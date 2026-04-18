const { app, BrowserWindow, Menu, screen, ipcMain, Tray, globalShortcut, powerMonitor, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// 禁用硬體加速以避免 WSL 環境的 GPU 錯誤
// 只有在 app 可用時才呼叫
if (app && typeof app.disableHardwareAcceleration === 'function') {
  app.disableHardwareAcceleration();
}

// 解除 Chromium 的 autoplay 限制 — 讓計時完成警報音能在背景播放
// 必須在 app ready 之前呼叫
if (app && typeof app.commandLine !== 'undefined') {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
}

// 自動更新器設定會在 app.whenReady() 之後初始化

// 保持對window對象的全局引用，避免被垃圾回收
let mainWindow;
let miniWindow = null; // 迷你視窗
let isMinimized = false;
let tray = null;
let forceQuit = false;

// 閒置偵測相關
let currentUserIdentity = null; // 'user1' | 'user2' | 'parent'
let isTimerCurrentlyRunning = false;
let activeSeconds = 0;
let reminderCooldownUntil = 0;
let activityCheckInterval = null;

// 冷卻期活動偵測
let cooldownEndTime = 0; // 冷卻期結束時間
let cooldownReminderShowing = false; // 是否正在顯示冷卻期提醒

// === 主進程計時器（source of truth，不被 Chromium 節流） ===
let timerState = {
  isRunning: false,        // 是否進行中（含暫停）
  isPaused: false,         // 是否暫停
  totalDuration: 0,        // 總秒數
  remainingSec: 0,         // 剩餘秒數
  startTime: 0,            // Date.now() 起算
  pauseStartTime: 0,       // 本次暫停的起點
  accumulatedPauseMs: 0,   // 累計已暫停的毫秒數
  user: null,              // 'user1' | 'user2'
  category: null,          // 活動類別
  startTimestamp: null,    // ISO 字串（給 Firebase 記錄）
};
let timerTickInterval = null;
let powerSaveBlockerId = null;

// 廣播計時 tick 給主視窗 + 迷你視窗
function broadcastTick() {
  const minutes = Math.floor(timerState.remainingSec / 60);
  const seconds = timerState.remainingSec % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const userName = timerState.user === 'user1' ? '品瑜' : '品榕';

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer-tick', {
      isRunning: timerState.isRunning,
      isPaused: timerState.isPaused,
      remainingSec: timerState.remainingSec,
      totalDuration: timerState.totalDuration,
      user: timerState.user,
    });
  }
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send('update-mini-display', timeString, userName);
  }
}

// 每 tick 計算實際剩餘時間（用 Date.now 當基準，不依賴 interval 精度）
function tick() {
  if (!timerState.isRunning || timerState.isPaused) return;
  const elapsedMs = Date.now() - timerState.startTime - timerState.accumulatedPauseMs;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const newRemaining = Math.max(0, timerState.totalDuration - elapsedSec);

  if (newRemaining !== timerState.remainingSec) {
    timerState.remainingSec = newRemaining;
    broadcastTick();
  }

  if (newRemaining <= 0) {
    completeTimer();
  }
}

// 啟動 powerSaveBlocker（防止系統/應用被掛起）
function startPowerSaveBlocker() {
  if (powerSaveBlockerId !== null) return;
  try {
    powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    console.log('🔋 powerSaveBlocker 已啟動 id:', powerSaveBlockerId);
  } catch (e) {
    console.error('powerSaveBlocker 啟動失敗:', e);
  }
}

function stopPowerSaveBlocker() {
  if (powerSaveBlockerId === null) return;
  try {
    if (powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlocker.stop(powerSaveBlockerId);
      console.log('🔋 powerSaveBlocker 已停止');
    }
  } catch (e) {
    console.error('powerSaveBlocker 停止失敗:', e);
  }
  powerSaveBlockerId = null;
}

// 開始新計時
function startMainTimer({ totalDuration, user, category, startTimestamp }) {
  if (timerTickInterval) {
    clearInterval(timerTickInterval);
    timerTickInterval = null;
  }
  timerState = {
    isRunning: true,
    isPaused: false,
    totalDuration,
    remainingSec: totalDuration,
    startTime: Date.now(),
    pauseStartTime: 0,
    accumulatedPauseMs: 0,
    user,
    category,
    startTimestamp,
  };
  startPowerSaveBlocker();
  // 每 250ms tick 一次（顯示精度仍是秒，但反應更靈敏）
  timerTickInterval = setInterval(tick, 250);
  broadcastTick();
  console.log('⏱️ 主進程計時開始:', { totalDuration, user, category });
}

