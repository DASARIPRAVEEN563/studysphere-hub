#!/usr/bin/env bash
# Starts the Flask backend and the React frontend together.
# Usage:  bash scripts/start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> STUDENTS KA NOTES SHARING HUB"

if [ ! -f backend/.env ]; then
  echo "!! backend/.env is missing. Copying the example file."
  cp backend/.env.example backend/.env
  echo "!! Open backend/.env and fill in JWT_SECRET and SMTP_PASSWORD, then run this again."
  exit 1
fi

if [ ! -f .env ]; then
  echo "VITE_API_URL=http://localhost:5000" > .env
  echo "==> Created .env with VITE_API_URL"
fi

# ---- backend ----
cd backend
if [ ! -d .venv ]; then
  echo "==> Creating Python virtual environment"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "==> Starting Flask on http://localhost:5000"
python app.py &
BACKEND_PID=$!
cd "$ROOT"

cleanup() {
  echo
  echo "==> Stopping backend"
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ---- frontend ----
if [ ! -d node_modules ]; then
  echo "==> Installing frontend packages"
  npm install
fi

echo "==> Starting frontend on http://localhost:8080"
npm run dev