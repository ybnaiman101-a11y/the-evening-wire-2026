@echo off
setlocal
cd /d "%~dp0"
title THE EVENING WIRE - Private Windows Preview
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install the LTS version from https://nodejs.org/
  echo Then reopen this file.
  pause
  exit /b 1
)
if not exist "node_modules\pg" (
  echo Installing the website's required software packages...
  call npm install --omit=dev --ignore-scripts --no-audit --no-fund
  if errorlevel 1 goto failed
)
set "NODE_ENV=development"
set "HOST=127.0.0.1"
set "PORT=3000"
set "EW_READ_ONLY_PREVIEW=1"
echo.
echo ====================================================
echo THE EVENING WIRE - PRIVATE PREVIEW
echo Open this link on THIS computer:
echo http://127.0.0.1:3000
echo.
echo Sign-in, posting and administrative actions are
echo disabled in this safe read-only preview.
echo Close this window to stop the website.
echo ====================================================
echo.
node server.mjs
echo.
echo The website stopped.
pause
exit /b 0
:failed
echo Website software setup failed. See errors above.
pause
exit /b 1
