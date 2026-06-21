param(
  [string]$InstallerPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $repoRoot "dist"
if (-not $InstallerPath) {
  $InstallerPath = Join-Path $distDir "bridge-installer\XtensionBridgeSetup.exe"
}

if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
  throw "Installer executable not found: $InstallerPath"
}

& (Join-Path $PSScriptRoot "sign-bridge.ps1") -Target @($InstallerPath)
if ($LASTEXITCODE -ne 0) {
  throw "Installer signing failed with exit code $LASTEXITCODE"
}

$signedInstaller = Resolve-Path -LiteralPath $InstallerPath
$releaseInstaller = Join-Path $distDir "XtensionBridgeSetup.exe"
Copy-Item -LiteralPath $signedInstaller.Path -Destination $releaseInstaller -Force

$stream = [System.IO.File]::OpenRead($releaseInstaller)
try {
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  $hashBytes = $sha256.ComputeHash($stream)
  $hashValue = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
} finally {
  if ($sha256) { $sha256.Dispose() }
  $stream.Dispose()
}

Set-Content -LiteralPath (Join-Path $distDir "XtensionBridgeSetup.SHA256.txt") -Value "$hashValue  XtensionBridgeSetup.exe" -Encoding UTF8
Write-Host "[OK] Signed installer: $releaseInstaller"
