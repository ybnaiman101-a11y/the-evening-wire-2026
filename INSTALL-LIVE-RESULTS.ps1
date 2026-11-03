# The Evening Wire: owner-initiated LOCAL code update only.
# Does not use remote commands and does not read, delete or upload member records.
$ErrorActionPreference = "Stop"
try {
  $source = Split-Path -Parent $MyInvocation.MyCommand.Path
  $changes = @(
    @{Source=(Join-Path $source "server.mjs"); Relative="server.mjs"},
    @{Source=(Join-Path $source "public\index.html"); Relative="public\index.html"},
    @{Source=(Join-Path $source "live-results.mjs"); Relative="live-results.mjs"},
    @{Source=(Join-Path $source "start-local.mjs"); Relative="start-local.mjs"}
  )
  foreach ($f in $changes) {
    if (-not (Test-Path -LiteralPath $f.Source -PathType Leaf)) {
      throw "New website code is incomplete. Extract the WHOLE downloaded ZIP first."
    }
  }
  Write-Host ""
  Write-Host "Looking for the existing Evening Wire website..." -ForegroundColor Cyan
  $roots = @("$env:USERPROFILE\Downloads","$env:USERPROFILE\Desktop","$env:USERPROFILE\Documents") | Where-Object {Test-Path $_}
  $paths = @{}
  foreach ($root in $roots) {
    $first = @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object {$_.Name -like "*evening-wire*"})
    foreach ($item in $first) {
      $second = @(Get-ChildItem -LiteralPath $item.FullName -Directory -ErrorAction SilentlyContinue)
      $folders = @($item) + $second
      foreach ($folder in $folders) {
        $candidate=$folder.FullName
        if ((Test-Path -LiteralPath (Join-Path $candidate "START-NEW-DATABASE.cmd") -PathType Leaf) -and
          (Test-Path -LiteralPath (Join-Path $candidate "private-data\owner-admin.sha256") -PathType Leaf)) {
          $paths[$candidate.ToLowerInvariant()]=$candidate
        }
      }
    }
  }
  $targets = @($paths.Values | Sort-Object)
  if ($targets.Count -eq 0) {
    Write-Host ""
    Write-Host "The existing website was not located automatically." -ForegroundColor Yellow
    $manual=Read-Host "Paste your existing website folder path, or press Enter to cancel"
    $manual=$manual.Trim('"').Trim()
    if (-not $manual) {throw "No changes made"}
    if ((Test-Path -LiteralPath (Join-Path $manual "START-NEW-DATABASE.cmd") -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $manual "private-data\owner-admin.sha256") -PathType Leaf)) {
      $targets=@((Resolve-Path -LiteralPath $manual).Path)
    } else {throw "This is not your configured website folder. No changes made."}
  }
  $target=$targets[0]
  if ($targets.Count -gt 1) {
    Write-Host ""
    Write-Host "More than one configured website was found. Choose the one you USE:"
    for($i=0;$i -lt $targets.Count;$i++){Write-Host (" "+($i+1)+". "+$targets[$i])}
    $answer=Read-Host "Type the number of your existing website, or Enter to cancel"
    $n=0
    if (-not [int]::TryParse($answer,[ref]$n) -or $n -lt 1 -or $n -gt $targets.Count) {
      throw "No changes made. The website folder was not chosen."
    }
    $target=$targets[$n-1]
  }
  Write-Host ""
  Write-Host "Existing website selected:" -ForegroundColor Cyan
  Write-Host $target
  Write-Host ""
  Write-Host "IMPORTANT: Close your old Evening Wire black server window first." -ForegroundColor Yellow
  $answer=Read-Host "Type YES to install the results feeds and PRESERVE your existing database"
  if ($answer -cne "YES") {throw "No changes made. You did not type YES."}

  $timestamp=Get-Date -Format "yyyyMMdd-HHmmss"
  $backup=Join-Path $target ("backups\live-results-before-update-"+$timestamp)
  New-Item -ItemType Directory -Path (Join-Path $backup "public") -Force | Out-Null
  foreach($name in @("server.mjs","public\index.html","live-results.mjs","start-local.mjs")) {
    $old=Join-Path $target $name
    if(Test-Path -LiteralPath $old -PathType Leaf) {
      $dst=Join-Path $backup $name
      Copy-Item -LiteralPath $old -Destination $dst -ErrorAction Stop
    }
  }
  foreach($f in $changes) {
    $destination=Join-Path $target $f.Relative
    Copy-Item -LiteralPath $f.Source -Destination $destination -Force -ErrorAction Stop
  }
  if (-not (Test-Path -LiteralPath (Join-Path $target "private-data\owner-admin.sha256"))) {
    throw "Owner password file is missing. Stop and inspect the folders."
  }
  Write-Host ""
  Write-Host "SUCCESS: LIVE RESULTS CONNECTORS INSTALLED." -ForegroundColor Green
  Write-Host "Your existing member database and owner password were NOT changed."
  Write-Host "Backup of old website code: $backup"
  Write-Host "Official Arizona / Open America / People's Tally automatic counts are now enabled."
  Write-Host "AP requires a separate licensed API key; Ohio official results are linked."
  Write-Host ""
  $launch=Read-Host "Type START to launch your website now (or Enter to skip)"
  if ($launch -ceq "START"){
    $cmd=Join-Path $target "START-NEW-DATABASE.cmd"
    Start-Process -FilePath "cmd.exe" -ArgumentList @("/c",('"' + $cmd + '"')) -WorkingDirectory $target
    Start-Sleep -Seconds 3
    Start-Process "http://127.0.0.1:3000"
  }
}catch {
  Write-Host ""
  Write-Host ("NOT INSTALLED: "+$_.Exception.Message) -ForegroundColor Yellow
  Write-Host "No database files were deleted."
}