function pauseMainTimer() {
  if (!timerState.isRunning || timerState.isPaused) return;
  timerState.isPaused = true;
  timerState.pauseStartTime = Date.now();
  broadcastTick();
  console.log('⏸️ 主進程計時暫停，剩餘:', timerState.remainingSec, '秒');
}

function resumeMainTimer() {
  if (!timerState.isRunning || !timerState.isPaused) return;
  const pausedMs = Date.now() - timerState.pauseStartTime;
  timerState.accumulatedPauseMs += pausedMs;
  timerState.isPaused = false;
  timerState.pauseStartTime = 0;
  broadcastTick();
  console.log('▶️ 主進程計時繼續，剩餘:', timerState.remainingSec, '秒');
}

function resetMainTimer() {
  if (timerTickInterval) {
    clearInterval(timerTickInterval);
    timerTickInterval = null;
  }
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.remainingSec = timerState.totalDuration;
  stopPowerSaveBlocker();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer-reset-confirmed');
  }
  console.log('🔄 主進程計時重置');
}

// 計時自然完成 → 主動恢復視窗 + 通知 renderer 跑後續流程
function completeTimer() {
  if (timerTickInterval) {
    clearInterval(timerTickInterval);
    timerTickInterval = null;
  }
  const completedSnapshot = {
    user: timerState.user,
    category: timerState.category,
    totalDuration: timerState.totalDuration,
    startTimestamp: timerState.startTimestamp,
  };
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.remainingSec = 0;
  stopPowerSaveBlocker();

  // 主動恢復視窗（不依賴 renderer 是否被節流）
  if (isMinimized) {
    console.log('計時完成：從迷你模式恢復');
    restoreFromMiniMode();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    // screen-saver level：能蓋過其他應用的全螢幕模式（如 Chrome 全螢幕看 YouTube）
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.show();
    mainWindow.focus();
    // 工具列圖示閃爍：即使視窗仍被擋住，也能引起注意
    mainWindow.flashFrame(true);

    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.flashFrame(false);
      }
    }, 5000);

    // 給視窗 100ms 暖機時間（讓 renderer 從遮擋狀態變可見），再通知跑警報音效
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('timer-completed', completedSnapshot);
      }
    }, 100);
  }
  console.log('🔔 主進程計時完成:', completedSnapshot);
}

// 視窗狀態儲存/載入（路徑延遲取得，避免 app 未就緒）
let windowStatePath = null;

function getWindowStatePath() {
  if (!windowStatePath) {
    windowStatePath = path.join(app.getPath('userData'), 'window-state.json');
  }
  return windowStatePath;
}

function loadWindowState() {
  try {
    const data = fs.readFileSync(getWindowStatePath(), 'utf8');
    const parsed = JSON.parse(data);
    // 向下相容：舊格式是直接存 bounds 物件（有 width 屬性），新格式是 { main: {...}, mini: {...} }
    if (parsed && parsed.width) {
      return { main: parsed };
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || isMinimized) return;
  try {
    const bounds = mainWindow.getBounds();
    const existing = loadWindowState() || {};
    existing.main = bounds;
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(existing));
  } catch (e) {
    console.error('儲存視窗狀態失敗:', e);
  }
}

