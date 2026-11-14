// Activity probe: one resident PowerShell that reports, every 5 s,
//   1. the display execution state (is some app keeping the DISPLAY on = a visible video), and
//   2. seconds since the last REAL keyboard / mouse / Xbox-gamepad input.
//
// Why not powerMonitor.getSystemIdleTime(): Unreal Engine games (Wuthering Waves) reset the
// Windows last-input time every 10-50 s while in the foreground, with no input event at all.
// Measured 2026-11-14 on the dev PC: a kid left the game open and went to class, and every
// half hour was logged as untimed use. Low-level hooks see only real events (injected ones
// are flagged and skipped), so the game's resets do not count.
// Gamepads do not touch either signal, so XInput is polled (4 slots, every 250 ms). Only a
// pressed / changed button, a trigger, or a stick beyond the XInput dead zone counts; a resting
// stick drifts by ~2500 and is ignored. Verified 2026-11-14 with an Xbox pad while the game had
// focus: playing -> age 0 s, pad on the desk -> age kept growing.
//
// Display state, verified 2026-10-24 (Chrome): a playing YouTube video reports
// ES_DISPLAY_REQUIRED (0x2), readable without admin. Music only, a background tab, or a
// minimised Chrome report just 0x1. Known false positive: a covered video window still 0x2.
// IGNORE_PROCESSES: apps that hold 0x2 with nobody watching (see below).
//
// Fail-safe: if the probe dies or stops reporting, getInputIdleSec() returns null and main
// falls back to the Windows idle time, so detection degrades to the old behaviour, never to
// "nothing detected". The probe exits by itself when the app's process is gone.
const { spawn } = require('child_process');

const ES_DISPLAY_REQUIRED = 0x2;
const SAMPLE_MS = 5000;
const WINDOW = 4;      // last 4 samples (~20 s)
const NEEDED = 3;      // 3 of them must say "display required"
const NEVER = 999999;  // input age reported before any input was seen

// Apps that hold "display required" without anyone watching. While one of them has a
// window (open or minimised), the display bit is ignored; keyboard/mouse still count.
// Measured 2026-11-13 on the dev PC: Wuthering Waves launcher (animated WebView2
// background) -> tray 0x0, window open 0x3, minimised 0x2. It kept a kid's PC "in use"
// all night. Trade-off: a hands-off video watched while it is open is not detected.
const IGNORE_PROCESSES = ['launcher_main'];

function psScript(parentPid) {
  const ignoreCsv = IGNORE_PROCESSES.join(',');
  return `
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public static class ActivityProbe {
    [StructLayout(LayoutKind.Sequential)]
    struct XSTATE { public uint packet; public ushort buttons; public byte lt; public byte rt; public short lx; public short ly; public short rx; public short ry; }
    delegate IntPtr HookProc(int n, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, HookProc fn, IntPtr mod, uint tid);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int n, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
    [DllImport("powrprof.dll")] static extern uint CallNtPowerInformation(int level, IntPtr inBuf, uint inLen, out uint outVal, uint outLen);
    [DllImport("xinput1_4.dll")] static extern uint XInputGetState(uint idx, out XSTATE s);

    static HookProc mouseProc = MouseHook, keyProc = KeyHook;
    static IntPtr mouseHook = IntPtr.Zero, keyHook = IntPtr.Zero;
    static DateTime lastInput = DateTime.MinValue;
    static ushort[] prevButtons = new ushort[4];
    static bool padAvailable = true;
    static string[] ignore;
    static int parentPid;

    // Injected events (SendInput from other programs) are skipped: LLMHF_INJECTED / LLKHF_INJECTED.
    static IntPtr MouseHook(int n, IntPtr w, IntPtr l) {
        if (n >= 0 && (Marshal.ReadInt32(l, 12) & 0x1) == 0) lastInput = DateTime.UtcNow;
        return CallNextHookEx(IntPtr.Zero, n, w, l);
    }
    static IntPtr KeyHook(int n, IntPtr w, IntPtr l) {
        if (n >= 0 && (Marshal.ReadInt32(l, 8) & 0x10) == 0) lastInput = DateTime.UtcNow;
        return CallNextHookEx(IntPtr.Zero, n, w, l);
    }
    // Windows silently drops a low-level hook that once timed out, so re-install periodically.
    static void Hook() {
        if (mouseHook != IntPtr.Zero) UnhookWindowsHookEx(mouseHook);
        if (keyHook != IntPtr.Zero) UnhookWindowsHookEx(keyHook);
        IntPtr mod = GetModuleHandle(null);
        mouseHook = SetWindowsHookEx(14, mouseProc, mod, 0);
        keyHook = SetWindowsHookEx(13, keyProc, mod, 0);
    }
    static bool Beyond(short v, int dz) { return v > dz || v < -dz; }
    static void PollPads() {
        if (!padAvailable) return;
        try {
            for (uint i = 0; i < 4; i++) {
                XSTATE s;
                if (XInputGetState(i, out s) != 0) continue;
                bool active = s.buttons != 0 || s.buttons != prevButtons[i] || s.lt > 30 || s.rt > 30
                    || Beyond(s.lx, 7849) || Beyond(s.ly, 7849) || Beyond(s.rx, 8689) || Beyond(s.ry, 8689);
                prevButtons[i] = s.buttons;
                if (active) lastInput = DateTime.UtcNow;
            }
        } catch (Exception) { padAvailable = false; }
    }
    static uint DisplayState() {
        uint es = 0;
        if (CallNtPowerInformation(16, IntPtr.Zero, 0, out es, 4) != 0) return 0xFFFFFFFF;
        foreach (string name in ignore) {
            foreach (Process p in Process.GetProcessesByName(name)) {
                try { if (p.MainWindowHandle != IntPtr.Zero) es &= ~2u; } catch (Exception) { }
            }
        }
        return es;
    }
    static void Report() {
        try { Process.GetProcessById(parentPid); } catch (Exception) { Application.Exit(); return; }
        uint es = DisplayState();
        // Hooks refused (e.g. blocked by antivirus): report -1 so main falls back to the
        // Windows idle time instead of believing nobody ever touches anything.
        bool hooked = mouseHook != IntPtr.Zero && keyHook != IntPtr.Zero;
        long age = !hooked ? -1 : lastInput == DateTime.MinValue ? ${NEVER} : (long)(DateTime.UtcNow - lastInput).TotalSeconds;
        Console.Out.WriteLine((es == 0xFFFFFFFF ? "-1" : es.ToString()) + " " + age.ToString());
        Console.Out.Flush();
    }
    public static void Run(int pid, string ignoreCsv) {
        parentPid = pid;
        ignore = ignoreCsv.Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
        Hook();
        var pad = new Timer(); pad.Interval = 250; pad.Tick += (s, e) => PollPads(); pad.Start();
        var report = new Timer(); report.Interval = ${SAMPLE_MS}; report.Tick += (s, e) => Report(); report.Start();
        var rehook = new Timer(); rehook.Interval = 60000; rehook.Tick += (s, e) => Hook(); rehook.Start();
        Report();
        Application.Run();
    }
}
"@
[ActivityProbe]::Run(${parentPid}, '${ignoreCsv}')
`;
}

