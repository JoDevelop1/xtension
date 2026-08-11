param(
  [string]$InstallerPath = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$package = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "package.json") | ConvertFrom-Json
$expectedVersion = [string]$package.version

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

# /ping est la seule route joignable sans origine d'extension : elle confirme que
# le connecteur repond sans exposer le compte ChatGPT a un appelant local.
$ping = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:47623/ping" -TimeoutSec 10
if (-not $ping.ok) {
  throw "The connector answered on the loopback port but reported an unexpected state."
}
if ([string]$ping.version -ne $expectedVersion) {
  throw "Connector version mismatch after installation. Expected $expectedVersion, received $($ping.version)."
}
Write-Host "[OK] Per-user connector installed and answering on http://127.0.0.1:47623."
Write-Host "     Version: $($ping.version)"
Write-Host "     Open the Xtension options page to check the Codex and ChatGPT account status."