function createWindow() {
  // 嘗試載入上次的視窗大小
  const savedState = loadWindowState();

  let windowWidth, windowHeight, windowX, windowY;

  if (savedState && savedState.main) {
    // 使用上次儲存的大小和位置
    windowWidth = savedState.main.width;
    windowHeight = savedState.main.height;
    windowX = savedState.main.x;
    windowY = savedState.main.y;
  } else {
    // 首次啟動，根據螢幕計算預設大小
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    windowWidth = Math.max(800, Math.min(1200, Math.floor(screenWidth * 0.5)));
    windowHeight = Math.max(800, Math.floor(screenHeight * 0.9));
  }

  // 創建瀏覽器窗口
  const windowOptions = {
    width: windowWidth,
    height: windowHeight,
    minWidth: 700,
    minHeight: 700,
    maxWidth: 1400,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // 防止視窗被遮擋時 Chromium 節流計時器
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: '電腦使用時間追蹤器',
    show: false,
  };

  // 如果有儲存位置就套用，否則置中
  if (savedState && savedState.main) {
    windowOptions.x = windowX;
    windowOptions.y = windowY;
  } else {
    windowOptions.center = true;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // 載入HTML文件
  mainWindow.loadFile('src/index.html');

  // 當窗口準備好時顯示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 視窗大小/位置變更時儲存
  mainWindow.on('resize', () => saveWindowState());
  mainWindow.on('move', () => saveWindowState());

  // 攔截窗口關閉事件
  mainWindow.on('close', (event) => {
    // 儲存視窗狀態
    saveWindowState();
    // 如果是強制退出，不攔截
    if (forceQuit) {
      return;
    }
    
    // 攔截關閉事件，檢查計時狀態
    event.preventDefault();
    // 向渲染進程詢問是否正在計時
    mainWindow.webContents.send('check-timer-status', 'close');
  });

  // 當窗口真正關閉時觸發
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 攔截最小化事件
  mainWindow.on('minimize', (event) => {
    // 如果不在迷你模式，攔截並檢查計時狀態
    if (!isMinimized) {
      event.preventDefault();
      // 向渲染進程詢問是否正在計時
      mainWindow.webContents.send('check-timer-status', 'minimize');
    }
  });

  // 開發模式下開啟開發者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// 創建系統托盤
function createTray() {
  // 防止重複建立 Tray
  if (tray) return;

  const { nativeImage } = require('electron');
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    // 系統匣圖示建議 16x16，縮放避免模糊
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } catch (error) {
    console.log('托盤圖標載入失敗，使用預設圖標');
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  
  // 設置托盤工具提示
  tray.setToolTip('電腦使用時間追蹤器');
  
  // 創建托盤菜單
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '顯示主窗口',
      click: () => {
        if (mainWindow) {
          if (isMinimized) {
            // 如果在迷你模式，先恢復正常模式
            restoreFromMiniMode();
          }
          mainWindow.show();
          mainWindow.focus();
        } else {
          // 如果窗口不存在，重新創建
          createWindow();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        console.log('托盤菜單：強制退出應用程式');
        forceQuit = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // 雙擊托盤圖標顯示窗口
  tray.on('double-click', () => {
    // 如果在迷你模式，優先顯示迷你視窗
    if (isMinimized && miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.show();
      miniWindow.focus();
    } else if (mainWindow) {
      if (isMinimized) {
        restoreFromMiniMode();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 儲存迷你視窗位置
function saveMiniWindowState(pos) {
  try {
    const existing = loadWindowState() || {};
    existing.mini = pos;
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(existing));
  } catch (e) {
    console.error('儲存迷你視窗位置失敗:', e);
  }
}

// 建立迷你視窗
function createMiniWindow(timeString, userName) {
  if (miniWindow) return;

  const savedState = loadWindowState();
  const miniPos = savedState && savedState.mini ? savedState.mini : null;

  const miniOptions = {
    width: 280,
    height: 70,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: false,
    skipTaskbar: false,
    minimizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // 防止視窗被遮擋時 Chromium 節流計時器
    },
  };

  // 檢查記憶位置是否在螢幕可見範圍內
  if (miniPos) {
    const displays = screen.getAllDisplays();
    const isVisible = displays.some(display => {
      const { x, y, width, height } = display.workArea;
      // 迷你視窗中心點必須在工作區域內（避免被工作列擋住）
      const centerX = miniPos.x + 140; // 280/2
      const centerY = miniPos.y + 35;  // 70/2
      return centerX > x && centerX < x + width &&
             centerY > y && centerY < y + height;
    });
    if (isVisible) {
      miniOptions.x = miniPos.x;
      miniOptions.y = miniPos.y;
    } else {
      console.log('迷你視窗記憶位置超出螢幕，重置到右上角');
    }
  }

  miniWindow = new BrowserWindow(miniOptions);
  miniWindow.loadFile('src/mini-window.html');

  // 視窗載入完成後送初始資料
  miniWindow.webContents.once('did-finish-load', () => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.webContents.send('update-mini-display', timeString, userName);
    }
  });

  // 迷你視窗移動時記住位置
  miniWindow.on('move', () => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      const bounds = miniWindow.getBounds();
      saveMiniWindowState({ x: bounds.x, y: bounds.y });
    }
  });

  // 關閉按鈕 → 隱藏到系統匣（計時繼續背景執行）
  miniWindow.on('close', (e) => {
    if (!forceQuit && miniWindow && !miniWindow.isDestroyed()) {
      e.preventDefault();
      miniWindow.hide();
      console.log('迷你視窗已隱藏到系統匣');
    }
  });

  miniWindow.on('closed', () => {
    miniWindow = null;
  });

  // 如果沒有設定位置，放在螢幕右上角
  if (!miniOptions.x && miniOptions.x !== 0) {
    const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
    miniWindow.setPosition(screenW - 300, 20);
  }

  console.log('迷你視窗已建立');
}

// 關閉迷你視窗（真正銷毀）
function closeMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.removeAllListeners('close'); // 移除隱藏攔截，允許真正關閉
    miniWindow.close();
    miniWindow = null;
  }
}

// 從迷你模式恢復
function restoreFromMiniMode() {
  closeMiniWindow();
  isMinimized = false;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('timer-restored');
  }
  console.log('迷你模式恢復完成');
}

