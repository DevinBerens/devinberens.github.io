# 🍳 Recipe Box

A simple **shared recipe app**. Add the cooks in your group (just names — no
accounts, no passwords), then add recipes under each person. Most recipes come
straight from a photo: snap a picture of a page in a recipe book and the app
reads the text off it automatically. You can also type a recipe in by hand.

It's a single static `index.html` hosted on GitHub Pages. Recipes sync across
everyone's phones through a free **Firebase / Cloud Firestore** project. Text is
pulled from photos right in the browser using **Tesseract.js** — no server, no
API keys for OCR.

---

## What you can do

- **Groups** — create a group (e.g. "The Berens Family") and add people by name.
- **Add a recipe from a photo** — pick the cook, snap/upload a photo of the
  recipe-book page, and the app OCRs the text into an editable box. Fix anything
  that came out wrong, give it a title, and save.
- **Add a recipe by hand** — skip the photo and just type it in.
- **Browse** — recipes are listed per group and can be filtered by cook.
- **Edit / delete** any recipe.

Everything is live-synced, so when one person adds a recipe it shows up on
everyone else's phone.

---

## One-time setup (Firebase)

The app needs a free Firebase project so recipes are shared across phones.

1. Go to <https://console.firebase.google.com> and **Add project** (the free
   "Spark" plan is plenty).
2. In the project, click the **Web** icon (`</>`) to register a web app. Copy
   the `firebaseConfig` object it shows you.
3. In the left sidebar open **Build → Firestore Database → Create database**.
   Start in **test mode** for now (see the security note below).
4. Open `index.html` in this repo, find the `FIREBASE_CONFIG` block near the
   bottom (inside the `<script type="module">`), and paste your values in place
   of the `PASTE_...` placeholders:

   ```js
   const FIREBASE_CONFIG = {
     apiKey: "…",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "…",
     appId: "…",
   };
   ```

5. Commit and push. GitHub Pages serves it at
   <https://devinberens.github.io>.

Until the config is filled in, the app shows a friendly setup screen instead of
crashing.

### Security: protecting your project

The web config in `index.html` is **public by design** — Firebase keys identify
your project, they aren't secrets, and there's no way to hide them on a static
site (the browser downloads the page). What actually protects you is the two
locks below. Both are quick and free.

**1. Restrict the API key to your domain** (so the key only works on your site):

- Go to <https://console.cloud.google.com/apis/credentials> (same Google
  account; pick the `recipe-box-…` project).
- Click the **Browser key (auto created by Firebase)**.
- Under **Application restrictions** choose **Websites** and add:
  - `devinberens.github.io/*`
  - `localhost/*` (optional, for local testing)
- Save. Now the key is useless if someone copies it elsewhere.

**2. Lock the database with rules + anonymous auth.** The app signs in
anonymously, so every real request carries an auth token; bots hitting the DB
with just the config are rejected.

- In the Firebase console: **Build → Authentication → Get started →
  Sign-in method → Anonymous → Enable.** *(Required — the app shows a lock
  screen until this is on.)*
- Then **Build → Firestore Database → Rules**, paste the contents of
  [`firestore.rules`](firestore.rules), and **Publish**. This replaces the
  temporary 30-day "test mode" with permanent rules, so you don't have to worry
  about the test-mode expiry.

There is intentionally **no user login** — that was the whole point — so anyone
you share the URL with can read and add recipes. Treat it like a shared
notebook.

---

## Running it locally

It's just static files, so any static server works:

```bash
npm start          # runs `npx serve .`
# or
python3 -m http.server 8000
```

Then open the printed URL. The camera/photo picker works best on a real phone.

---

## How the data is stored

```
Firestore
└── groups (collection)
    └── <groupId>
        ├── name:      "The Berens Family"
        ├── members:   ["Devin", "Mom", "Grandma"]
        └── recipes (subcollection)
            └── <recipeId>
                ├── author:    "Grandma"
                ├── title:     "Apple Pie"
                ├── content:   "…full recipe text…"
                └── createdAt
```

Photos themselves aren't stored — only the text read from them — so there's
nothing to clean up and the free tier goes a long way.

---

## Files

| File         | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `index.html` | The entire app (UI, Firebase sync, Tesseract.js OCR).          |
| `.nojekyll`  | Tells GitHub Pages to serve the HTML as-is (no Jekyll).        |
| `package.json` | Just a name + a `start` script for local serving.            |

---

## Adding it to your phone's home screen

1. Open Safari/Chrome on your phone and go to <https://devinberens.github.io>.
2. Share → **Add to Home Screen**.
3. Name it "Recipe Box". It'll behave like a native app, full-screen.
