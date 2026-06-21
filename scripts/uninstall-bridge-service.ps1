param(
  [string]$ServiceName = "XtensionBridge",
  [string]$InstallDir = "",
  [switch]$RemoveFiles
)

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
  throw "Run this uninstaller from an elevated PowerShell session so it can remove the Windows service."
}

if (-not $InstallDir) {
  $InstallDir = Join-Path $env:ProgramFiles "Xtension\Bridge"
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
  if ($service.Status -ne "Stopped") {
    Stop-Service -Name $ServiceName -Force
    $service.WaitForStatus("Stopped", [TimeSpan]::FromSeconds(20))
  }
  & sc.exe delete $ServiceName | Out-Null
  Write-Host "[OK] Removed service: $ServiceName"
} else {
  Write-Host "[OK] Service was not installed: $ServiceName"
}

if ($RemoveFiles -and (Test-Path -LiteralPath $InstallDir)) {
  Remove-Item -LiteralPath $InstallDir -Recurse -Force
  Write-Host "[OK] Removed files: $InstallDir"
}