// 註冊全局快捷鍵
function registerGlobalShortcuts() {
  // Ctrl+Space: 快速開始/暫停
  globalShortcut.register('CommandOrControl+Space', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global-shortcut', 'start-pause');
    }
  });

  // Ctrl+Shift+M: 切換迷你模式
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global-shortcut', 'toggle-mini');
    }
  });

  // Ctrl+Shift+R: 重置計時器
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global-shortcut', 'reset');
    }
  });

  console.log('全局快捷鍵已註冊');
}

// 初始化自動更新器（在 app ready 之後）
function setupAutoUpdater() {
  const { autoUpdater } = require('electron-updater');

  // 設定自動更新器
  autoUpdater.autoDownload = false; // 不自動下載，讓使用者確認
  autoUpdater.autoInstallOnAppQuit = true; // 應用程式關閉時自動安裝

  // 自動更新事件監聽
  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 正在檢查更新...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('✅ 發現新版本:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('✅ 目前已是最新版本:', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ 自動更新錯誤:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const message = `下載進度: ${Math.round(progressObj.percent)}%`;
    console.log(message);
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ 更新已下載完成:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });

  // 不再自動檢查更新,改由使用者手動點擊「檢查更新」按鈕
  console.log('✅ 自動更新系統已初始化,等待使用者手動檢查更新');

  return autoUpdater;
}

