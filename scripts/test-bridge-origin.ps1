$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$testPort = 47631
$nodePath = (Get-Command node -ErrorAction Stop).Source
$bridgeScript = Join-Path $repoRoot "scripts\xtension-ai-bridge.js"
$stdoutPath = Join-Path ([IO.Path]::GetTempPath()) ("xtension-origin-test-" + [guid]::NewGuid().ToString("N") + ".out.log")
$stderrPath = Join-Path ([IO.Path]::GetTempPath()) ("xtension-origin-test-" + [guid]::NewGuid().ToString("N") + ".err.log")
$httpHandler = [Net.Http.HttpClientHandler]::new()
$httpHandler.UseProxy = $false
$httpClient = [Net.Http.HttpClient]::new($httpHandler)
$httpClient.Timeout = [TimeSpan]::FromSeconds(2)
$env:XTENSION_BRIDGE_PORT = [string]$testPort
$bridgeProcess = Start-Process -FilePath $nodePath -ArgumentList @($bridgeScript) -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru

function Send-TestRequest([string]$Path, [string]$Origin = "") {
  $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, "http://127.0.0.1:$testPort$Path")
  if ($Origin) {
    $request.Headers.Add("Origin", $Origin)
  }
  try {
    $response = $httpClient.SendAsync($request).GetAwaiter().GetResult()
    $corsValues = $null
    $hasCors = $response.Headers.TryGetValues("Access-Control-Allow-Origin", [ref]$corsValues)
    return [pscustomobject]@{
      StatusCode = [int]$response.StatusCode
      Cors = if ($hasCors) { [string]($corsValues | Select-Object -First 1) } else { "" }
    }
  } finally {
    $request.Dispose()
    if ($response) { $response.Dispose() }
  }
}

try {
  $probe = $null
  for ($attempt = 0; $attempt -lt 200 -and -not $probe; $attempt += 1) {
    try {
      $candidate = Send-TestRequest "/ping"
      if ($candidate.StatusCode -eq 200) {
        $probe = $candidate
      }
    } catch {
      Start-Sleep -Milliseconds 100
    }
  }
  if (-not $probe) {
    $bridgeProcess.Refresh()
    $details = if ($bridgeProcess.HasExited) {
      " Process exited with code $($bridgeProcess.ExitCode). stderr: $(Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue)"
    } else {
      " Process is still running but did not answer. stdout: $(Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue) stderr: $(Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue)"
    }
    throw "Connector did not start on isolated port $testPort.$details"
  }

  $official = Send-TestRequest "/ping" "chrome-extension://mjimpcncnbcngljfdifglncblmljgfkm"
  $legacy = Send-TestRequest "/ping" "chrome-extension://bkcoigchdfenookfhogaokpmlkhekeai"
  $arbitrary = Send-TestRequest "/ping" "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  $website = Send-TestRequest "/ping" "https://evil.example"
  $noOriginHealth = Send-TestRequest "/health"

  $results = [ordered]@{
    Liveness = $probe.StatusCode
    OfficialStoreOrigin = $official.StatusCode
    OfficialCors = $official.Cors
    ExistingXtensionOrigin = $legacy.StatusCode
    ExistingXtensionCors = $legacy.Cors
    ArbitraryExtensionOrigin = $arbitrary.StatusCode
    WebsiteOrigin = $website.StatusCode
    NoOriginHealth = $noOriginHealth.StatusCode
  }
  if (
    $results.Liveness -ne 200 -or
    $results.OfficialStoreOrigin -ne 200 -or
    $results.OfficialCors -ne "chrome-extension://mjimpcncnbcngljfdifglncblmljgfkm" -or
    $results.ExistingXtensionOrigin -ne 200 -or
    $results.ExistingXtensionCors -ne "chrome-extension://bkcoigchdfenookfhogaokpmlkhekeai" -or
    $results.ArbitraryExtensionOrigin -ne 403 -or
    $results.WebsiteOrigin -ne 403 -or
    $results.NoOriginHealth -ne 403
  ) {
    throw "Unexpected connector origin policy: $($results | ConvertTo-Json -Compress)"
  }
  [pscustomobject]$results | Format-List
} finally {
  Stop-Process -Id $bridgeProcess.Id -Force -ErrorAction SilentlyContinue
  $httpClient.Dispose()
  $httpHandler.Dispose()
  Remove-Item Env:XTENSION_BRIDGE_PORT -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
}
