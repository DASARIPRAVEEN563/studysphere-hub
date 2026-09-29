# Deploy STUDENTS KA NOTES SHARING HUB

## What goes where

| Piece | Deploy target | Why |
|-------|---------------|-----|
| **React frontend** | **Lovable Publish** (one-click) | The project is built with TanStack Start + the Lovable Vite config, which outputs a Cloudflare Worker. |
| **Flask backend** | **Render** | Standard Python service. `render.yaml`, `runtime.txt`, and a bridge so data survives restarts. |
| **Database** | **Lovable Cloud / Supabase** | Kept as you requested. |
| **Files** | **Google Drive** | Kept as you requested. |

Current backend URL: `https://sknsh-backend.onrender.com`

---

## 1. Backend → Render

### 1.1 Create the Render service

1. Go to [render.com](https://render.com) → **New** → **Web Service** → connect your GitHub repo.
   (Or **New** → **Blueprint** — it reads `backend/render.yaml`, already in the repo.)
2. **Root Directory**: `backend`
3. **Language / Environment**: `Python 3`
4. **Build Command**: `pip install -r requirements.txt`
5. **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
6. **Health Check Path**: `/api/health`
7. Deploy, then test:
   ```bash
   curl https://sknsh-backend.onrender.com/api/health
   ```

### 1.2 Add these variables in Render → Environment

```env
# Flask
FLASK_DEBUG=0
JWT_SECRET=<generate a long random string>
JWT_EXPIRES_HOURS=24

# CORS: put your final frontend URL here.
CORS_ORIGINS=https://sknsh-by-pd.lovable.app

# Bootstrap admin account
ADMIN_ID=ADMIN001
ADMIN_PASSWORD=<strong password>
ADMIN_NAME=Portal Administrator

# Persistence bridge (Lovable Cloud does NOT expose a Supabase service-role key,
# so Flask writes through the published frontend instead)
APP_BRIDGE_URL=https://sknsh-by-pd.lovable.app
BACKEND_BRIDGE_SECRET=<same value saved in Lovable secrets>

# Lovable Google Drive connector (already set in your project secrets)
LOVABLE_API_KEY=<your secret>
GOOGLE_DRIVE_API_KEY=<your secret>
DRIVE_ROOT_FOLDER=STUDENTS KA NOTES SHARING HUB

# Uploads
MAX_UPLOAD_MB=25

# SMTP for face-verification emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=studentsnotessharing@gmail.com
SMTP_PASSWORD=<Gmail app password>
SMTP_FROM=studentsnotessharing@gmail.com

# Permanent master admin
MASTER_ADMIN_ID=PRAVEEN2207
MASTER_ADMIN_PASSWORD=PRAVEEN2204
```

> **Important:** Lovable Cloud does **not** expose `SUPABASE_SERVICE_ROLE_KEY`. The Flask app persists by calling `/api/public/state` on the published frontend. Both sides must share the same `BACKEND_BRIDGE_SECRET`.

**Free-tier note:** the Render free service sleeps after ~15 minutes of inactivity. The first request after sleep takes ~30–60 seconds to wake; after that it is fast until it idles again.

---

## 2. Frontend → Lovable Publish

1. In the Lovable editor, click **Publish** (top right on desktop, bottom-right in preview).
2. This builds and deploys the React app to a Cloudflare URL.
3. Copy the published URL (e.g. `https://sknsh-by-pd.lovable.app`).

---

## 3. Connect frontend ↔ backend

1. In your Lovable project, open **Project Settings → Environment Variables**.
2. Add / update:
   ```env
   VITE_API_URL=https://sknsh-backend.onrender.com
   ```
3. Re-publish the frontend so the new API URL is baked into the build.
4. Update the backend’s `CORS_ORIGINS` and `APP_BRIDGE_URL` variables to match your published frontend URL, then redeploy the backend.

---

## 4. What the code needs for deployment

- `backend/render.yaml` – Render blueprint (root dir, build + start commands, health check).
- `backend/runtime.txt` – pins Python 3.12.
- `backend/requirements.txt` – includes `gunicorn` and `requests`.
- `backend/models/store.py` – uses the bridge when `APP_BRIDGE_URL` + `BACKEND_BRIDGE_SECRET` are present; otherwise falls back to local JSON.
- `backend/models/bridge_store.py` – bridge client that calls `/api/public/state` on the published frontend.
- `src/routes/api/public/state.ts` – bearer-protected endpoint that reads/writes the Lovable Cloud database for the backend.

---

## 5. Common gotchas

- **Render builds Node instead of Python?** Root Directory must be `backend` and Language must be `Python 3`. Then **Manual Deploy → Clear build cache & deploy**.
- **Data loss on restarts?** Make sure `APP_BRIDGE_URL` and `BACKEND_BRIDGE_SECRET` are set in Render and match the Lovable secret. Without them, Flask uses JSON files and data is lost on every redeploy.
- **CORS errors in the browser?** Make sure `CORS_ORIGINS` in Render exactly matches your published frontend URL (including `https://`).
- **Google Drive uploads fail?** Verify `LOVABLE_API_KEY` and `GOOGLE_DRIVE_API_KEY` are copied from your Lovable project secrets.
- **Face-verification emails not sent?** Check the SMTP password is a Gmail **App Password**, not your regular Gmail password.