class DisplayProbe {
  constructor() {
    this.samples = [];
    this.child = null;
    this.stopped = false;
    this.restartDelayMs = 5000;
    this.lastSampleAt = 0;
    this.inputAgeSec = null;
  }

  start() {
    if (process.platform !== 'win32' || this.child || this.stopped) return;
    // -EncodedCommand (UTF-16LE base64) avoids every quoting problem with the here-string.
    const encoded = Buffer.from(psScript(process.pid), 'utf16le').toString('base64');
    try {
      this.child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (e) {
      console.error('activity probe spawn failed:', e.message);
      this.scheduleRestart();
      return;
    }
    let buf = '';
    this.child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const parts = buf.slice(0, nl).trim().split(/\s+/);
        buf = buf.slice(nl + 1);
        const es = parseInt(parts[0], 10);
        const age = parseInt(parts[1], 10);
        if (!isNaN(es) && !isNaN(age)) this.push(es, age);
      }
    });
    this.child.on('exit', () => {
      this.child = null;
      this.inputAgeSec = null;
      this.scheduleRestart();
    });
    this.child.on('error', () => {});
  }

  scheduleRestart() {
    if (this.stopped) return;
    setTimeout(() => this.start(), this.restartDelayMs);
    this.restartDelayMs = Math.min(this.restartDelayMs * 2, 5 * 60 * 1000);
  }

  push(state, inputAgeSec) {
    this.restartDelayMs = 5000;
    this.lastSampleAt = Date.now();
    this.inputAgeSec = inputAgeSec >= 0 ? inputAgeSec : null;
    if (state >= 0) {
      this.samples.push(state);
      if (this.samples.length > WINDOW) this.samples.shift();
    }
  }

  isFresh() {
    return Date.now() - this.lastSampleAt <= SAMPLE_MS * 3;
  }

  // True when a video has been visibly playing for roughly the last 20 seconds.
  // Stale samples (probe died) count as "no video" so a dead probe can never invent use.
  isVideoActive() {
    if (!this.isFresh()) return false;
    const hits = this.samples.filter(s => (s & ES_DISPLAY_REQUIRED) !== 0).length;
    return hits >= NEEDED;
  }

  // Seconds since real keyboard / mouse / gamepad input, or null when the probe is not
  // reporting (caller falls back to the Windows idle time).
  getInputIdleSec() {
    if (this.inputAgeSec === null || !this.isFresh()) return null;
    return this.inputAgeSec + Math.floor((Date.now() - this.lastSampleAt) / 1000);
  }

  stop() {
    this.stopped = true;
    if (this.child) {
      try { this.child.kill(); } catch (e) { /* already gone */ }
      this.child = null;
    }
  }
}

module.exports = { DisplayProbe };
