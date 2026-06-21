using System.Diagnostics;
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

    private void ApplyEnvironment(ProcessStartInfo startInfo)
    {
        if (!string.IsNullOrWhiteSpace(config.UserProfile))
        {
            startInfo.Environment["USERPROFILE"] = config.UserProfile;
            startInfo.Environment["HOME"] = config.UserProfile;
            startInfo.Environment["APPDATA"] = Path.Combine(config.UserProfile, "AppData", "Roaming");
            startInfo.Environment["LOCALAPPDATA"] = Path.Combine(config.UserProfile, "AppData", "Local");
            startInfo.Environment["XTENSION_BRIDGE_USER_HOME"] = config.UserProfile;
        }

        AddPathEntries(startInfo, GetPathAdditions());

        foreach (var item in config.EnvironmentVariables)
        {
            if (!string.IsNullOrWhiteSpace(item.Key))
            {
                startInfo.Environment[item.Key] = item.Value ?? "";
            }
        }
    }

    private IEnumerable<string> GetPathAdditions()
    {
        yield return Path.GetDirectoryName(config.BridgeExe) ?? AppContext.BaseDirectory;

        if (!string.IsNullOrWhiteSpace(config.UserProfile))
        {
            yield return Path.Combine(config.UserProfile, "AppData", "Roaming", "npm");
            yield return Path.Combine(config.UserProfile, ".local", "bin");
            yield return Path.Combine(config.UserProfile, ".grok", "bin");
        }
    }

    private static void AddPathEntries(ProcessStartInfo startInfo, IEnumerable<string> additions)
    {
        var existingPath = startInfo.Environment.TryGetValue("PATH", out var upperPath)
            ? upperPath
            : startInfo.Environment.TryGetValue("Path", out var mixedPath)
                ? mixedPath
                : "";

        var entries = (existingPath ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Concat(additions.Where(Directory.Exists))
            .Distinct(StringComparer.OrdinalIgnoreCase);

        var nextPath = string.Join(Path.PathSeparator, entries);
        startInfo.Environment["PATH"] = nextPath;
        startInfo.Environment["Path"] = nextPath;
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
}
