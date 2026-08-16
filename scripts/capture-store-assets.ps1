$ErrorActionPreference = "Stop"

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tmpRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot "tmp"))
$serverProcess = $null
$profiles = [Collections.Generic.List[string]]::new()

if (-not (Test-Path -LiteralPath $chromePath)) {
  throw "Chrome executable not found at $chromePath"
}

function Wait-Http([string]$Url) {
  for ($attempt = 0; $attempt -lt 80; $attempt += 1) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 1 | Out-Null
      return
    } catch {
      Start-Sleep -Milliseconds 100
    }
  }
  throw "Timed out waiting for $Url"
}

function Capture-Page([string]$Url, [int]$Port, [string]$TargetPattern, [string]$Script, [string]$Output) {
  $profile = Join-Path $tmpRoot ("store-capture-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $profile -Force | Out-Null
  $profiles.Add($profile)
  $arguments = @(
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$profile",
    "--window-size=1280,800",
    $Url
  )
  $chromeProcess = Start-Process -FilePath $chromePath -ArgumentList $arguments -WindowStyle Hidden -PassThru
  try {
    $target = $null
    for ($attempt = 0; $attempt -lt 80 -and -not $target; $attempt += 1) {
      try {
        $targetResponse = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 1
        $targets = $targetResponse.Content | ConvertFrom-Json
        $target = $targets |
          Where-Object { $_.type -eq "page" -and $_.url -like $TargetPattern } |
          Select-Object -First 1
      } catch {
        Start-Sleep -Milliseconds 100
      }
    }
    if (-not $target) {
      throw "Chrome DevTools target not found for $Url"
    }
    & node $Script $target.webSocketDebuggerUrl $Output
    if ($LASTEXITCODE -ne 0) {
      throw "Store screenshot validation failed for $Url"
    }
  } finally {
    Stop-Process -Id $chromeProcess.Id -Force -ErrorAction SilentlyContinue
  }
}

try {
  New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
  $serverProcess = Start-Process -FilePath "python" -ArgumentList @("-m", "http.server", "8134", "--bind", "127.0.0.1") -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
  Wait-Http "http://127.0.0.1:8134/tests/social-harness.html"

  Capture-Page `
    "http://127.0.0.1:8134/tests/social-harness.html" `
    9237 `
    "*social-harness.html*" `
    (Join-Path $repoRoot "tests\social-cdp.mjs") `
    (Join-Path $repoRoot "store-assets\screenshot-2-1280x800.png")

  Capture-Page `
    "http://127.0.0.1:8134/options.html" `
    9238 `
    "*options.html*" `
    (Join-Path $repoRoot "tests\options-cdp.mjs") `
    (Join-Path $repoRoot "store-assets\screenshot-1-1280x800.png")
} finally {
  if ($serverProcess) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
  $validatedTmpPrefix = $tmpRoot.TrimEnd("\") + "\"
  foreach ($profile in $profiles) {
    $resolved = [IO.Path]::GetFullPath($profile)
    if ($resolved.StartsWith($validatedTmpPrefix, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolved)) {
      Remove-Item -LiteralPath $resolved -Recurse -Force
    }
  }
}

Get-Item `
  (Join-Path $repoRoot "store-assets\screenshot-1-1280x800.png"), `
  (Join-Path $repoRoot "store-assets\screenshot-2-1280x800.png") |
  Select-Object Name, Length, LastWriteTime
