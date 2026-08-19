# Deploy STUDENTS KA NOTES SHARING HUB

## What goes where

| Piece | Deploy target | Why |
|-------|---------------|-----|
| **React frontend** | **Lovable Publish** (one-click) | The project is built with TanStack Start + the Lovable Vite config, which outputs a Cloudflare Worker. Railway is not the easiest host for this part. |
| **Flask backend** | **Railway** | Standard Python service. I added `Procfile`, `runtime.txt`, `railway.json`, and a bridge so data survives restarts. |
| **Database** | **Lovable Cloud / Supabase** | Kept as you requested. |
| **Files** | **Google Drive** | Kept as you requested. |

---

## 1. Backend → Railway

### 1.1 Add these variables in Railway

Go to your Railway project → backend service → **Variables**, then add:

```env
# Flask
PORT=5000
FLASK_DEBUG=0
JWT_SECRET=<generate a long random string>
JWT_EXPIRES_HOURS=24

# CORS: put your final frontend URL here.
# If you use Lovable Publish, it looks like https://project--xxxx.lovable.app
CORS_ORIGINS=https://your-frontend-url.lovable.app

# Bootstrap admin account
ADMIN_ID=ADMIN001
ADMIN_PASSWORD=<strong password>
ADMIN_NAME=Portal Administrator

# Persistence bridge (Lovable Cloud does NOT expose a Supabase service-role key,
# so Flask writes through the published frontend instead)
# Use the preview URL first, then update to the published URL after publishing.
APP_BRIDGE_URL=https://<your-frontend>.lovable.app
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

> **Important:** Lovable Cloud does **not** expose `SUPABASE_SERVICE_ROLE_KEY`. Railway’s Flask app persists by calling `/api/public/state` on the published frontend. Both sides must share the same `BACKEND_BRIDGE_SECRET`.

### 1.2 Create the Railway service

1. In Railway, click **New** → **Empty Service**.
2. Connect your GitHub repo.
3. Set the service **Root Directory** to `backend`.
4. Railway will detect `backend/Procfile` and run:
   ```
   gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60
   ```
5. Deploy. After it finishes, Railway gives you a URL like `https://students-notes-api.up.railway.app`.
6. Test it:
   ```bash
   curl https://students-notes-api.up.railway.app/api/health
   ```

---

## 2. Frontend → Lovable Publish

1. In the Lovable editor, click **Publish** (top right on desktop, bottom-right in preview).
2. This builds and deploys the React app to a Cloudflare URL.
3. Copy the published URL (e.g. `https://project--xxxx.lovable.app`).

---

## 3. Connect frontend ↔ backend

1. In your Lovable project, open **Project Settings → Environment Variables**.
2. Add / update:
   ```env
   VITE_API_URL=https://your-railway-backend-url
   ```
   Example:
   ```env
   VITE_API_URL=https://students-notes-api.up.railway.app
   ```
3. Re-publish the frontend so the new API URL is baked into the build.
4. Update the backend’s `CORS_ORIGINS` and `APP_BRIDGE_URL` variables to match your published frontend URL, then redeploy the backend.

---

## 4. What changed in the code for Railway

- `backend/Procfile` – tells Railway how to start Flask.
- `backend/runtime.txt` – pins Python 3.12.
- `backend/railway.json` – Railway service config.
- `backend/requirements.txt` – added `gunicorn` and `requests`.
- `backend/models/store.py` – uses the bridge when `APP_BRIDGE_URL` + `BACKEND_BRIDGE_SECRET` are present; otherwise falls back to local JSON.
- `backend/models/bridge_store.py` – new bridge client that calls `/api/public/state` on the published frontend.
- `src/routes/api/public/state.ts` – bearer-protected endpoint that reads/writes the Lovable Cloud database for the backend.

---

## 5. Common gotchas

- **Data loss on Railway restarts?** Make sure `APP_BRIDGE_URL` and `BACKEND_BRIDGE_SECRET` are set in Railway and match the Lovable secret. Without them, Flask uses JSON files and data is lost on every redeploy.
- **CORS errors in the browser?** Make sure `CORS_ORIGINS` in Railway exactly matches your published frontend URL (including `https://`).
- **Google Drive uploads fail?** Verify `LOVABLE_API_KEY` and `GOOGLE_DRIVE_API_KEY` are copied from your Lovable project secrets.
- **Face-verification emails not sent?** Check the SMTP password is a Gmail **App Password**, not your regular Gmail password.

---

## Optional: deploy the frontend on Railway too

The frontend build is currently tuned for Cloudflare Workers by the Lovable TanStack config. If you really need it on Railway, you must add a Node wrapper around the Worker output. That is more fragile than using Lovable Publish, so I recommend the Lovable Publish path above. If you still want the Railway frontend route, let me know and I’ll add the wrapper.
