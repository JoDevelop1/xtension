param(
  [string[]]$Target = @(),
  [string]$ClonyVoiceRoot = "C:\Users\Jonathan\Documents\Workspace\clonyvoice"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $Target -or $Target.Count -eq 0) {
  $Target = @(
    (Join-Path $repoRoot "dist\bridge\XtensionBridge.exe"),
    (Join-Path $repoRoot "dist\bridge-service\XtensionBridgeService.exe")
  )
}

$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
$signDlib = Join-Path $env:USERPROFILE ".nuget\packages\microsoft.trusted.signing.client\1.0.95\bin\x64\Azure.CodeSigning.Dlib.dll"
$signMetadata = Join-Path $ClonyVoiceRoot "trusted-signing.json"

if (-not (Test-Path -LiteralPath $signtool -PathType Leaf)) {
  throw "SignTool not found: $signtool"
}
if (-not (Test-Path -LiteralPath $signDlib -PathType Leaf)) {
  throw "Trusted Signing DLib not found: $signDlib"
}
if (-not (Test-Path -LiteralPath $signMetadata -PathType Leaf)) {
  throw "Trusted Signing metadata not found: $signMetadata"
}

$signedTargets = @()
foreach ($item in $Target) {
  $targetPath = Resolve-Path $item
  if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
    throw "Bridge executable not found: $targetPath"
  }

  & $signtool sign /v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 /dlib $signDlib /dmdf $signMetadata $targetPath
  if ($LASTEXITCODE -ne 0) {
    throw "Bridge signing failed with exit code $LASTEXITCODE"
  }

  & $signtool verify /pa /v $targetPath
  if ($LASTEXITCODE -ne 0) {
    throw "Bridge signature verification failed with exit code $LASTEXITCODE"
  }

  $signedTargets += $targetPath.Path
  Write-Host "[OK] Signed bridge component: $targetPath"
}

foreach ($group in ($signedTargets | Group-Object { Split-Path -Parent $_ })) {
  $lines = foreach ($targetPath in $group.Group) {
    $stream = [System.IO.File]::OpenRead($targetPath)
    try {
      $sha256 = [System.Security.Cryptography.SHA256]::Create()
      $hashBytes = $sha256.ComputeHash($stream)
      $hashValue = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
      "$hashValue  $(Split-Path -Leaf $targetPath)"
    } finally {
      if ($sha256) { $sha256.Dispose() }
      $stream.Dispose()
    }
  }

  $checksumPath = Join-Path $group.Name "SHA256SUMS.txt"
  Set-Content -LiteralPath $checksumPath -Value $lines -Encoding UTF8
}
