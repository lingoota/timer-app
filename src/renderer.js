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
        dailyChartLegend: document.getElementById('daily-chart-legend'),
        userChartLegend: document.getElementById('user-chart-legend'),
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
    
    // 檢查關鍵 DOM 元素是否正確載入
    console.log('=== DOM 元素檢查 ===');
    console.log('exportBtn:', dom.exportBtn);
    console.log('chartsBtn:', dom.chartsBtn);
    console.log('exportModal:', dom.exportModal);
    console.log('chartsModal:', dom.chartsModal);
    
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
    
    // 匯出按鈕事件
    console.log('檢查匯出按鈕:', dom.exportBtn);
    if (dom.exportBtn) {
        dom.exportBtn.addEventListener('click', function(e) {
            console.log('Export button clicked!');
            e.preventDefault();
            e.stopPropagation();
            dom.exportModal.classList.remove('hidden');
        });
        console.log('匯出按鈕事件已綁定');
    } else {
        console.error('匯出按鈕未找到!');
    }
    
    // 關閉模態對話框
    dom.modalClose.addEventListener('click', function() {
        console.log('Modal close button clicked!');
        dom.exportModal.classList.add('hidden');
    });
    
    // 點擊模態背景關閉
    dom.exportModal.addEventListener('click', function(e) {
        if (e.target === dom.exportModal) {
            console.log('Modal background clicked!');
            dom.exportModal.classList.add('hidden');
        }
    });
    
    // CSV 匯出
    dom.exportCsvBtn.addEventListener('click', function() {
        console.log('Export CSV button clicked!');
        const range = document.querySelector('input[name="export-range"]:checked').value;
        exportData('csv', range);
        dom.exportModal.classList.add('hidden');
    });
    
    // JSON 匯出
    dom.exportJsonBtn.addEventListener('click', function() {
        console.log('Export JSON button clicked!');
        const range = document.querySelector('input[name="export-range"]:checked').value;
        exportData('json', range);
        dom.exportModal.classList.add('hidden');
    });
    
    // 圖表按鈕事件
    console.log('檢查圖表按鈕:', dom.chartsBtn);
    if (dom.chartsBtn) {
        dom.chartsBtn.addEventListener('click', function(e) {
            console.log('Charts button clicked!');
            e.preventDefault();
            e.stopPropagation();
            dom.chartsModal.classList.remove('hidden');
            // 延遲渲染圖表以確保模態對話框已顯示
            setTimeout(() => {
                renderCharts();
            }, 100);
        });
        console.log('圖表按鈕事件已綁定');
    } else {
        console.error('圖表按鈕未找到!');
    }
    
    // 關閉圖表模態對話框
    dom.chartsModalClose.addEventListener('click', function() {
        console.log('Charts modal close button clicked!');
        dom.chartsModal.classList.add('hidden');
    });
    
    // 點擊圖表模態背景關閉
    dom.chartsModal.addEventListener('click', function(e) {
        if (e.target === dom.chartsModal) {
            console.log('Charts modal background clicked!');
            dom.chartsModal.classList.add('hidden');
        }
    });
    
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
    
    // 匯出數據功能
    function exportData(format, range) {
        console.log('匯出數據:', format, range);
        
        // 收集當前本地數據
        const localData = {
            date: getTodayDate(),
            user1: {
                name: '品瑜',
                totalTime: state.user1TotalTime,
                sessions: state.user1SessionCount,
                totalMinutes: Math.round(state.user1TotalTime / 60)
            },
            user2: {
                name: '品榕', 
                totalTime: state.user2TotalTime,
                sessions: state.user2SessionCount,
                totalMinutes: Math.round(state.user2TotalTime / 60)
            },
            total: {
                totalTime: state.user1TotalTime + state.user2TotalTime,
                totalMinutes: Math.round((state.user1TotalTime + state.user2TotalTime) / 60),
                totalSessions: state.user1SessionCount + state.user2SessionCount
            }
        };
        
        if (range === 'today') {
            exportTodayData(localData, format);
        } else {
            // 對於本週和所有數據，需要從Google Sheets獲取
            fetchAndExportData(format, range);
        }
    }
    
    function exportTodayData(data, format) {
        if (format === 'csv') {
            const csvContent = generateCSV(data);
            downloadFile(csvContent, `timer_data_${data.date.replace(/\//g, '-')}.csv`, 'text/csv');
        } else if (format === 'json') {
            const jsonContent = JSON.stringify(data, null, 2);
            downloadFile(jsonContent, `timer_data_${data.date.replace(/\//g, '-')}.json`, 'application/json');
        }
        
        showToast(`已匯出${format.toUpperCase()}格式數據`);
    }
    
    function generateCSV(data) {
        const header = '日期,使用者,總時間(分鐘),使用次數\n';
        const rows = [
            `"${data.date}","${data.user1.name}",${data.user1.totalMinutes},${data.user1.sessions}`,
            `"${data.date}","${data.user2.name}",${data.user2.totalMinutes},${data.user2.sessions}`,
            `"${data.date},總計,${data.total.totalMinutes},${data.total.totalSessions}`
        ];
        return header + rows.join('\n');
    }
    
    async function fetchAndExportData(format, range) {
        updateSyncStatus('正在載入數據...', true);

        const url = `${SCRIPT_URL}?action=exportData&range=${range}`;

        try {
            const result = await window.api.invoke('fetch-google-script', url);

            if (result.success && result.data.result === 'success') {
                const data = result.data;
                let exportData;
                
                if (range === 'week') {
                    exportData = data.weekData || [];
                } else if (range === 'all') {
                    exportData = data.allData || [];
                }
                
                if (format === 'csv') {
                    const csvContent = generateExtendedCSV(exportData);
                    downloadFile(csvContent, `timer_data_${range}_${getTodayDate().replace(/\//g, '-')}.csv`, 'text/csv');
                } else if (format === 'json') {
                    const jsonContent = JSON.stringify(exportData, null, 2);
                    downloadFile(jsonContent, `timer_data_${range}_${getTodayDate().replace(/\//g, '-')}.json`, 'application/json');
                }
                
                showToast(`已匯出${range === 'week' ? '本週' : '全部'}數據`);
                updateSyncStatus('已同步');
            } else {
                updateSyncStatus('載入失敗');
                showToast('無法載入遠端數據，請稍後再試');
                console.error('Failed to fetch export data:', result.error || (result.data ? result.data.message : 'Unknown error'));
            }
        } catch (error) {
            updateSyncStatus('載入錯誤');
            showToast('匯出數據時發生錯誤，請稍後再試');
            console.error('Error in fetchAndExportData:', error);
        }
    }
    
    function generateExtendedCSV(dataArray) {
        if (!dataArray || dataArray.length === 0) {
            return '日期,使用者,活動類別,時長(分鐘),開始時間,結束時間\n無數據';
        }
        
        const header = '日期,使用者,活動類別,時長(分鐘),開始時間,結束時間\n';
        const rows = dataArray.map(item => {
            const duration = Math.round((item.duration || 0) / 60);
            return `${item.date || ''},${item.user || ''},${item.category || ''},${duration},${item.startTime || ''},${item.endTime || ''}`;
        });
        return header + rows.join('\n');
    }
    
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 圖表渲染功能
    function renderCharts() {
        // 呼叫正確的活動類別圓餅圖渲染函數（定義在後面）
        renderDailyPieChart();
        renderUserComparisonChart();
    }
    
    function renderUserComparisonChart() {
        const canvas = dom.userComparisonChart;
        const ctx = canvas.getContext('2d');
        const padding = 40;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);
        
        // 清除畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const user1Minutes = Math.round(state.user1TotalTime / 60);
        const user2Minutes = Math.round(state.user2TotalTime / 60);
        const maxMinutes = Math.max(user1Minutes, user2Minutes, 30); // 最小刻度30分鐘
        
        // 繪製背景格線
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + chartWidth, y);
            ctx.stroke();
        }
        
        // 繪製條形圖
        const barWidth = chartWidth / 3;
        const user1Height = (user1Minutes / maxMinutes) * chartHeight;
        const user2Height = (user2Minutes / maxMinutes) * chartHeight;
        
        // 繪製標籤
        const computedStyle = getComputedStyle(document.documentElement);
        const textColor = computedStyle.getPropertyValue('--text-primary').trim();
        const user1ColorChart = computedStyle.getPropertyValue('--user1-color').trim();
        const user2ColorChart = computedStyle.getPropertyValue('--user2-color').trim();
        
        // 品瑜的條形
        ctx.fillStyle = user1ColorChart;
        ctx.fillRect(
            padding + barWidth * 0.2, 
            padding + chartHeight - user1Height, 
            barWidth * 0.6, 
            user1Height
        );
        
        // 品榕的條形
        ctx.fillStyle = user2ColorChart;
        ctx.fillRect(
            padding + barWidth * 1.2, 
            padding + chartHeight - user2Height, 
            barWidth * 0.6, 
            user2Height
        );
        
        ctx.fillStyle = textColor;
        ctx.font = '14px Poppins';
        ctx.textAlign = 'center';
        
        // X軸標籤
        ctx.fillText('品瑜', padding + barWidth * 0.5, canvas.height - 10);
        ctx.fillText('品榕', padding + barWidth * 1.5, canvas.height - 10);
        
        // Y軸標籤
        ctx.textAlign = 'right';
        ctx.font = '12px Poppins';
        for (let i = 0; i <= 5; i++) {
            const value = Math.round((maxMinutes / 5) * (5 - i));
            const y = padding + (chartHeight / 5) * i + 5;
            ctx.fillText(value + 'min', padding - 10, y);
        }
        
        // 數值標籤
        ctx.textAlign = 'center';
        ctx.font = '12px Poppins';
        if (user1Minutes > 0) {
            ctx.fillText(user1Minutes + 'min', padding + barWidth * 0.5, padding + chartHeight - user1Height - 10);
        }
        if (user2Minutes > 0) {
            ctx.fillText(user2Minutes + 'min', padding + barWidth * 1.5, padding + chartHeight - user2Height - 10);
        }
        
        // 更新圖例
        dom.userChartLegend.innerHTML = `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${user1ColorChart}"></span>
                品瑜: ${user1Minutes}分鐘 (${state.user1SessionCount}次)
            </div>
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${user2ColorChart}"></span>
                品榕: ${user2Minutes}分鐘 (${state.user2SessionCount}次)
            </div>
        `;
    }
    
    // 主題切換
    function toggleTheme() {
        state.isDarkMode = !state.isDarkMode;
        document.documentElement.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
        localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
        dom.themeToggle.innerHTML = state.isDarkMode ? "☀️<span class=\"feature-label\">白字</span>" : "🌙<span class=\"feature-label\">黑字</span>";
        // 重新渲染圖表以更新顏色
        if (dom.chartsModal.classList.contains('hidden') === false) {
            renderCharts();
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
                const elapsed = Date.now() - activeTimer.startTime;
                const remaining = Math.max(0, activeTimer.totalDuration * 60 * 1000 - elapsed);
                const remainingMinutes = Math.floor(remaining / 60000);
                const remainingSeconds = Math.floor((remaining % 60000) / 1000);

                // 計算進度
                const progress = Math.min(100, Math.floor((elapsed / (activeTimer.totalDuration * 60 * 1000)) * 100));

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
    
    // === 匯出功能實現 ===
    
    // 匯出數據函數
    async function exportData(format, range) {
        console.log(`開始匯出數據 - 格式: ${format}, 範圍: ${range}`);
        
        try {
            // 根據範圍獲取數據
            let exportData = [];
            const today = new Date().toDateString();
            
            if (range === 'today') {
                // 從本地存儲獲取今日數據
                const localData = localStorage.getItem('timerAppBackup');
                if (localData) {
                    const data = JSON.parse(localData);
                    exportData = [{
                        date: today,
                        user1Total: data.user1TotalTime || 0,
                        user1Sessions: data.user1SessionCount || 0,
                        user2Total: data.user2TotalTime || 0,
                        user2Sessions: data.user2SessionCount || 0
                    }];
                }
            } else if (range === 'week' || range === 'all') {
                // 嘗試從 Google Sheets 獲取歷史數據
                try {
                    const url = `${SCRIPT_URL}?action=exportData&range=${range}`;
                    const response = await window.api.invoke('fetch-google-script', url);
                    
                    if (response.success && response.data) {
                        exportData = response.data.weekData || response.data.allData || [];
                    }
                } catch (error) {
                    console.log('從雲端獲取數據失敗，使用本地數據');
                    // 使用本地數據作為後備
                    const localData = localStorage.getItem('timerAppBackup');
                    if (localData) {
                        const data = JSON.parse(localData);
                        exportData = [{
                            date: today,
                            user1Total: data.user1TotalTime || 0,
                            user1Sessions: data.user1SessionCount || 0,
                            user2Total: data.user2TotalTime || 0,
                            user2Sessions: data.user2SessionCount || 0
                        }];
                    }
                }
            }
            
            if (exportData.length === 0) {
                showToast('暫無數據可匯出');
                return;
            }
            
            // 根據格式匯出
            if (format === 'csv') {
                exportToCsv(exportData, range);
            } else if (format === 'json') {
                exportToJson(exportData, range);
            }
            
        } catch (error) {
            console.error('匯出數據時發生錯誤:', error);
            showToast('匯出失敗，請稍後再試');
        }
    }
    
    // 匯出為 CSV 格式
    function exportToCsv(data, range) {
        const headers = ['日期', '品瑜總時間(分鐘)', '品瑜會話次數', '品榕總時間(分鐘)', '品榕會話次數'];
        const csvContent = [
            headers.join(','),
            ...data.map(row => [
                row.date || '今日',
                Math.round((row.user1Total || 0) / 60),
                row.user1Sessions || 0,
                Math.round((row.user2Total || 0) / 60),
                row.user2Sessions || 0
            ].join(','))
        ].join('\n');
        
        downloadFile(csvContent, `timer-data-${range}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        showToast('CSV 檔案已下載');
    }
    
    // 匯出為 JSON 格式
    function exportToJson(data, range) {
        const jsonContent = JSON.stringify({
            exportDate: new Date().toISOString(),
            range: range,
            data: data.map(row => ({
                date: row.date || '今日',
                user1: {
                    totalMinutes: Math.round((row.user1Total || 0) / 60),
                    sessions: row.user1Sessions || 0
                },
                user2: {
                    totalMinutes: Math.round((row.user2Total || 0) / 60),
                    sessions: row.user2Sessions || 0
                }
            }))
        }, null, 2);
        
        downloadFile(jsonContent, `timer-data-${range}-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        showToast('JSON 檔案已下載');
    }
    
    // 下載檔案輔助函數
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // === 圖表功能實現 ===
    
    // 渲染圖表函數
    async function renderCharts() {
        console.log('開始渲染圖表');

        try {
            // 獲取當前數據
            const user1Minutes = Math.round(state.user1TotalTime / 60);
            const user2Minutes = Math.round(state.user2TotalTime / 60);
            const user1Sessions = state.user1SessionCount;
            const user2Sessions = state.user2SessionCount;

            // 渲染當前用戶活動類別分佈餅圖
            renderDailyPieChart();

            // 渲染用戶對比圖
            renderUserComparisonChart(user1Minutes, user1Sessions, user2Minutes, user2Sessions);

            // 渲染 24 小時使用時間線條圖
            await renderTimelineCharts();

            showToast('圖表已更新');
        } catch (error) {
            console.error('渲染圖表時發生錯誤:', error);
            showToast('圖表渲染失敗');
        }
    }

    /**
     * 渲染兩位使用者的 24 小時時間線條圖
     */
    async function renderTimelineCharts() {
        try {
            // 從 Firebase 取得今日活動記錄
            const todayStats = await window.getTodayStats();

            // 品瑜的資料
            const pinyuRecords = todayStats.pinyu.records || [];
            const pinyuHourlyData = calculateHourlyUsage(pinyuRecords);
            renderTimelineChart('pinyu-timeline-chart', pinyuHourlyData, '品瑜', 'rgb(100, 220, 255)');

            // 品榕的資料
            const pinrongRecords = todayStats.pinrong.records || [];
            const pinrongHourlyData = calculateHourlyUsage(pinrongRecords);
            renderTimelineChart('pinrong-timeline-chart', pinrongHourlyData, '品榕', 'rgb(255, 180, 100)');

            console.log('✅ 24 小時時間線條圖渲染完成');
        } catch (error) {
            console.error('❌ 渲染時間線條圖失敗:', error);
        }
    }
    
    // 渲染當前用戶活動類別分佈餅圖
    function renderDailyPieChart() {
        const canvas = dom.dailyPieChart;
        const ctx = canvas.getContext('2d');
        
        // 清除畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 獲取當前用戶的活動類別數據
        const currentUser = state.selectedUser || 'user1'; // 預設使用 user1
        let categoryData = currentUser === 'user1' ? state.user1CategoryTime : state.user2CategoryTime;
        const userName = currentUser === 'user1' ? '品瑜' : '品榕';
        const userTotalTime = currentUser === 'user1' ? state.user1TotalTime : state.user2TotalTime;
        
        // Debug 信息
        console.log('=== 圓餅圖渲染 Debug ===');
        console.log('當前用戶:', currentUser, userName);
        console.log('用戶總時間:', userTotalTime);
        console.log('用戶1活動類別數據:', state.user1CategoryTime);
        console.log('用戶2活動類別數據:', state.user2CategoryTime);
        console.log('當前用戶活動類別數據:', categoryData);
        
        // 計算活動類別總時間
        const categoryTotal = Object.values(categoryData).reduce((sum, time) => sum + time, 0);
        console.log('活動類別總時間:', categoryTotal);
        
        // 處理舊數據：如果有總時間但沒有活動類別數據，創建"未分類"項目
        if (userTotalTime > 0 && categoryTotal === 0) {
            console.log('檢測到舊數據，將總時間歸類為"未分類"');
            categoryData = { ...categoryData, '未分類': userTotalTime };
            // 更新狀態
            if (currentUser === 'user1') {
                state.user1CategoryTime = categoryData;
            } else {
                state.user2CategoryTime = categoryData;
            }
            saveLocalBackup(); // 保存更新的數據
        }
        
        // 重新計算總時間
        const total = Object.values(categoryData).reduce((sum, time) => sum + time, 0);
        console.log('最終活動類別總時間:', total);
        
        if (total === 0) {
            // 沒有數據時顯示提示
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${userName} 暫無活動數據`, canvas.width / 2, canvas.height / 2);
            return;
        }
        
        // 定義活動類別顏色
        const categoryColors = {
            '遊戲': 'rgb(255, 99, 132)',
            'YouTube': 'rgb(255, 159, 64)', 
            '查資料': 'rgb(255, 205, 86)',
            '看漫畫': 'rgb(75, 192, 192)',
            '學習': 'rgb(54, 162, 235)',
            '寫作': 'rgb(255, 105, 180)',
            '其他': 'rgb(153, 102, 255)',
            '未分類': 'rgb(128, 128, 128)' // 灰色代表舊的未分類數據
        };
        
        // 繪製餅圖
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        
        let currentAngle = 0;
        
        Object.entries(categoryData).forEach(([category, time]) => {
            if (time > 0) {
                const angle = (time / total) * 2 * Math.PI;
                
                // 繪製扇形
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
                ctx.lineTo(centerX, centerY);
                ctx.fillStyle = categoryColors[category] || 'rgb(128, 128, 128)';
                ctx.fill();
                
                currentAngle += angle;
            }
        });
        
        // 更新圖例
        updateDailyChartLegend(categoryData, userName);
    }
    
    // 渲染用戶對比圖
    function renderUserComparisonChart(user1Minutes, user1Sessions, user2Minutes, user2Sessions) {
        const canvas = dom.userComparisonChart;
        const ctx = canvas.getContext('2d');
        
        // 清除畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const maxValue = Math.max(user1Minutes, user2Minutes, 1);
        const barWidth = 80;
        const barMaxHeight = canvas.height - 60;
        
        // 品瑜的柱子
        const user1Height = (user1Minutes / maxValue) * barMaxHeight;
        ctx.fillStyle = 'rgb(100, 220, 255)';
        ctx.fillRect(50, canvas.height - 30 - user1Height, barWidth, user1Height);
        
        // 品榕的柱子
        const user2Height = (user2Minutes / maxValue) * barMaxHeight;
        ctx.fillStyle = 'rgb(255, 180, 100)';
        ctx.fillRect(170, canvas.height - 30 - user2Height, barWidth, user2Height);
        
        // 添加標籤
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('品瑜', 90, canvas.height - 10);
        ctx.fillText('品榕', 210, canvas.height - 10);
        
        // 添加數值標籤
        ctx.font = '12px Arial';
        ctx.fillText(`${user1Minutes}分`, 90, canvas.height - 35 - user1Height);
        ctx.fillText(`${user2Minutes}分`, 210, canvas.height - 35 - user2Height);
        
        // 更新圖例
        updateUserChartLegend(user1Minutes, user1Sessions, user2Minutes, user2Sessions);
    }
    
    // 更新活動類別圖表圖例
    function updateDailyChartLegend(categoryData, userName) {
        const categoryColors = {
            '遊戲': 'rgb(255, 99, 132)',
            'YouTube': 'rgb(255, 159, 64)', 
            '查資料': 'rgb(255, 205, 86)',
            '看漫畫': 'rgb(75, 192, 192)',
            '學習': 'rgb(54, 162, 235)',
            '寫作': 'rgb(255, 105, 180)',
            '其他': 'rgb(153, 102, 255)',
            '未分類': 'rgb(128, 128, 128)' // 灰色代表舊的未分類數據
        };
        
        const total = Object.values(categoryData).reduce((sum, time) => sum + time, 0);
        
        if (total === 0) {
            dom.dailyChartLegend.innerHTML = `<div class="legend-item"><span>${userName} 暫無活動數據</span></div>`;
            return;
        }
        
        let legendHTML = '';
        Object.entries(categoryData).forEach(([category, time]) => {
            if (time > 0) {
                const minutes = Math.round(time / 60);
                const percent = Math.round((time / total) * 100);
                const color = categoryColors[category] || 'rgb(128, 128, 128)';
                
                legendHTML += `
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: ${color};"></div>
                        <span>${category}: ${minutes}分鐘 (${percent}%)</span>
                    </div>
                `;
            }
        });
        
        dom.dailyChartLegend.innerHTML = legendHTML;
    }
    
    // 更新用戶對比圖例
    function updateUserChartLegend(user1Minutes, user1Sessions, user2Minutes, user2Sessions) {
        dom.userChartLegend.innerHTML = `
            <div class="legend-item">
                <div class="legend-color" style="background-color: rgb(100, 220, 255);"></div>
                <span>品瑜: ${user1Minutes}分鐘 (${user1Sessions}次)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: rgb(255, 180, 100);"></div>
                <span>品榕: ${user2Minutes}分鐘 (${user2Sessions}次)</span>
            </div>
        `;
    }

    // ===================================
    // 24 小時使用時間線條圖
    // ===================================

    /**
     * 繪製 24 小時使用時間線條圖
     * @param {string} canvasId - Canvas 元素 ID
     * @param {Array} hourlyData - 24 小時的使用時間資料 (分鐘)
     * @param {string} userName - 使用者名稱
     * @param {string} color - 線條顏色
     */
    function renderTimelineChart(canvasId, hourlyData, userName, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`找不到 canvas: ${canvasId}`);
            return;
        }

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // 清除畫布
        ctx.clearRect(0, 0, width, height);

        // 設定繪圖區域的邊距
        const padding = { top: 30, right: 40, bottom: 40, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // 找出最大值，用於計算 Y 軸比例
        const maxMinutes = Math.max(...hourlyData, 10); // 至少顯示到 10 分鐘
        const yScale = chartHeight / maxMinutes;
        const xScale = chartWidth / 23; // 0-23 小時，共 24 個點

        // 繪製背景網格線
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        // 水平網格線 (每 10 分鐘一條)
        for (let i = 0; i <= maxMinutes; i += 10) {
            const y = padding.top + chartHeight - (i * yScale);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }

        // 垂直網格線 (每 4 小時一條)
        for (let hour = 0; hour <= 24; hour += 4) {
            const x = padding.left + (hour * xScale);
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
        }

        // 繪製 X 軸
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top + chartHeight);
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.stroke();

        // 繪製 Y 軸
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        ctx.stroke();

        // 繪製 X 軸標籤 (小時)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        for (let hour = 0; hour <= 24; hour += 4) {
            const x = padding.left + (hour * xScale);
            const y = padding.top + chartHeight + 20;
            ctx.fillText(`${hour}:00`, x, y);
        }

        // 繪製 Y 軸標籤 (分鐘)
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= maxMinutes; i += 10) {
            const y = padding.top + chartHeight - (i * yScale);
            ctx.fillText(`${i}分`, padding.left - 10, y);
        }

        // 繪製標題
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${userName} - 今日每小時累計使用時間`, width / 2, 15);

        // 繪製折線圖
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        for (let hour = 0; hour < 24; hour++) {
            const x = padding.left + (hour * xScale);
            const y = padding.top + chartHeight - (hourlyData[hour] * yScale);

            if (hour === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // 繪製資料點
        for (let hour = 0; hour < 24; hour++) {
            const x = padding.left + (hour * xScale);
            const y = padding.top + chartHeight - (hourlyData[hour] * yScale);

            // 繪製圓點
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();

            // 如果有使用時間，顯示數值
            if (hourlyData[hour] > 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`${hourlyData[hour]}`, x, y - 8);
                ctx.fillStyle = color;
            }
        }
    }

    /**
     * 從 Firebase 資料計算每小時的累計使用時間
     * @param {Array} records - 活動記錄陣列
     * @returns {Array} 24 小時的使用時間 (分鐘)
     */
    function calculateHourlyUsage(records) {
        const hourlyMinutes = new Array(24).fill(0);

        if (!records || records.length === 0) {
            return hourlyMinutes;
        }

        records.forEach(record => {
            if (record.timestamp) {
                const date = record.timestamp.toDate ? record.timestamp.toDate() : new Date(record.timestamp);
                const hour = date.getHours();
                const minutes = Math.round(record.duration / 60); // 秒轉分鐘
                hourlyMinutes[hour] += minutes;
            }
        });

        return hourlyMinutes;
    }

    // ===================================
    // 自動更新 UI 功能
    // ===================================

    /**
     * 顯示更新通知
     * @param {Object} info - 更新資訊 { version, releaseNotes }
     */
    function showUpdateNotification(info) {
        const notification = document.getElementById('update-notification');
        const versionEl = notification.querySelector('.update-version');
        const messageEl = notification.querySelector('.update-message');

        versionEl.textContent = `版本 ${info.version}`;
        messageEl.textContent = info.releaseNotes ? '有新功能和改進' : '';

        notification.style.display = 'block';

        console.log('🔄 顯示更新通知:', info);
    }

    /**
     * 隱藏更新通知
     */
    function hideUpdateNotification() {
        const notification = document.getElementById('update-notification');
        notification.style.display = 'none';
    }

    /**
     * 顯示下載進度
     */
    function showDownloadProgress() {
        const progress = document.getElementById('download-progress');
        progress.style.display = 'block';
    }

    /**
     * 隱藏下載進度
     */
    function hideDownloadProgress() {
        const progress = document.getElementById('download-progress');
        progress.style.display = 'none';
    }

    /**
     * 更新下載進度
     * @param {Object} progressObj - { percent, transferred, total }
     */
    function updateDownloadProgress(progressObj) {
        const progressFill = document.querySelector('.progress-fill');
        const progressPercent = document.querySelector('.progress-percent');

        const percent = Math.round(progressObj.percent);

        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }

        if (progressPercent) {
            progressPercent.textContent = `${percent}%`;
        }

        console.log(`📥 下載進度: ${percent}%`);
    }

    /**
     * 顯示安裝通知
     * @param {Object} info - 更新資訊
     */
    function showInstallNotification(info) {
        hideDownloadProgress();

        const notification = document.getElementById('install-notification');
        notification.style.display = 'block';

        console.log('✅ 更新已下載完成，顯示安裝提示');
    }

    /**
     * 隱藏安裝通知
     */
    function hideInstallNotification() {
        const notification = document.getElementById('install-notification');
        notification.style.display = 'none';
    }

    // 步驟 3: 監聽來自 main.js 的更新事件
    if (window.api) {
        // 監聽「發現新版本」事件
        window.api.on('update-available', (info) => {
            console.log('🔔 收到更新通知:', info);
            showUpdateNotification(info);
        });

        // 監聽「下載進度」事件
        window.api.on('download-progress', (progressObj) => {
            updateDownloadProgress(progressObj);
        });

        // 監聽「更新已下載完成」事件
        window.api.on('update-downloaded', (info) => {
            console.log('📦 更新已下載完成:', info);
            showInstallNotification(info);
        });

        // 監聽「沒有新版本」事件（可選）
        window.api.on('update-not-available', (info) => {
            console.log('✅ 目前已是最新版本:', info.version);
            // 顯示提示訊息
            alert('✅ 您目前使用的已經是最新版本!');
        });

        // 監聽「更新錯誤」事件（可選）
        window.api.on('update-error', (error) => {
            console.error('❌ 更新錯誤:', error);
        });
    }

    // 步驟 5: 設定按鈕事件處理
    // 注意：不需要再包一層 DOMContentLoaded，因為整個 renderer.js 已經在 DOMContentLoaded 中執行

    // 「下載更新」按鈕
    const downloadBtn = document.getElementById('download-update-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            console.log('👆 使用者點擊「下載更新」');
            if (window.api) {
                window.api.send('download-update');
            }
            hideUpdateNotification();
            showDownloadProgress();
        });
    }

    // 「稍後提醒」按鈕
    const dismissBtn = document.getElementById('dismiss-update-btn');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            console.log('👆 使用者點擊「稍後提醒」');
            hideUpdateNotification();
        });
    }

    // 「立即重啟」按鈕
    const installNowBtn = document.getElementById('install-now-btn');
    if (installNowBtn) {
        installNowBtn.addEventListener('click', () => {
            console.log('👆 使用者點擊「立即重啟」');
            if (window.api) {
                window.api.send('quit-and-install');
            }
        });
    }

    // 「稍後重啟」按鈕
    const installLaterBtn = document.getElementById('install-later-btn');
    if (installLaterBtn) {
        installLaterBtn.addEventListener('click', () => {
            console.log('👆 使用者點擊「稍後重啟」');
            hideInstallNotification();
        });
    }

    // 「檢查更新」按鈕
    const checkUpdateBtn = document.getElementById('check-update-btn');
    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', () => {
            console.log('👆 使用者點擊「檢查更新」');
            if (window.api) {
                window.api.send('check-for-updates');
                console.log('🔍 正在檢查更新...');
            } else {
                console.warn('⚠️ window.api 不可用，無法檢查更新');
                alert('更新功能目前不可用');
            }
        });
    }

    // 暴露給全局使用（調試用）
    window.clearRememberedUser = clearRememberedUser;
    window.exportData = exportData;
    window.renderCharts = renderCharts;
    window.showUpdateNotification = showUpdateNotification; // 測試用
});