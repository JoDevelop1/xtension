using System.Diagnostics;
using System.IO.Compression;
using System.Net.Http;
using System.Reflection;
using System.Security.Principal;
using System.Text.Json;
using Microsoft.Win32;

namespace Xtension.Bridge.Installer;

internal static class Program
{
    private const string ProductName = "Xtension Codex Connector";
    private const string RunValueName = "XtensionCodexConnector";
    private const string LegacyServiceName = "XtensionBridge";
    private const int DefaultPort = 47623;
    private const string RunRegistryKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string UninstallRegistryKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\XtensionBridge";
    private static readonly string ProductVersion = GetProductVersion();

    private static int Main(string[] args)
    {
        var uninstallMode = HasArg(args, "--uninstall");
        var fromTemp = HasArg(args, "--from-temp");
        var quietMode = HasArg(args, "--quiet") || HasArg(args, "/quiet") || HasArg(args, "/qn");
        if (uninstallMode && !fromTemp && TryRelaunchUninstallerFromTemp())
        {
            return 0;
        }

        Console.Title = uninstallMode ? "Xtension Codex Connector Uninstall" : "Xtension Codex Connector Setup";
        try
        {
            if (uninstallMode)
            {
                Uninstall();
                Log("Uninstall completed successfully.");
            }
            else
            {
                Install();
                Log("Installation completed successfully.");
            }

            PauseIfInteractive(quietMode);
            return 0;
        }
        catch (Exception error)
        {
            Log("");
            Log(uninstallMode ? "Uninstall failed:" : "Installation failed:");
            Log(error.Message);
            PauseIfInteractive(quietMode);
            return 1;
        }
    }

    private static void Install()
    {
        var installDir = GetInstallDirectory();
        var tempDir = Path.Combine(Path.GetTempPath(), "XtensionBridgeSetup-" + Guid.NewGuid().ToString("N"));

        try
        {
            Step("Preparing the Codex connector.");
            Directory.CreateDirectory(tempDir);
            ExtractPayload(tempDir);

            Step("Stopping the previous connector.");
            RemoveRunEntry();
            CleanupLegacyServiceIfPossible();
            StopInstalledProcesses(installDir);
            CleanupLegacyStartupTask();
            CleanupLegacyArtifacts();

            Step("Installing for the current Windows account.");
            Directory.CreateDirectory(installDir);
            File.Copy(Path.Combine(tempDir, "XtensionBridge.exe"), Path.Combine(installDir, "XtensionBridge.exe"), true);
            File.Copy(Path.Combine(tempDir, "XtensionBridgeHost.exe"), Path.Combine(installDir, "XtensionBridgeHost.exe"), true);
            var installedSetup = CopyInstallerToInstallDir(installDir);

            Step("Enabling automatic startup in this Windows session.");
            RegisterRunEntry(installDir);
            RegisterUninstallEntry(installDir, installedSetup);

            Step("Starting the connector.");
            StartHost(installDir);

            Step("Checking Codex availability.");
            var providers = WaitForProvidersAsync().GetAwaiter().GetResult();
            Log("Detected provider: " + providers);
        }
        finally
        {
            TryDeleteDirectory(tempDir);
        }
    }

    private static void Uninstall()
    {
        var installDir = GetInstallDirectory();

        Step("Disabling automatic startup.");
        RemoveRunEntry();

        Step("Stopping the connector.");
        CleanupLegacyServiceIfPossible();
        StopInstalledProcesses(installDir);
        CleanupLegacyStartupTask();
        CleanupLegacyArtifacts();

        Step("Removing installed files.");
        DeleteValidatedInstallDirectory(installDir);

        Step("Removing the uninstall entry.");
        Registry.CurrentUser.DeleteSubKeyTree(UninstallRegistryKey, false);
    }

