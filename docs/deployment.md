# Deploying TrueTrace (Render + Netlify, free tier)

Three services, two hosts:

- **truetrace-detector** (Render) — the ML service. Private: only truetrace-api
  can call it, via a shared secret.
- **truetrace-api** (Render) — the FastAPI backend. Public.
- **web** (Netlify) — the Next.js frontend. Public.

I cannot log into Render or Netlify as you — both need your own account and
GitHub authorization. Everything below is the steps to do that yourself.

## 1. Push to GitHub first

Both platforms deploy by connecting to the GitHub repo, so it needs to be
current:
```bash
git push
```

## 2. Render — deploy both backend services via Blueprint

1. Go to [dashboard.render.com](https://dashboard.render.com), sign in
   (GitHub OAuth is easiest), and connect this repo if you haven't already.
2. **New → Blueprint**, pick this repo. Render reads `render.yaml` at the
   repo root and proposes both services (`truetrace-detector`, `truetrace-api`).
3. Apply it. Both services will start building — the detector one will take
   several minutes (torch + mediapipe are large).
4. Once **truetrace-detector** is live, open its page and copy:
   - Its URL (top of the page, `https://truetrace-detector-XXXX.onrender.com`)
   - The auto-generated `DETECTOR_SHARED_SECRET` value, under Environment
5. On **truetrace-api**'s Environment tab, fill in the `sync: false` vars
   `render.yaml` left blank:
   - `DETECTOR_URL` = the detector URL from step 4
   - `DETECTOR_SHARED_SECRET` = the exact same secret value from step 4
   - `EVIDENCE_KEY`, `AUTH_SECRET`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID` = the
     same values already in your local `.env`
   - `ALLOWED_ORIGINS` — leave as `http://localhost:3000` for now; you'll
     update this once the Netlify URL exists (step 4 below)
6. Still on **truetrace-api**, add a **Secret File**: path
   `/etc/secrets/firestore-key.json`, contents = the key file I'm sending you
   separately (`firestore-key.json`). This is what lets it reach Firestore —
   Render has no equivalent to Cloud Run's automatic credentials.
   **After uploading it, delete the local copy of that file** — it only
   needs to exist on your machine long enough to paste into Render.
7. Save — truetrace-api redeploys with the new config. Check its `/healthz`
   URL once it's up.

## 3. Netlify — deploy the frontend

1. Go to [app.netlify.com](https://app.netlify.com), sign in, **Add new site
   → Import an existing project**, pick this repo.
2. Set **Base directory** to `apps/web` (this is a monorepo — Netlify needs
   to know where the Next.js app actually lives). It should auto-detect
   `apps/web/netlify.toml` from there.
3. **Before the first build**, add an environment variable:
   `NEXT_PUBLIC_API_URL` = the truetrace-api URL from step 5 above.
   This has to be set before building — it's baked into the browser bundle
   at build time, not read later.
4. Deploy. Once live, copy the site's URL.

## 4. Close the loop: tell the API about the frontend's origin

Back on Render, **truetrace-api → Environment**, set:
- `ALLOWED_ORIGINS` = the Netlify URL from step 3.4 (exactly, including
  `https://`, no trailing slash)

Save — this redeploys truetrace-api. Without this, the browser's requests
from the Netlify site will be blocked by CORS.

## 5. Verify

Open the Netlify URL, sign up, start a case with a real link and a photo,
and confirm it completes. If something fails, check truetrace-api's logs
first (Render dashboard → Logs) — most first-deploy issues are a missed or
mistyped env var from steps 2 or 4.

## Cost

Both platforms' free tiers cover this at personal/demo scale:
- Render free web services sleep after 15 minutes idle and wake on the next
  request (expect a slow first response, ~30-60s, after any idle period —
  this is normal, not a bug)
- Netlify's free tier is generous for a low-traffic site
- Firestore's free tier (already in use) comfortably covers this too

Nothing here should generate a bill. If Render's free tier ever proves too
small (detector needs real memory for torch/mediapipe), that will show up
as the service failing to start or crashing under load, not as a surprise
charge — free-tier services don't auto-upgrade to paid.
