// Display probe: is some app asking Windows to keep the DISPLAY on (i.e. a visible video)?
//
// Verified on 2026-10-24 (dev PC, Chrome): a playing YouTube video reports
// ES_DISPLAY_REQUIRED (0x2) through CallNtPowerInformation(SystemExecutionState),
// readable without admin. Music only (YouTube Music), a background tab, or a minimised
// Chrome report just ES_SYSTEM_REQUIRED (0x1), so listening without watching is not
// counted. Known false positive: a video window covered by another window still reports 0x2.
//
// Only PowerShell can reach this API without a native module, so one resident PowerShell
// prints the state every 5 s. It exits by itself when the app's process is gone, so a
// task-manager kill does not leave orphans behind.
const { spawn } = require('child_process');

const ES_DISPLAY_REQUIRED = 0x2;
const SAMPLE_MS = 5000;
const WINDOW = 4;      // last 4 samples (~20 s)
const NEEDED = 3;      // 3 of them must say "display required"

function psScript(parentPid) {
  return `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class DisplayProbe {
    [DllImport("powrprof.dll")]
    public static extern uint CallNtPowerInformation(int level, IntPtr inBuf, uint inLen, out uint outVal, uint outLen);
}
"@
while ($true) {
    if (-not (Get-Process -Id ${parentPid} -ErrorAction SilentlyContinue)) { exit }
    $es = 0
    $rc = [DisplayProbe]::CallNtPowerInformation(16, [IntPtr]::Zero, 0, [ref]$es, 4)
    if ($rc -eq 0) { [Console]::Out.WriteLine($es) } else { [Console]::Out.WriteLine(-1) }
    [Console]::Out.Flush()
    Start-Sleep -Milliseconds ${SAMPLE_MS}
}
`;
}

class DisplayProbe {
  constructor() {
    this.samples = [];
    this.child = null;
    this.stopped = false;
    this.restartDelayMs = 5000;
    this.lastSampleAt = 0;
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
      console.error('display probe spawn failed:', e.message);
      this.scheduleRestart();
      return;
    }
    let buf = '';
    this.child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        const v = parseInt(line, 10);
        if (!isNaN(v) && v >= 0) this.push(v);
      }
    });
    this.child.on('exit', () => {
      this.child = null;
      this.scheduleRestart();
    });
    this.child.on('error', () => {});
  }

  scheduleRestart() {
    if (this.stopped) return;
    setTimeout(() => this.start(), this.restartDelayMs);
    this.restartDelayMs = Math.min(this.restartDelayMs * 2, 5 * 60 * 1000);
  }

  push(state) {
    this.restartDelayMs = 5000;
    this.lastSampleAt = Date.now();
    this.samples.push(state);
    if (this.samples.length > WINDOW) this.samples.shift();
  }

  // True when a video has been visibly playing for roughly the last 20 seconds.
  // Stale samples (probe died) count as "no video" so a dead probe can never invent use.
  isVideoActive() {
    if (Date.now() - this.lastSampleAt > SAMPLE_MS * 3) return false;
    const hits = this.samples.filter(s => (s & ES_DISPLAY_REQUIRED) !== 0).length;
    return hits >= NEEDED;
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
