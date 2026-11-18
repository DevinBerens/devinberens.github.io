# Hey Jarvis -> Claude Code (no API key)

Say "Hey Jarvis" and your Mac does what double-tapping Control does (macOS Dictation into your terminal), then submits when you stop talking. Claude Code (included in Claude Pro) answers, and a Stop hook reads the reply aloud with `say`. Nothing here calls the paid API.

## One-time setup (Mac)
1. macOS Settings > Keyboard > Dictation: turn on, set shortcut to "Press Control key twice".
2. `cd kitchen-assistant/jarvis && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
3. First run downloads the wake-word model: `python3 -c "import openwakeword; openwakeword.utils.download_models()"`
4. Grant your terminal app Microphone, Accessibility, and Input Monitoring (System Settings > Privacy & Security). Restart the terminal after.

## Run
- Terminal tab 1: `claude` (run it from this `jarvis` folder so CLAUDE.md and the speak hook load; approve the project hook when asked).
- Terminal tab 2 (or a different app): `source .venv/bin/activate && TERMINAL_APP=Terminal python3 jarvis.py`
  Keep Claude Code's terminal as the frontmost window of `TERMINAL_APP`.
- Say "Hey Jarvis, read me the first recipe." Listen for the Pop chime, speak, and a Tink means it was sent.

## Tuning (env vars)
`THRESHOLD` (0.5, raise if it false-triggers), `SILENCE_SECS` (1.8), `TERMINAL_APP`, `STOP_MODE=none` if dictation already ends on its own, `SUBMIT=0` to review before sending, `JARVIS_VOICE` / `JARVIS_RATE` for the spoken voice (`say -v ?` lists voices).

## Caveats
Untested on a real Mac so far. If dictation doesn't stop cleanly, try `STOP_MODE=none`. Speaker output can retrigger the mic; the script silences speech when it wakes. openWakeWord models are non-commercial licensed (fine for personal use).
