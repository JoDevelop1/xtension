using System.Diagnostics;
using System.Security.Principal;

namespace Xtension.Bridge.Host;

internal static class Program
{
    private const int RestartDelayMs = 2000;
    private static readonly CancellationTokenSource StopTokenSource = new();
    private static Process? bridgeProcess;

    [STAThread]
    private static int Main()
    {
        var userId = WindowsIdentity.GetCurrent().User?.Value ?? Environment.UserName;
        using var singleton = new Mutex(true, $@"Local\XtensionCodexConnector-{SanitizeMutexPart(userId)}", out var createdNew);
        if (!createdNew)
        {
            return 0;
        }

        AppDomain.CurrentDomain.ProcessExit += (_, _) => StopBridge();
        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            StopTokenSource.Cancel();
            StopBridge();
        };

        try
        {
            return RunAsync(StopTokenSource.Token).GetAwaiter().GetResult();
        }
        catch (OperationCanceledException)
        {
            return 0;
        }
        catch (Exception error)
        {
            WriteLog($"Host stopped after an unrecoverable error: {error.Message}");
            return 1;
        }
    }

    private static async Task<int> RunAsync(CancellationToken cancellationToken)
    {
        var bridgeExe = Path.Combine(AppContext.BaseDirectory, "XtensionBridge.exe");
        if (!File.Exists(bridgeExe))
        {
            WriteLog($"Bridge executable is missing: {bridgeExe}");
            return 2;
        }

        WriteLog("Per-user Codex connector host started.");
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                using var process = StartBridge(bridgeExe);
                bridgeProcess = process;
                WriteLog($"Connector started: pid={process.Id}");
                await process.WaitForExitAsync(cancellationToken);
                var exitCode = process.HasExited ? process.ExitCode.ToString() : "unknown";
                bridgeProcess = null;

                if (!cancellationToken.IsCancellationRequested)
                {
                    WriteLog($"Connector exited with code {exitCode}; restarting.");
                    await Task.Delay(RestartDelayMs, cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception error)
            {
                bridgeProcess = null;
                WriteLog($"Connector supervisor error: {error.Message}");
                await Task.Delay(RestartDelayMs, cancellationToken);
            }
        }

        StopBridge();
        WriteLog("Per-user Codex connector host stopped.");
        return 0;
    }

    private static Process StartBridge(string bridgeExe)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = bridgeExe,
            WorkingDirectory = AppContext.BaseDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        var localData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var dataDirectory = Path.Combine(localData, "Xtension", "Bridge");
        var logDirectory = Path.Combine(dataDirectory, "logs");
        Directory.CreateDirectory(logDirectory);

        startInfo.Environment["XTENSION_BRIDGE_PORT"] = "47623";
        startInfo.Environment["XTENSION_BRIDGE_DATA_DIR"] = dataDirectory;
        startInfo.Environment["XTENSION_BRIDGE_LOG_FILE"] = Path.Combine(logDirectory, "bridge.log");
        startInfo.Environment["XTENSION_BRIDGE_USER_HOME"] = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        startInfo.Environment.Remove("OPENAI_API_KEY");
        startInfo.Environment.Remove("CODEX_API_KEY");
        AddUserCommandPaths(startInfo.Environment);

        var process = new Process
        {
            StartInfo = startInfo,
            EnableRaisingEvents = true
        };
        process.OutputDataReceived += (_, _) => { };
        process.ErrorDataReceived += (_, _) => { };
        if (!process.Start())
        {
            throw new InvalidOperationException("The connector process did not start.");
        }
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return process;
    }

    private static void AddUserCommandPaths(IDictionary<string, string?> environment)
    {
        var profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var additions = new[]
        {
            Path.Combine(profile, "AppData", "Roaming", "npm"),
            Path.Combine(profile, ".local", "bin")
        }.Where(Directory.Exists);

        var existing = environment.TryGetValue("PATH", out var path) ? path ?? "" : "";
        var next = existing.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Concat(additions)
            .Distinct(StringComparer.OrdinalIgnoreCase);
        environment["PATH"] = string.Join(Path.PathSeparator, next);
    }

    private static void StopBridge()
    {
        StopTokenSource.Cancel();
        var process = bridgeProcess;
        bridgeProcess = null;
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
        catch
        {
            // Windows shutdown may terminate the child before the host.
        }
        finally
        {
            process.Dispose();
        }
    }

    private static void WriteLog(string message)
    {
        try
        {
            var logDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Xtension",
                "Bridge",
                "logs");
            Directory.CreateDirectory(logDirectory);
            File.AppendAllText(
                Path.Combine(logDirectory, "host.log"),
                $"{DateTimeOffset.Now:O} {message}{Environment.NewLine}");
        }
        catch
        {
            // Logging must never prevent the connector from running.
        }
    }

    private static string SanitizeMutexPart(string value)
    {
        return new string(value.Select(character => char.IsLetterOrDigit(character) ? character : '_').ToArray());
    }
}
