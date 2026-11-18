#!/usr/bin/env python3
"""Voice kitchen assistant for the Recipe Box app (devinberens.github.io).

Loop: wake word (or press Enter) -> record -> faster-whisper -> Claude (tool use)
-> Piper TTS -> speaker. Recipes are read from / saved to the same Firestore
database the web app uses, via the REST API with an anonymous sign-in
(matching firestore.rules, which only require request.auth != null).

Recipe docs look like: {author, title, content (free text), createdAt}.
Groups look like: {name, members[], createdAt}.

Untested on hardware: treat this as a starter and expect to tune audio.
"""
import datetime
import os
import re
import subprocess
import tempfile
import threading
import wave

import anthropic
import numpy as np
import requests
import sounddevice as sd
from faster_whisper import WhisperModel

# ── Config (env vars; see .env.example) ──────────────────────────────────────
FIREBASE_API_KEY = os.environ["FIREBASE_API_KEY"]  # public web config key
PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "recipe-box-80abe")
GROUP_NAME = os.environ["GROUP_NAME"]  # name of your group in the app
AUTHOR = os.environ.get("AUTHOR", "Devin")  # author for recipes the agent saves
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
PIPER_VOICE = os.environ.get("PIPER_VOICE", "en_US-lessac-medium.onnx")
ENABLE_WEB_SEARCH = os.environ.get("ENABLE_WEB_SEARCH", "1") == "1"
# Wake word. Default: openWakeWord's stock "hey_jarvis" model. Other stock
# models: alexa, hey_mycroft, hey_rhasspy; or a path to a custom .onnx model.
# Set WAKE_MODEL to an empty string to instead listen for the phrase "Hey Chef"
# with a tiny Whisper model (no training needed, but less reliable).
WAKE_MODEL = os.environ.get("WAKE_MODEL", "hey_jarvis")
WAKE_RE = re.compile(r"\b(?:hey|hay|hi|okay|ok|a)[\s,.!-]*(?:chef|shef|chief)\b[\s,.!-]*(.*)", re.I | re.S)

SR = 16000
FS_BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

SYSTEM = (
    "You are a hands-free kitchen assistant speaking out loud to a home cook. "
    "Reply in short, natural spoken sentences: no markdown, no lists, no emojis. "
    "Use the recipe tools to look up the user's saved recipes before suggesting "
    "outside ones. When reading a recipe, give ONE step at a time and wait for "
    "the user to say next, back or repeat. Use set_timer for any timing request. "
    "Only save a recipe when the user asks you to."
)

# ── Firestore (REST + anonymous auth) ────────────────────────────────────────
_token = {"id": None}
_group_id = {"id": None}


def _sign_in():
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_API_KEY}",
        json={"returnSecureToken": True},
        timeout=15,
    )
    r.raise_for_status()
    _token["id"] = r.json()["idToken"]


def _fs(method, path, **kw):
    for attempt in (1, 2):  # retry once with a fresh token (tokens expire hourly)
        if not _token["id"]:
            _sign_in()
        r = requests.request(
            method,
            f"{FS_BASE}/{path}",
            headers={"Authorization": f"Bearer {_token['id']}"},
            timeout=15,
            **kw,
        )
        if r.status_code in (401, 403) and attempt == 1:
            _token["id"] = None
            continue
        r.raise_for_status()
        return r.json()


def _s(doc, field):
    return doc.get("fields", {}).get(field, {}).get("stringValue", "")


def group_id():
    if _group_id["id"]:
        return _group_id["id"]
    docs = _fs("GET", "groups", params={"pageSize": 100}).get("documents", [])
    for d in docs:
        if _s(d, "name").strip().lower() == GROUP_NAME.strip().lower():
            _group_id["id"] = d["name"].split("/")[-1]
            return _group_id["id"]
    raise RuntimeError(f"No group named {GROUP_NAME!r}. Found: {[_s(d, 'name') for d in docs]}")


