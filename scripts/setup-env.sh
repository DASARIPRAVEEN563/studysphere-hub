#!/usr/bin/env bash
# One-time environment setup. Usage: bash scripts/setup-env.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"

gen() { python3 -c "import secrets;print(secrets.token_urlsafe(48))"; }

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env (frontend). Fill VITE_SUPABASE_* if you use Lovable Cloud."
else
  echo "==> .env already exists, leaving it alone."
fi

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  SECRET="$(gen)"
  python3 - "$SECRET" <<'PY'
import sys, pathlib
p = pathlib.Path("backend/.env")
t = p.read_text()
t = t.replace("JWT_SECRET=change-this-to-a-long-random-secret", f"JWT_SECRET={sys.argv[1]}")
if "JWT_SECRET=" not in t:
    t += f"\nJWT_SECRET={sys.argv[1]}\n"
p.write_text(t)
PY
  echo "==> Created backend/.env with a fresh random JWT_SECRET."
  echo "   Still to fill by hand: MASTER_ADMIN_ID, MASTER_ADMIN_PASSWORD, SMTP_PASSWORD"
  echo "   Optional: SUPABASE_*, LOVABLE_API_KEY, GOOGLE_DRIVE_API_KEY"
else
  echo "==> backend/.env already exists, leaving it alone."
fi

mkdir -p backend/uploads backend/data
echo "==> Done. Next: bash scripts/start.sh"
