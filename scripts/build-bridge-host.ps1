$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$package = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "package.json") | ConvertFrom-Json
$version = [string]$package.version
if ($version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Invalid Xtension version in package.json: $version"
}

$project = Join-Path $repoRoot "bridge-service\Xtension.Bridge.Service.csproj"
$output = Join-Path $repoRoot "dist\bridge-service"
dotnet publish $project -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:PublishTrimmed=false -p:Version=$version -p:InformationalVersion=$version -o $output
if ($LASTEXITCODE -ne 0) {
  throw "Connector host publish failed with exit code $LASTEXITCODE"
}

Write-Host "[OK] Built connector host v$version in $output"
