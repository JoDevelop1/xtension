using System.Diagnostics;
using System.IO.Compression;
using System.Net.Http;
using System.Reflection;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Win32;

namespace Xtension.Bridge.Installer;

internal static class Program
{
    private const string ServiceName = "XtensionBridge";
    private const int DefaultPort = 47623;
    private const string UninstallRegistryKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\XtensionBridge";

    private static int Main(string[] args)
    {
        var uninstallMode = HasArg(args, "--uninstall");
        var fromTemp = HasArg(args, "--from-temp");
        var quietMode = HasArg(args, "--quiet") || HasArg(args, "/quiet") || HasArg(args, "/qn");
        if (uninstallMode && !fromTemp && TryRelaunchUninstallerFromTemp())
        {
            return 0;
        }

        Console.Title = uninstallMode ? "Xtension Bridge Uninstall" : "Xtension Bridge Setup";
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

    private static bool HasArg(IEnumerable<string> args, string expected)
    {
        return args.Any(arg => string.Equals(arg, expected, StringComparison.OrdinalIgnoreCase));
    }

    private static void Install()
    {
        if (!IsAdministrator())
        {
            throw new InvalidOperationException("Run this installer as administrator.");
        }

        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Xtension", "Bridge");
        var dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Xtension", "Bridge");
        var logDir = Path.Combine(dataDir, "logs");
        var serviceTempDir = Path.Combine(dataDir, "temp");
        var tempDir = Path.Combine(Path.GetTempPath(), "XtensionBridgeSetup-" + Guid.NewGuid().ToString("N"));

        try
        {
            Step("Preparing installer payload.");
            Directory.CreateDirectory(tempDir);
            ExtractPayload(tempDir);

            Step("Stopping previous Xtension Bridge service if needed.");
            StopAndDeleteServiceIfExists();
            StopExistingBridgeProcesses();
            DeleteLegacyStartupTaskIfExists();

            Step("Copying signed bridge files.");
            Directory.CreateDirectory(installDir);
            Directory.CreateDirectory(logDir);
            Directory.CreateDirectory(serviceTempDir);
            File.Copy(Path.Combine(tempDir, "XtensionBridge.exe"), Path.Combine(installDir, "XtensionBridge.exe"), true);
            File.Copy(Path.Combine(tempDir, "XtensionBridgeService.exe"), Path.Combine(installDir, "XtensionBridgeService.exe"), true);
            var installedSetup = CopyInstallerToInstallDir(installDir);

            Step("Writing service configuration.");
            WriteServiceConfig(installDir, logDir, serviceTempDir, userProfile);

            Step("Creating Windows service.");
            CreateService(installDir);

            Step("Starting Windows service.");
            StartService();

            Step("Checking local bridge endpoint.");
            var providers = WaitForProvidersAsync().GetAwaiter().GetResult();
            Log("Detected providers: " + providers);

            Step("Registering Windows uninstall entry.");
            RegisterUninstallEntry(installDir, installedSetup);
        }
        finally
        {
            TryDeleteDirectory(tempDir);
        }
    }

    private static void Uninstall()
    {
        if (!IsAdministrator())
        {
            throw new InvalidOperationException("Run this uninstaller as administrator.");
        }

        var installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Xtension", "Bridge");

        Step("Stopping Xtension Bridge service.");
        StopAndDeleteServiceIfExists();
        StopExistingBridgeProcesses();
        DeleteLegacyStartupTaskIfExists();

        Step("Removing installed files.");
        RemoveInstalledFiles(installDir);

        Step("Removing Windows uninstall entry.");
        Registry.LocalMachine.DeleteSubKeyTree(UninstallRegistryKey, false);
    }

    private static bool IsAdministrator()
    {
        using var identity = WindowsIdentity.GetCurrent();
        var principal = new WindowsPrincipal(identity);
        return principal.IsInRole(WindowsBuiltInRole.Administrator);
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

    private static void StopAndDeleteServiceIfExists()
    {
        if (!ServiceExists(ServiceName))
        {
            return;
        }

        using var service = new ServiceController(ServiceName);
        if (service.Status != ServiceControllerStatus.Stopped && service.Status != ServiceControllerStatus.StopPending)
        {
            service.Stop();
        }

        service.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(25));
        RunProcess("sc.exe", $"delete {ServiceName}", TimeSpan.FromSeconds(20));

        var deadline = DateTimeOffset.Now.AddSeconds(20);
        while (ServiceExists(ServiceName) && DateTimeOffset.Now < deadline)
        {
            Thread.Sleep(500);
        }
    }

    private static bool ServiceExists(string serviceName)
    {
        return ServiceController.GetServices().Any(service => string.Equals(service.ServiceName, serviceName, StringComparison.OrdinalIgnoreCase));
    }

    private static void StopExistingBridgeProcesses()
    {
        foreach (var process in Process.GetProcessesByName("XtensionBridge"))
        {
            try
            {
                Log($"Stopping existing bridge process {process.Id}.");
                process.Kill(entireProcessTree: true);
                process.WaitForExit(5000);
            }
            catch (Exception error)
            {
                Log($"Could not stop process {process.Id}: {error.Message}");
            }
            finally
            {
                process.Dispose();
            }
        }
    }

    private static void DeleteLegacyStartupTaskIfExists()
    {
        try
        {
            RunProcess("schtasks.exe", $"/Delete /TN {Quote(ServiceName)} /F", TimeSpan.FromSeconds(20), allowExitCodes: new[] { 0, 1 });
        }
        catch (Exception error)
        {
            Log($"Could not remove legacy startup task: {error.Message}");
        }
    }

    private static void RemoveInstalledFiles(string installDir)
    {
        if (!Directory.Exists(installDir))
        {
            return;
        }

        var currentPath = Environment.ProcessPath ?? "";
        foreach (var file in Directory.EnumerateFiles(installDir, "*", SearchOption.AllDirectories))
        {
            if (SamePath(file, currentPath))
            {
                continue;
            }

            File.SetAttributes(file, FileAttributes.Normal);
            File.Delete(file);
        }

        foreach (var directory in Directory.EnumerateDirectories(installDir, "*", SearchOption.AllDirectories).OrderByDescending(path => path.Length))
        {
            if (!Directory.EnumerateFileSystemEntries(directory).Any())
            {
                Directory.Delete(directory);
            }
        }

        if (!Directory.EnumerateFileSystemEntries(installDir).Any())
        {
            Directory.Delete(installDir);
        }
    }

    private static void WriteServiceConfig(string installDir, string logDir, string serviceTempDir, string userProfile)
    {
        var environment = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["XTENSION_BRIDGE_PORT"] = DefaultPort.ToString(),
            ["XTENSION_BRIDGE_LOG_FILE"] = Path.Combine(logDir, "bridge.log"),
            ["TEMP"] = serviceTempDir,
            ["TMP"] = serviceTempDir
        };

        AddIfFound(environment, "CODEX_HOME", Path.Combine(userProfile, ".codex"));
        AddIfFound(environment, "HOMEDRIVE", GetHomeDrive(userProfile));
        AddIfFound(environment, "HOMEPATH", GetHomePath(userProfile));
        AddIfFound(environment, "USERNAME", GetUserNameFromProfile(userProfile));
        AddIfFound(environment, "USERDOMAIN", Environment.UserDomainName);
        AddIfFound(environment, "CODEX_CLI", ResolveCommandPath("codex", userProfile, Path.Combine(userProfile, "AppData", "Roaming", "npm", "codex.cmd")));
        AddIfFound(environment, "GROK_CLI", ResolveCommandPath("grok", userProfile, Path.Combine(userProfile, ".grok", "bin", "grok.exe")));
        AddIfFound(environment, "GEMINI_CLI", ResolveCommandPath("gemini", userProfile, Path.Combine(userProfile, "AppData", "Roaming", "npm", "gemini.cmd")));
        AddIfFound(environment, "CLAUDE_CLI", ResolveCommandPath("claude", userProfile, Path.Combine(userProfile, ".local", "bin", "claude.exe")));

        var config = new BridgeServiceConfig
        {
            BridgeExe = Path.Combine(installDir, "XtensionBridge.exe"),
            WorkingDirectory = installDir,
            UserProfile = userProfile,
            LogDirectory = logDir,
            RestartDelayMs = 2000,
            Environment = environment
        };

        var options = new JsonSerializerOptions
        {
            WriteIndented = true
        };
        File.WriteAllText(Path.Combine(installDir, "bridge-service.json"), JsonSerializer.Serialize(config, options));
    }

