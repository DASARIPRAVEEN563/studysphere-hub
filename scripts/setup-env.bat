@echo off
REM One-time environment setup. Usage: scripts\setup-env.bat
cd /d "%~dp0.."
if not exist ".env" ( copy ".env.example" ".env" >nul & echo Created .env ) else ( echo .env already exists )
if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo Created backend\.env - open it and set JWT_SECRET, MASTER_ADMIN_ID, MASTER_ADMIN_PASSWORD, SMTP_PASSWORD
) else ( echo backend\.env already exists )
if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "backend\data" mkdir "backend\data"
echo Done. Next: scripts\start.bat
