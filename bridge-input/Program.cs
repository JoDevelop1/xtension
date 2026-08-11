// XtensionInput - native Windows text delivery for the Xtension connector.
//
// The browser extension cannot create trusted DOM input events. This helper uses
// SendInput with KEYEVENTF_UNICODE, so Windows delivers the text through the
// browser's native input path. Chrome and Edge then create keydown, beforeinput,
// input and keyup events whose Event.isTrusted value is true.
//
// This does not make the input identical to a physical keyboard at every layer:
// a low-level Windows hook can still observe LLKHF_INJECTED. The helper's goal is
// reliable native delivery and correct browser event provenance, not concealment.

using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

const int MaxChars = 4000;

Console.InputEncoding = Encoding.UTF8;
var serializedRequest = Console.In.ReadToEnd();

try
{
    var request = JsonSerializer.Deserialize<NativeTypeRequest>(serializedRequest, new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true
    }) ?? throw new InvalidOperationException("Native input request is missing.");

    request = request.Normalize(MaxChars);
    new UnicodeInputSender(request).Send();
    return 0;
}
catch (Exception error)
{
    // Never echo the text or the expected page title: stderr may be captured by
    // the connector for diagnostics.
    Console.Error.WriteLine(error is NativeInputException nativeError ? nativeError.Code : "native_input_failed");
    return 1;
}

internal sealed record NativeTypeRequest
{
    public string Text { get; init; } = "";
    public bool ReplaceExisting { get; init; }
    public string ExpectedTitle { get; init; } = "";
    public string ExpectedBrowser { get; init; } = "";

    public NativeTypeRequest Normalize(int maxChars)
    {
        var normalizedText = (Text ?? "").Replace("\r\n", "\n").Replace('\r', '\n');
        var safeText = new StringBuilder(Math.Min(normalizedText.Length, maxChars));
        foreach (var character in normalizedText)
        {
            if (character == '\n' || (character >= 0x20 && character != 0x7f && !(character >= 0x80 && character <= 0x9f)))
            {
                safeText.Append(character);
            }
            if (safeText.Length >= maxChars)
            {
                break;
            }
        }

        var browser = (ExpectedBrowser ?? "").Trim().ToLowerInvariant();
        if (browser is not ("chrome" or "edge" or "firefox"))
        {
            throw new NativeInputException("target_browser_invalid");
        }

        var title = (ExpectedTitle ?? "").Trim();
        if (title.Length == 0 || title.Length > 512)
        {
            throw new NativeInputException("target_title_invalid");
        }
        if (safeText.Length == 0 && !ReplaceExisting)
        {
            throw new NativeInputException("native_text_empty");
        }

        return this with
        {
            Text = safeText.ToString(),
            ExpectedBrowser = browser,
            ExpectedTitle = title
        };
    }
}

internal sealed class UnicodeInputSender
{
    private const uint InputKeyboard = 1;
    private const uint KeyEventExtendedKey = 0x0001;
    private const uint KeyEventKeyUp = 0x0002;
    private const uint KeyEventUnicode = 0x0004;

    private const ushort VirtualKeyReturn = 0x0D;
    private const ushort VirtualKeyShift = 0x10;
    private const ushort VirtualKeyControl = 0x11;
    private const ushort VirtualKeyDelete = 0x2E;
    private const ushort VirtualKeyA = 0x41;

