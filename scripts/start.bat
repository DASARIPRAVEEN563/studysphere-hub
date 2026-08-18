@echo off
REM Starts the Flask backend and the React frontend together (Windows).
REM Usage:  scripts\start.bat

cd /d "%~dp0.."

echo ==^> STUDENTS KA NOTES SHARING HUB

if not exist "backend\.env" (
  echo !! backend\.env is missing. Copying the example file.
  copy "backend\.env.example" "backend\.env" >nul
  echo !! Open backend\.env, fill in JWT_SECRET and SMTP_PASSWORD, then run this again.
  pause
  exit /b 1
)

if not exist ".env" (
  echo VITE_API_URL=http://localhost:5000> .env
  echo ==^> Created .env with VITE_API_URL
)

if not exist "backend\.venv" (
  echo ==^> Creating Python virtual environment
  python -m venv backend\.venv
)

echo ==^> Installing Python packages
call backend\.venv\Scripts\activate.bat
pip install --quiet --upgrade pip
pip install --quiet -r backend\requirements.txt

echo ==^> Starting Flask on http://localhost:5000
start "Notes Hub Backend" cmd /k "cd /d %CD%\backend && ..\backend\.venv\Scripts\activate.bat && python app.py"

if not exist "node_modules" (
  echo ==^> Installing frontend packages
  call npm install
)

echo ==^> Starting frontend on http://localhost:8080
call npm run dev