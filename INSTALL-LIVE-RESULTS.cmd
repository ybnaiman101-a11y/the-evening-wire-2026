@echo off
setlocal
cd /d "%~dp0"
title THE EVENING WIRE - Install Live Election Results
echo.
echo THE EVENING WIRE - SAFE LIVE RESULTS UPDATE
echo This updater keeps your EXISTING owner password, member accounts, and database.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALL-LIVE-RESULTS.ps1"
echo.
echo Press any key to close this setup window.
pause >nul
