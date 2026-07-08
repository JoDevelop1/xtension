using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Xtension.Bridge.Service;

internal static class Program
{
    private static int Main(string[] args)
    {
        var config = BridgeServiceConfig.Load(args);
        var service = new XtensionBridgeWindowsService(config);

        if (Environment.UserInteractive || args.Contains("--console", StringComparer.OrdinalIgnoreCase))
        {
            return service.RunConsoleAsync().GetAwaiter().GetResult();
        }

        ServiceBase.Run(service);
        return 0;
    }
}

internal sealed class BridgeServiceConfig
{
    [JsonPropertyName("bridgeExe")]
    public string BridgeExe { get; set; } = Path.Combine(AppContext.BaseDirectory, "XtensionBridge.exe");

    [JsonPropertyName("workingDirectory")]
    public string WorkingDirectory { get; set; } = AppContext.BaseDirectory;

    [JsonPropertyName("userProfile")]
    public string UserProfile { get; set; } = "";

    [JsonPropertyName("logDirectory")]
    public string LogDirectory { get; set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "Xtension",
        "Bridge",
        "logs");

    [JsonPropertyName("restartDelayMs")]
    public int RestartDelayMs { get; set; } = 2000;

    [JsonPropertyName("runBridgeInUserSession")]
    public bool RunBridgeInUserSession { get; set; } = true;

    [JsonPropertyName("environment")]
    public Dictionary<string, string> EnvironmentVariables { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public static BridgeServiceConfig Load(string[] args)
    {
        var configPath = GetConfigPath(args);
        if (!File.Exists(configPath))
        {
            return Normalize(new BridgeServiceConfig());
        }

        var json = File.ReadAllText(configPath);
        var config = JsonSerializer.Deserialize<BridgeServiceConfig>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? new BridgeServiceConfig();

        return Normalize(config);
    }

    private static string GetConfigPath(string[] args)
    {
        for (var index = 0; index < args.Length - 1; index += 1)
        {
            if (string.Equals(args[index], "--config", StringComparison.OrdinalIgnoreCase))
            {
                return Path.GetFullPath(args[index + 1]);
            }
        }

        return Path.Combine(AppContext.BaseDirectory, "bridge-service.json");
    }

    private static BridgeServiceConfig Normalize(BridgeServiceConfig config)
    {
        config.BridgeExe = ExpandFullPath(config.BridgeExe, Path.Combine(AppContext.BaseDirectory, "XtensionBridge.exe"));
        config.WorkingDirectory = ExpandFullPath(config.WorkingDirectory, AppContext.BaseDirectory);
        config.LogDirectory = ExpandFullPath(config.LogDirectory, Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "Xtension",
            "Bridge",
            "logs"));
        config.UserProfile = ExpandFullPath(config.UserProfile, Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));
        config.RestartDelayMs = Math.Clamp(config.RestartDelayMs, 500, 60000);
        config.EnvironmentVariables ??= new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        return config;
    }

    private static string ExpandFullPath(string? value, string fallback)
    {
        var raw = string.IsNullOrWhiteSpace(value) ? fallback : value;
        return Path.GetFullPath(Environment.ExpandEnvironmentVariables(raw));
    }
}

internal sealed class XtensionBridgeWindowsService : ServiceBase
{
    private readonly BridgeServiceConfig config;
    private readonly object syncRoot = new();
    private CancellationTokenSource? stopTokenSource;
    private Task? supervisorTask;
    private Process? bridgeProcess;

    public XtensionBridgeWindowsService(BridgeServiceConfig config)
    {
        this.config = config;
        ServiceName = "XtensionBridge";
        CanStop = true;
        AutoLog = true;
    }

    public async Task<int> RunConsoleAsync()
    {
        Console.WriteLine("Xtension Bridge Service host running in console mode.");
        OnStart(Array.Empty<string>());

        using var consoleStop = new CancellationTokenSource();
        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            consoleStop.Cancel();
        };

