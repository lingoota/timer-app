// Watchdog: a per-user Windows scheduled task that relaunches the app every minute.
// If the app is already running, the single-instance lock makes the new process exit
// immediately (main.js ignores second-instance events that carry WATCHDOG_ARG).
// Why a task instead of a .bat: it ships inside the app and is (re)created on every
// launch, so cloud updates keep it in sync without anyone touching the kids' PCs.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TASK_NAME = 'TimeCalculatorWatchdog';
const WATCHDOG_ARG = '--watchdog';

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// startBoundary is overridable only for testing (a far-future date never fires).
function buildTaskXml(exePath, startBoundary) {
  const start = startBoundary || '2000-01-01T00:00:00';
  // XML import (not /SC MINUTE) because the CLI cannot turn off
  // "start only on AC power", which would silently disable the watchdog on laptops.
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Relaunch Time Calculator if it was closed</Description>
  </RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <Repetition>
        <Interval>PT1M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>${start}</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xmlEscape(exePath)}</Command>
      <Arguments>${WATCHDOG_ARG}</Arguments>
    </Exec>
  </Actions>
</Task>
`;
}

function runSchtasks(args) {
  return new Promise((resolve) => {
    execFile('schtasks.exe', args, { windowsHide: true }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout || ''), stderr: String(stderr || ''), err });
    });
  });
}

// Create or overwrite the task. Called on every launch so the exe path stays current
// after updates. Returns { ok, detail }.
async function installWatchdog(exePath, opts = {}) {
  if (process.platform !== 'win32') return { ok: false, detail: 'not windows' };
  const taskName = opts.taskName || TASK_NAME;
  const xmlPath = path.join(os.tmpdir(), `${taskName}.xml`);
  try {
    // schtasks /XML only reliably accepts UTF-16 LE with BOM.
    const xml = buildTaskXml(exePath, opts.startBoundary);
    fs.writeFileSync(xmlPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')]));
  } catch (e) {
    return { ok: false, detail: `write xml failed: ${e.message}` };
  }
  const res = await runSchtasks(['/Create', '/F', '/TN', taskName, '/XML', xmlPath]);
  try { fs.unlinkSync(xmlPath); } catch (e) { /* temp file, ignore */ }
  return { ok: res.ok, detail: (res.stdout + res.stderr).trim() };
}

async function removeWatchdog(opts = {}) {
  if (process.platform !== 'win32') return { ok: false, detail: 'not windows' };
  const res = await runSchtasks(['/Delete', '/F', '/TN', opts.taskName || TASK_NAME]);
  return { ok: res.ok, detail: (res.stdout + res.stderr).trim() };
}

module.exports = { installWatchdog, removeWatchdog, buildTaskXml, TASK_NAME, WATCHDOG_ARG };
