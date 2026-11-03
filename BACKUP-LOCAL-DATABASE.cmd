@echo off
setlocal
cd /d "%~dp0"
title THE EVENING WIRE - Save Backup
if not exist "private-data\pglite" (
  echo There is no local database to back up yet.
  pause
  exit /b 1
)
echo IMPORTANT: Close THE EVENING WIRE's black server window before backing up.
echo Do not continue if the website is still running.
pause
if not exist "backups" mkdir "backups"
powershell -NoProfile -Command "$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'; Compress-Archive -Path 'private-data' -DestinationPath ('backups\evening-wire-'+$stamp+'.zip') -ErrorAction Stop; Write-Host 'Backup created in backups folder.'"
if errorlevel 1 (
  echo Backup could not be created.
) else (
  echo Your backup contains members, news updates, race calls and owner password hash.
  echo Keep it PRIVATE and copy it to another safe location.
)
pause
