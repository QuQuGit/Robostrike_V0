# Deploying Robostrike (GitHub → Vercel + Render + MongoDB Atlas + Resend)

## 1. MongoDB Atlas
1. Create a cluster (the free M0 tier is enough to start).
2. Database Access → create a user with a password.
3. Network Access → allow `0.0.0.0/0` (Render has no fixed IP on the cheaper plans).
4. Copy the `mongodb+srv://...` connection string → this is `MONGO_URL`.

## 2. Render (backend FastAPI + WebSocket)
- New → Blueprint → select the repo: `render.yaml` (at the repo root) creates the `robostrike-api` service.
  - or manually: Web Service, Root Directory `backend`, Build `pip install -r requirements.txt`,
    Start `uvicorn server:app --host 0.0.0.0 --port $PORT --workers 1`.
- Variables (see `backend/.env.example`):
  | Variable | Value |
  |---|---|
  | `MONGO_URL` | Atlas connection string |
  | `DB_NAME` | `robostrike` |
  | `JWT_SECRET` | long random string (DO NOT reuse the preview one) |
  | `CORS_ORIGINS` | `https://robostrike.app,https://www.robostrike.app` (+ the `*.vercel.app` URL if needed) |
  | `FRONTEND_URL` | `https://robostrike.app` (used in the email links) |
  | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | admin account created on first start |
  | `RESEND_API_KEY` | Resend API key |
  | `EMAIL_FROM` | `Robostrike <noreply@robostrike.app>` |
- **Keep 1 single instance / 1 worker**: online rooms are kept in the server's memory.
  A restart (redeploy, or the free plan going to sleep) ends the games in progress.
  The free plan goes to sleep after 15 min of inactivity → the Starter plan is recommended.
- Health check: `GET /api/` → `{"message": "Robostrike API online"}`.

## 3. Vercel (React frontend)
- Import the repo, **Root Directory = `frontend`** (the `vercel.json` handles build + SPA rewrites).
- Variable: `REACT_APP_BACKEND_URL` = Render URL (e.g. `https://robostrike-api.onrender.com`), without a trailing `/`.
  It is baked in at build time: redeploy after changing it.
- Domain: add `robostrike.app` in Vercel → Domains.
- WebSockets go straight to Render (`wss://<render>/api/ws/rooms/...`), nothing to configure on Vercel.

## 4. Resend
1. Domains → add `robostrike.app`, add the DNS records (SPF/DKIM) shown, wait until it is "Verified".
2. API Keys → create a key (Sending access) → `RESEND_API_KEY` on Render.
3. Without a key the backend does not send anything and writes the link to its logs (dev mode).

## 5. Checks after deployment
- `https://robostrike.app/robots.txt` and `/sitemap.xml` respond.
- Registration → confirmation email received → the link opens `/verify-email` and logs you in.
- "Mot de passe oublié" → email → `/reset-password`.
- Create a room in 2 browsers → the WebSocket connects (no CORS error in the console).
- Google Analytics (G-W0DNHTE9RB) → "Realtime" report.

## Security
- The `.env` files of the Emergent preview are versioned: if the repo is public, **change `JWT_SECRET`,
  `ADMIN_PASSWORD`** and use different values on Render. Do not put real keys in `.env.example`.