def fetch_recipes():
    out, token = [], None
    while True:
        params = {"pageSize": 300}
        if token:
            params["pageToken"] = token
        data = _fs("GET", f"groups/{group_id()}/recipes", params=params)
        for d in data.get("documents", []):
            out.append(
                {
                    "id": d["name"].split("/")[-1],
                    "title": _s(d, "title"),
                    "author": _s(d, "author"),
                    "content": _s(d, "content"),
                }
            )
        token = data.get("nextPageToken")
        if not token:
            return out


def tool_list_recipes(query=""):
    words = query.lower().split()
    hits = []
    for r in fetch_recipes():
        hay = f"{r['title']} {r['content']}".lower()
        if all(w in hay for w in words):
            hits.append({"id": r["id"], "title": r["title"], "author": r["author"]})
    return hits[:15] or "No matching recipes."


def tool_get_recipe(recipe_id):
    for r in fetch_recipes():
        if r["id"] == recipe_id:
            return r
    return "Recipe not found."


def tool_save_recipe(title, content):
    body = {
        "fields": {
            "author": {"stringValue": AUTHOR},
            "title": {"stringValue": title},
            "content": {"stringValue": content},
            "createdAt": {"timestampValue": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
        }
    }
    _fs("POST", f"groups/{group_id()}/recipes", json=body)
    return "Saved."


def tool_set_timer(minutes, label="timer"):
    def done():
        speak(f"Your {label} timer is done.")

    t = threading.Timer(float(minutes) * 60, done)
    t.daemon = True
    t.start()
    return f"Timer set for {minutes} minutes."


TOOLS = [
    {
        "name": "list_recipes",
        "description": "Search the user's saved recipes by words in the title or content. Empty query lists the most recent.",
        "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}},
    },
    {
        "name": "get_recipe",
        "description": "Get the full text of one saved recipe by id.",
        "input_schema": {"type": "object", "properties": {"recipe_id": {"type": "string"}}, "required": ["recipe_id"]},
    },
    {
        "name": "save_recipe",
        "description": "Save a new recipe to the user's recipe box. Content is plain text: ingredients as '- item' lines, then the steps.",
        "input_schema": {
            "type": "object",
            "properties": {"title": {"type": "string"}, "content": {"type": "string"}},
            "required": ["title", "content"],
        },
    },
    {
        "name": "set_timer",
        "description": "Start a kitchen timer that announces out loud when done.",
        "input_schema": {
            "type": "object",
            "properties": {"minutes": {"type": "number"}, "label": {"type": "string"}},
            "required": ["minutes"],
        },
    },
]
if ENABLE_WEB_SEARCH:
    # Server-side web search for finding new recipes. Check the Anthropic docs
    # for the current tool version string if this errors.
    TOOLS.append({"type": "web_search_20250305", "name": "web_search", "max_uses": 3})

HANDLERS = {
    "list_recipes": tool_list_recipes,
    "get_recipe": tool_get_recipe,
    "save_recipe": tool_save_recipe,
    "set_timer": tool_set_timer,
}

# ── Audio in / out ───────────────────────────────────────────────────────────
_whisper = None
_speak_lock = threading.Lock()


def speak(text):
    if not text.strip():
        return
    with _speak_lock, tempfile.NamedTemporaryFile(suffix=".wav") as f:
        subprocess.run(["piper", "--model", PIPER_VOICE, "--output_file", f.name], input=text.encode(), check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["aplay", "-q", f.name], check=False)


def record_until_silence(max_s=15, silence_s=1.0, threshold=500):
    """Record 16 kHz mono until `silence_s` of quiet after speech starts."""
    chunks, quiet, started = [], 0.0, False
    block = int(SR * 0.1)
    with sd.InputStream(samplerate=SR, channels=1, dtype="int16", blocksize=block) as stream:
        for _ in range(int(max_s / 0.1)):
            data, _ = stream.read(block)
            chunks.append(data.copy())
            loud = np.abs(data).mean() > threshold
            if loud:
                started, quiet = True, 0.0
            elif started:
                quiet += 0.1
                if quiet >= silence_s:
                    break
    return np.concatenate(chunks).flatten()


_whisper = {}


def transcribe(audio_i16, size="base.en"):
    if size not in _whisper:
        _whisper[size] = WhisperModel(size, compute_type="int8")
    segs, _ = _whisper[size].transcribe(audio_i16.astype(np.float32) / 32768.0, language="en")
    return " ".join(s.text.strip() for s in segs).strip()


def _listen_phrase_for_chef(threshold=500):
    """Block until someone says 'Hey Chef'. Whisper only runs on bursts of
    speech, so the Pi stays idle in a quiet kitchen. Returns anything said
    after the wake phrase (e.g. 'hey chef set a timer' -> 'set a timer')."""
    block = int(SR * 0.1)
    with sd.InputStream(samplerate=SR, channels=1, dtype="int16", blocksize=block) as stream:
        while True:
            data, _ = stream.read(block)
            if np.abs(data).mean() <= threshold:
                continue
            chunks, quiet = [data.copy()], 0.0
            while len(chunks) < 50 and quiet < 0.6:  # up to ~5 s, ends on 0.6 s of quiet
                data, _ = stream.read(block)
                chunks.append(data.copy())
                quiet = 0.0 if np.abs(data).mean() > threshold else quiet + 0.1
            text = transcribe(np.concatenate(chunks).flatten(), "tiny.en")
            m = WAKE_RE.search(text)
            if m:
                return m.group(1).strip()


def wait_for_wake():
    """Block until the wake word is heard; return any command spoken with it.
    Falls back to pressing Enter if nothing else is available."""
    if not WAKE_MODEL:
        return _listen_phrase_for_chef()
    try:
        from openwakeword.model import Model

        oww = Model(wakeword_models=[WAKE_MODEL])
    except Exception:
        input("Press Enter to talk... ")
        return ""
    with sd.InputStream(samplerate=SR, channels=1, dtype="int16", blocksize=1280) as stream:
        while True:
            data, _ = stream.read(1280)
            scores = oww.predict(data.flatten())
            if max(scores.values()) > 0.5:
                return ""


# ── Claude loop ──────────────────────────────────────────────────────────────
client = anthropic.Anthropic()


def ask_claude(messages):
    while True:
        resp = client.messages.create(model=MODEL, max_tokens=800, system=SYSTEM, tools=TOOLS, messages=messages)
        messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")
        results = []
        for b in resp.content:
            if b.type == "tool_use":
                try:
                    out = HANDLERS[b.name](**b.input)
                except Exception as e:  # keep the conversation alive
                    out = f"Tool error: {e}"
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": str(out)})
        messages.append({"role": "user", "content": results})


def main():
    messages = []
    speak("Kitchen assistant ready.")
    while True:
        text = wait_for_wake()
        if not text:
            speak("Yes?")
            text = transcribe(record_until_silence())
        if not text:
            continue
        print("You:", text)
        if text.lower().strip(" .!") in {"stop", "goodbye", "that's all", "thats all"}:
            messages.clear()
            speak("Okay.")
            continue
        messages.append({"role": "user", "content": text})
        reply = ask_claude(messages)
        print("Chef:", reply)
        speak(reply)
        # Keep the follow-ups flowing without re-saying the wake word.
        while True:
            text = transcribe(record_until_silence(max_s=8))
            if not text or text.lower().strip(" .!") in {"stop", "goodbye", "that's all", "thats all"}:
                break
            print("You:", text)
            messages.append({"role": "user", "content": text})
            reply = ask_claude(messages)
            print("Chef:", reply)
            speak(reply)


if __name__ == "__main__":
    main()
