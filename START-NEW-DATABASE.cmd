@echo off
setlocal
cd /d "%~dp0"
title THE EVENING WIRE - Database and Owner Access
where node >nul 2>&1
if errorlevel 1 (
  echo Please install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\@electric-sql\pglite" (
  echo Installing the local database and website software...
  call npm install --omit=dev --ignore-scripts --no-audit --no-fund
  if errorlevel 1 (
    echo Install failed. Please send a picture of this window.
    pause
    exit /b 1
  )
)
if not exist "private-data\owner-admin.sha256" (
  echo First-run setup: making a UNIQUE private owner password.
  echo You do NOT need to type anything. The password appears ONCE.
  node set-owner-password.mjs
  if errorlevel 1 (
    echo Owner setup did not complete.
    pause
    exit /b 1
  )
  echo.
  echo IMPORTANT: Save the password displayed ABOVE before starting the website.
  echo Do not send a picture of your private password.
  echo.
  pause
)
echo.
echo =====================================================
echo THE EVENING WIRE - FULL LOCAL DATABASE
echo This is a private owner test, not an internet website.
echo Open http://127.0.0.1:3000 in Chrome
echo.
echo Members, reactions, alerts, race calls and analytics
echo are saved to private-data on THIS computer.
echo Close this window to stop the site.
echo =====================================================
echo.
node start-local.mjs
echo.
echo Website stopped. Do not delete the private-data folder.
pause
