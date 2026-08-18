# Setup on a new laptop — STUDENTS KA NOTES SHARING HUB

Follow this from top to bottom. It takes about 15 minutes.

---

## 0. Why things were broken

| Problem | Cause | Fixed by |
|---|---|---|
| Can't run the project | `backend/.env` is in `.gitignore`, so it was never copied | Step 3 |
| Login / signup broken | Flask had no `JWT_SECRET`, so tokens failed | Step 3 |
| Uploads / Google Drive fail | Connector keys belong to the old workspace | Step 6 (optional) |
| Emails not sending | `SMTP_PASSWORD` was missing | Step 3 |

Good news: the project still runs **fully** without Google Drive. Files are
saved to `backend/uploads/` instead. You can add Drive later.

---

## 1. Install the tools

| Tool | Version | Download |
|---|---|---|
| Node.js | 20 or newer | https://nodejs.org |
| Python | 3.10 or newer | https://python.org/downloads |
| Git | any | https://git-scm.com |

On Windows, tick **"Add Python to PATH"** during the Python install.

Check they work:

```bash
node -v
python --version
git --version
```

---

## 2. Get the code

```bash
git clone <your-github-repo-url>
cd <project-folder>
```

---

## 3. Create the backend `.env` file  ← the important one

```bash
cd backend
cp .env.example .env      # Windows: copy .env.example .env
```

Now open `backend/.env` and fill it in:

```env
PORT=5000
FLASK_DEBUG=1
JWT_SECRET=put-any-long-random-text-here-at-least-32-characters
JWT_EXPIRES_HOURS=24
CORS_ORIGINS=http://localhost:8080,http://localhost:5173

# Bootstrap admin (created automatically on first run)
ADMIN_ID=ADMIN001
ADMIN_PASSWORD=Admin@12345
ADMIN_NAME=Portal Administrator

# Master admin
MASTER_ADMIN_ID=PRAVEEN2207
MASTER_ADMIN_PASSWORD=PRAVEEN2204

# Uploads
MAX_UPLOAD_MB=25
DRIVE_ROOT_FOLDER=STUDENTS KA NOTES SHARING HUB

# Email (Gmail App Password, NOT your normal password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=studentsnotessharing@gmail.com
SMTP_PASSWORD=your-16-character-gmail-app-password
SMTP_FROM=studentsnotessharing@gmail.com
```

> Leave `SUPABASE_*`, `LOVABLE_API_KEY` and `GOOGLE_DRIVE_API_KEY` **empty**
> for now. The app will use local JSON files and the local `uploads/` folder.

### How to get a Gmail App Password

1. Go to https://myaccount.google.com/security
2. Turn on **2-Step Verification**
3. Open https://myaccount.google.com/apppasswords
4. Create a password named "Notes Hub" and copy the 16 characters
5. Paste it into `SMTP_PASSWORD`

---

## 4. Start the backend

```bash
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Mac / Linux:
source .venv/bin/activate

pip install -r requirements.txt
python app.py
```

You should see:

```
[init] Admin account created: ADMIN001
 * Running on http://0.0.0.0:5000
```

Test it in a browser: http://localhost:5000/api/health

**Leave this terminal open.**

---

## 5. Start the frontend

Open a **second terminal** in the project root:

```bash
npm install
npm run dev
```

Then open http://localhost:8080

If the frontend cannot find the backend, create a `.env` in the project root:

```env
VITE_API_URL=http://localhost:5000
```

---

## 6. Optional — turn Google Drive back on

Because the project moved to a new workspace, the old Drive keys no longer
work. To re-enable Drive storage:

1. In the Lovable editor, ask to connect the **Google Drive** connector.
2. After connecting, copy the new `LOVABLE_API_KEY` and `GOOGLE_DRIVE_API_KEY`
   from Project Settings into `backend/.env`.
3. Restart the backend.

Until then, uploads are saved to `backend/uploads/` and everything still works.

---

## 7. Login details

| Role | ID | Password |
|---|---|---|
| Master admin | `PRAVEEN2207` | `PRAVEEN2204` |
| Flask admin | `ADMIN001` | `Admin@12345` |
| Student | Sign up in the app | your choice |

---

## 8. Quick start next time

From the project root:

```bash
# Windows
scripts\start.bat

# Mac / Linux
bash scripts/start.sh
```

This starts the backend and the frontend together.

---

## 9. Common errors

**`ModuleNotFoundError: No module named 'flask'`**
You forgot to activate the virtual environment. Run the activate command in
step 4 again.

**`python is not recognized`** (Windows)
Python is not on PATH. Reinstall Python and tick "Add Python to PATH", or use
`py` instead of `python`.

**Login fails / "Invalid token"**
`JWT_SECRET` is empty in `backend/.env`. Put any long random text there and
restart the backend.

**CORS error in the browser console**
Add your frontend URL to `CORS_ORIGINS` in `backend/.env`, then restart.

**Camera does not open for face verification**
The browser only allows the camera on `localhost` or `https`. Use
`http://localhost:8080`, not the network IP address.

**Port 5000 already in use** (common on macOS — AirPlay uses it)
Change `PORT=5001` in `backend/.env` and set
`VITE_API_URL=http://localhost:5001` in the root `.env`.