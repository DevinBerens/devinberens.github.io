#!/usr/bin/env python3
"""Say "Hey Jarvis" -> presses double-tap Control (macOS Dictation) -> you talk ->
when you stop, dictation is stopped and Return is pressed so Claude Code gets it.

No API key: it only listens locally (openWakeWord) and sends keystrokes to your
terminal, where Claude Code (on your Pro plan) does the thinking.

Needs macOS permissions for your terminal app: Microphone, Accessibility,
Input Monitoring. See README.md.

Env knobs: TERMINAL_APP (default "Terminal"; e.g. "iTerm", "Ghostty", "Warp"),
THRESHOLD (0.5), SILENCE_SECS (1.8), MAX_SECS (30), SUBMIT (1/0),
STOP_MODE ("control" = double-tap Control again, "none" = just press Return),
TAP_GAP (0.12), AUDIO_INPUT_DEVICE.
"""
import os
import subprocess
import sys
import time

import numpy as np
import sounddevice as sd
from openwakeword.model import Model
from pynput.keyboard import Controller, Key

TERMINAL_APP = os.environ.get("TERMINAL_APP", "Terminal")
THRESHOLD = float(os.environ.get("THRESHOLD", "0.5"))
SILENCE_SECS = float(os.environ.get("SILENCE_SECS", "1.8"))
MAX_SECS = float(os.environ.get("MAX_SECS", "30"))
SUBMIT = os.environ.get("SUBMIT", "1") != "0"
STOP_MODE = os.environ.get("STOP_MODE", "control")
TAP_GAP = float(os.environ.get("TAP_GAP", "0.12"))
DEVICE = os.environ.get("AUDIO_INPUT_DEVICE") or None
RATE, CHUNK = 16000, 1280  # openWakeWord wants 80 ms frames of 16 kHz int16

kb = Controller()


def double_tap_control():
    for _ in range(2):
        kb.press(Key.ctrl)
        kb.release(Key.ctrl)
        time.sleep(TAP_GAP)


def focus_terminal():
    subprocess.run(
        ["osascript", "-e", f'tell application "{TERMINAL_APP}" to activate'],
        check=False,
        capture_output=True,
    )
    time.sleep(0.4)


def chime(name="Pop"):
    subprocess.Popen(
        ["afplay", f"/System/Library/Sounds/{name}.aiff"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def wait_for_speech_end(stream):
    """Block until you've spoken and then gone quiet. Adaptive to room noise."""
    subprocess.run(["pkill", "-x", "say"], check=False)  # stop talking so we don't hear ourselves
    start = time.time()
    noise = []
    spoke = False
    quiet_since = None
    while time.time() - start < MAX_SECS:
        audio, _ = stream.read(CHUNK)
        level = float(np.sqrt(np.mean(audio.astype(np.float32) ** 2)))
        if len(noise) < 12:  # first ~1s calibrates the noise floor
            noise.append(level)
            continue
        floor = max(np.median(noise), 50.0)
        if level > floor * 2.5:
            spoke, quiet_since = True, None
        elif spoke:
            quiet_since = quiet_since or time.time()
            if time.time() - quiet_since >= SILENCE_SECS:
                return True
    return spoke


def main():
    model = Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")
    print("Listening for 'Hey Jarvis'… (Ctrl+C to quit)")
    with sd.InputStream(samplerate=RATE, channels=1, dtype="int16", blocksize=CHUNK, device=DEVICE) as stream:
        cooldown = 0.0
        while True:
            audio, _ = stream.read(CHUNK)
            scores = model.predict(audio[:, 0])
            if max(scores.values()) < THRESHOLD or time.time() < cooldown:
                continue
            model.reset()
            print("Wake word heard")
            chime("Pop")
            focus_terminal()
            double_tap_control()  # start macOS Dictation
            if wait_for_speech_end(stream):
                if STOP_MODE == "control":
                    double_tap_control()  # stop Dictation
                    time.sleep(0.5)
                if SUBMIT:
                    kb.press(Key.enter)
                    kb.release(Key.enter)
                chime("Tink")
            else:  # heard nothing: cancel dictation
                if STOP_MODE == "control":
                    double_tap_control()
            cooldown = time.time() + 2.0


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
