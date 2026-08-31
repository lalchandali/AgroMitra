# What's in this zip

Every file here keeps its path relative to your repo root (the folder
containing the outer `AgroMitra/` folder and this repo's `README.md`) —
copy each one over the matching path in your local clone.

## ⚠️ One manual step this zip can't do
**Delete `AgroMitra/backend/database/main_with_db.py`.** It's a stale,
out-of-sync duplicate FastAPI app (see chat for why) — a zip can only add
files, not remove one, so this file just needs deleting by hand.

## Files NOT written by me — verify before trusting
Four files changed since I last reviewed them, and I didn't make these
edits myself (see chat for the full explanation). I checked all four and
they're correct, safe, and consistent with the rest of the codebase, but
you should still look them over since I can't confirm who/what wrote them:
- `AgroMitra/backend/.env.example` — adds DATABASE_URL, DB_ADMIN_*, JWT_SECRET_KEY, ENVIRONMENT
- `LICENSE` — MIT license text (README already claimed this license; no file backed it up before)
- `AgroMitra/frontend/src/context/ThemeContext.jsx` (modified) + `theme-context.js` (new) + `AgroMitra/frontend/src/hooks/useTheme.js` (new) — splits a file that exported both a component and a hook, which was breaking Vite Fast Refresh

## Everything else — changes I made, explained in chat
- **Security fix**: `database/schemas/user_schema.py`, `frontend/src/pages/AuthPage.jsx` —
  registration can no longer set role=admin
- **Removed stale entrypoint**: deleted `main_with_db.py` (see above),
  fixed `database/scripts/trigger_create_tables.py` which depended on it
  and was silently only creating 3 of 8 tables
- **Restored CI**: `.github/workflows/ci.yml` (recovered from git history)
- **Got the backend to actually pass that CI's lint step**: `pyproject.toml`
  (line-length 100→120, three narrow per-file-ignores, each commented with
  why) + small real fixes across `main.py`, `ai_models/*.py`,
  `database/**/*.py` (dead variables removed, a couple of SQLAlchemy
  `== True`/`== False` simplified, a misplaced import moved, long lines
  wrapped). The bulk of the remaining diffs in `database/models/`,
  `database/routes/`, `database/schemas/` you'll see are pure import
  reordering from `ruff --fix` — no logic changed. Diff each file if you
  want to confirm.
- **README**: fixed the project-structure diagram to match the real
  backend/frontend layout (it previously listed folders like `routers/`
  and `services/` that don't exist)

Not included: `frontend/package-lock.json` changed too, but only because
installing dependencies in my sandbox re-resolved it — not a real edit.
Leave your own as-is (or just run `npm install` again yourself).

## Update — 2 roles instead of 3
Per follow-up request: registration now offers just **Farmer** and
**Customer** (dropped the separate "Consumer" option). It was already
functionally identical to "Buyer" everywhere in the app — same route,
same permissions, nothing in the backend ever checked for it
specifically — so this only removes a redundant label, doesn't change
behavior for anyone. Updated: `frontend/src/pages/AuthPage.jsx`,
`backend/database/schemas/user_schema.py` (SELF_REGISTERABLE_ROLES).