// 單一實例鎖定：防止重複開啟
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // 已有實例在運行，退出新實例
  app.quit();
} else {
  app.on('second-instance', () => {
    // 使用者嘗試開第二個實例 → 把現有視窗拉回前景
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 當Electron完成初始化並準備創建瀏覽器窗口時調用此方法
app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  createTray();
  registerGlobalShortcuts();

  // 初始化自動更新器
  const autoUpdater = setupAutoUpdater();

  // 將 autoUpdater 設為全域變數，供 IPC handler 使用
  global.autoUpdater = autoUpdater;

  // 啟動後延遲 5 秒自動檢查更新（避免影響啟動速度）
  setTimeout(() => {
    if (global.autoUpdater) {
      console.log('啟動自動檢查更新...');
      global.autoUpdater.checkForUpdates();
    }
  }, 5000);
});

// 當所有窗口關閉時的處理
app.on('window-all-closed', () => {
  // 如果是強制退出，則真正退出應用程式
  if (forceQuit) {
    console.log('強制退出：應用程式即將關閉');
    app.quit();
  } else {
    // 否則繼續在背景運行
    console.log('所有窗口已關閉，但應用程式繼續在背景運行');
  }
});

app.on('activate', () => {
  // 在macOS上，當應用程式圖標被點擊且沒有其他窗口打開時，重新創建窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 清理全局快捷鍵
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  console.log('全局快捷鍵已清理');
});

// 設置應用程式菜單
const template = [
  {
    label: '檔案',
    submenu: [
      {
        label: '重新載入',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          if (mainWindow) {
            mainWindow.reload();
          }
        }
      },
      {
        label: '開發者工具',
        accelerator: 'F12',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.toggleDevTools();
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          console.log('應用程式菜單：強制退出應用程式');
          forceQuit = true;
          app.quit();
        }
      }
    ]
  },
  {
    label: '計時器',
    submenu: [
      {
        label: '開始/暫停',
        accelerator: 'CmdOrCtrl+Space',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('global-shortcut', 'start-pause');
          }
        }
      },
      {
        label: '重置計時器',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('global-shortcut', 'reset');
          }
        }
      },
      {
        label: '切換迷你模式',
        accelerator: 'CmdOrCtrl+Shift+M',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('global-shortcut', 'toggle-mini');
          }
        }
      }
    ]
  },
  {
    label: '視窗',
    submenu: [
      {
        label: '最小化',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize'
      },
      {
        label: '關閉',
        accelerator: 'CmdOrCtrl+W',
        role: 'close'
      }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// --- 新的 IPC 處理和網路請求 ---

/**
 * 使用 axios 發送網路請求到 Google Apps Script
 * @param {string} url - 請求的 URL
 * @returns {Promise<object>} - 解析後的 JSON 數據
 */
async function fetchGoogleScript(url) {
  try {
    console.log('=== 發送請求到 Google Apps Script ===');
    console.log('URL:', url);
    
    // 使用 axios 發送 GET 請求，並設定 15 秒的超時
    const response = await axios.get(url, {
      timeout: 15000, // 15 秒超時
      maxRedirects: 5, // 允許最多5次重定向
      // axios 預設會自動處理重定向
    });
    
    console.log('=== 響應狀態 ===');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Data type:', typeof response.data);
    console.log('Data:', response.data);

    // Google Apps Script 可能會返回 JSONP 格式，外層包著一個函數調用
    // 例如：callback({...})
    // 我們需要判斷並提取純 JSON 數據
    if (typeof response.data === 'string') {
      const match = response.data.match(/\((.*)\)/);
      if (match && match[1]) {
        return JSON.parse(match[1]);
      }
    }
    
    // 如果 response.data 已經是 object，直接返回
    return response.data;

  } catch (error) {
    // 統一處理 axios 的錯誤
    if (axios.isAxiosError(error)) {
      // 提取更詳細的錯誤資訊
      const errorInfo = {
        message: error.message,
        url: error.config.url,
        method: error.config.method,
        status: error.response ? error.response.status : null,
        statusText: error.response ? error.response.statusText : null,
      };
      console.error('Axios request failed:', errorInfo);
      // 拋出一個更具體的錯誤，方便上層捕獲
      throw new Error(`網路請求失敗: ${error.message}`);
    } else {
      // 處理非 axios 錯誤（例如 JSON 解析錯誤）
      console.error('An unexpected error occurred:', error);
      throw new Error(`處理請求時發生未知錯誤: ${error.message}`);
    }
  }
}

// 設置所有 IPC 通道的處理程序
function setupIpcHandlers() {
  // 處理來自渲染進程的網路請求
  ipcMain.handle('fetch-google-script', async (event, url) => {
    try {
      const data = await fetchGoogleScript(url);
      return { success: true, data };
    } catch (error) {
      console.error('Failed to fetch Google Script:', error);
      return { success: false, error: error.message };
    }
  });

  // 處理計時狀態檢查回應
  ipcMain.on('timer-status-response', (event, isTimerRunning, actionType) => {
    console.log('主進程收到計時狀態回應:', {isTimerRunning, actionType, isMinimized, currentUserIdentity});
    
    if (mainWindow) {
      if (actionType === 'close') {
        const isChild = currentUserIdentity === 'user1' || currentUserIdentity === 'user2';

        // 小孩身份：一律隱藏到系統匣（防止誤關失去提醒功能）
        // 家長/其他身份：有計時隱藏，沒計時真正退出
        if (isTimerRunning || isChild) {
          console.log(isChild ? '小孩身份，隱藏到系統匣' : '計時運行中，隱藏窗口到工具列');

          // 如果當前在迷你模式，先恢復正常大小再隱藏
          if (isMinimized) {
            console.log('從迷你模式恢復後隱藏');
            restoreFromMiniMode();
          }

          mainWindow.hide();
        } else {
          console.log('沒有計時，真正退出應用程式');
          forceQuit = true;
          app.quit();
        }
      } else if (actionType === 'minimize') {
        // 最小化按鈕：根據計時狀態決定行為
        if (isTimerRunning) {
          console.log('計時運行中，進入迷你視窗模式');
          if (!isMinimized) {
            // 請 renderer 提供目前計時資訊，然後開迷你視窗
            mainWindow.webContents.send('request-mini-mode-data');
          }
        } else {
          console.log('沒有計時，正常最小化到工作列');
          mainWindow.minimize();
        }
      }
    }
  });

  // === 主進程計時器控制 IPC ===
  // renderer 點「開始」→ 啟動 main 計時器
  ipcMain.on('timer-start', (event, opts) => {
    if (!opts || !opts.totalDuration || !opts.user) {
      console.warn('timer-start 缺少必要參數:', opts);
      return;
    }
    startMainTimer({
      totalDuration: opts.totalDuration,
      user: opts.user,
      category: opts.category || null,
      startTimestamp: opts.startTimestamp || new Date().toISOString(),
    });
  });

  // renderer 點「暫停」
  ipcMain.on('timer-pause', () => {
    pauseMainTimer();
  });

  // renderer 點「繼續」（從暫停恢復）
  ipcMain.on('timer-resume', () => {
    if (!timerState.isRunning) {
      console.warn('timer-resume 收到但 timerState 未啟動，忽略');
      return;
    }
    resumeMainTimer();
  });

  // renderer 點「重置」
  ipcMain.on('timer-reset', () => {
    resetMainTimer();
  });

  // renderer 查詢當前計時狀態（用於頁面 reload 後重建 UI）
  ipcMain.handle('timer-get-state', () => {
    return {
      isRunning: timerState.isRunning,
      isPaused: timerState.isPaused,
      remainingSec: timerState.remainingSec,
      totalDuration: timerState.totalDuration,
      user: timerState.user,
      category: timerState.category,
      startTimestamp: timerState.startTimestamp,
    };
  });

  // 進入迷你模式（renderer 提供計時資料後觸發）
  ipcMain.on('enter-mini-mode', (event, timeString, userName) => {
    console.log('進入迷你視窗模式:', timeString, userName);
    isMinimized = true;
    createMiniWindow(timeString, userName);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  });

  // 迷你視窗：暫停 → 直接呼叫主計時器 + 通知主視窗 UI 同步
  ipcMain.on('mini-pause', () => {
    pauseMainTimer();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer-paused-by-mini');
    }
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.webContents.send('mini-pause-state', true);
    }
  });

  // 迷你視窗：繼續 → 直接呼叫主計時器 + 通知主視窗 UI 同步
  ipcMain.on('mini-resume', () => {
    resumeMainTimer();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer-resumed-by-mini');
    }
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.webContents.send('mini-pause-state', false);
    }
  });

  // 迷你視窗：結束計時 → 直接呼叫主計時器 + 通知主視窗 UI 同步
  ipcMain.on('mini-stop', () => {
    console.log('迷你視窗請求結束計時');
    resetMainTimer();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer-stopped-by-mini');
    }
    restoreFromMiniMode();
  });

  // 迷你視窗：最小化
  ipcMain.on('mini-minimize', () => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.minimize();
    }
  });

  // 迷你視窗：關閉（隱藏到系統匣）
  ipcMain.on('mini-close', () => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.hide();
      console.log('迷你視窗已隱藏到系統匣');
    }
  });

  // 計時完成的視窗置頂與從迷你模式恢復，已由 main 進程的 completeTimer() 主動處理

  // 處理來自渲染進程的手動恢復請求（從迷你模式退出）
  ipcMain.on('exit-mini-mode', (event) => {
    console.log('收到退出迷你模式請求');
    restoreFromMiniMode();
  });

  // 處理自動更新相關的 IPC 事件
  ipcMain.on('download-update', () => {
    console.log('開始下載更新...');
    if (global.autoUpdater) {
      global.autoUpdater.downloadUpdate();
    }
  });

  ipcMain.on('quit-and-install', () => {
    console.log('退出並安裝更新...');
    if (global.autoUpdater) {
      global.autoUpdater.quitAndInstall();
    }
  });

  ipcMain.on('check-for-updates', () => {
    console.log('手動檢查更新...');
    if (global.autoUpdater) {
      global.autoUpdater.checkForUpdates();
    }
  });

  // === 開機自啟動 + 閒置偵測 IPC ===

  // 設定開機自啟動
  ipcMain.on('set-auto-launch', (event, enabled) => {
    console.log('⚙️ 設定開機自啟動:', enabled);
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath
    });
  });

  // 渲染進程回報當前用戶身份
  ipcMain.on('user-identity', (event, identity) => {
    console.log('👤 收到用戶身份:', identity);
    currentUserIdentity = identity;

    // 小孩身份才啟動閒置偵測
    if (identity === 'user1' || identity === 'user2') {
      setupActivityReminder();
    } else {
      stopActivityReminder();
    }
  });

  // 渲染進程回報計時狀態
  ipcMain.on('timer-running-status', (event, isRunning) => {
    isTimerCurrentlyRunning = isRunning;
    if (isRunning) {
      activeSeconds = 0;
    }
  });

  // 使用者點「稍後提醒」
  ipcMain.on('snooze-reminder', (event) => {
    console.log('💤 稍後提醒，冷卻 5 分鐘');
    reminderCooldownUntil = Date.now() + 5 * 60 * 1000;
    activeSeconds = 0;
    // 取消置頂
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
    }
  });

  // 取消視窗置頂（提醒被處理後）
  ipcMain.on('cancel-always-on-top', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
    }
  });

  // 計時完成音效循環後強制置頂（screen-saver level 能蓋過全螢幕應用）
  ipcMain.on('force-window-top', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.show();
      mainWindow.focus();
      mainWindow.flashFrame(true);
    }
  });

  // 關閉螢幕（螢幕休眠）
  ipcMain.on('turn-off-screen', () => {
    console.log('🖥️ 關閉螢幕');
    const { exec } = require('child_process');
    exec('powershell -Command "(Add-Type -MemberDefinition \'[DllImport(\\\"user32.dll\\\")] public static extern int SendMessage(int hWnd, int hMsg, int wParam, int lParam);\' -Name ScreenOff -Namespace Win32 -PassThru)::SendMessage(-1, 0x0112, 0xF170, 2)"');
  });

  // 冷卻期開始（計時完成停止警報後）
  ipcMain.on('cooldown-started', () => {
    cooldownEndTime = Date.now() + 5 * 60 * 1000;
    cooldownReminderShowing = false;
    console.log('❄️ 冷卻期開始，5 分鐘後結束');
  });

  // 冷卻期提醒已關閉
  ipcMain.on('cooldown-dismiss', () => {
    cooldownReminderShowing = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
    }
  });
}

