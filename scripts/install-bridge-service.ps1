param(
  [string]$InstallerPath = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not $InstallerPath) {
  $InstallerPath = Join-Path $repoRoot "dist\XtensionBridgeSetup.exe"
}
if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
  $InstallerPath = Join-Path $repoRoot "dist\bridge-installer\XtensionBridgeSetup.exe"
}
if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
  throw "Connector installer not found. Run npm run bridge:release first."
}

$resolvedInstaller = (Resolve-Path -LiteralPath $InstallerPath).Path
$startInfo = [Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $resolvedInstaller
$startInfo.Arguments = "--quiet"
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$process = [Diagnostics.Process]::Start($startInfo)
if (-not $process) {
  throw "Could not start the connector installer."
}
$process.WaitForExit()
if ($process.ExitCode -ne 0) {
  throw "Connector installer failed with exit code $($process.ExitCode)."
}

$health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:47623/providers" -TimeoutSec 10
$providers = @($health.providers | Where-Object { $_.installed } | ForEach-Object { $_.id }) -join ", "
Write-Host "[OK] Per-user connector installed and running. Provider: $providers"
