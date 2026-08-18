# STUDENTS KA NOTES SHARING HUB

A premium, colourful student notes-sharing platform with live face verification,
Google Drive storage, gamification (stars, likes, leaderboard) and a full admin portal.

- **Frontend** — React 19 + TanStack Router/Start + Tailwind CSS v4 (`src/`)
- **Backend** — Python 3 + Flask + JWT + bcrypt + Google Drive + openpyxl (`backend/`)
- **Offline fallback** — the frontend ships with a built-in browser backend
  (`src/lib/offline-backend.ts`) so the whole site works even without Flask running.

---

## 1. Requirements

| Tool | Version |
| --- | --- |
| Node.js | 20+ (or Bun 1.1+) |
| Python | 3.10+ |
| Modern browser | Chrome / Edge / Safari (camera access needed for face verification) |

Python packages (`backend/requirements.txt`): Flask, Flask-Cors, PyJWT, bcrypt,
passlib, openpyxl, python-dotenv, requests.

---

## 2. How to run the project

### 2.1 Frontend

```bash
npm install          # or: bun install
echo "VITE_API_URL=http://localhost:5000" > .env
npm run dev          # http://localhost:8080
```

### 2.2 Backend (optional — the app also runs fully offline)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # then edit values
python app.py             # http://localhost:5000
```

### 2.3 Build for production

```bash
npm run build
```

---

## 3. Accounts

| Role | ID | Password |
| --- | --- | --- |
| Master admin (permanent) | `PRAVEEN2207` | `PRAVEEN2204` |
| Demo admin (preview) | `ADMIN` | `admin123` |
| Flask bootstrap admin | `ADMIN001` | `Admin@12345` |

The master admin account gets an extra **Create Admin** panel in the profile page and
can delete both students and other admins.

---

## 4. Configuration

### Google Drive (via Lovable connector)

Notes are stored in Google Drive of the connected account
(`studentsnotessharing@gmail.com`) using the Lovable Google Drive connector — no
service-account JSON needed. Secrets used: `LOVABLE_API_KEY`, `GOOGLE_DRIVE_API_KEY`.

Folder structure:

```
STUDENTS KA NOTES SHARING HUB/<Department>/<Year>/<Semester>/<Subject>.pdf
```

If the connector secrets are missing, the same tree is created under `backend/uploads/`.

### Email (SMTP) — face-verification codes

`backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=studentsnotessharing@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=studentsnotessharing@gmail.com
```

Gmail needs an **App Password** (https://myaccount.google.com/apppasswords).
If SMTP is not configured the code is logged to the console and verification still works.

---

## 5. How to use the website

### Student
1. **Intro animation → Login / Sign up.** Hall ticket no and security answer are
   uppercase by default; a new account lands on the Profile page.
2. **Profile → add your email ID** (one account per email), then start
   **Live Face Verification** — only one person may be in frame, blink once and the
   photo is captured automatically.
3. A **6-digit code** is emailed to you. Paste it in the profile to unlock the site.
   Until then only **Home** and **Profile** are available.
4. **Home** — timetables, notices, gallery folders, promotions and advertisements posted
   by the admin, with pinned items on top, festive effects, flipbook galleries and downloads.
5. **Notes** — browse Department → Year → Semester → Subject → Files; manual search with
   filters (department, year, semester, subject prefix) plus sorting by most liked /
   downloaded / viewed. Recent top-10 uploads are listed below.
6. **Share Notes** — upload PDF/JPG/JPEG/PNG/WEBP (extension, MIME, magic-byte and size
   checked). Duplicate names get a sequential suffix (`ds`, `ds01`). Each upload earns a
   **star** with a celebration animation.
7. **View / Download** — every file has a view option beside download; likes, views and
   download counts are tracked, and the uploader gets an anonymous like notification.
8. **Chat with Admin** — direct two-way messaging with text and images.
9. **Profile extras** — shared/downloaded counts, stars, top-3 leaderboard, theme picker
   (dark / light / more) and sharing via WhatsApp, Telegram, Instagram or link.
10. **Logout** — a thank-you card with an optional star review appears before exiting.

### Admin
- **Admin Portal** — manage notes (grouped in department folders), rename subjects,
  delete users, and export students to Excel (Name, Email, Hall ticket no, Department,
  Year, Semester + face-verified image; no passwords or security answers).
- **Content** — add timetables, notices, gallery images, promotions and ads by URL or
  drag-and-drop, choose animation effects (fire crackers, Diwali, confetti…), pin any
  content type, and group multi-image uploads into folders.
- **Chat** — reply to each student thread WhatsApp-style, get unread notifications and
  broadcast one message to all selected users at once.

---

## 6. API

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/signup` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/forgot/question` | public |
| POST | `/api/auth/forgot/reset` | public |
| GET/PUT | `/api/profile` | student |
| POST | `/api/profile/face-verify` | student |
| POST | `/api/profile/confirm-code` | student |
| GET | `/api/notes` | student |
| POST | `/api/notes/upload` | student |
| GET | `/api/notes/<note_id>/download` | student |
| GET | `/api/content` | public |
| GET/POST | `/api/chat` | student/admin |
| GET | `/api/social/leaderboard` | student |
| GET | `/api/admin/notes` | admin |
| PATCH/DELETE | `/api/admin/notes/<note_id>` | admin |
| POST | `/api/admin/content` | admin |
| PATCH/DELETE | `/api/admin/content/<id>` | admin |
| GET | `/api/admin/students.xlsx` | admin |

---

## 7. Project structure

```
/                 React frontend (src/routes, src/components, src/lib)
/backend          Flask API (routes, controllers, services, models)
/public           static assets
```
