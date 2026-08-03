$ErrorActionPreference = "Stop"

$installDir = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "Programs\Xtension\Bridge"
$installer = Join-Path $installDir "XtensionBridgeSetup.exe"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  Write-Host "[OK] Xtension Codex Connector is not installed for this Windows account."
  exit 0
}

$resolvedInstallDir = [IO.Path]::GetFullPath($installDir).TrimEnd("\")
$expectedInstallDir = [IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "Programs\Xtension\Bridge")).TrimEnd("\")
if (-not $resolvedInstallDir.Equals($expectedInstallDir, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to uninstall from an unexpected directory: $resolvedInstallDir"
}

$tempInstaller = Join-Path ([IO.Path]::GetTempPath()) ("XtensionBridgeUninstall-" + [Guid]::NewGuid().ToString("N") + ".exe")
Copy-Item -LiteralPath $installer -Destination $tempInstaller -Force
$startInfo = [Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $tempInstaller
$startInfo.Arguments = "--uninstall --from-temp --quiet"
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$process = [Diagnostics.Process]::Start($startInfo)
if (-not $process) {
  throw "Could not start the connector uninstaller."
}
$process.WaitForExit()
if ($process.ExitCode -ne 0) {
  throw "Connector uninstaller failed with exit code $($process.ExitCode)."
}
Remove-Item -LiteralPath $tempInstaller -Force -ErrorAction SilentlyContinue
Write-Host "[OK] Per-user connector uninstalled."
