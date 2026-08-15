# STUDENTS KA NOTES SHARING HUB

A premium, colourful student notes-sharing platform.

- **Frontend** — React 19 + TanStack Router + Tailwind CSS v4 (this repo root, `src/`)
- **Backend** — Python 3 + Flask + JWT + bcrypt + Google Drive + openpyxl (`backend/`)

## Backend (Flask, http://localhost:5000)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # then edit values
python app.py
```

A bootstrap admin account is created on first run using `ADMIN_ID` /
`ADMIN_PASSWORD` from `.env` (default `ADMIN001` / `Admin@12345`).

### Google Drive (via Lovable connector)

The backend stores uploaded notes in the Google Drive account connected
through Lovable's Google Drive connector. No service-account JSON key is
required.

1. In Lovable, go to **Project Settings → Connectors** and connect
   **Google Drive** with the account you want to use.
2. The connector provides two secrets:
   - `LOVABLE_API_KEY`
   - `GOOGLE_DRIVE_API_KEY`
3. These secrets are already written to `backend/.env` when you connect from
   this chat. If you recreate the project elsewhere, copy the values from
   **Project Settings → Secrets** into `backend/.env`.

Files are stored as:

```
STUDENTS KA NOTES SHARING HUB/<Department>/<Year>/<Semester>/<Subject>.pdf
```

The subject is also stored separately as metadata in `backend/data/notes.json`.
If the connector secrets are not present, the identical folder tree is created
under `backend/uploads/` so the app still runs end to end.

### Email (SMTP) for face verification confirmation

When a student completes live face verification, the backend sends a
confirmation email to the email ID saved in their profile.

Add these lines to `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=studentsnotessharing@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=studentsnotessharing@gmail.com
```

For Gmail, you must create an **App Password** (not your normal Gmail
password):

1. Go to <https://myaccount.google.com/apppasswords>.
2. Sign in with `studentsnotessharing@gmail.com`.
3. Select **Mail** → **Other (custom name)** → type `Notes Hub` → click **Generate**.
4. Copy the 16-character password and paste it as `SMTP_PASSWORD`.
5. Save `backend/.env` and restart the backend.

If SMTP is not configured, the email is only logged in the console and face
verification still succeeds.

### API

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/signup` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/forgot/question` | public |
| POST | `/api/auth/forgot/reset` | public |
| GET/PUT | `/api/profile` | student |
| GET | `/api/notes` | student |
| POST | `/api/notes/upload` | student |
| GET | `/api/notes/<note_id>/download` | student |
| GET | `/api/content` | public |
| GET | `/api/admin/notes` | admin |
| PATCH/DELETE | `/api/admin/notes/<note_id>` | admin |
| POST | `/api/admin/content` | admin |
| PATCH/DELETE | `/api/admin/content/<id>` | admin |
| GET | `/api/admin/students.xlsx` | admin |

Uploads accept PDF, JPG, JPEG, PNG and WEBP only, validated by extension,
MIME type, magic bytes and size.

## Frontend (http://localhost:5173 in the standalone Vite setup)

```bash
npm install
npm run dev
```

Point the frontend at the Flask API with `VITE_API_URL` (defaults to
`http://localhost:5000`):

```bash
echo "VITE_API_URL=http://localhost:5000" > .env
```

Pages: animated intro, Login, Signup, Forgot Password, Admin Login, Home,
Notes (Department → Year → Semester → Subject → Files), Share Notes, Profile
and Admin Portal.
