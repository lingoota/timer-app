// Full-screen rest overlay: one frameless, always-on-top window per display.
// It refuses to close until the guard hides it, and pulls focus back if the kid
// Alt+Tabs away so keyboard input does not reach the game underneath.
const { BrowserWindow, screen } = require('electron');
const path = require('path');

class RestWindows {
  constructor(appRoot) {
    this.appRoot = appRoot;
    this.windows = [];
    this.allowClose = false;
    this.focusTimer = null;
    this.lastState = null;
  }

  isShown() {
    return this.windows.some(w => !w.isDestroyed());
  }

  show() {
    this.windows = this.windows.filter(w => !w.isDestroyed());
    if (this.windows.length > 0) return;
    this.allowClose = false;
    const displays = screen.getAllDisplays();
    const primaryId = screen.getPrimaryDisplay().id;
    displays.forEach(display => {
      const { x, y, width, height } = display.bounds;
      const win = new BrowserWindow({
        x, y, width, height,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: true,
        skipTaskbar: true,
        alwaysOnTop: true,
        show: false,
        backgroundColor: '#101820',
        webPreferences: {
          preload: path.join(this.appRoot, 'src', 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });
      // No app menu here: its accelerators (Ctrl+Q quit, Ctrl+W close) would be an exit.
      win.removeMenu();
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setVisibleOnAllWorkspaces(true);
      win.loadFile(path.join(this.appRoot, 'src', 'rest-screen.html'), {
        query: { primary: display.id === primaryId ? '1' : '0' },
      });
      win.once('ready-to-show', () => {
        if (win.isDestroyed()) return;
        win.setFullScreen(true);
        win.show();
        win.focus();
        if (this.lastState) win.webContents.send('rest-state', this.lastState);
        if (this.lastMedia) win.webContents.send('rest-media', this.lastMedia);
      });
      win.on('close', (e) => {
        if (!this.allowClose) e.preventDefault();
      });
      this.windows.push(win);
    });

    if (!this.focusTimer) {
      this.focusTimer = setInterval(() => this.keepOnTop(), 1500);
    }
  }

  keepOnTop() {
    const live = this.windows.filter(w => !w.isDestroyed());
    if (live.length === 0) return;
    const anyFocused = live.some(w => w.isFocused());
    live.forEach(w => {
      if (!w.isVisible()) w.show();
      w.setAlwaysOnTop(true, 'screen-saver');
      w.moveTop();
    });
    if (!anyFocused) live[0].focus();
  }

  hide() {
    if (this.focusTimer) {
      clearInterval(this.focusTimer);
      this.focusTimer = null;
    }
    this.allowClose = true;
    this.windows.forEach(w => {
      if (!w.isDestroyed()) w.destroy();
    });
    this.windows = [];
  }

  // Now-playing info from the media controller (lib/music.js).
  sendMedia(info) {
    this.lastMedia = info;
    this.windows.forEach(w => {
      if (!w.isDestroyed()) w.webContents.send('rest-media', info);
    });
  }

  send(state) {
    this.lastState = state;
    this.windows.forEach(w => {
      if (!w.isDestroyed()) w.webContents.send('rest-state', state);
    });
  }
}

module.exports = { RestWindows };
