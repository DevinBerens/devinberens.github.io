# Kitchen assistant (Raspberry Pi)

Voice assistant for the Recipe Box app. It reads and saves recipes in the same
Firestore database the website uses, so nothing on the site changes and no
existing recipes are touched unless you ask it to save a new one.

See `parts.json` for the shopping list.

## Setup on the Pi

```bash
sudo apt install -y alsa-utils python3-venv
python3 -m venv .venv && source .venv/bin/activate
pip install anthropic requests numpy sounddevice faster-whisper openwakeword piper-tts
python -c "import openwakeword.utils as u; u.download_models()"   # wake word models
# Download a Piper voice (e.g. en_US-lessac-medium .onnx + .onnx.json) next to the script.
cp .env.example .env   # fill in, then: set -a; source .env; set +a
python kitchen_assistant.py
```

Say **"Hey Jarvis"** to wake it. If the wake-word model can't load, it falls back
to pressing Enter to talk.

## Display

Run Chromium in kiosk mode pointed at the recipe site:

```bash
chromium-browser --kiosk https://devinberens.github.io
```

## Notes

- The Firebase web API key is public by design (it's already in `index.html`).
  Your **Anthropic key must stay in `.env`** (gitignored), never in the repo.
- Auth is Firestore anonymous sign-in, matching `firestore.rules`.
- Starter code, not tested on hardware. Tune `threshold` in
  `record_until_silence` for your mic and kitchen noise.
- Wake word is the stock `hey_jarvis` model (non-commercial license, fine for home
  use). `WAKE_MODEL=` (empty) switches to a Whisper-based "Hey Chef" listener, which
  needs no training but is less reliable than a real wake-word model.