        try
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, consoleStop.Token);
        }
        catch (OperationCanceledException)
        {
            // Normal console shutdown.
        }

        OnStop();
        return 0;
    }

    protected override void OnStart(string[] args)
    {
        Directory.CreateDirectory(config.LogDirectory);
        EnsureBridgeWritablePaths();
        WriteLog("Service starting.");
        stopTokenSource = new CancellationTokenSource();
        supervisorTask = Task.Run(() => RunSupervisorAsync(stopTokenSource.Token));
    }

    protected override void OnStop()
    {
        WriteLog("Service stopping.");
        stopTokenSource?.Cancel();
        StopBridgeProcess();

        try
        {
            supervisorTask?.Wait(TimeSpan.FromSeconds(10));
        }
        catch (AggregateException error)
        {
            WriteLog($"Supervisor stop error: {error.Flatten().InnerException?.Message ?? error.Message}");
        }

        stopTokenSource?.Dispose();
        stopTokenSource = null;
        supervisorTask = null;
        WriteLog("Service stopped.");
    }

    private async Task RunSupervisorAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                if (!File.Exists(config.BridgeExe))
                {
                    WriteLog($"Bridge executable not found: {config.BridgeExe}");
                    await Task.Delay(config.RestartDelayMs, cancellationToken);
                    continue;
                }

                using var process = StartBridgeProcess();
                lock (syncRoot)
                {
                    bridgeProcess = process;
                }

                WriteLog($"Bridge process started: pid={process.Id}");
                await process.WaitForExitAsync(cancellationToken);

                var exitCode = process.HasExited ? process.ExitCode.ToString() : "unknown";
                lock (syncRoot)
                {
                    if (ReferenceEquals(bridgeProcess, process))
                    {
                        bridgeProcess = null;
                    }
                }

                if (!cancellationToken.IsCancellationRequested)
                {
                    WriteLog($"Bridge process exited with code {exitCode}; restarting.");
                    await Task.Delay(config.RestartDelayMs, cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception error)
            {
                WriteLog($"Supervisor error: {error}");
                try
                {
                    await Task.Delay(config.RestartDelayMs, cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }

    private Process StartBridgeProcess()
    {
        Directory.CreateDirectory(config.WorkingDirectory);

        if (config.RunBridgeInUserSession && !Environment.UserInteractive)
        {
            try
            {
                if (TryStartBridgeProcessInActiveUserSession(out var userProcess))
                {
                    return userProcess;
                }
            }
            catch (Exception error)
            {
                WriteLog($"Active user launch failed: {error}");
            }

            WriteLog("Active user launch unavailable; falling back to service account launch.");
        }

        return StartBridgeProcessWithServiceToken();
    }

    private Process StartBridgeProcessWithServiceToken()
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = config.BridgeExe,
            WorkingDirectory = config.WorkingDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        ApplyEnvironment(startInfo);

        var process = new Process
        {
            StartInfo = startInfo,
            EnableRaisingEvents = true
        };

        process.OutputDataReceived += (_, eventArgs) =>
        {
            if (!string.IsNullOrWhiteSpace(eventArgs.Data))
            {
                WriteBridgeLog("stdout", eventArgs.Data);
            }
        };
        process.ErrorDataReceived += (_, eventArgs) =>
        {
            if (!string.IsNullOrWhiteSpace(eventArgs.Data))
            {
                WriteBridgeLog("stderr", eventArgs.Data);
            }
        };

        if (!process.Start())
        {
            throw new InvalidOperationException("Bridge process did not start.");
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return process;
    }

    private bool TryStartBridgeProcessInActiveUserSession(out Process process)
    {
        process = null!;
        var sessionId = WTSGetActiveConsoleSessionId();
        if (sessionId == uint.MaxValue)
        {
            WriteLog("No active console session found.");
            return false;
        }

        var userToken = IntPtr.Zero;
        var primaryToken = IntPtr.Zero;
        var environmentBlock = IntPtr.Zero;
        PROCESS_INFORMATION processInfo = default;

        try
        {
            if (!WTSQueryUserToken(sessionId, out userToken))
            {
                WriteLog($"WTSQueryUserToken failed for session {sessionId}: {GetLastWin32Error()}");
                return false;
            }

            if (!DuplicateTokenEx(
                    userToken,
                    TokenForPrimaryProcess,
                    IntPtr.Zero,
                    SecurityImpersonation,
                    TokenPrimary,
                    out primaryToken))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "DuplicateTokenEx failed.");
            }

            var environment = BuildBridgeEnvironment(CreateUserEnvironment(primaryToken));
            environmentBlock = CreateNativeEnvironmentBlock(environment);

            var startupInfo = new STARTUPINFO
            {
                cb = Marshal.SizeOf<STARTUPINFO>(),
                lpDesktop = @"winsta0\default"
            };

            var commandLine = QuoteCommandLine(config.BridgeExe);
            if (!CreateProcessAsUser(
                    primaryToken,
                    config.BridgeExe,
                    commandLine,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    false,
                    CreateNoWindow | CreateUnicodeEnvironment,
                    environmentBlock,
                    config.WorkingDirectory,
                    ref startupInfo,
                    out processInfo))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateProcessAsUser failed.");
            }

            process = Process.GetProcessById((int)processInfo.dwProcessId);
            WriteLog($"Bridge process started in active user session {sessionId}: pid={process.Id}");
            return true;
        }
        finally
        {
            if (processInfo.hProcess != IntPtr.Zero)
            {
                CloseHandle(processInfo.hProcess);
            }

            if (processInfo.hThread != IntPtr.Zero)
            {
                CloseHandle(processInfo.hThread);
            }

            if (environmentBlock != IntPtr.Zero)
            {
                Marshal.FreeHGlobal(environmentBlock);
            }

            if (primaryToken != IntPtr.Zero)
            {
                CloseHandle(primaryToken);
            }

            if (userToken != IntPtr.Zero)
            {
                CloseHandle(userToken);
            }
        }
    }

    private void ApplyEnvironment(ProcessStartInfo startInfo)
    {
        var environment = BuildBridgeEnvironment(startInfo.Environment.Select(item =>
            new KeyValuePair<string, string?>(item.Key, item.Value)));
        startInfo.Environment.Clear();
        foreach (var item in environment)
        {
            startInfo.Environment[item.Key] = item.Value;
        }
    }

    private Dictionary<string, string> BuildBridgeEnvironment(IEnumerable<KeyValuePair<string, string?>> baseEnvironment)
    {
        var environment = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in baseEnvironment)
        {
            if (!string.IsNullOrWhiteSpace(item.Key))
            {
                environment[item.Key] = item.Value ?? "";
            }
        }

        foreach (var item in config.EnvironmentVariables)
        {
            if (!string.IsNullOrWhiteSpace(item.Key))
            {
                environment[item.Key] = item.Value ?? "";
            }
        }

        if (!string.IsNullOrWhiteSpace(config.UserProfile))
        {
            environment["USERPROFILE"] = config.UserProfile;
            environment["HOME"] = config.UserProfile;
            environment["APPDATA"] = Path.Combine(config.UserProfile, "AppData", "Roaming");
            environment["LOCALAPPDATA"] = Path.Combine(config.UserProfile, "AppData", "Local");
            environment["XTENSION_BRIDGE_USER_HOME"] = config.UserProfile;
            AddIfNotBlank(environment, "HOMEDRIVE", GetHomeDrive(config.UserProfile));
            AddIfNotBlank(environment, "HOMEPATH", GetHomePath(config.UserProfile));
            AddIfNotBlank(environment, "USERNAME", GetUserNameFromProfile(config.UserProfile));
        }

        AddPathEntries(environment, GetPathAdditions());
        return environment;
    }

    private IEnumerable<KeyValuePair<string, string?>> CreateUserEnvironment(IntPtr primaryToken)
    {
        var nativeEnvironment = IntPtr.Zero;
        try
        {
            if (CreateEnvironmentBlock(out nativeEnvironment, primaryToken, false))
            {
                return ParseNativeEnvironmentBlock(nativeEnvironment).ToList();
            }

            WriteLog($"CreateEnvironmentBlock failed: {GetLastWin32Error()}");
        }
        finally
        {
            if (nativeEnvironment != IntPtr.Zero)
            {
                DestroyEnvironmentBlock(nativeEnvironment);
            }
        }

        return Environment.GetEnvironmentVariables()
            .Cast<System.Collections.DictionaryEntry>()
            .Select(item => new KeyValuePair<string, string?>(
                Convert.ToString(item.Key) ?? "",
                Convert.ToString(item.Value)));
    }

    private IEnumerable<string> GetPathAdditions()
    {
        yield return Path.GetDirectoryName(config.BridgeExe) ?? AppContext.BaseDirectory;

        if (!string.IsNullOrWhiteSpace(config.UserProfile))
        {
            yield return Path.Combine(config.UserProfile, "AppData", "Roaming", "npm");
            yield return Path.Combine(config.UserProfile, ".local", "bin");
        }
    }

    private static void AddIfNotBlank(IDictionary<string, string> environment, string key, string value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            environment[key] = value;
        }
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

    private static void AddPathEntries(IDictionary<string, string> environment, IEnumerable<string> additions)
    {
        var existingPath = environment.TryGetValue("PATH", out var upperPath)
            ? upperPath
            : environment.TryGetValue("Path", out var mixedPath)
                ? mixedPath
                : "";

        var entries = (existingPath ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Concat(additions.Where(Directory.Exists))
            .Distinct(StringComparer.OrdinalIgnoreCase);

        var nextPath = string.Join(Path.PathSeparator, entries);
        environment["PATH"] = nextPath;
        environment["Path"] = nextPath;
    }

    private void EnsureBridgeWritablePaths()
    {
        var directories = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            config.LogDirectory
        };

        AddDirectoryFromEnvironment(directories, "XTENSION_BRIDGE_LOG_FILE", isFilePath: true);
        AddDirectoryFromEnvironment(directories, "TEMP", isFilePath: false);
        AddDirectoryFromEnvironment(directories, "TMP", isFilePath: false);

        foreach (var directory in directories.Where(value => !string.IsNullOrWhiteSpace(value)))
        {
            try
            {
                GrantBuiltInUsersModify(directory);
            }
            catch (Exception error)
            {
                WriteLog($"Could not update ACL for {directory}: {error.Message}");
            }
        }
    }

    private void AddDirectoryFromEnvironment(HashSet<string> directories, string key, bool isFilePath)
    {
        if (!config.EnvironmentVariables.TryGetValue(key, out var rawValue) || string.IsNullOrWhiteSpace(rawValue))
        {
            return;
        }

        var expandedValue = Environment.ExpandEnvironmentVariables(rawValue);
        var directory = isFilePath ? Path.GetDirectoryName(expandedValue) : expandedValue;
        if (!string.IsNullOrWhiteSpace(directory))
        {
            directories.Add(directory);
        }
    }

    private static void GrantBuiltInUsersModify(string directoryPath)
    {
        Directory.CreateDirectory(directoryPath);
        var usersSid = new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null);
        var directoryInfo = new DirectoryInfo(directoryPath);
        var directorySecurity = directoryInfo.GetAccessControl(AccessControlSections.Access);
        directorySecurity.AddAccessRule(new FileSystemAccessRule(
            usersSid,
            FileSystemRights.Modify,
            InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
            PropagationFlags.None,
            AccessControlType.Allow));
        directoryInfo.SetAccessControl(directorySecurity);

        foreach (var filePath in Directory.EnumerateFiles(directoryPath, "*", SearchOption.TopDirectoryOnly))
        {
            var fileInfo = new FileInfo(filePath);
            var fileSecurity = fileInfo.GetAccessControl(AccessControlSections.Access);
            fileSecurity.AddAccessRule(new FileSystemAccessRule(
                usersSid,
                FileSystemRights.Modify,
                AccessControlType.Allow));
            fileInfo.SetAccessControl(fileSecurity);
        }
    }

    private static IEnumerable<KeyValuePair<string, string?>> ParseNativeEnvironmentBlock(IntPtr environmentBlock)
    {
        var offset = 0;
        while (true)
        {
            var entry = Marshal.PtrToStringUni(IntPtr.Add(environmentBlock, offset));
            if (string.IsNullOrEmpty(entry))
            {
                yield break;
            }

            var separatorIndex = entry.StartsWith("=", StringComparison.Ordinal)
                ? entry.IndexOf('=', 1)
                : entry.IndexOf('=');
            if (separatorIndex > 0)
            {
                yield return new KeyValuePair<string, string?>(
                    entry[..separatorIndex],
                    entry[(separatorIndex + 1)..]);
            }

            offset += (entry.Length + 1) * sizeof(char);
        }
    }

    private static IntPtr CreateNativeEnvironmentBlock(Dictionary<string, string> environment)
    {
        var builder = new System.Text.StringBuilder();
        foreach (var item in environment.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(item.Key) || item.Key.Contains('=') || item.Key.Contains('\0'))
            {
                continue;
            }

            builder.Append(item.Key).Append('=').Append(item.Value ?? "").Append('\0');
        }

        builder.Append('\0');
        return Marshal.StringToHGlobalUni(builder.ToString());
    }

    private static string QuoteCommandLine(string value)
    {
        return "\"" + value.Replace("\"", "\\\"", StringComparison.Ordinal) + "\"";
    }

    private static string GetLastWin32Error()
    {
        return new Win32Exception(Marshal.GetLastWin32Error()).Message;
    }

    private void StopBridgeProcess()
    {
        Process? process;
        lock (syncRoot)
        {
            process = bridgeProcess;
            bridgeProcess = null;
        }

        if (process is null)
        {
            return;
        }

        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                process.WaitForExit(5000);
            }
        }
        catch (Exception error)
        {
            WriteLog($"Bridge stop error: {error.Message}");
        }
    }

    private void WriteBridgeLog(string stream, string line)
    {
        WriteLog($"bridge/{stream}: {Truncate(line, 4000)}");
    }

    private void WriteLog(string message)
    {
        try
        {
            Directory.CreateDirectory(config.LogDirectory);
            var logPath = Path.Combine(config.LogDirectory, "service.log");
            RotateLogIfNeeded(logPath);
            File.AppendAllText(logPath, $"{DateTimeOffset.Now:O} {message}{Environment.NewLine}");
        }
        catch
        {
            // Windows services must not crash because logging failed.
        }
    }

    private static void RotateLogIfNeeded(string logPath)
    {
        var file = new FileInfo(logPath);
        if (!file.Exists || file.Length < 5 * 1024 * 1024)
        {
            return;
        }

        var rotatedPath = Path.Combine(file.DirectoryName ?? AppContext.BaseDirectory, "service.old.log");
        File.Delete(rotatedPath);
        File.Move(logPath, rotatedPath);
    }

    private static string Truncate(string value, int maxLength)
    {
        if (value.Length <= maxLength)
        {
            return value;
        }

        return value[..Math.Max(0, maxLength - 3)] + "...";
    }

    private const uint TokenAssignPrimary = 0x0001;
    private const uint TokenDuplicate = 0x0002;
    private const uint TokenQuery = 0x0008;
    private const uint TokenAdjustDefault = 0x0080;
    private const uint TokenAdjustSessionId = 0x0100;
    private const uint TokenForPrimaryProcess = TokenAssignPrimary | TokenDuplicate | TokenQuery | TokenAdjustDefault | TokenAdjustSessionId;
    private const int SecurityImpersonation = 2;
    private const int TokenPrimary = 1;
    private const uint CreateUnicodeEnvironment = 0x00000400;
    private const uint CreateNoWindow = 0x08000000;

    [DllImport("kernel32.dll")]
    private static extern uint WTSGetActiveConsoleSessionId();

    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSQueryUserToken(uint sessionId, out IntPtr token);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool DuplicateTokenEx(
        IntPtr existingToken,
        uint desiredAccess,
        IntPtr tokenAttributes,
        int impersonationLevel,
        int tokenType,
        out IntPtr newToken);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessAsUser(
        IntPtr token,
        string applicationName,
        string commandLine,
        IntPtr processAttributes,
        IntPtr threadAttributes,
        bool inheritHandles,
        uint creationFlags,
        IntPtr environment,
        string currentDirectory,
        ref STARTUPINFO startupInfo,
        out PROCESS_INFORMATION processInformation);

    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool CreateEnvironmentBlock(out IntPtr environment, IntPtr token, bool inherit);

    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool DestroyEnvironmentBlock(IntPtr environment);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public int cb;
        public string? lpReserved;
        public string? lpDesktop;
        public string? lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public uint dwProcessId;
        public uint dwThreadId;
    }
}
