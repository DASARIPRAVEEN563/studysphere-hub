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

### Google Drive

1. Create a Google Cloud project and enable the **Google Drive API**.
2. Create a **service account** and download its JSON key as
   `backend/service-account.json` (no Gmail password is ever used).
3. Optionally share a Drive folder with the service-account email and set
   `GOOGLE_DRIVE_PARENT_ID` to that folder ID.

Files are stored as:

```
STUDENTS KA NOTES SHARING HUB/<Department>/<Year>/<Semester>/<Subject>.pdf
```

The subject is also stored separately as metadata in `backend/data/notes.json`.
If no service-account key is present, the identical folder tree is created
under `backend/uploads/` so the app still runs end to end.

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