    private static string GetInstallDirectory()
    {
        return Path.GetFullPath(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            "Xtension",
            "Bridge"));
    }

    private static void ExtractPayload(string destination)
    {
        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream("XtensionBridgePayload.zip")
            ?? throw new InvalidOperationException("Installer payload is missing.");

        var zipPath = Path.Combine(destination, "payload.zip");
        using (var file = File.Create(zipPath))
        {
            stream.CopyTo(file);
        }
        ZipFile.ExtractToDirectory(zipPath, destination, true);
    }

    private static string CopyInstallerToInstallDir(string installDir)
    {
        var currentInstaller = Environment.ProcessPath;
        var installedSetup = Path.Combine(installDir, "XtensionBridgeSetup.exe");
        if (!string.IsNullOrWhiteSpace(currentInstaller) && File.Exists(currentInstaller) && !SamePath(currentInstaller, installedSetup))
        {
            File.Copy(currentInstaller, installedSetup, true);
        }
        return installedSetup;
    }

    private static void RegisterRunEntry(string installDir)
    {
        var hostExe = Path.Combine(installDir, "XtensionBridgeHost.exe");
        using var key = Registry.CurrentUser.CreateSubKey(RunRegistryKey, true)
            ?? throw new InvalidOperationException("Unable to create the per-user startup entry.");
        key.SetValue(RunValueName, Quote(hostExe));
    }

    private static void RemoveRunEntry()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunRegistryKey, true);
        key?.DeleteValue(RunValueName, false);
    }

    private static void StartHost(string installDir)
    {
        var hostExe = Path.Combine(installDir, "XtensionBridgeHost.exe");
        var process = Process.Start(new ProcessStartInfo
        {
            FileName = hostExe,
            WorkingDirectory = installDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        });
        if (process is null)
        {
            throw new InvalidOperationException("The per-user connector host did not start.");
        }
        process.Dispose();
    }

    private static void StopInstalledProcesses(string installDir)
    {
        var allowedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            Path.GetFullPath(Path.Combine(installDir, "XtensionBridgeHost.exe")),
            Path.GetFullPath(Path.Combine(installDir, "XtensionBridge.exe"))
        };

        var legacyDir = Path.GetFullPath(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            "Xtension",
            "Bridge"));
        allowedPaths.Add(Path.Combine(legacyDir, "XtensionBridgeService.exe"));
        allowedPaths.Add(Path.Combine(legacyDir, "XtensionBridge.exe"));

        foreach (var processName in new[] { "XtensionBridgeHost", "XtensionBridge", "XtensionBridgeService" })
        {
            foreach (var process in Process.GetProcessesByName(processName))
            {
                try
                {
                    var executablePath = process.MainModule?.FileName;
                    if (string.IsNullOrWhiteSpace(executablePath) || !allowedPaths.Contains(Path.GetFullPath(executablePath)))
                    {
                        continue;
                    }

                    Log($"Stopping installed connector process {process.Id}.");
                    process.Kill(entireProcessTree: true);
                    process.WaitForExit(7000);
                }
                catch (Exception error)
                {
                    Log($"Could not stop connector process {process.Id}: {error.Message}");
                }
                finally
                {
                    process.Dispose();
                }
            }
        }
    }

    private static void CleanupLegacyServiceIfPossible()
    {
        if (!LegacyServiceExists())
        {
            return;
        }

        if (!IsAdministrator())
        {
            Log("A legacy Windows service still exists. Run this installer once as administrator if it prevents the connector from starting.");
            return;
        }

        RunProcess(SystemTool("sc.exe"), $"stop {LegacyServiceName}", TimeSpan.FromSeconds(20), new[] { 0, 1060, 1062 });
        RunProcess(SystemTool("sc.exe"), $"delete {LegacyServiceName}", TimeSpan.FromSeconds(20), new[] { 0, 1060, 1072 });
    }

    private static void CleanupLegacyStartupTask()
    {
        try
        {
            RunProcess(
                SystemTool("schtasks.exe"),
                $"/Delete /TN {Quote(LegacyServiceName)} /F",
                TimeSpan.FromSeconds(20),
                new[] { 0, 1 });
        }
        catch (Exception error)
        {
            Log("Could not remove the legacy startup task: " + error.Message);
        }
    }

    private static void CleanupLegacyArtifacts()
    {
        if (LegacyServiceExists())
        {
            return;
        }

        var legacyProgramData = Path.GetFullPath(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "Xtension",
            "Bridge"));
        try
        {
            if (Directory.Exists(legacyProgramData))
            {
                Directory.Delete(legacyProgramData, recursive: true);
            }
        }
        catch (Exception error)
        {
            Log("Could not remove the legacy system data: " + error.Message);
        }

        var currentData = Path.GetFullPath(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Xtension",
            "Bridge"));
        if (!Directory.Exists(currentData))
        {
            return;
        }

        var staleFiles = new[]
        {
            Path.Combine(currentData, "XtensionBridge.exe"),
            Path.Combine(currentData, "bridge.log")
        }
        .Concat(Directory.EnumerateFiles(currentData, "service-*.log", SearchOption.TopDirectoryOnly))
        .Concat(Directory.EnumerateFiles(currentData, "system-codex-*.log", SearchOption.TopDirectoryOnly))
        .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var staleFile in staleFiles)
        {
            try
            {
                if (File.Exists(staleFile) && IsPathInside(staleFile, currentData))
                {
                    File.Delete(staleFile);
                }
            }
            catch (Exception error)
            {
                Log($"Could not remove legacy file {Path.GetFileName(staleFile)}: {error.Message}");
            }
        }
    }

    private static bool LegacyServiceExists()
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = SystemTool("sc.exe"),
                Arguments = $"query {LegacyServiceName}",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            });
            if (process is null)
            {
                return false;
            }
            process.WaitForExit(5000);
            return process.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsAdministrator()
    {
        using var identity = WindowsIdentity.GetCurrent();
        return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
    }

    private static void RegisterUninstallEntry(string installDir, string installedSetup)
    {
        using var key = Registry.CurrentUser.CreateSubKey(UninstallRegistryKey, true)
            ?? throw new InvalidOperationException("Unable to create the uninstall entry.");
        key.SetValue("DisplayName", ProductName);
        key.SetValue("DisplayVersion", ProductVersion);
        key.SetValue("Publisher", "NOVA2G");
        key.SetValue("InstallLocation", installDir);
        key.SetValue("DisplayIcon", installedSetup);
        key.SetValue("UninstallString", $"{Quote(installedSetup)} --uninstall");
        key.SetValue("QuietUninstallString", $"{Quote(installedSetup)} --uninstall --quiet");
        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        key.SetValue("EstimatedSize", EstimateInstallSizeKb(installDir), RegistryValueKind.DWord);
    }

    private static int EstimateInstallSizeKb(string installDir)
    {
        var bytes = Directory.Exists(installDir)
            ? Directory.EnumerateFiles(installDir, "*", SearchOption.AllDirectories).Select(file => new FileInfo(file).Length).Sum()
            : 0;
        return (int)Math.Min(int.MaxValue, Math.Max(1, bytes / 1024));
    }

    private static string GetProductVersion()
    {
        var informational = Assembly.GetExecutingAssembly()
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;
        var version = (informational ?? Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0")
            .Split('+', 2)[0];
        return string.IsNullOrWhiteSpace(version) ? "0.0.0" : version;
    }

    private static async Task<string> WaitForProvidersAsync()
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
        Exception? lastError = null;
        var deadline = DateTimeOffset.Now.AddSeconds(30);
        while (DateTimeOffset.Now < deadline)
        {
            try
            {
                // /ping est la seule route joignable sans origine d'extension. Les routes
                // de statut exposeraient le compte ChatGPT a tout appelant local, elles
                // exigent donc desormais un en-tete Origin d'extension.
                using var response = await client.GetAsync($"http://127.0.0.1:{DefaultPort}/ping");
                response.EnsureSuccessStatusCode();
                var json = await response.Content.ReadAsStringAsync();
                using var document = JsonDocument.Parse(json);
                if (document.RootElement.TryGetProperty("ok", out var ok) && ok.GetBoolean())
                {
                    return "ready";
                }
                throw new InvalidOperationException("The connector answered with an unexpected state.");
            }
            catch (Exception error)
            {
                lastError = error;
                await Task.Delay(700);
            }
        }
        throw new InvalidOperationException("The connector was installed, but its local endpoint did not answer: " + lastError?.Message);
    }

    private static void DeleteValidatedInstallDirectory(string installDir)
    {
        var expected = GetInstallDirectory();
        if (!SamePath(installDir, expected))
        {
            throw new InvalidOperationException("Refusing to remove an unexpected install directory.");
        }
        if (Directory.Exists(expected))
        {
            Directory.Delete(expected, recursive: true);
        }
    }

    private static bool TryRelaunchUninstallerFromTemp()
    {
        var currentPath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(currentPath) || !File.Exists(currentPath))
        {
            return false;
        }
        if (!IsPathInside(currentPath, GetInstallDirectory()))
        {
            return false;
        }

        try
        {
            var tempPath = Path.Combine(Path.GetTempPath(), "XtensionBridgeUninstall-" + Guid.NewGuid().ToString("N") + ".exe");
            File.Copy(currentPath, tempPath, true);
            Process.Start(new ProcessStartInfo
            {
                FileName = tempPath,
                Arguments = "--uninstall --from-temp",
                UseShellExecute = false,
                CreateNoWindow = true
            });
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Chemin absolu d'un utilitaire systeme sous %SystemRoot%\System32.
    /// Lancer "sc.exe" ou "schtasks.exe" par nom seul laisse Windows parcourir le
    /// PATH : un binaire homonyme place dans un repertoire inscriptible et situe
    /// plus tot dans le PATH serait execute a la place du binaire systeme.
    /// </summary>
    private static string SystemTool(string executableName)
    {
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), executableName);
    }

    private static void RunProcess(string fileName, string arguments, TimeSpan timeout, IReadOnlyCollection<int> allowExitCodes)
    {
        using var process = Process.Start(new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        }) ?? throw new InvalidOperationException($"Unable to start {fileName}.");
        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit((int)timeout.TotalMilliseconds))
        {
            process.Kill(entireProcessTree: true);
            throw new InvalidOperationException($"{fileName} timed out.");
        }
        if (!allowExitCodes.Contains(process.ExitCode))
        {
            var details = string.Join(Environment.NewLine, new[] { output.GetAwaiter().GetResult(), error.GetAwaiter().GetResult() }.Where(value => !string.IsNullOrWhiteSpace(value)));
            throw new InvalidOperationException($"{fileName} failed with exit code {process.ExitCode}. {details}");
        }
    }

    private static bool HasArg(IEnumerable<string> args, string expected) =>
        args.Any(arg => string.Equals(arg, expected, StringComparison.OrdinalIgnoreCase));

    private static bool IsPathInside(string path, string directory)
    {
        var candidate = Path.GetFullPath(path);
        var root = Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        return candidate.StartsWith(root, StringComparison.OrdinalIgnoreCase);
    }

    private static bool SamePath(string left, string right) =>
        string.Equals(
            Path.GetFullPath(left).TrimEnd(Path.DirectorySeparatorChar),
            Path.GetFullPath(right).TrimEnd(Path.DirectorySeparatorChar),
            StringComparison.OrdinalIgnoreCase);

    private static string Quote(string value) => "\"" + value.Replace("\"", "\\\"") + "\"";

    private static void TryDeleteDirectory(string directory)
    {
        try
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, true);
            }
        }
        catch
        {
            // Temporary cleanup must not hide the installation result.
        }
    }

    private static void Step(string message)
    {
        Log("");
        Log(message);
    }

    private static void Log(string message) => Console.WriteLine(message);

    private static void PauseIfInteractive(bool quietMode)
    {
        if (quietMode || !Environment.UserInteractive || Console.IsInputRedirected)
        {
            return;
        }
        Console.WriteLine("");
        Console.WriteLine("Press Enter to close.");
        Console.ReadLine();
    }
}