    private static void AddIfFound(IDictionary<string, string> target, string key, string value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            target[key] = value;
        }
    }

    private static string ResolveCommandPath(string commandName, string userProfile, params string[] fallbacks)
    {
        var pathEntries = new[]
            {
                Path.Combine(userProfile, "AppData", "Roaming", "npm"),
                Path.Combine(userProfile, ".local", "bin"),
                Path.Combine(userProfile, ".grok", "bin")
            }
            .Concat((Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

        var extensions = commandName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) || commandName.EndsWith(".cmd", StringComparison.OrdinalIgnoreCase)
            ? new[] { "" }
            : new[] { ".exe", ".cmd", ".bat", "" };

        foreach (var directory in pathEntries.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            foreach (var extension in extensions)
            {
                var candidate = Path.Combine(directory, commandName + extension);
                if (File.Exists(candidate))
                {
                    return Path.GetFullPath(candidate);
                }
            }
        }

        foreach (var fallback in fallbacks)
        {
            if (File.Exists(fallback))
            {
                return Path.GetFullPath(fallback);
            }
        }

        return "";
    }

    private static string GetHomeDrive(string userProfile)
    {
        var root = Path.GetPathRoot(userProfile);
        return string.IsNullOrWhiteSpace(root)
            ? ""
            : root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
    }

    private static string GetHomePath(string userProfile)
    {
        var root = Path.GetPathRoot(userProfile);
        if (string.IsNullOrWhiteSpace(root) || !userProfile.StartsWith(root, StringComparison.OrdinalIgnoreCase))
        {
            return userProfile;
        }

        var rootWithoutSlash = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return userProfile[rootWithoutSlash.Length..];
    }

    private static string GetUserNameFromProfile(string userProfile)
    {
        return Path.GetFileName(userProfile.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
    }

    private static void CreateService(string installDir)
    {
        var serviceExe = Path.Combine(installDir, "XtensionBridgeService.exe");
        RunProcess("sc.exe", $"create {ServiceName} binPath= {Quote(serviceExe)} start= auto DisplayName= {Quote("Xtension Bridge")}", TimeSpan.FromSeconds(20));
        RunProcess("sc.exe", $"description {ServiceName} {Quote("Runs the local Xtension AI bridge for browser extension reply tools.")}", TimeSpan.FromSeconds(20));
        RunProcess("sc.exe", $"failure {ServiceName} reset= 86400 actions= restart/5000/restart/30000/restart/60000", TimeSpan.FromSeconds(20));
    }

    private static void StartService()
    {
        RunProcess("sc.exe", $"start {ServiceName}", TimeSpan.FromSeconds(20), allowExitCodes: new[] { 0, 1056 });
        using var service = new ServiceController(ServiceName);
        service.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(25));
    }

    private static void RegisterUninstallEntry(string installDir, string installedSetup)
    {
        using var key = Registry.LocalMachine.CreateSubKey(UninstallRegistryKey, true)
            ?? throw new InvalidOperationException("Unable to create uninstall registry entry.");

        key.SetValue("DisplayName", "Xtension Bridge");
        key.SetValue("DisplayVersion", "0.4.16");
        key.SetValue("Publisher", "NOVA2G");
        key.SetValue("InstallLocation", installDir);
        key.SetValue("DisplayIcon", installedSetup);
        key.SetValue("UninstallString", $"{Quote(installedSetup)} --uninstall");
        key.SetValue("QuietUninstallString", $"{Quote(installedSetup)} --uninstall");
        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        key.SetValue("EstimatedSize", EstimateInstallSizeKb(installDir), RegistryValueKind.DWord);
    }

    private static int EstimateInstallSizeKb(string installDir)
    {
        if (!Directory.Exists(installDir))
        {
            return 0;
        }

        var bytes = Directory.EnumerateFiles(installDir, "*", SearchOption.AllDirectories)
            .Select(file => new FileInfo(file).Length)
            .Sum();
        return (int)Math.Min(int.MaxValue, Math.Max(1, bytes / 1024));
    }

    private static async Task<string> WaitForProvidersAsync()
    {
        using var client = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(4)
        };

        Exception? lastError = null;
        var deadline = DateTimeOffset.Now.AddSeconds(25);
        while (DateTimeOffset.Now < deadline)
        {
            try
            {
                using var response = await client.GetAsync($"http://127.0.0.1:{DefaultPort}/providers");
                response.EnsureSuccessStatusCode();
                var json = await response.Content.ReadAsStringAsync();
                using var document = JsonDocument.Parse(json);
                if (document.RootElement.TryGetProperty("providers", out var providers) && providers.ValueKind == JsonValueKind.Array)
                {
                    var installed = providers.EnumerateArray()
                        .Where(item => item.TryGetProperty("installed", out var installedValue) && installedValue.GetBoolean())
                        .Select(item => item.TryGetProperty("id", out var id) ? id.GetString() : "")
                        .Where(value => !string.IsNullOrWhiteSpace(value))
                        .ToArray();
                    return installed.Length > 0 ? string.Join(", ", installed) : "none";
                }

                return "unknown";
            }
            catch (Exception error)
            {
                lastError = error;
                await Task.Delay(700);
            }
        }

        throw new InvalidOperationException("The service was installed, but the local bridge endpoint did not answer: " + lastError?.Message);
    }

    private static void RunProcess(string fileName, string arguments, TimeSpan timeout, IReadOnlyCollection<int>? allowExitCodes = null)
    {
        allowExitCodes ??= new[] { 0 };
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            }
        };

        process.Start();
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit((int)timeout.TotalMilliseconds))
        {
            process.Kill(entireProcessTree: true);
            throw new InvalidOperationException($"{fileName} timed out.");
        }

        var output = outputTask.GetAwaiter().GetResult().Trim();
        var error = errorTask.GetAwaiter().GetResult().Trim();
        if (!allowExitCodes.Contains(process.ExitCode))
        {
            var details = string.Join(Environment.NewLine, new[] { output, error }.Where(value => !string.IsNullOrWhiteSpace(value)));
            throw new InvalidOperationException($"{fileName} failed with exit code {process.ExitCode}.{Environment.NewLine}{details}");
        }
    }

    private static bool TryRelaunchUninstallerFromTemp()
    {
        var currentPath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(currentPath) || !File.Exists(currentPath))
        {
            return false;
        }

        var installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Xtension", "Bridge");
        if (!Path.GetFullPath(currentPath).StartsWith(Path.GetFullPath(installDir), StringComparison.OrdinalIgnoreCase))
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
                UseShellExecute = false
            });
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    private static bool SamePath(string left, string right)
    {
        return string.Equals(Path.GetFullPath(left).TrimEnd(Path.DirectorySeparatorChar), Path.GetFullPath(right).TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase);
    }

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
            // Temporary cleanup must not hide the install result.
        }
    }

    private static void Step(string message)
    {
        Log("");
        Log(message);
    }

    private static void Log(string message)
    {
        Console.WriteLine(message);
    }

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

internal sealed class BridgeServiceConfig
{
    [JsonPropertyName("bridgeExe")]
    public string BridgeExe { get; set; } = "";

    [JsonPropertyName("workingDirectory")]
    public string WorkingDirectory { get; set; } = "";

    [JsonPropertyName("userProfile")]
    public string UserProfile { get; set; } = "";

    [JsonPropertyName("logDirectory")]
    public string LogDirectory { get; set; } = "";

    [JsonPropertyName("restartDelayMs")]
    public int RestartDelayMs { get; set; }

    [JsonPropertyName("environment")]
    public SortedDictionary<string, string> Environment { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}