    private static readonly IReadOnlyDictionary<string, string> BrowserProcessNames =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["chrome"] = "chrome",
            ["edge"] = "msedge",
            ["firefox"] = "firefox"
        };

    private readonly NativeTypeRequest request;

    public UnicodeInputSender(NativeTypeRequest request)
    {
        this.request = request;
    }

    public void Send()
    {
        // Capture and validate the exact foreground browser window immediately
        // before constructing the input batch. The focused native child handle is
        // pinned too, which catches a switch to the address bar or another tab.
        var target = CaptureTarget();
        var inputs = BuildInputs();
        EnsureTargetStillActive(target);

        if (inputs.Count == 0)
        {
            return;
        }

        var nativeInputs = inputs.ToArray();
        var sent = SendInput((uint)nativeInputs.Length, nativeInputs, Marshal.SizeOf<Input>());
        if (sent != nativeInputs.Length)
        {
            throw new NativeInputException("send_input_incomplete");
        }
        EnsureTargetStillActive(target);
    }

    private List<Input> BuildInputs()
    {
        var inputs = new List<Input>((request.Text.Length * 2) + 8);

        if (request.ReplaceExisting)
        {
            AddVirtualKey(inputs, VirtualKeyControl, keyUp: false);
            AddVirtualKey(inputs, VirtualKeyA, keyUp: false);
            AddVirtualKey(inputs, VirtualKeyA, keyUp: true);
            AddVirtualKey(inputs, VirtualKeyControl, keyUp: true);
            AddVirtualKey(inputs, VirtualKeyDelete, keyUp: false, extended: true);
            AddVirtualKey(inputs, VirtualKeyDelete, keyUp: true, extended: true);
        }

        foreach (var character in request.Text)
        {
            if (character == '\n')
            {
                // Shift+Enter creates a native line break without using a bare
                // Enter that could submit a social composer.
                AddVirtualKey(inputs, VirtualKeyShift, keyUp: false);
                AddVirtualKey(inputs, VirtualKeyReturn, keyUp: false);
                AddVirtualKey(inputs, VirtualKeyReturn, keyUp: true);
                AddVirtualKey(inputs, VirtualKeyShift, keyUp: true);
                continue;
            }

            AddUnicode(inputs, character, keyUp: false);
            AddUnicode(inputs, character, keyUp: true);
        }

        return inputs;
    }

    private TargetSnapshot CaptureTarget()
    {
        var foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero)
        {
            throw new NativeInputException("target_window_missing");
        }

        var threadId = GetWindowThreadProcessId(foreground, out var processId);
        if (threadId == 0 || processId == 0)
        {
            throw new NativeInputException("target_process_missing");
        }

        string processName;
        try
        {
            using var process = Process.GetProcessById((int)processId);
            processName = process.ProcessName;
        }
        catch
        {
            throw new NativeInputException("target_process_missing");
        }

        if (!BrowserProcessNames.TryGetValue(request.ExpectedBrowser, out var expectedProcess)
            || !string.Equals(processName, expectedProcess, StringComparison.OrdinalIgnoreCase))
        {
            throw new NativeInputException("target_browser_mismatch");
        }

        var actualTitle = ReadWindowTitle(foreground);
        if (!TitleMatches(actualTitle, request.ExpectedTitle))
        {
            throw new NativeInputException("target_title_mismatch");
        }

        var focusedChild = ReadFocusedChild(threadId);
        if (focusedChild == IntPtr.Zero)
        {
            throw new NativeInputException("target_focus_missing");
        }

        return new TargetSnapshot(foreground, processId, threadId, focusedChild);
    }

    private void EnsureTargetStillActive(TargetSnapshot target)
    {
        if (GetForegroundWindow() != target.Window)
        {
            throw new NativeInputException("target_window_changed");
        }

        var threadId = GetWindowThreadProcessId(target.Window, out var processId);
        if (threadId != target.ThreadId || processId != target.ProcessId)
        {
            throw new NativeInputException("target_window_changed");
        }

        if (ReadFocusedChild(threadId) != target.FocusedChild)
        {
            throw new NativeInputException("target_focus_changed");
        }
    }

    private static bool TitleMatches(string actual, string expected)
    {
        if (string.Equals(actual, expected, StringComparison.Ordinal))
        {
            return true;
        }

        return actual.StartsWith(expected + " - ", StringComparison.Ordinal)
            || actual.StartsWith(expected + " — ", StringComparison.Ordinal);
    }

    private static string ReadWindowTitle(IntPtr window)
    {
        var length = GetWindowTextLength(window);
        var buffer = new StringBuilder(Math.Max(length + 1, 2));
        _ = GetWindowText(window, buffer, buffer.Capacity);
        return buffer.ToString();
    }

    private static IntPtr ReadFocusedChild(uint threadId)
    {
        var info = new GuiThreadInfo
        {
            Size = Marshal.SizeOf<GuiThreadInfo>()
        };
        return GetGUIThreadInfo(threadId, ref info) ? info.FocusedWindow : IntPtr.Zero;
    }

    private static void AddUnicode(List<Input> inputs, char codeUnit, bool keyUp)
    {
        inputs.Add(CreateKeyboardInput(
            virtualKey: 0,
            scanCode: codeUnit,
            flags: KeyEventUnicode | (keyUp ? KeyEventKeyUp : 0)));
    }

    private static void AddVirtualKey(List<Input> inputs, ushort virtualKey, bool keyUp, bool extended = false)
    {
        var flags = (keyUp ? KeyEventKeyUp : 0) | (extended ? KeyEventExtendedKey : 0);
        inputs.Add(CreateKeyboardInput(virtualKey, 0, flags));
    }

    private static Input CreateKeyboardInput(ushort virtualKey, ushort scanCode, uint flags) => new()
    {
        Type = InputKeyboard,
        Union = new InputUnion
        {
            Keyboard = new KeyboardInput
            {
                VirtualKey = virtualKey,
                ScanCode = scanCode,
                Flags = flags,
                Time = 0,
                ExtraInfo = IntPtr.Zero
            }
        }
    };

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint inputCount, Input[] inputs, int size);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, StringBuilder value, int maxCount);

    [DllImport("user32.dll")]
    private static extern int GetWindowTextLength(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool GetGUIThreadInfo(uint threadId, ref GuiThreadInfo info);

    private sealed record TargetSnapshot(IntPtr Window, uint ProcessId, uint ThreadId, IntPtr FocusedChild);

    [StructLayout(LayoutKind.Sequential)]
    private struct GuiThreadInfo
    {
        public int Size;
        public uint Flags;
        public IntPtr ActiveWindow;
        public IntPtr FocusedWindow;
        public IntPtr CaptureWindow;
        public IntPtr MenuOwnerWindow;
        public IntPtr MoveSizeWindow;
        public IntPtr CaretWindow;
        public Rect CaretRect;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Input
    {
        public uint Type;
        public InputUnion Union;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] public MouseInput Mouse;
        [FieldOffset(0)] public KeyboardInput Keyboard;
        [FieldOffset(0)] public HardwareInput Hardware;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KeyboardInput
    {
        public ushort VirtualKey;
        public ushort ScanCode;
        public uint Flags;
        public uint Time;
        public IntPtr ExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MouseInput
    {
        public int X;
        public int Y;
        public uint MouseData;
        public uint Flags;
        public uint Time;
        public IntPtr ExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct HardwareInput
    {
        public uint Message;
        public ushort ParameterLow;
        public ushort ParameterHigh;
    }
}

internal sealed class NativeInputException : Exception
{
    public string Code { get; }

    public NativeInputException(string code)
        : base(code)
    {
        Code = code;
    }
}
