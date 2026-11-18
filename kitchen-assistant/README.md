# Kitchen assistant

Voice assistant for the Recipe Box app. It reads and saves recipes in the same
Firestore database the website uses, so nothing on the site changes and no
existing recipes are touched unless you ask it to save a new one.

Runs on a **Mac** (no hardware to buy) or a **Raspberry Pi**. See `parts.json`.

## Setup on a Mac

```bash
git clone https://github.com/DevinBerens/devinberens.github.io
cd devinberens.github.io/kitchen-assistant
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -c "import openwakeword.utils as u; u.download_models()"   # wake word models
cp .env.example .env   # fill in your keys and group name
set -a; source .env; set +a
python kitchen_assistant.py
```

- Open <https://devinberens.github.io> in a browser next to it for the recipes.
- The first run asks for **microphone access** (System Settings > Privacy &
  Security > Microphone, for Terminal or your editor). Run it from a terminal
  app that has that permission.
- Speech uses the Mac's built-in `say` voice by default. Change it with
  `SAY_VOICE=Samantha` (list voices with `say -v '?'`), or install `piper-tts`
  and set `TTS=piper` for a more natural voice.
- Wrong microphone? Run `python -m sounddevice` to list devices, then set
  `AUDIO_INPUT_DEVICE=<number or name>`.
- Laptop speakers can feed back into the mic. Headphones, or lowering the
  volume, help if it keeps hearing itself.

Say **"Hey Jarvis"** to wake it. If the wake-word model can't load, it falls back
to pressing Enter to talk.

## Setup on a Raspberry Pi

```bash
sudo apt install -y alsa-utils python3-venv
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt piper-tts
python -c "import openwakeword.utils as u; u.download_models()"
# Download a Piper voice (e.g. en_US-lessac-medium .onnx + .onnx.json) next to the script.
cp .env.example .env && set -a && source .env && set +a
python kitchen_assistant.py
```

For a kitchen display, run Chromium in kiosk mode:
`chromium-browser --kiosk https://devinberens.github.io`

## Notes

- The Firebase web API key is public by design (it's already in `index.html`).
  Your **Anthropic key must stay in `.env`** (gitignored), never in the repo.
- Auth is Firestore anonymous sign-in, matching `firestore.rules`.
- Starter code, not tested on a Mac or a Pi yet. Tune `threshold` in
  `record_until_silence` for your mic and room noise.
- Wake word is the stock `hey_jarvis` model (non-commercial license, fine for home
  use). `WAKE_MODEL=` (empty) switches to a Whisper-based "Hey Chef" listener, which
  needs no training but is less reliable than a real wake-word model.
