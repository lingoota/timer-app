// Music helpers for the rest overlay:
// - openMusicApp(): find a music app shortcut in the Start Menu (Chrome-installed
//   YouTube Music first, then Spotify / KKBOX / Apple Music) and launch it.
//   Verified 2026-10-24: Chrome puts PWAs under "Start Menu\Programs\Chrome 應用程式\YouTube Music.lnk"
//   (the folder name is localised, so we search by file name, not by folder).
// - sendMediaKey(): press the keyboard media keys (play/pause, next, previous), which
//   Windows routes to whichever app is playing, so music can be controlled without
//   leaving the overlay.
const { shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PREFERRED = [/^youtube music\.lnk$/i, /^spotify\.lnk$/i, /^kkbox\.lnk$/i, /^apple music\.lnk$/i];
const MEDIA_VK = { playpause: 0xB3, next: 0xB0, prev: 0xB1 };

function startMenuDirs() {
  const dirs = [];
  if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  if (process.env.ProgramData) dirs.push(path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  if (process.env.USERPROFILE) dirs.push(path.join(process.env.USERPROFILE, 'Desktop'));
  return dirs;
}

function listShortcuts(dir, depth, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && depth > 0) listShortcuts(full, depth - 1, out);
    else if (e.isFile() && /\.lnk$/i.test(e.name)) out.push(full);
  }
}

// Searched on every call (a handful of directory reads) so a newly installed app is found.
function findMusicShortcut() {
  const all = [];
  startMenuDirs().forEach(d => listShortcuts(d, 3, all));
  for (const re of PREFERRED) {
    const hit = all.find(p => re.test(path.basename(p)));
    if (hit) return hit;
  }
  return null;
}

async function openMusicApp() {
  const lnk = findMusicShortcut();
  if (!lnk) {
    console.log('🎧 找不到音樂 App 捷徑，只收起休息畫面');
    return false;
  }
  const err = await shell.openPath(lnk);
  if (err) console.error('🎧 開啟音樂 App 失敗:', err);
  else console.log('🎧 已開啟', lnk);
  return !err;
}

function sendMediaKey(name) {
  const vk = MEDIA_VK[name];
  if (!vk || process.platform !== 'win32') return;
  const script = `
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class MediaKey { [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra); }
"@
[MediaKey]::keybd_event(${vk}, 0, 1, [UIntPtr]::Zero)
[MediaKey]::keybd_event(${vk}, 0, 3, [UIntPtr]::Zero)
`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
    windowsHide: true,
    stdio: 'ignore',
  });
  child.on('error', () => {});
}

// ---------- Media controller (Windows SMTC) ----------
// Media keys go to whatever session Windows considers current, which on 2026-10-24 could
// have been a paused Netflix tab instead of the YouTube Music app. SMTC lets us pick the
// session that is actually playing music and send explicit play / pause / next / previous.
// Verified on the dev PC: the YouTube Music Chrome app (Chrome._crx_...) supports
// play / pause / next / previous; it does NOT expose shuffle or repeat (Chrome limitation),
// so repeat is set inside YouTube Music during the 1-minute music break.
//
// One resident PowerShell, only while the rest overlay is up: prints now-playing JSON every
// 2 s and reads commands (play / pause / next / prev) from stdin.
function mediaHelperScript(parentPid) {
  return `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
} | Select-Object -First 1
function Await($op, [Type]$type) {
    $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    $t.Wait(5000) | Out-Null
    if ($t.IsCompleted) { return $t.Result } else { return $null }
}
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$T = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$mgr = Await ($T::RequestAsync()) $T

# Prefer: playing + has a next track (music) > any playing > paused with a next track > Windows' current.
function Pick-Session {
    $all = @($mgr.GetSessions())
    $playing = @($all | Where-Object { $_.GetPlaybackInfo().PlaybackStatus -eq 'Playing' })
    $s = $playing | Where-Object { $_.GetPlaybackInfo().Controls.IsNextEnabled } | Select-Object -First 1
    if (-not $s) { $s = $playing | Select-Object -First 1 }
    if (-not $s) { $s = $all | Where-Object { $_.GetPlaybackInfo().Controls.IsNextEnabled } | Select-Object -First 1 }
    if (-not $s) { $s = $mgr.GetCurrentSession() }
    return $s
}

function Report {
    $s = Pick-Session
    if (-not $s) { [Console]::Out.WriteLine('{"status":"none"}'); return }
    $info = $s.GetPlaybackInfo()
    $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $o = [ordered]@{ status = [string]$info.PlaybackStatus; title = [string]$p.Title; artist = [string]$p.Artist; app = [string]$s.SourceAppUserModelId }
    [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
}

$readTask = [Console]::In.ReadLineAsync()
$lastReport = [DateTime]::MinValue
while ($true) {
    if (-not (Get-Process -Id ${parentPid} -ErrorAction SilentlyContinue)) { exit }
    if ($readTask.IsCompleted) {
        $cmd = $readTask.Result
        if ($cmd -eq $null) { exit }
        $s = Pick-Session
        if ($s) {
            switch ($cmd.Trim()) {
                'play'  { [void](Await ($s.TryPlayAsync()) ([bool])) }
                'pause' { [void](Await ($s.TryPauseAsync()) ([bool])) }
                'next'  { [void](Await ($s.TrySkipNextAsync()) ([bool])) }
                'prev'  { [void](Await ($s.TrySkipPreviousAsync()) ([bool])) }
            }
        }
        Start-Sleep -Milliseconds 400
        Report
        $lastReport = [DateTime]::Now
        $readTask = [Console]::In.ReadLineAsync()
    }
    if (([DateTime]::Now - $lastReport).TotalSeconds -ge 2) { Report; $lastReport = [DateTime]::Now }
    Start-Sleep -Milliseconds 150
}
`;
}

class MediaController {
  constructor(onInfo) {
    this.onInfo = onInfo;
    this.child = null;
  }

  start() {
    if (process.platform !== 'win32' || this.child) return;
    const encoded = Buffer.from(mediaHelperScript(process.pid), 'utf16le').toString('base64');
    try {
      this.child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } catch (e) {
      this.child = null;
      return;
    }
    let buf = '';
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('{')) continue;
        try { this.onInfo(JSON.parse(line)); } catch (e) { /* partial / noise */ }
      }
    });
    this.child.on('exit', () => { this.child = null; });
    this.child.on('error', () => {});
    this.child.stdin.on('error', () => {});
  }

  // Falls back to the plain media keys if the helper is not running.
  send(cmd) {
    if (this.child && this.child.stdin.writable) {
      this.child.stdin.write(`${cmd}\n`);
      return;
    }
    sendMediaKey(cmd === 'play' || cmd === 'pause' ? 'playpause' : cmd);
  }

  stop() {
    if (!this.child) return;
    try { this.child.stdin.end(); } catch (e) { /* ignore */ }
    try { this.child.kill(); } catch (e) { /* already gone */ }
    this.child = null;
  }
}

module.exports = { openMusicApp, sendMediaKey, findMusicShortcut, MediaController };
