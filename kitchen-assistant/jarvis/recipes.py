#!/usr/bin/env python3
"""Read-only recipe lookup for Claude Code (no API key needed).

Usage:
  python3 recipes.py list
  python3 recipes.py get "chicken"      # title substring match, prints full recipe text

Reads the Recipe Box Firestore (same data as the website) over REST using the
site's public web key and anonymous sign-in.
"""
import json
import os
import sys
import urllib.request

API_KEY = os.environ.get("FIREBASE_API_KEY", "AIzaSyBiFMsKH1ffDL2EjBT3aKKDdLtr5YXk43o")
PROJECT = os.environ.get("FIREBASE_PROJECT_ID", "recipe-box-80abe")
GROUP = os.environ.get("GROUP_NAME", "").strip().lower()
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"


def _req(url, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def _str(doc, field):
    return doc.get("fields", {}).get(field, {}).get("stringValue", "")


def _list(path, token):
    out, page = [], None
    while True:
        url = f"{BASE}/{path}?pageSize=300" + (f"&pageToken={page}" if page else "")
        data = _req(url, token=token)
        out += data.get("documents", [])
        page = data.get("nextPageToken")
        if not page:
            return out


def load():
    token = _req(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}",
        {"returnSecureToken": True},
    )["idToken"]
    groups = _list("groups", token)
    if GROUP:
        groups = [g for g in groups if _str(g, "name").strip().lower() == GROUP] or groups
    recipes = []
    for g in groups:
        gid = g["name"].split("/")[-1]
        for d in _list(f"groups/{gid}/recipes", token):
            recipes.append((_str(d, "title"), _str(d, "author"), _str(d, "content")))
    return sorted(recipes, key=lambda r: r[0].lower())


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("list", "get"):
        sys.exit(__doc__)
    recipes = load()
    if sys.argv[1] == "list":
        for title, author, _ in recipes:
            print(f"- {title}" + (f" (by {author})" if author else ""))
        return
    q = " ".join(sys.argv[2:]).lower()
    hits = [r for r in recipes if q in r[0].lower()]
    if not hits:
        sys.exit(f"No recipe matching {q!r}. Try: list")
    for title, author, content in hits:
        print(f"# {title}\n{content}\n")


if __name__ == "__main__":
    main()
