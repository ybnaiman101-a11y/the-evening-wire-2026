@echo off
setlocal
cd /d "%~dp0"
title THE EVENING WIRE - Create Private Public Admin Login
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install Node.js LTS first.
  pause
  exit /b 1
)
node generate-public-admin.mjs
echo.
echo Your NEW public website password is different from your local password.
echo Please save the private file in a secure location.
echo.
pause
