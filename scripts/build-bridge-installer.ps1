param(
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $repoRoot "dist"
$bridgeExe = Join-Path $distDir "bridge\XtensionBridge.exe"
$serviceExe = Join-Path $distDir "bridge-service\XtensionBridgeService.exe"
$payloadRoot = Join-Path $distDir "bridge-installer-payload"
$payloadDir = Join-Path $payloadRoot "payload"
$payloadZip = Join-Path $payloadRoot "XtensionBridgePayload.zip"
$installerProject = Join-Path $repoRoot "bridge-installer\Xtension.Bridge.Installer.csproj"

if (-not $OutputDir) {
  $OutputDir = Join-Path $distDir "bridge-installer"
}

foreach ($file in @($bridgeExe, $serviceExe, $installerProject)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw "Required installer input not found: $file"
  }
}

$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
if (-not (Test-Path -LiteralPath $signtool -PathType Leaf)) {
  throw "SignTool not found: $signtool"
}

foreach ($file in @($bridgeExe, $serviceExe)) {
  & $signtool verify /pa /q $file
  if ($LASTEXITCODE -ne 0) {
    throw "Installer payload must be signed before packaging: $file"
  }
}

Remove-Item -LiteralPath $payloadRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null
Copy-Item -LiteralPath $bridgeExe -Destination (Join-Path $payloadDir "XtensionBridge.exe") -Force
Copy-Item -LiteralPath $serviceExe -Destination (Join-Path $payloadDir "XtensionBridgeService.exe") -Force
Compress-Archive -Path (Join-Path $payloadDir "*") -DestinationPath $payloadZip -Force

dotnet publish $installerProject -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true -p:PublishTrimmed=false -o $OutputDir
if ($LASTEXITCODE -ne 0) {
  throw "Installer publish failed with exit code $LASTEXITCODE"
}

$installerExe = Join-Path $OutputDir "XtensionBridgeSetup.exe"
if (-not (Test-Path -LiteralPath $installerExe -PathType Leaf)) {
  throw "Installer executable was not created: $installerExe"
}

Write-Host "[OK] Built unsigned installer: $installerExe"
