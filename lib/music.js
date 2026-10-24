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

module.exports = { openMusicApp, sendMediaKey, findMusicShortcut };
