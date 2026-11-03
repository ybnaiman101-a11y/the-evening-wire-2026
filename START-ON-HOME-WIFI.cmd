@echo off
setlocal
cd /d "%~dp0"
title THE EVENING WIRE - Home Wi-Fi Read-Only Preview
where node >nul 2>&1
if errorlevel 1 (
  echo Install the Node.js LTS version from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\pg" (
  call npm install --omit=dev --ignore-scripts --no-audit --no-fund
  if errorlevel 1 goto failed
)
set "NODE_ENV=development"
set "HOST=0.0.0.0"
set "PORT=3000"
set "EW_READ_ONLY_PREVIEW=1"
echo.
echo ============================================================
echo THE EVENING WIRE - HOME NETWORK READ-ONLY PREVIEW
echo.
echo Anyone on the SAME trusted home Wi-Fi network may
echo visit http://YOUR-PC-LOCAL-IP:3000
echo.
echo To find YOUR-PC-LOCAL-IP, open another Command Prompt,
echo run ipconfig, and read the IPv4 Address of your Wi-Fi.
echo.
echo You may need a Windows Firewall rule limited to PRIVATE
echo network access on TCP port 3000.
echo.
echo DO NOT forward port 3000 on your internet router.
echo DO NOT ask guests to log in or enter passwords.
echo Read-only mode blocks logins, posting and admin actions.
echo Close this window to shut down the website.
echo ============================================================
echo.
node server.mjs
echo The website stopped.
pause
exit /b 0
:failed
echo Installation failed.
pause
exit /b 1
