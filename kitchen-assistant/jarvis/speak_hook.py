#!/usr/bin/env python3
"""Claude Code Stop hook: read Claude's last reply aloud with macOS `say`.

Claude Code passes JSON on stdin including `transcript_path` (a .jsonl file).
We take the last assistant text, strip markdown, and speak it in the background.
Set JARVIS_VOICE (e.g. "Samantha") and JARVIS_RATE (words/min) to tune.
"""
import json
import os
import re
import subprocess
import sys


def last_assistant_text(path):
    last = ""
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            msg = e.get("message") or {}
            if e.get("type") != "assistant" and msg.get("role") != "assistant":
                continue
            content = msg.get("content")
            if isinstance(content, str):
                text = content
            else:
                text = "\n".join(
                    b.get("text", "") for b in content or [] if isinstance(b, dict) and b.get("type") == "text"
                )
            if text.strip():
                last = text
    return last


def clean(t):
    t = re.sub(r"```.*?```", " ", t, flags=re.S)
    t = re.sub(r"`([^`]*)`", r"\1", t)
    t = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"https?://\S+", "", t)
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)
    t = re.sub(r"^\s*[-*•]\s+", "", t, flags=re.M)
    t = re.sub(r"[*_>|~]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def main():
    try:
        data = json.load(sys.stdin)
        text = clean(last_assistant_text(data["transcript_path"]))
    except Exception:
        return
    if not text:
        return
    subprocess.run(["pkill", "-x", "say"], check=False)  # cut off any earlier reply
    cmd = ["say", "-r", os.environ.get("JARVIS_RATE", "190")]
    if os.environ.get("JARVIS_VOICE"):
        cmd += ["-v", os.environ["JARVIS_VOICE"]]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, start_new_session=True)
    p.stdin.write(text[:4000].encode())
    p.stdin.close()


if __name__ == "__main__":
    main()