// 啟動活動偵測提醒
function setupActivityReminder() {
  if (activityCheckInterval) return;

  console.log('🔍 啟動活動偵測提醒');
  activityCheckInterval = setInterval(() => {
    const idleTime = powerMonitor.getSystemIdleTime();

    if (idleTime < 5) {
      activeSeconds += 5;
    } else {
      activeSeconds = 0;
    }

    const now = Date.now();
    const isChild = currentUserIdentity === 'user1' || currentUserIdentity === 'user2';

    // 冷卻期內偵測到活動 → 顯示休息提醒
    if (
      isChild &&
      now < cooldownEndTime &&
      idleTime < 5 &&
      !cooldownReminderShowing
    ) {
      const remainingMs = cooldownEndTime - now;
      const remainingSec = Math.ceil(remainingMs / 1000);
      console.log('😴 冷卻期內偵測到活動，剩餘', remainingSec, '秒');
      cooldownReminderShowing = true;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true);
        mainWindow.focus();
        mainWindow.webContents.send('show-cooldown-reminder', remainingSec);
      }
    }

    // 冷卻期內持續更新剩餘時間
    if (isChild && now < cooldownEndTime && cooldownReminderShowing) {
      const remainingSec = Math.ceil((cooldownEndTime - now) / 1000);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-cooldown-time', remainingSec);
      }
    }

    // 冷卻期結束
    if (cooldownEndTime > 0 && now >= cooldownEndTime) {
      cooldownEndTime = 0;
      cooldownReminderShowing = false;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cooldown-ended');
        mainWindow.setAlwaysOnTop(false);
      }
    }

    // 一般閒置提醒（非冷卻期）
    if (
      activeSeconds >= 60 &&
      !isTimerCurrentlyRunning &&
      isChild &&
      now > reminderCooldownUntil &&
      now >= cooldownEndTime
    ) {
      console.log('⏰ 偵測到使用電腦但未計時，發送提醒');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true);
        mainWindow.focus();
        mainWindow.webContents.send('show-timer-reminder');
      }
      reminderCooldownUntil = now + 5 * 60 * 1000;
      activeSeconds = 0;
    }
  }, 5000);
}

// 停止活動偵測
function stopActivityReminder() {
  if (activityCheckInterval) {
    clearInterval(activityCheckInterval);
    activityCheckInterval = null;
    console.log('🛑 停止活動偵測提醒');
  }
}