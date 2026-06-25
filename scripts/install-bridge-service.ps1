param(
  [string]$ServiceName = "XtensionBridge",
  [string]$DisplayName = "Xtension Bridge",
  [string]$InstallDir = "",
  [string]$BridgeExe = "",
  [string]$ServiceExe = "",
  [string]$UserProfile = "",
  [string]$BridgeToken = "",
  [int]$Port = 47623,
  [switch]$NoStart
)

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Resolve-ExistingPath([string[]]$Candidates) {
  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return ""
}

function Resolve-CommandPath([string]$CommandName, [string[]]$Fallbacks) {
  $fallback = Resolve-ExistingPath $Fallbacks
  if ($fallback) {
    return $fallback
  }

  $commands = @(Get-Command $CommandName -All -ErrorAction SilentlyContinue)
  foreach ($command in $commands) {
    if (-not $command.Source -or -not (Test-Path -LiteralPath $command.Source -PathType Leaf)) {
      continue
    }

    $extension = [IO.Path]::GetExtension($command.Source)
    if ($extension -in @(".exe", ".cmd", ".bat")) {
      return (Resolve-Path -LiteralPath $command.Source).Path
    }
  }

  return ""
}

if (-not (Test-IsAdmin)) {
  throw "Run this installer from an elevated PowerShell session so it can create the Windows service."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $InstallDir) {
  $InstallDir = Join-Path $env:ProgramFiles "Xtension\Bridge"
}
if (-not $UserProfile) {
  $UserProfile = [Environment]::GetFolderPath("UserProfile")
}
if (-not $BridgeExe) {
  $BridgeExe = Resolve-ExistingPath @(
    (Join-Path $PSScriptRoot "XtensionBridge.exe"),
    (Join-Path $repoRoot "dist\bridge\XtensionBridge.exe"),
    (Join-Path $repoRoot "dist\bridge\XtensionCodexBridge.exe")
  )
}
if (-not $ServiceExe) {
  $ServiceExe = Resolve-ExistingPath @(
    (Join-Path $PSScriptRoot "XtensionBridgeService.exe"),
    (Join-Path $repoRoot "dist\bridge-service\XtensionBridgeService.exe"),
    (Join-Path $repoRoot "bridge-service\bin\Release\net8.0-windows\win-x64\publish\XtensionBridgeService.exe")
  )
}

if (-not $BridgeExe -or -not (Test-Path -LiteralPath $BridgeExe -PathType Leaf)) {
  throw "Bridge executable not found. Run npm run bridge:build first."
}
if (-not $ServiceExe -or -not (Test-Path -LiteralPath $ServiceExe -PathType Leaf)) {
  throw "Service host executable not found. Run npm run bridge:service:build first."
}

$logDir = Join-Path $env:ProgramData "Xtension\Bridge\logs"
$tempDir = Join-Path $env:ProgramData "Xtension\Bridge\temp"
$targetBridge = Join-Path $InstallDir "XtensionBridge.exe"
$targetService = Join-Path $InstallDir "XtensionBridgeService.exe"
$targetConfig = Join-Path $InstallDir "bridge-service.json"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.Status -ne "Stopped") {
    Stop-Service -Name $ServiceName -Force
    $existing.WaitForStatus("Stopped", [TimeSpan]::FromSeconds(20))
  }
  & sc.exe delete $ServiceName | Out-Null
  Start-Sleep -Milliseconds 800
}

Unregister-ScheduledTask -TaskName $ServiceName -Confirm:$false -ErrorAction SilentlyContinue

Copy-Item -LiteralPath $BridgeExe -Destination $targetBridge -Force
Copy-Item -LiteralPath $ServiceExe -Destination $targetService -Force

$codexCli = Resolve-CommandPath "codex" @(
  (Join-Path $UserProfile "AppData\Roaming\npm\codex.cmd")
)
$grokCli = Resolve-CommandPath "grok" @(
  (Join-Path $UserProfile ".grok\bin\grok.exe")
)
$geminiCli = Resolve-CommandPath "gemini" @(
  (Join-Path $UserProfile "AppData\Roaming\npm\gemini.cmd")
)
$claudeCli = Resolve-CommandPath "claude" @(
  (Join-Path $UserProfile ".local\bin\claude.exe")
)

$environment = [ordered]@{
  XTENSION_BRIDGE_PORT = [string]$Port
  XTENSION_BRIDGE_LOG_FILE = (Join-Path $logDir "bridge.log")
  CODEX_HOME = (Join-Path $UserProfile ".codex")
  HOMEDRIVE = [IO.Path]::GetPathRoot($UserProfile).TrimEnd("\")
  HOMEPATH = $UserProfile.Substring(([IO.Path]::GetPathRoot($UserProfile).TrimEnd("\")).Length)
  USERNAME = Split-Path -Leaf $UserProfile
  USERDOMAIN = $env:USERDOMAIN
  TEMP = $tempDir
  TMP = $tempDir
}
if ($BridgeToken) {
  $environment.XTENSION_BRIDGE_TOKEN = $BridgeToken
}
if ($codexCli) {
  $environment.CODEX_CLI = $codexCli
}
if ($grokCli) {
  $environment.GROK_CLI = $grokCli
}
if ($geminiCli) {
  $environment.GEMINI_CLI = $geminiCli
}
if ($claudeCli) {
  $environment.CLAUDE_CLI = $claudeCli
}

$config = [ordered]@{
  bridgeExe = $targetBridge
  workingDirectory = $InstallDir
  userProfile = $UserProfile
  logDirectory = $logDir
  restartDelayMs = 2000
  environment = $environment
}

$config | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $targetConfig -Encoding UTF8

New-Service `
  -Name $ServiceName `
  -BinaryPathName "`"$targetService`"" `
  -DisplayName $DisplayName `
  -Description "Runs the local Xtension AI bridge for browser extension reply tools." `
  -StartupType Automatic | Out-Null

& sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/30000/restart/60000 | Out-Null

if (-not $NoStart) {
  Start-Service -Name $ServiceName
  Start-Sleep -Seconds 2

  $headers = @{}
  if ($BridgeToken) {
    $headers["x-xtension-bridge-token"] = $BridgeToken
  }

  try {
    $health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$Port/providers" -Headers $headers -TimeoutSec 8
    $installedProviders = @($health.providers | Where-Object { $_.installed } | ForEach-Object { $_.id }) -join ", "
    if (-not $installedProviders) {
      $installedProviders = "none"
    }
    Write-Host "[OK] $ServiceName installed and running. Detected providers: $installedProviders"
  } catch {
    Write-Warning "$ServiceName was installed, but the bridge health check failed: $($_.Exception.Message)"
  }
} else {
  Write-Host "[OK] $ServiceName installed. Start it with: Start-Service $ServiceName"
}

Write-Host "Install directory: $InstallDir"
Write-Host "Logs: $logDir"
