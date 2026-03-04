const { app, BrowserWindow, Menu, screen, ipcMain, Tray, globalShortcut, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// 禁用硬體加速以避免 WSL 環境的 GPU 錯誤
// 只有在 app 可用時才呼叫
if (app && typeof app.disableHardwareAcceleration === 'function') {
  app.disableHardwareAcceleration();
}

// 自動更新器設定會在 app.whenReady() 之後初始化

// 保持對window對象的全局引用，避免被垃圾回收
let mainWindow;
let isMinimized = false;
let originalBounds = null;
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
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || isMinimized) return;
  try {
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(bounds));
  } catch (e) {
    console.error('儲存視窗狀態失敗:', e);
  }
}

function createWindow() {
  // 嘗試載入上次的視窗大小
  const savedState = loadWindowState();

  let windowWidth, windowHeight, windowX, windowY;

  if (savedState) {
    // 使用上次儲存的大小和位置
    windowWidth = savedState.width;
    windowHeight = savedState.height;
    windowX = savedState.x;
    windowY = savedState.y;
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
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: '電腦使用時間追蹤器',
    show: false,
  };

  // 如果有儲存位置就套用，否則置中
  if (savedState) {
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
    if (mainWindow) {
      if (isMinimized) {
        restoreFromMiniMode();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 從迷你模式恢復
function restoreFromMiniMode() {
  if (mainWindow && isMinimized && originalBounds) {
    console.log('恢復迷你模式，從:', mainWindow.getBounds(), '到:', originalBounds);
    
    // 恢復原始窗口大小和位置
    mainWindow.setBounds(originalBounds);
    
    // 恢復窗口屬性
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setResizable(true);
    
    // 恢復正常模式的最小尺寸限制（允許用戶手動縮放）
    mainWindow.setMinimumSize(400, 500);
    
    isMinimized = false;
    
    // 只有在窗口可見時才通知渲染進程
    if (!mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('timer-restored');
    }
    
    console.log('迷你模式恢復完成');
  }
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
    console.log('主進程收到計時狀態回應:', {isTimerRunning, actionType, isMinimized});
    
    if (mainWindow) {
      if (actionType === 'close') {
        // 關閉按鈕：如果沒有計時就真正退出，如果有計時就隱藏到工具列
        if (isTimerRunning) {
          console.log('計時運行中，隱藏窗口到工具列');
          
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
          console.log('計時運行中，進入迷你模式');
          // 如果計時正在運行，進入迷你模式
          if (!isMinimized) {
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
            
            // 保存原始窗口大小和位置
            originalBounds = mainWindow.getBounds();
            console.log('保存原始窗口:', originalBounds);
            
            // 先設置迷你模式的最小尺寸（僅迷你模式使用）
            console.log('設置迷你模式最小尺寸: 160x60');
            mainWindow.setMinimumSize(160, 60);
            
            // 設置迷你模式：右上角小窗口
            const newBounds = {
              x: screenWidth - 160,
              y: 0,
              width: 160,
              height: 60
            };
            console.log('設置迷你窗口:', newBounds);
            mainWindow.setBounds(newBounds);
            
            // 驗證實際設置的大小並強制修正
            setTimeout(() => {
              const actualBounds = mainWindow.getBounds();
              console.log('實際迷你模式窗口大小:', actualBounds);
              
              // 如果大小不正確，強制重新設置
              if (actualBounds.width !== 160 || actualBounds.height !== 60) {
                console.log('迷你模式大小不正確，強制重新設置');
                mainWindow.setBounds({
                  x: screenWidth - 160,
                  y: 0,
                  width: 160,
                  height: 60
                });
              }
            }, 100);
            
            // 設置窗口屬性
            mainWindow.setAlwaysOnTop(true);
            mainWindow.setResizable(false);
            
            isMinimized = true;
            console.log('窗口已設為迷你模式');
            
            // 通知渲染進程已進入迷你模式
            mainWindow.webContents.send('timer-minimized');
          } else {
            console.log('已經在迷你模式中');
          }
        } else {
          console.log('沒有計時，正常最小化到工作列');
          // 沒有計時，正常最小化到工作列
          mainWindow.minimize();
        }
      }
    }
  });

  // 更新迷你窗口標題
  ipcMain.on('update-mini-timer', (event, timeLeft, user) => {
    if (mainWindow && isMinimized) {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      mainWindow.setTitle(`${user} - ${timeString}`);
    }
  });

  // 計時結束時將窗口置頂
  ipcMain.on('timer-completed-show-window', (event) => {
    console.log('收到計時完成通知，將窗口置頂');
    
    if (mainWindow) {
      // 如果在迷你模式，先恢復正常模式
      if (isMinimized) {
        console.log('從迷你模式恢復並置頂');
        restoreFromMiniMode();
      }
      
      // 顯示窗口並置頂
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      
      // 5秒後取消置頂狀態，避免永久置頂
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(false);
          console.log('取消窗口置頂狀態');
        }
      }, 5000);
      
      console.log('窗口已置頂並獲得焦點');
    }
  });

  // 處理來自渲染進程的手動恢復請求
  ipcMain.on('restore-timer', (event) => {
    console.log('收到手動恢復迷你模式請求');
    if (mainWindow && isMinimized) {
      restoreFromMiniMode();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // 強制同步迷你模式狀態
  ipcMain.on('sync-mini-mode-state', (event, rendererMiniMode) => {
    console.log('同步迷你模式狀態 - 主進程:', isMinimized, '渲染進程:', rendererMiniMode);

    if (isMinimized !== rendererMiniMode) {
      console.log('檢測到狀態不同步，進行修復');
      if (rendererMiniMode && !isMinimized) {
        // 渲染進程認為在迷你模式，但主進程不是
        isMinimized = true;
      } else if (!rendererMiniMode && isMinimized) {
        // 主進程認為在迷你模式，但渲染進程不是
        restoreFromMiniMode();
      }
    }
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

  // 計時完成音效循環後強制置頂
  ipcMain.on('force-window-top', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.focus();
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