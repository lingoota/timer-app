document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, starting app initialization...');
    
    // 更新為新的Google Apps Script Web App URL
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZOZNixqmMai8690QgbuitEQKk2hZGTU4O_YFlRw_NeO2A3FfmZg5WycWwCIb8BCkf0Q/exec';
    
    // DOM 元素
    const dom = {
        timeDisplay: document.getElementById('time-display'),
        userDisplay: document.getElementById('user-display'),
        startBtn: document.getElementById('start-btn'),
        pauseBtn: document.getElementById('pause-btn'),
        resetBtn: document.getElementById('reset-btn'),
        progressBar: document.getElementById('progress-bar'),
        user1Btn: document.getElementById('user1'),
        user2Btn: document.getElementById('user2'),
        // 用戶選擇相關
        userSelectionOverlay: document.getElementById('user-selection-overlay'),
        selectUser1Btn: document.getElementById('select-user1'),
        selectUser2Btn: document.getElementById('select-user2'),
        currentUserName: document.getElementById('current-user-name'),
        userSettingsBtn: document.getElementById('user-settings'),
        // 計時提醒相關
        timerReminderOverlay: document.getElementById('timer-reminder-overlay'),
        reminderStartTimerBtn: document.getElementById('reminder-start-timer'),
        reminderSnoozeBtn: document.getElementById('reminder-snooze'),
        cooldownReminderOverlay: document.getElementById('cooldown-reminder-overlay'),
        cooldownRemainingTime: document.getElementById('cooldown-remaining-time'),
        cooldownScreenOffBtn: document.getElementById('cooldown-screen-off-btn'),
        cooldownDismissBtn: document.getElementById('cooldown-dismiss-btn'),
        user1Total: document.getElementById('user1-total'),
        user2Total: document.getElementById('user2-total'),
        user1Sessions: document.getElementById('user1-sessions'),
        user2Sessions: document.getElementById('user2-sessions'),
        totalTime: document.getElementById('total-time'),
        sandAnimation: document.getElementById('sand-animation'),
        completedAnimation: document.getElementById('completed-animation'),
        timeButtons: document.querySelectorAll('.time-btn'),
        customTimeInput: document.getElementById('custom-time-input'),
        customMinutesInput: document.getElementById('custom-minutes'),
        confirmCustomTimeBtn: document.getElementById('confirm-custom-time'),
        customTimeBtn: document.querySelector('.custom-time-btn'),
        syncStatus: document.getElementById('sync-status'),
        toast: document.getElementById('toast'),
        refreshBtn: document.getElementById('refresh-btn'),
        soundToggle: document.getElementById('sound-toggle'),
        achievementBadge: document.getElementById('achievement-badge'),
        achievementText: document.getElementById('achievement-text'),
        exportBtn: document.getElementById('export-btn'),
        exportModal: document.getElementById('export-modal'),
        modalClose: document.getElementById('modal-close'),
        exportCsvBtn: document.getElementById('export-csv'),
        exportJsonBtn: document.getElementById('export-json'),
        chartsBtn: document.getElementById('charts-btn'),
        chartsModal: document.getElementById('charts-modal'),
        chartsModalClose: document.getElementById('charts-modal-close'),
        dailyPieChart: document.getElementById('daily-pie-chart'),
        userComparisonChart: document.getElementById('user-comparison-chart'),
        historyTrendChart: document.getElementById('history-trend-chart'),
        dailyChartLegend: document.getElementById('daily-chart-legend'),
        summaryPinyu: document.getElementById('summary-pinyu'),
        summaryPinrong: document.getElementById('summary-pinrong'),
        summaryTotal: document.getElementById('summary-total'),
        themeToggle: document.getElementById('theme-toggle'),
        container: document.querySelector('.container'),
        alarmStopButton: document.getElementById('alarm-stop-button'),
        stopAlarmBtn: document.getElementById('stop-alarm-btn'),
        screenOffAlarmBtn: document.getElementById('screen-off-alarm-btn'),
        screenOffBtn: document.getElementById('screen-off-btn'),
        settingsToggle: document.getElementById('settings-toggle'),
        settingsPanel: document.getElementById('settings-panel'),
    };
    
    // 狀態變數
    const state = {
        timer: null,
        timeLeft: 0,
        totalDuration: 0,
        isRunning: false,
        selectedUser: null,
        selectedCategory: null,
        user1TotalTime: 0,
        user2TotalTime: 0,
        user1SessionCount: 0,
        user2SessionCount: 0,
        startTimestamp: null,
        soundEnabled: true,
        achievementTimeout: null,
        lastUpdateTime: null,
        preventSleepInterval: null,
        isMiniMode: false,
        isDarkMode: false,
        alarmAudio: null, // 用於追蹤警報音效
        alarmTimeout: null, // 用於自動停止1分鐘警報
        lastCompletionTime: null, // 上次計時完成的時間
        isParentMode: false,  // 新增：家長觀察模式
        cooldownDuration: 5 * 60 * 1000, // 5分鐘冷卻期（毫秒）
        cooldownUpdateInterval: null, // 冷卻期更新定時器
        alarmCycleTimeout: null, // 警報循環定時器
        alarmCycleActive: false, // 警報循環是否激活
        alarmCycleCount: 0, // 警報循環次數計數
        // 用戶活動類別時間追蹤
        user1CategoryTime: {},
        user2CategoryTime: {},
    };
    
    // 暴露共享物件供拆分模組使用
    window.appDom = dom;
    window.appState = state;
    window.appScriptUrl = SCRIPT_URL;

    // 進度條設定
    const radius = 95;
    const circumference = 2 * Math.PI * radius;
    dom.progressBar.style.strokeDasharray = circumference;
    dom.progressBar.style.strokeDashoffset = circumference;
    
    // 成就系統
    const achievements = [
        { threshold: 300, message: '🌱 專注新手!', icon: '🌱' },
        { threshold: 900, message: '⭐ 專注達人!', icon: '⭐' },
        { threshold: 1800, message: '👑 專注大師!', icon: '👑' },
        { threshold: 3600, message: '🏆 專注王者!', icon: '🏆' }
    ];
    
    // 初始化
    console.log('開始初始化...');
    loadLocalBackup();
    updateStatsDisplay();
    initializeTheme();
    
    // 延遲執行用戶選擇初始化，確保DOM完全載入
    setTimeout(() => {
        console.log('開始初始化用戶選擇...');
        initializeUserSelection();
    }, 100);
    
    // 延遲載入雲端數據，讓本地數據先顯示
    setTimeout(() => {
        loadDataFromSheets();
    }, 500);
    
    // 監聽主進程的計時狀態檢查請求
    window.api.on('check-timer-status', (actionType) => {
        console.log('收到計時狀態檢查請求:', actionType, '當前計時狀態:', state.isRunning, '迷你模式:', state.isMiniMode);
        
        // 回應當前的計時狀態和操作類型
        window.api.send('timer-status-response', state.isRunning, actionType);
        
        // 根據操作類型和計時狀態決定界面行為
        if (actionType === 'close') {
            // 關閉按鈕：隱藏到工具列，不需要界面變化
            console.log('關閉按鈕：窗口將隱藏到工具列');
        } else if (actionType === 'minimize') {
            // 最小化按鈕：如果在計時，主進程會開迷你視窗
            if (state.isRunning) {
                console.log('計時運行中，主進程將開啟迷你視窗');
            } else {
                console.log('未在計時，將正常最小化到工作列');
            }
        }
    });

    // 主進程請求迷你模式的計時資料
    window.api.on('request-mini-mode-data', () => {
        if (state.isRunning && !state.isMiniMode) {
            const minutes = Math.floor(state.timeLeft / 60);
            const seconds = state.timeLeft % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            const userName = state.selectedUser === 'user1' ? '品瑜' : '品榕';
            state.isMiniMode = true;
            window.api.send('enter-mini-mode', timeString, userName);
            console.log('已發送迷你模式資料');
        }
    });

    // 監聯從迷你模式恢復的事件
    window.api.on('timer-restored', () => {
        console.log('收到恢復正常模式事件');
        if (state.isMiniMode) {
            state.isMiniMode = false;
            console.log('已恢復正常模式');
        }
    });
    
    // 監聽全局快捷鍵事件
    window.api.on('global-shortcut', (action) => {
        console.log('收到全局快捷鍵事件:', action);
        
        switch (action) {
            case 'start-pause':
                handleStartPauseShortcut();
                break;
            case 'toggle-mini':
                handleToggleMiniShortcut();
                break;
            case 'reset':
                handleResetShortcut();
                break;
            case 'pause':
                // 迷你視窗的暫停/繼續
                if (state.isRunning) {
                    dom.pauseBtn.click();
                } else if (state.timeLeft > 0 && state.timeLeft < state.totalDuration) {
                    dom.startBtn.click();
                }
                break;
            case 'stop':
                // 迷你視窗的結束計時
                dom.resetBtn.click();
                break;
        }
    });
    
    // 驗證自定義時間輸入
    function validateCustomTime(minutes) {
        if (isNaN(minutes) || minutes === null || minutes === undefined) {
            showToast('請輸入有效的數字');
            return false;
        }
        
        if (minutes < 1) {
            showToast('時間不能少於1分鐘');
            return false;
        }
        
        if (minutes > 30) {
            showToast('時間不能超過30分鐘');
            return false;
        }
        
        return true;
    }
    
    // 檢查開始按鈕狀態
    function checkStartButtonState() {
        // 檢查基本條件
        const basicConditionsMet = state.selectedUser && state.selectedCategory && state.totalDuration > 0 && !state.isRunning;
        
        // 檢查冷卻期
        let cooldownMet = true;
        let remainingCooldown = 0;
        
        if (state.lastCompletionTime) {
            const timeSinceCompletion = Date.now() - state.lastCompletionTime;
            cooldownMet = timeSinceCompletion >= state.cooldownDuration;
            remainingCooldown = Math.max(0, state.cooldownDuration - timeSinceCompletion);
        }
        
        if (basicConditionsMet && cooldownMet) {
            dom.startBtn.disabled = false;
            dom.startBtn.classList.add('active');
            dom.startBtn.textContent = '開始';
        } else {
            dom.startBtn.disabled = true;
            dom.startBtn.classList.remove('active');
            
            // 如果是冷卻期限制，顯示剩餘時間
            if (basicConditionsMet && !cooldownMet) {
                const minutes = Math.ceil(remainingCooldown / (60 * 1000));
                dom.startBtn.textContent = `冷卻中 (${minutes}分鐘)`;
            } else {
                dom.startBtn.textContent = '開始';
            }
        }
    }
    
    // 齒輪設定面板展開/收折
    if (dom.settingsToggle && dom.settingsPanel) {
        dom.settingsToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dom.settingsPanel.classList.toggle('hidden');
        });
    }

    // 點擊面板外部 → 收折面板
    document.addEventListener('click', function(e) {
        if (!dom.settingsPanel.classList.contains('hidden')) {
            // 檢查點擊是否在整個 settings-wrapper 內（包含齒輪按鈕和面板）
            const settingsWrapper = dom.settingsToggle ? dom.settingsToggle.closest('.settings-wrapper') : null;
            if (settingsWrapper && !settingsWrapper.contains(e.target)) {
                dom.settingsPanel.classList.add('hidden');
            }
        }
    });

    // 聲音控制
    dom.soundToggle.addEventListener('click', function() {
        state.soundEnabled = !state.soundEnabled;
        if (state.soundEnabled) {
            dom.soundToggle.innerHTML = '🔊<span class="feature-label">聲音</span>';
            dom.soundToggle.classList.remove('muted');
            showToast('聲音已開啟');
        } else {
            dom.soundToggle.innerHTML = '🔇<span class="feature-label">靜音</span>';
            dom.soundToggle.classList.add('muted');
            showToast('聲音已關閉');
        }
        localStorage.setItem('soundEnabled', state.soundEnabled);
    });

    // 從本地存儲載入聲音設定
    const savedSoundSetting = localStorage.getItem('soundEnabled');
    if (savedSoundSetting !== null) {
        state.soundEnabled = savedSoundSetting === 'true';
        if (!state.soundEnabled) {
            dom.soundToggle.innerHTML = '🔇<span class="feature-label">靜音</span>';
            dom.soundToggle.classList.add('muted');
        }
    }
    
    // 活動類別選擇器
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            if (!state.isRunning) {
                categoryButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                state.selectedCategory = this.dataset.category;
                checkStartButtonState();
                
                if (!state.selectedUser) {
                    showToast('請選擇使用者');
                } else if (!state.selectedCategory) {
                    showToast('請選擇活動類別');
                } else if (state.totalDuration === 0) {
                    showToast('請選擇時間');
                }
            }
        });
    });
    
    // 時間選擇器
    dom.timeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            if (!state.isRunning) {
                dom.timeButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                const minutesData = this.dataset.minutes;
                
                if (minutesData === 'custom') {
                    // 顯示自定義時間輸入框
                    dom.customTimeInput.classList.remove('hidden');
                    dom.customMinutesInput.focus();
                    // 重置計時器狀態，等待用戶輸入
                    state.totalDuration = 0;
                    state.timeLeft = 0;
                } else {
                    // 隱藏自定義時間輸入框
                    dom.customTimeInput.classList.add('hidden');
                    
                    const minutes = parseInt(minutesData);
                    state.totalDuration = minutes * 60;
                    state.timeLeft = state.totalDuration;
                    updateDisplay();
                    updateProgressBar();
                }
                
                checkStartButtonState();
                
                if (!state.selectedUser) {
                    showToast('請選擇使用者');
                }
            }
        });
    });
    
    // 自定義時間確認按鈕
    dom.confirmCustomTimeBtn.addEventListener('click', function() {
        const customMinutes = parseInt(dom.customMinutesInput.value);
        
        if (validateCustomTime(customMinutes)) {
            state.totalDuration = customMinutes * 60;
            state.timeLeft = state.totalDuration;
            updateDisplay();
            updateProgressBar();
            
            // 隱藏輸入框
            dom.customTimeInput.classList.add('hidden');
            
            // 更新「其他」按鈕顯示
            dom.customTimeBtn.textContent = `其他 (${customMinutes}分)`;
            
            checkStartButtonState();
            showToast(`已設定 ${customMinutes} 分鐘`);
        }
    });
    
    // 自定義時間輸入框 Enter 鍵支持
    dom.customMinutesInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            dom.confirmCustomTimeBtn.click();
        }
    });
    
    // 自定義時間輸入框失去焦點時的處理
    dom.customMinutesInput.addEventListener('blur', function() {
        // 如果用戶點擊了其他地方，可以選擇隱藏輸入框或保持顯示
        // 這裡我們選擇保持顯示，讓用戶有機會重新輸入
    });
    
    // 舊的用戶選擇按鈕已移除，現在使用啟動時選擇 + 記憶功能
    
    // 重新整理按鈕
    dom.refreshBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log("重新載入按鈕被點擊");
        
        dom.refreshBtn.style.transform = 'rotate(360deg)';
        dom.refreshBtn.style.transition = 'transform 1s ease';
        updateSyncStatus('重新載入中...', true);
        
        // 強制從Google Sheets重新載入數據
        loadDataFromSheets();
        
        setTimeout(() => {
            dom.refreshBtn.style.transform = '';
        }, 1000);
    });
    
    // 圖表 + 匯出事件已移至 charts.js
    
    // 主題切換按鈕事件
    dom.themeToggle.addEventListener('click', function(e) {
        console.log('Theme toggle button clicked!');
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
    });
    
    // 開始按鈕
    dom.startBtn.addEventListener('click', async function() {
        if (state.selectedUser && state.timeLeft > 0 && !state.isRunning) {
            stopAlarmSound(); // 停止可能在播放的警報
            state.isRunning = true;
            dom.startBtn.disabled = true;
            dom.startBtn.classList.remove('active');
            dom.pauseBtn.disabled = false;
            dom.resetBtn.disabled = false;

            state.startTimestamp = new Date();
            state.lastUpdateTime = Date.now();

            // 使用更高頻率的計時器來防止休眠
            state.timer = setInterval(updateTimer, 100);

            // 啟動防休眠機制
            state.preventSleepInterval = setInterval(preventSystemSleep, 30000);

            // 放大使用者名稱
            dom.userDisplay.classList.add('timing');

            dom.sandAnimation.style.display = 'block';
            startSandAnimation();

            if (state.soundEnabled) {
                playSound('start');
            }

            showToast(`${state.selectedUser === 'user1' ? '品瑜' : '品榕'}的計時開始!`);

            // 更新 Firebase 即時計時狀態
            const userId = state.selectedUser === 'user1' ? 'pinyu' : 'pinrong';
            if (window.updateLiveTimerStatus) {
                window.updateLiveTimerStatus(userId, {
                    isRunning: true,
                    startTime: Date.now(),
                    totalDuration: state.totalDuration,
                    category: state.selectedCategory
                });
            }

            // 延遲進入迷你模式，讓用戶看到計時開始
            setTimeout(() => {
                enterMiniMode();
            }, 1000);
        }
    });
    
    // 暫停按鈕
    dom.pauseBtn.addEventListener('click', function() {
        if (state.isRunning) {
            stopAlarmSound(); // 停止可能在播放的警報
            state.isRunning = false;
            clearInterval(state.timer);
            clearInterval(state.preventSleepInterval);
            dom.startBtn.disabled = false;
            dom.startBtn.classList.add('active');
            dom.pauseBtn.disabled = true;

            // 恢復使用者名稱大小
            dom.userDisplay.classList.remove('timing');

            dom.sandAnimation.style.display = 'none';

            if (state.soundEnabled) {
                playSound('pause');
            }

            showToast('計時已暫停');

            // 更新 Firebase 即時計時狀態（停止計時）
            const userId = state.selectedUser === 'user1' ? 'pinyu' : 'pinrong';
            if (window.updateLiveTimerStatus) {
                window.updateLiveTimerStatus(userId, { isRunning: false });
            }
        }
    });
    
    // 重置按鈕
    dom.resetBtn.addEventListener('click', function() {
        stopAlarmSound(); // 停止警報
        state.isRunning = false;
        clearInterval(state.timer);
        clearInterval(state.preventSleepInterval);
        state.lastUpdateTime = null;
        state.timeLeft = state.totalDuration;
        updateDisplay();
        updateProgressBar();
        
        dom.startBtn.disabled = false;
        dom.startBtn.classList.add('active');
        dom.pauseBtn.disabled = true;
        dom.resetBtn.disabled = true;
        
        // 恢復使用者名稱大小
        dom.userDisplay.classList.remove('timing');
        
        dom.sandAnimation.style.display = 'none';
        dom.completedAnimation.style.display = 'none';
        
        // 退出迷你模式
        if (state.isMiniMode) {
            exitMiniMode();
        }
        
        if (state.soundEnabled) {
            playSound('reset');
        }

        showToast('計時已重置');

        // 更新 Firebase 即時計時狀態（停止計時）
        const userId = state.selectedUser === 'user1' ? 'pinyu' : 'pinrong';
        if (window.updateLiveTimerStatus) {
            window.updateLiveTimerStatus(userId, { isRunning: false });
        }
    });
    
    // 停止警報按鈕
    dom.stopAlarmBtn.addEventListener('click', function() {
        stopAlarmSound();
        showToast('警報已停止');
    });

    // 關閉螢幕按鈕（警報區域）
    if (dom.screenOffAlarmBtn) {
        dom.screenOffAlarmBtn.addEventListener('click', function() {
            stopAlarmSound();
            window.api.send('turn-off-screen');
            showToast('螢幕已關閉，動滑鼠或按鍵盤即可恢復');
        });
    }

    // 關閉螢幕按鈕（計時器旁）
    if (dom.screenOffBtn) {
        dom.screenOffBtn.addEventListener('click', function() {
            window.api.send('turn-off-screen');
            showToast('螢幕已關閉，動滑鼠或按鍵盤即可恢復');
        });
    }

    // 防止系統休眠的函數
    function preventSystemSleep() {
        // 使用微小的DOM更新來保持活動狀態
        document.title = document.title === '電腦使用時間' ? '電腦使用時間 ⏰' : '電腦使用時間';
    }
    
    // 高精度計時器更新
    function updateTimer() {
        const currentTime = Date.now();
        
        if (state.lastUpdateTime === null) {
            state.lastUpdateTime = currentTime;
        }
        
        // 計算實際經過的時間（毫秒）
        const elapsed = Math.floor((currentTime - state.lastUpdateTime) / 1000);
        
        if (elapsed >= 1) {
            if (state.timeLeft > 0) {
                // 如果系統休眠導致時間跳躍，按實際時間扣除
                state.timeLeft = Math.max(0, state.timeLeft - elapsed);
                state.lastUpdateTime = currentTime;
                updateDisplay();
                updateProgressBar();
                updateSandAnimation();
            }
        }
        
        if (state.timeLeft <= 0) {
            clearInterval(state.timer);
            clearInterval(state.preventSleepInterval);
            state.isRunning = false;
            
            // 確保退出迷你模式
            ensureExitMiniMode();
            
            // 恢復使用者名稱大小
            dom.userDisplay.classList.remove('timing');
            
            const endTimestamp = new Date();
            
            // 不在此處記錄冷卻時間，等用戶手動停止警報時再記錄
            
            if (state.selectedUser === 'user1') {
                state.user1TotalTime += state.totalDuration;
                state.user1SessionCount++;
                // 追蹤活動類別時間
                if (!state.user1CategoryTime[state.selectedCategory]) {
                    state.user1CategoryTime[state.selectedCategory] = 0;
                }
                state.user1CategoryTime[state.selectedCategory] += state.totalDuration;
            } else if (state.selectedUser === 'user2') {
                state.user2TotalTime += state.totalDuration;
                state.user2SessionCount++;
                // 追蹤活動類別時間
                if (!state.user2CategoryTime[state.selectedCategory]) {
                    state.user2CategoryTime[state.selectedCategory] = 0;
                }
                state.user2CategoryTime[state.selectedCategory] += state.totalDuration;
            }
            
            updateStatsDisplay();
            saveLocalBackup();
            
            // 保存記錄到Google Sheets
            const currentSessionCount = state.selectedUser === 'user1' ? state.user1SessionCount : state.user2SessionCount;
            saveRecordToSheets(state.selectedUser === 'user1' ? '品瑜' : '品榕', state.selectedCategory, state.totalDuration, state.startTimestamp, endTimestamp, currentSessionCount);
            
            checkAchievements();
            
            dom.sandAnimation.style.display = 'none';
            dom.completedAnimation.style.display = 'block';
            dom.completedAnimation.classList.add('fade-in-out');
            
            dom.startBtn.disabled = true;
            dom.startBtn.classList.remove('active');
            dom.pauseBtn.disabled = true;
            dom.resetBtn.disabled = false;
            
            // 更新 Firebase 即時計時狀態（計時完成）
            const userId = state.selectedUser === 'user1' ? 'pinyu' : 'pinrong';
            if (window.updateLiveTimerStatus) {
                window.updateLiveTimerStatus(userId, { isRunning: false });
            }

            // 通知主進程將窗口置頂
            window.api.send('timer-completed-show-window');
            
            playCompletionEffect();
            
            if (state.soundEnabled) {
                // 激活警報循環，重置計數器
                state.alarmCycleActive = true;
                state.alarmCycleCount = 0;
                playSound('complete');
            }
            
            showToast('時間到! 🎉');
            
            setTimeout(() => {
                dom.completedAnimation.style.display = 'none';
                dom.completedAnimation.classList.remove('fade-in-out');
            }, 2000);
        }
    }
    
    // 更新顯示
    function updateDisplay() {
        const minutes = Math.floor(state.timeLeft / 60);
        const seconds = state.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        dom.timeDisplay.textContent = timeString;
        
        // 如果在迷你模式中，同時更新迷你顯示和IPC通信
        // 迷你視窗模式：透過 IPC 更新獨立小視窗的顯示
        if (state.isMiniMode) {
            window.api.send('update-mini-timer', state.timeLeft, state.selectedUser === 'user1' ? '品瑜' : '品榕');
        }
    }
    
    // 更新進度條
    function updateProgressBar() {
        const progress = state.timeLeft / state.totalDuration;
        const offset = circumference - (progress * circumference);
        dom.progressBar.style.strokeDashoffset = offset;
    }
    
    // 沙漏動畫
    function startSandAnimation() {
        const topSand = document.querySelector('.top-sand');
        const bottomSand = document.querySelector('.bottom-sand');
        
        topSand.style.height = '25px';
        bottomSand.style.height = '0px';
        
        animateSandParticles();
    }
    
    function updateSandAnimation() {
        const topSand = document.querySelector('.top-sand');
        const bottomSand = document.querySelector('.bottom-sand');
        
        const progress = 1 - (state.timeLeft / state.totalDuration);
        const maxHeight = 25;  // 配合新的沙漏尺寸
        const topHeight = maxHeight * (1 - progress);
        const bottomHeight = maxHeight * progress;
        
        topSand.style.height = `${topHeight}px`;
        bottomSand.style.height = `${bottomHeight}px`;
    }
    
    function animateSandParticles() {
        if (!state.isRunning) return;
        
        const particle = document.querySelector('.sand-particle');
        particle.style.animation = 'none';
        void particle.offsetWidth;
        particle.style.animation = 'fallingSand 1s linear';
        
        setTimeout(() => {
            if (state.isRunning) {
                animateSandParticles();
            }
        }, 300);
    }
    
    // 播放完成效果
    function playCompletionEffect() {
        dom.timeDisplay.classList.add('pulse');
        setTimeout(() => {
            dom.timeDisplay.classList.remove('pulse');
        }, 2000);
    }
    
    // 音效播放
    function playSound(type) {
        if (!state.soundEnabled) return;

        // 如果是新的音效請求，先停止可能正在播放的警報
        if (type !== 'complete') {
            stopAlarmSound();
        }

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (type === 'complete') {
                // 如果已經有警報在播放，則不重複啟動
                if (state.alarmAudio && state.alarmAudio.context.state === 'running') {
                    return;
                }

                // 創建一個持續的警報音
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.type = 'sine'; // 使用正弦波，聲音較柔和
                oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 音高
                gainNode.gain.setValueAtTime(0.15, audioContext.currentTime); // 設定音量

                // 創建一個重複的節奏
                const interval = setInterval(() => {
                    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
                    setTimeout(() => {
                        oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
                    }, 150);
                }, 300);

                oscillator.start();

                // 設定1分鐘後自動停止警報
                const alarmTimeout = setTimeout(() => {
                    // 自動停止警報（不觸發冷卻期）
                    if (state.alarmAudio) {
                        if (state.alarmAudio.context) {
                            state.alarmAudio.context.close();
                        }
                        if (state.alarmAudio.interval) {
                            clearInterval(state.alarmAudio.interval);
                        }
                        state.alarmAudio = null;
                    }
                    state.alarmTimeout = null;

                    // 如果警報循環激活，30秒後重新啟動警報
                    if (state.alarmCycleActive) {
                        state.alarmCycleCount++;
                        showToast('警報音效已停止，30秒後將重新提醒');
                        state.alarmCycleTimeout = setTimeout(() => {
                            if (state.alarmCycleActive) {
                                console.log('循環警報重新啟動，第 ' + (state.alarmCycleCount + 1) + ' 次');
                                // 第 2 次循環起，強制視窗置頂
                                if (state.alarmCycleCount >= 1) {
                                    window.api.send('force-window-top');
                                }
                                playSound('complete');
                            }
                        }, 30000); // 30秒後重新啟動
                    } else {
                        showToast('警報音效已自動停止');
                        hideAlarmStopButton();
                    }
                }, 60000); // 60秒 = 1分鐘

                // 將音訊上下文、計時器和自動停止計時器存儲起來
                state.alarmAudio = { context: audioContext, interval: interval };
                state.alarmTimeout = alarmTimeout;

                // 顯示可手動停止警報的提示
                showAlarmStopButton();
                return; // 直接返回，不執行後續的單次音效
            }

            // 對於 start, pause, reset，播放短暫的提示音
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            let frequency, duration;
            switch(type) {
                case 'start':
                    frequency = 800;
                    duration = 0.2;
                    break;
                case 'pause':
                    frequency = 400;
                    duration = 0.1;
                    break;
                case 'reset':
                    frequency = 300;
                    duration = 0.15;
                    break;
            }

            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);

        } catch (e) {
            console.log('音效播放失敗:', e);
        }
    }

    // 停止警報音效的函數
    function stopAlarmSound() {
        if (state.alarmAudio) {
            if (state.alarmAudio.context) {
                state.alarmAudio.context.close();
            }
            if (state.alarmAudio.interval) {
                clearInterval(state.alarmAudio.interval);
            }
            state.alarmAudio = null;
        }
        
        // 清除自動停止計時器
        if (state.alarmTimeout) {
            clearTimeout(state.alarmTimeout);
            state.alarmTimeout = null;
        }
        
        // 清除循環警報計時器
        if (state.alarmCycleTimeout) {
            clearTimeout(state.alarmCycleTimeout);
            state.alarmCycleTimeout = null;
        }
        
        // 記錄手動停止警報的時間（用於冷卻期計算）
        if (state.alarmCycleActive || state.alarmAudio) {
            state.lastCompletionTime = Date.now();
            console.log('手動停止警報，開始冷卻期');
            // 啟動冷卻期更新定時器
            startCooldownUpdate();
            // 通知主程序開始冷卻期活動偵測
            window.api.send('cooldown-started');
        }
        
        // 停止警報循環，重置計數器
        state.alarmCycleActive = false;
        state.alarmCycleCount = 0;
        // 取消視窗置頂
        window.api.send('cancel-always-on-top');
        
        // 隱藏停止警報按鈕
        hideAlarmStopButton();
    }
    
    // 顯示停止警報按鈕
    function showAlarmStopButton() {
        dom.alarmStopButton.classList.remove('hidden');
        setTimeout(() => {
            dom.alarmStopButton.classList.add('show');
        }, 10);
    }
    
    // 隱藏停止警報按鈕
    function hideAlarmStopButton() {
        dom.alarmStopButton.classList.remove('show');
        setTimeout(() => {
            dom.alarmStopButton.classList.add('hidden');
        }, 300); // 等待動畫完成
    }
    
    // 成就檢查
    function checkAchievements() {
        const currentUserTime = state.selectedUser === 'user1' ? state.user1TotalTime : state.user2TotalTime;
        
        for (let achievement of achievements) {
            if (currentUserTime >= achievement.threshold && currentUserTime - state.totalDuration < achievement.threshold) {
                showAchievement(achievement.message);
                break;
            }
        }
    }
    
    // 顯示成就
    function showAchievement(message) {
        dom.achievementText.textContent = message;
        dom.achievementBadge.classList.add('show');
        
        if (state.achievementTimeout) {
            clearTimeout(state.achievementTimeout);
        }
        
        state.achievementTimeout = setTimeout(() => {
            dom.achievementBadge.classList.remove('show');
        }, 5000);
    }
    
    // 更新統計顯示
    function updateStatsDisplay() {
        dom.user1Total.textContent = formatTotalTime(state.user1TotalTime);
        dom.user2Total.textContent = formatTotalTime(state.user2TotalTime);
        dom.user1Sessions.textContent = `(${state.user1SessionCount}次)`;
        dom.user2Sessions.textContent = `(${state.user2SessionCount}次)`;
        dom.totalTime.textContent = formatTotalTime(state.user1TotalTime + state.user2TotalTime);
    }
    
    // 格式化時間
    function formatTotalTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}小時${minutes}分鐘`;
        } else {
            return `${minutes}分鐘`;
        }
    }
    
    // Toast 通知
    function showToast(message, duration = 3000) {
        dom.toast.textContent = message;
        dom.toast.classList.add('show');

        setTimeout(() => {
            dom.toast.classList.remove('show');
        }, duration);
    }
    window.appShowToast = showToast;
    
    // 本地數據管理
    function saveLocalBackup() {
        try {
            const today = getTodayDate();
            const data = {
                date: today,
                user1Total: state.user1TotalTime,
                user2Total: state.user2TotalTime,
                user1Sessions: state.user1SessionCount,
                user2Sessions: state.user2SessionCount,
                user1CategoryTime: state.user1CategoryTime,
                user2CategoryTime: state.user2CategoryTime
            };
            localStorage.setItem('timerData', JSON.stringify(data));
            console.log("Saved local backup:", data);
        } catch (e) {
            console.error('保存本地數據失敗:', e);
        }
    }
    
    function loadLocalBackup() {
        try {
            const data = JSON.parse(localStorage.getItem('timerData'));
            const today = getTodayDate();
            
            console.log("Loading local backup for date:", today);
            console.log("Local data:", data);
            
            if (data && data.date === today) {
                state.user1TotalTime = data.user1Total || 0;
                state.user2TotalTime = data.user2Total || 0;
                state.user1SessionCount = data.user1Sessions || 0;
                state.user2SessionCount = data.user2Sessions || 0;
                state.user1CategoryTime = data.user1CategoryTime || {};
                state.user2CategoryTime = data.user2CategoryTime || {};
                console.log("Loaded local data:", {
                    user1Total: state.user1TotalTime,
                    user2Total: state.user2TotalTime,
                    user1Sessions: state.user1SessionCount,
                    user2Sessions: state.user2SessionCount,
                    user1CategoryTime: state.user1CategoryTime,
                    user2CategoryTime: state.user2CategoryTime
                });
            } else {
                console.log("No local data for today or data is for different date, resetting...");
                state.user1TotalTime = 0;
                state.user2TotalTime = 0;
                state.user1SessionCount = 0;
                state.user2SessionCount = 0;
                state.user1CategoryTime = {};
                state.user2CategoryTime = {};
                saveLocalBackup();
            }
            updateStatsDisplay();
        } catch (e) {
            console.error('載入本地數據失敗:', e);
            state.user1TotalTime = 0;
            state.user2TotalTime = 0;
            state.user1SessionCount = 0;
            state.user2SessionCount = 0;
            state.user1CategoryTime = {};
            state.user2CategoryTime = {};
            updateStatsDisplay();
        }
    }
    
    // 從 Firebase 載入數據 (新版)
    async function loadDataFromSheets() {
        updateSyncStatus('正在載入...', true);

        console.log("=== 載入 Firebase 數據 ===");

        try {
            // 取得今天的統計數據
            const todayStats = await getTodayStats();
            console.log("Firebase 今日統計:", todayStats);

            // 更新品瑜的數據
            state.user1TotalTime = todayStats.pinyu.totalTime;
            state.user1CategoryTime = todayStats.pinyu.activities;

            // 更新品榕的數據
            state.user2TotalTime = todayStats.pinrong.totalTime;
            state.user2CategoryTime = todayStats.pinrong.activities;

            // 從今天的活動記錄計算當天計時次數（records 陣列的長度）
            state.user1SessionCount = todayStats.pinyu.records.length;
            state.user2SessionCount = todayStats.pinrong.records.length;

            console.log('Firebase 同步完成:', {
                user1: { time: state.user1TotalTime, sessions: state.user1SessionCount },
                user2: { time: state.user2TotalTime, sessions: state.user2SessionCount }
            });

            updateStatsDisplay();
            saveLocalBackup();

            updateSyncStatus('已同步 ☁️');
            showToast('已從 Firebase 載入今日使用記錄');
        } catch (error) {
            updateSyncStatus('載入錯誤');
            showToast('Firebase 載入失敗，使用本地備份');
            console.error('Error in loadDataFromFirebase:', error);
        }
    }
    
    // 保存記錄到 Firebase (新版)
    async function saveRecordToSheets(user, category, duration, startTime, endTime, sessionCount) {
        updateSyncStatus('正在同步...', true);

        try {
            // 轉換使用者名稱為 userId
            const userId = user === '品瑜' ? 'pinyu' : 'pinrong';

            console.log(`準備儲存到 Firebase: ${user} (${userId}), ${category}, ${duration}分鐘`);

            // 記錄活動到 Firebase
            const success = await recordActivity(userId, duration, category);

            if (success) {
                updateSyncStatus('已同步 ☁️');
                showToast('使用記錄已存到 Firebase');
                console.log('✅ Firebase 儲存成功');

                // 重新載入數據以更新顯示
                setTimeout(() => {
                    loadDataFromSheets();
                }, 500);
            } else {
                updateSyncStatus('同步失敗');
                showToast('無法存檔到 Firebase，已保存本地備份');
                console.error('❌ Firebase 儲存失敗');
            }
        } catch (error) {
            updateSyncStatus('同步錯誤');
            showToast('無法存檔到 Firebase，已保存本地備份');
            console.error('Error in saveRecordToFirebase:', error);
        }
    }
    
    // 更新同步狀態
    function updateSyncStatus(status, isLoading = false) {
        if (isLoading) {
            dom.syncStatus.innerHTML = `${status} <span style="animation: spin 1s linear infinite;">⟳</span>`;
        } else {
            dom.syncStatus.textContent = status;
        }
    }
    
    // 格式化時間為Google Sheets格式
    function formatTimeForSheets(date) {
        return date.toLocaleTimeString('zh-TW', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    // 獲取今天日期
    function getTodayDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    }
    
    // 載入活動類別數據 (Firebase 版本已整合到 loadDataFromSheets，不再需要此函數)
    async function loadCategoryDataFromSheets() {
        // Firebase 版本不需要單獨載入活動類別數據
        // getTodayStats() 已經包含所有活動分類資訊
        console.log("使用 Firebase 版本，活動類別數據已整合");
        return;
        console.log("=== 載入活動類別數據 ===");
        
        const today = getTodayDate();
        const timestamp = new Date().getTime();
        
        // 嘗試不同的可能action名稱
        const possibleActions = [
            'getCategoryData',
            'getTodayCategory', 
            'getCategoryBreakdown',
            'getDetailedData',
            'getTodayDetails'
        ];
        
        for (const action of possibleActions) {
            try {
                const url = `${SCRIPT_URL}?action=${action}&date=${encodeURIComponent(today)}&_=${timestamp}`;
                console.log(`嘗試載入活動類別數據 - Action: ${action}`);
                console.log(`URL: ${url}`);
                
                const result = await window.api.invoke('fetch-google-script', url);
                console.log(`${action} 回應:`, result);
                console.log(`${action} 回應詳細數據:`, result.data);
                
                if (result.success && result.data && result.data.result === 'success') {
                    // 檢查是否包含活動類別數據
                    if (result.data.user1CategoryData || result.data.user2CategoryData || 
                        result.data.categoryData || result.data.categories) {
                        console.log('成功找到活動類別數據!', result.data);
                        
                        // 處理返回的活動類別數據
                        processCategoryData(result.data);
                        return; // 成功載入，退出循環
                    }
                }
            } catch (error) {
                console.log(`${action} 請求失敗:`, error.message);
            }
        }
        
        console.log('所有活動類別數據載入嘗試都失敗，可能Google Apps Script不支持活動類別查詢');
        
        // 暫時解決方案：為現有數據創建示例活動類別分佈
        createFallbackCategoryData();
    }
    
    // 處理活動類別數據
    function processCategoryData(data) {
        console.log('處理活動類別數據:', data);
        
        // 根據不同的數據格式進行處理
        if (data.user1CategoryData) {
            state.user1CategoryTime = data.user1CategoryData;
        }
        if (data.user2CategoryData) {
            state.user2CategoryTime = data.user2CategoryData;
        }
        
        // 其他可能的數據格式
        if (data.categoryData) {
            if (data.categoryData.user1) {
                state.user1CategoryTime = data.categoryData.user1;
            }
            if (data.categoryData.user2) {
                state.user2CategoryTime = data.categoryData.user2;
            }
        }
        
        console.log('更新後的活動類別數據:', {
            user1CategoryTime: state.user1CategoryTime,
            user2CategoryTime: state.user2CategoryTime
        });
        
        // 保存到本地
        saveLocalBackup();
        showToast('已載入活動類別數據');
    }
    
    // 暫時解決方案：為現有數據創建示例活動類別分佈
    function createFallbackCategoryData() {
        console.log('=== 創建示例活動類別數據 ===');
        
        // 檢查是否已經有活動類別數據，避免覆蓋
        const user1HasCategoryData = Object.keys(state.user1CategoryTime).length > 0;
        const user2HasCategoryData = Object.keys(state.user2CategoryTime).length > 0;
        
        if (user1HasCategoryData && user2HasCategoryData) {
            console.log('已有活動類別數據，跳過創建示例數據');
            return;
        }
        
        // 為品瑜創建示例分佈
        if (state.user1TotalTime > 0 && !user1HasCategoryData) {
            console.log('為品瑜創建示例活動類別分佈');
            const user1Distribution = {
                '學習': Math.floor(state.user1TotalTime * 0.4), // 40%
                'YouTube': Math.floor(state.user1TotalTime * 0.25), // 25% 
                '查資料': Math.floor(state.user1TotalTime * 0.15), // 15%
                '遊戲': Math.floor(state.user1TotalTime * 0.12), // 12%
                '看漫畫': Math.floor(state.user1TotalTime * 0.08) // 8%
            };
            
            // 調整最後一項確保總和正確
            const distributionTotal = Object.values(user1Distribution).reduce((sum, val) => sum + val, 0);
            const remainder = state.user1TotalTime - distributionTotal;
            user1Distribution['學習'] += remainder;
            
            state.user1CategoryTime = user1Distribution;
            console.log('品瑜示例活動分佈:', user1Distribution);
        }
        
        // 為品榕創建示例分佈
        if (state.user2TotalTime > 0 && !user2HasCategoryData) {
            console.log('為品榕創建示例活動類別分佈');
            const user2Distribution = {
                '遊戲': Math.floor(state.user2TotalTime * 0.35), // 35%
                'YouTube': Math.floor(state.user2TotalTime * 0.3), // 30%
                '學習': Math.floor(state.user2TotalTime * 0.2), // 20%
                '查資料': Math.floor(state.user2TotalTime * 0.1), // 10%
                '其他': Math.floor(state.user2TotalTime * 0.05) // 5%
            };
            
            // 調整最後一項確保總和正確
            const distributionTotal = Object.values(user2Distribution).reduce((sum, val) => sum + val, 0);
            const remainder = state.user2TotalTime - distributionTotal;
            user2Distribution['遊戲'] += remainder;
            
            state.user2CategoryTime = user2Distribution;
            console.log('品榕示例活動分佈:', user2Distribution);
        }
        
        // 保存示例數據
        saveLocalBackup();
        showToast('已創建示例活動類別數據');
        
        console.log('最終活動類別數據:', {
            user1CategoryTime: state.user1CategoryTime,
            user2CategoryTime: state.user2CategoryTime
        });
    }

    // 手動載入數據的方法（備用）
    window.manualLoadData = function() {
        console.log("手動載入數據...");
        loadDataFromSheets();
    };
    
    // 手動載入活動類別數據的方法
    window.manualLoadCategoryData = function() {
        console.log("手動載入活動類別數據...");
        loadCategoryDataFromSheets();
    };
    
    // 主題切換
    function toggleTheme() {
        state.isDarkMode = !state.isDarkMode;
        document.documentElement.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
        localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
        dom.themeToggle.innerHTML = state.isDarkMode ? "☀️<span class=\"feature-label\">白字</span>" : "🌙<span class=\"feature-label\">黑字</span>";
        // 重新渲染圖表以更新顏色
        if (dom.chartsModal.classList.contains('hidden') === false) {
            window.renderCharts();
        }
    }
    
    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            state.isDarkMode = savedTheme === 'dark';
        } else {
            // 根據系統偏好設定預設主題
            state.isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        document.documentElement.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
        dom.themeToggle.innerHTML = state.isDarkMode ? "☀️<span class=\"feature-label\">白字</span>" : "🌙<span class=\"feature-label\">黑字</span>";
    }
    
    // 快捷鍵處理函數
    function handleStartPauseShortcut() {
        if (state.isRunning) {
            dom.pauseBtn.click();
        } else {
            dom.startBtn.click();
        }
    }
    
    function handleToggleMiniShortcut() {
        if (state.isMiniMode) {
            exitMiniMode();
        } else {
            enterMiniMode();
        }
    }
    
    function handleResetShortcut() {
        dom.resetBtn.click();
    }
    
    // 迷你模式進入/退出邏輯（使用獨立迷你視窗）
    function enterMiniMode() {
        if (!state.isMiniMode && state.isRunning) {
            console.log('請求進入迷你視窗模式');
            const minutes = Math.floor(state.timeLeft / 60);
            const seconds = state.timeLeft % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            const userName = state.selectedUser === 'user1' ? '品瑜' : '品榕';
            state.isMiniMode = true;
            window.api.send('enter-mini-mode', timeString, userName);
        }
    }

    function exitMiniMode() {
        if (state.isMiniMode) {
            console.log('請求退出迷你視窗模式');
            state.isMiniMode = false;
            window.api.send('exit-mini-mode');
        }
    }

    // 計時結束時確保退出迷你模式
    function ensureExitMiniMode() {
        if (state.isMiniMode) {
            console.log('計時結束，退出迷你視窗模式');
            exitMiniMode();
        }
    }
    
    // === 身份綁定系統 ===

    // 初始化用戶選擇（身份綁定）
    function initializeUserSelection() {
        console.log('=== 初始化身份綁定系統 ===');

        // 優先檢查新的 installedUser，再向下相容舊的 rememberedUser
        let installedUser = localStorage.getItem('installedUser');
        if (!installedUser) {
            const rememberedUser = localStorage.getItem('rememberedUser');
            if (rememberedUser) {
                // 將舊的 rememberedUser 遷移為 installedUser
                console.log('🔄 遷移舊的 rememberedUser:', rememberedUser);
                localStorage.setItem('installedUser', rememberedUser);
                localStorage.removeItem('rememberedUser');
                installedUser = rememberedUser;
            }
        }
        console.log('已綁定身份:', installedUser);

        if (installedUser) {
            // 已有綁定身份，直接設定
            setSelectedUser(installedUser);
            hideUserSelection();

            // 通知主進程身份（用於閒置偵測）
            window.api.send('user-identity', installedUser);

            // 小孩身份才定期回報計時狀態
            if (installedUser === 'user1' || installedUser === 'user2') {
                startTimerStatusReporting();
            }
        } else {
            // 首次使用，顯示身份選擇
            console.log('👋 首次使用，顯示身份選擇');
            showUserSelection();
        }

        // 綁定事件監聽器
        setupUserSelectionEvents();
        // 綁定提醒對話框事件
        setupReminderEvents();
        console.log('身份綁定初始化完成');
    }
    
    // 顯示用戶選擇界面
    function showUserSelection() {
        dom.userSelectionOverlay.classList.remove('hidden');
    }
    
    // 隱藏用戶選擇界面
    function hideUserSelection() {
        dom.userSelectionOverlay.classList.add('hidden');
    }

    // 隱藏計時器控制按鈕（家長模式使用）
    function hideTimerControls() {
        const timerControls = document.querySelector('.timer-controls');
        const categorySelection = document.querySelector('.category-selection');
        const durationControls = document.querySelector('.duration-controls');

        if (timerControls) timerControls.style.display = 'none';
        if (categorySelection) categorySelection.style.display = 'none';
        if (durationControls) durationControls.style.display = 'none';

        console.log('✅ 已隱藏計時器控制按鈕');
    }

    // 顯示計時器控制按鈕（一般使用者模式）
    function showTimerControls() {
        const timerControls = document.querySelector('.timer-controls');
        const categorySelection = document.querySelector('.category-selection');
        const durationControls = document.querySelector('.duration-controls');

        if (timerControls) timerControls.style.display = 'flex';
        if (categorySelection) categorySelection.style.display = 'block';
        if (durationControls) durationControls.style.display = 'flex';

        // 停止家長模式監控
        stopParentLiveMonitor();

        console.log('✅ 已顯示計時器控制按鈕');
    }

    // 顯示家長儀表板（觀察模式）
    async function showParentDashboard() {
        console.log('📊 載入家長儀表板...');

        try {
            // 顯示即時狀態區域
            const liveStatusDiv = document.getElementById('parent-live-status');
            if (liveStatusDiv) {
                liveStatusDiv.style.display = 'block';
            }

            // 載入今日統計資料
            const todayStats = await getTodayStats();

            // 顯示品瑜的資料
            const pinyuTime = todayStats.pinyu.totalTime || 0;
            const pinyuActivities = todayStats.pinyu.records || [];

            // 顯示品榕的資料
            const pinrongTime = todayStats.pinrong.totalTime || 0;
            const pinrongActivities = todayStats.pinrong.records || [];

            console.log('📊 品瑜今日使用:', pinyuTime, '分鐘');
            console.log('📊 品榕今日使用:', pinrongTime, '分鐘');

            // 更新統計顯示
            updateStatsDisplay();

            // 開始監控即時計時狀態
            startParentLiveMonitor();

            // 顯示提示訊息
            showToast('家長模式：可查看兩位孩子的使用資料');

            console.log('✅ 家長儀表板載入完成');
        } catch (error) {
            console.error('❌ 載入家長儀表板失敗:', error);
            showToast('載入資料失敗，請稍後再試', 'error');
        }
    }

    // 家長模式即時監控
    let parentLiveMonitorInterval = null;

    function startParentLiveMonitor() {
        // 立即更新一次
        updateParentLiveStatus();

        // 每秒更新一次
        if (parentLiveMonitorInterval) {
            clearInterval(parentLiveMonitorInterval);
        }

        parentLiveMonitorInterval = setInterval(() => {
            updateParentLiveStatus();
        }, 1000);

        console.log('✅ 家長模式即時監控已啟動');
    }

    function stopParentLiveMonitor() {
        if (parentLiveMonitorInterval) {
            clearInterval(parentLiveMonitorInterval);
            parentLiveMonitorInterval = null;
            console.log('✅ 家長模式即時監控已停止');
        }

        // 隱藏即時狀態區域
        const liveStatusDiv = document.getElementById('parent-live-status');
        if (liveStatusDiv) {
            liveStatusDiv.style.display = 'none';
        }
    }

    async function updateParentLiveStatus() {
        const liveStatusContent = document.getElementById('live-status-content');
        if (!liveStatusContent) return;

        try {
            // 從 Firebase 取得即時計時狀態
            const liveStatus = await window.getLiveTimerStatus();

            let activeTimer = null;

            // 檢查品瑜是否正在計時
            if (liveStatus.pinyu && liveStatus.pinyu.isRunning) {
                activeTimer = {
                    ...liveStatus.pinyu,
                    userName: '品瑜',
                    userClass: 'user1-color'
                };
            }
            // 檢查品榕是否正在計時
            else if (liveStatus.pinrong && liveStatus.pinrong.isRunning) {
                activeTimer = {
                    ...liveStatus.pinrong,
                    userName: '品榕',
                    userClass: 'user2-color'
                };
            }

            if (activeTimer) {
                // 計算剩餘時間
                // totalDuration 從 Firebase 讀取，單位是秒（state.totalDuration = minutes * 60）
                const elapsed = Date.now() - activeTimer.startTime;
                const totalMs = activeTimer.totalDuration * 1000;
                const remaining = Math.max(0, totalMs - elapsed);
                const remainingMinutes = Math.floor(remaining / 60000);
                const remainingSeconds = Math.floor((remaining % 60000) / 1000);

                // 計算進度
                const progress = Math.min(100, Math.floor((elapsed / totalMs) * 100));

                liveStatusContent.innerHTML = `
                    <div class="active-timer-info">
                        <div class="timer-user ${activeTimer.userClass}">
                            👤 ${activeTimer.userName} 正在計時
                        </div>
                        <div class="timer-category">
                            📋 ${activeTimer.category}
                        </div>
                        <div class="timer-progress ${activeTimer.userClass}">
                            ${String(remainingMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}
                        </div>
                        <div class="timer-remaining">
                            剩餘時間 ${remainingMinutes} 分 ${remainingSeconds} 秒 (${progress}%)
                        </div>
                    </div>
                `;
            } else {
                liveStatusContent.innerHTML = `
                    <div class="no-active-timer">目前沒有人在計時</div>
                `;
            }
        } catch (error) {
            console.error('❌ 更新即時計時狀態失敗:', error);
            liveStatusContent.innerHTML = `
                <div class="no-active-timer">目前沒有人在計時</div>
            `;
        }
    }

    function getOtherUserTimerData(userId) {
        try {
            const savedState = localStorage.getItem(`timerState_${userId}`);
            if (savedState) {
                const data = JSON.parse(savedState);
                return data;
            }
        } catch (error) {
            console.error(`讀取 ${userId} 計時資料失敗:`, error);
        }
        return null;
    }

    // 設置選中的用戶
    function setSelectedUser(user) {
        console.log('=== 設置用戶 ===');
        console.log('用戶ID:', user);

        state.selectedUser = user;

        // 家長模式處理
        if (user === 'parent') {
            state.isParentMode = true;
            const userName = '家長模式';
            console.log('用戶名稱:', userName);

            // 更新當前用戶顯示
            if (dom.currentUserName) {
                dom.currentUserName.textContent = userName;
                console.log('更新當前用戶顯示:', userName);
            }

            // 更新用戶顯示區域
            if (dom.userDisplay) {
                dom.userDisplay.textContent = '觀察模式';
                dom.userDisplay.className = 'user-display parent-color';
                console.log('更新用戶顯示區域為觀察模式');
            }

            // 隱藏計時器控制按鈕
            hideTimerControls();
            // 顯示家長儀表板
            showParentDashboard();

            console.log('家長模式設置完成');
            return;
        }

        // 一般使用者模式
        state.isParentMode = false;
        const userName = user === 'user1' ? '品瑜' : '品榕';
        console.log('用戶名稱:', userName);

        // 顯示計時器控制按鈕
        showTimerControls();

        // 更新當前用戶顯示
        if (dom.currentUserName) {
            dom.currentUserName.textContent = userName;
            console.log('更新當前用戶顯示:', userName);
        } else {
            console.error('currentUserName 元素不存在');
        }

        // 更新用戶顯示區域
        if (dom.userDisplay) {
            dom.userDisplay.textContent = userName;
            dom.userDisplay.className = `user-display ${user}-color`;
            console.log('更新用戶顯示區域');
        } else {
            console.error('userDisplay 元素不存在');
        }

        // 更新進度條顏色
        if (dom.progressBar) {
            const computedStyle = getComputedStyle(document.documentElement);
            const userColor = computedStyle.getPropertyValue(`--${user}-color`).trim();
            dom.progressBar.setAttribute('stroke', userColor);
            console.log('更新進度條顏色:', userColor);
        } else {
            console.error('progressBar 元素不存在');
        }

        // 檢查開始按鈕狀態
        console.log('當前狀態:', {
            selectedUser: state.selectedUser,
            selectedCategory: state.selectedCategory,
            totalDuration: state.totalDuration,
            isRunning: state.isRunning
        });
        checkStartButtonState();

        console.log('用戶設置完成:', userName);
    }
    
    // 設置用戶選擇事件監聽器
    function setupUserSelectionEvents() {
        // 品瑜按鈕
        if (dom.selectUser1Btn) {
            dom.selectUser1Btn.addEventListener('click', () => {
                selectAndBindIdentity('user1');
            });
        }

        // 品榕按鈕
        if (dom.selectUser2Btn) {
            dom.selectUser2Btn.addEventListener('click', () => {
                selectAndBindIdentity('user2');
            });
        }

        // 家長模式按鈕
        const parentBtn = document.getElementById('select-parent');
        if (parentBtn) {
            parentBtn.addEventListener('click', () => {
                selectAndBindIdentity('parent');
            });
        }

        // 用戶設定按鈕（切換使用者）
        if (dom.userSettingsBtn) {
            dom.userSettingsBtn.addEventListener('click', () => {
                console.log('👤 用戶設定按鈕被點擊，重新顯示身份選擇');
                clearInstalledUser();
            });
        }
    }

    // 選擇並綁定身份
    function selectAndBindIdentity(identity) {
        console.log('🔒 綁定身份:', identity);

        // 永久儲存
        localStorage.setItem('installedUser', identity);

        // 設定開機自啟動（小孩身份才啟用）
        const isChild = (identity === 'user1' || identity === 'user2');
        window.api.send('set-auto-launch', isChild);

        // 設定用戶
        setSelectedUser(identity);
        hideUserSelection();

        // 通知主進程身份
        window.api.send('user-identity', identity);

        // 小孩身份才回報計時狀態
        if (isChild) {
            startTimerStatusReporting();
        }

        const nameMap = { user1: '品瑜', user2: '品榕', parent: '家長模式' };
        showToast(`已綁定身份：${nameMap[identity]}`);
    }

    // 清除已綁定的身份（用於切換使用者）
    function clearInstalledUser() {
        localStorage.removeItem('installedUser');
        state.selectedUser = null;
        if (dom.currentUserName) dom.currentUserName.textContent = '未選擇';
        showUserSelection();
    }

    // 定期回報計時狀態給主進程（防止重複啟動）
    let timerStatusInterval = null;
    function startTimerStatusReporting() {
        if (timerStatusInterval) return;
        timerStatusInterval = setInterval(() => {
            window.api.send('timer-running-status', state.isRunning);
        }, 3000);
    }

    // === 計時提醒系統 ===

    // 綁定提醒對話框事件
    function setupReminderEvents() {
        // 監聽主進程的提醒事件
        window.api.on('show-timer-reminder', () => {
            console.log('⏰ 收到計時提醒');
            if (dom.timerReminderOverlay) {
                dom.timerReminderOverlay.classList.remove('hidden');
            }
        });

        // 「開始計時」按鈕
        if (dom.reminderStartTimerBtn) {
            dom.reminderStartTimerBtn.addEventListener('click', () => {
                if (dom.timerReminderOverlay) {
                    dom.timerReminderOverlay.classList.add('hidden');
                }
                // 取消視窗置頂
                window.api.send('cancel-always-on-top');
            });
        }

        // 「稍後提醒」按鈕
        if (dom.reminderSnoozeBtn) {
            dom.reminderSnoozeBtn.addEventListener('click', () => {
                if (dom.timerReminderOverlay) {
                    dom.timerReminderOverlay.classList.add('hidden');
                }
                window.api.send('snooze-reminder');
                showToast('5 分鐘後會再提醒你');
            });
        }

        // 冷卻期提醒：關閉螢幕按鈕
        if (dom.cooldownScreenOffBtn) {
            dom.cooldownScreenOffBtn.addEventListener('click', () => {
                window.api.send('turn-off-screen');
                window.api.send('cooldown-dismiss');
                if (dom.cooldownReminderOverlay) {
                    dom.cooldownReminderOverlay.classList.add('hidden');
                }
                showToast('螢幕已關閉，動滑鼠或按鍵盤即可恢復');
            });
        }

        // 冷卻期提醒：我知道了按鈕
        if (dom.cooldownDismissBtn) {
            dom.cooldownDismissBtn.addEventListener('click', () => {
                window.api.send('cooldown-dismiss');
                if (dom.cooldownReminderOverlay) {
                    dom.cooldownReminderOverlay.classList.add('hidden');
                }
            });
        }
    }

    // 冷卻期提醒 IPC 監聽
    window.api.on('show-cooldown-reminder', (remainingSec) => {
        if (dom.cooldownReminderOverlay) {
            const min = Math.floor(remainingSec / 60);
            const sec = remainingSec % 60;
            dom.cooldownRemainingTime.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
            dom.cooldownReminderOverlay.classList.remove('hidden');
        }
    });

    window.api.on('update-cooldown-time', (remainingSec) => {
        if (dom.cooldownRemainingTime) {
            const min = Math.floor(remainingSec / 60);
            const sec = remainingSec % 60;
            dom.cooldownRemainingTime.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
        }
    });

    window.api.on('cooldown-ended', () => {
        if (dom.cooldownReminderOverlay) {
            dom.cooldownReminderOverlay.classList.add('hidden');
        }
        showToast('休息時間結束，可以重新計時了！');
    });

    // 啟動冷卻期更新定時器
    function startCooldownUpdate() {
        // 清除可能存在的舊定時器
        if (state.cooldownUpdateInterval) {
            clearInterval(state.cooldownUpdateInterval);
        }
        
        // 每秒更新一次按鈕狀態
        state.cooldownUpdateInterval = setInterval(() => {
            if (state.lastCompletionTime) {
                const timeSinceCompletion = Date.now() - state.lastCompletionTime;
                
                if (timeSinceCompletion >= state.cooldownDuration) {
                    // 冷卻期結束，清除定時器
                    clearInterval(state.cooldownUpdateInterval);
                    state.cooldownUpdateInterval = null;
                    console.log('冷卻期結束');
                    showToast('可以重新開始計時了！');
                }
                
                // 更新按鈕狀態
                checkStartButtonState();
            }
        }, 1000);
        
        console.log('冷卻期更新定時器已啟動');
    }
    
    // 暴露給全局使用（調試用）
    window.clearRememberedUser = clearRememberedUser;
});