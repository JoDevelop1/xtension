param(
  [string]$Output = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $repoRoot "dist"
$bridgeExe = Join-Path $distDir "bridge\XtensionBridge.exe"
$serviceExe = Join-Path $distDir "bridge-service\XtensionBridgeService.exe"
$installScript = Join-Path $repoRoot "scripts\install-bridge-service.ps1"
$uninstallScript = Join-Path $repoRoot "scripts\uninstall-bridge-service.ps1"

if (-not $Output) {
  $Output = Join-Path $distDir "XtensionBridge-Windows.zip"
}

foreach ($file in @($bridgeExe, $serviceExe, $installScript, $uninstallScript)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw "Required bridge release file not found: $file"
  }
}

$stagingRoot = Join-Path $distDir "bridge-package"
$packageRoot = Join-Path $stagingRoot "XtensionBridge-Windows"
Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

Copy-Item -LiteralPath $bridgeExe -Destination (Join-Path $packageRoot "XtensionBridge.exe") -Force
Copy-Item -LiteralPath $serviceExe -Destination (Join-Path $packageRoot "XtensionBridgeService.exe") -Force
Copy-Item -LiteralPath $installScript -Destination (Join-Path $packageRoot "install-bridge-service.ps1") -Force
Copy-Item -LiteralPath $uninstallScript -Destination (Join-Path $packageRoot "uninstall-bridge-service.ps1") -Force

$readme = @"
Xtension Bridge for Windows

This package contains the signed Xtension bridge executables for Windows.

Run PowerShell as Administrator in this folder, then install the automatic Windows service:

  powershell -ExecutionPolicy Bypass -File .\install-bridge-service.ps1

The service is named XtensionBridge and listens on http://127.0.0.1:47623.
It detects Codex, Grok, Gemini, and Claude CLIs installed for the current Windows user.

To uninstall:

  powershell -ExecutionPolicy Bypass -File .\uninstall-bridge-service.ps1 -RemoveFiles
"@
Set-Content -LiteralPath (Join-Path $packageRoot "README.txt") -Value $readme -Encoding UTF8

Remove-Item -LiteralPath $Output -Force -ErrorAction SilentlyContinue
Compress-Archive -LiteralPath $packageRoot -DestinationPath $Output -Force

$stream = [System.IO.File]::OpenRead($Output)
try {
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  $hashBytes = $sha256.ComputeHash($stream)
  $hashValue = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
} finally {
  if ($sha256) { $sha256.Dispose() }
  $stream.Dispose()
}

Set-Content -LiteralPath (Join-Path $distDir "XtensionBridge-Windows.SHA256.txt") -Value "$hashValue  $(Split-Path -Leaf $Output)" -Encoding UTF8
Write-Host "[OK] Packaged bridge release: $Output"
