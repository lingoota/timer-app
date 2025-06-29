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
        rememberUserCheckbox: document.getElementById('remember-user'),
        currentUserName: document.getElementById('current-user-name'),
        userSettingsBtn: document.getElementById('user-settings'),
        user1Total: document.getElementById('user1-total'),
        user2Total: document.getElementById('user2-total'),
        user1Sessions: document.getElementById('user1-sessions'),
        user2Sessions: document.getElementById('user2-sessions'),
        totalTime: document.getElementById('total-time'),
        sandAnimation: document.getElementById('sand-animation'),
        completedAnimation: document.getElementById('completed-animation'),
        timeButtons: document.querySelectorAll('.time-btn'),
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
        miniMode: document.getElementById('mini-mode'),
        miniTimeDisplay: document.getElementById('mini-time-display'),
        miniUserDisplay: document.getElementById('mini-user-display'),
        container: document.querySelector('.container'),
        alarmStopButton: document.getElementById('alarm-stop-button'),
        stopAlarmBtn: document.getElementById('stop-alarm-btn'),
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
        cooldownDuration: 5 * 60 * 1000, // 5分鐘冷卻期（毫秒）
        cooldownUpdateInterval: null, // 冷卻期更新定時器
        alarmCycleTimeout: null, // 警報循環定時器
        alarmCycleActive: false, // 警報循環是否激活
    };
    
    // 進度條設定
    const radius = 115;
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
            // 最小化按鈕：如果在計時，進入迷你模式界面
            if (state.isRunning) {
                console.log('計時運行中，切換到迷你模式界面');
                
                if (!state.isMiniMode) {
                    // 更新迷你模式顯示
                    const userName = state.selectedUser === 'user1' ? '品瑜' : '品榕';
                    dom.miniUserDisplay.textContent = userName;
                    
                    const minutes = Math.floor(state.timeLeft / 60);
                    const seconds = state.timeLeft % 60;
                    dom.miniTimeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    
                    // 切換到迷你模式界面
                    state.isMiniMode = true;
                    document.body.classList.add('mini-mode-active');
                    dom.container.classList.add('hidden');
                    dom.miniMode.classList.remove('hidden');
                    
                    console.log('已切換到迷你模式界面');
                }
            } else {
                console.log('未在計時，將正常最小化到工作列');
            }
        }
    });
    
    // 監聽從迷你模式恢復的事件
    window.api.on('timer-restored', () => {
        console.log('收到恢復正常模式事件');
        if (state.isMiniMode) {
            // 恢復正常模式界面
            state.isMiniMode = false;
            document.body.classList.remove('mini-mode-active');
            dom.miniMode.classList.add('hidden');
            dom.container.classList.remove('hidden');
            console.log('已恢復正常模式界面');
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
        }
    });
    
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
    
    // 聲音控制
    dom.soundToggle.addEventListener('click', function() {
        state.soundEnabled = !state.soundEnabled;
        if (state.soundEnabled) {
            dom.soundToggle.textContent = '🔊';
            dom.soundToggle.classList.remove('muted');
            showToast('聲音已開啟');
        } else {
            dom.soundToggle.textContent = '🔇';
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
            dom.soundToggle.textContent = '🔇';
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
                
                const minutes = parseInt(this.dataset.minutes);
                state.totalDuration = minutes * 60;
                state.timeLeft = state.totalDuration;
                updateDisplay();
                updateProgressBar();
                
                checkStartButtonState();
                
                if (!state.selectedUser) {
                    showToast('請選擇使用者');
                }
            }
        });
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
    dom.exportBtn.addEventListener('click', function(e) {
        console.log('Export button clicked!');
        e.preventDefault();
        e.stopPropagation();
        dom.exportModal.classList.remove('hidden');
    });
    
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
    dom.startBtn.addEventListener('click', function() {
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
    });
    
    // 停止警報按鈕
    dom.stopAlarmBtn.addEventListener('click', function() {
        stopAlarmSound();
        showToast('警報已停止');
    });
    
    // 迷你模式點擊事件 (點擊返回正常界面)
    dom.miniMode.addEventListener('click', function() {
        exitMiniMode();
    });
    
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
            } else if (state.selectedUser === 'user2') {
                state.user2TotalTime += state.totalDuration;
                state.user2SessionCount++;
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
            
            // 通知主進程將窗口置頂
            window.api.send('timer-completed-show-window');
            
            playCompletionEffect();
            
            if (state.soundEnabled) {
                // 激活警報循環
                state.alarmCycleActive = true;
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
        if (state.isMiniMode) {
            dom.miniTimeDisplay.textContent = timeString;
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
                        showToast('警報音效已停止，30秒後將重新提醒');
                        state.alarmCycleTimeout = setTimeout(() => {
                            if (state.alarmCycleActive) {
                                console.log('循環警報重新啟動');
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
        }
        
        // 停止警報循環
        state.alarmCycleActive = false;
        
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
                user2Sessions: state.user2SessionCount
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
                console.log("Loaded local data:", {
                    user1Total: state.user1TotalTime,
                    user2Total: state.user2TotalTime,
                    user1Sessions: state.user1SessionCount,
                    user2Sessions: state.user2SessionCount
                });
            } else {
                console.log("No local data for today or data is for different date, resetting...");
                state.user1TotalTime = 0;
                state.user2TotalTime = 0;
                state.user1SessionCount = 0;
                state.user2SessionCount = 0;
                saveLocalBackup();
            }
            updateStatsDisplay();
        } catch (e) {
            console.error('載入本地數據失敗:', e);
            state.user1TotalTime = 0;
            state.user2TotalTime = 0;
            state.user1SessionCount = 0;
            state.user2SessionCount = 0;
            updateStatsDisplay();
        }
    }
    
    // 從Google Sheets載入數據
    async function loadDataFromSheets() {
        updateSyncStatus('正在載入...', true);
        
        const today = getTodayDate();
        console.log("=== 載入Google Sheets數據 ===");
        console.log("Loading data for date:", today);
        console.log("SCRIPT_URL:", SCRIPT_URL);
        
        const timestamp = new Date().getTime();
        const url = `${SCRIPT_URL}?action=getTodayTotal&date=${encodeURIComponent(today)}&_=${timestamp}`;
        console.log("完整請求URL:", url);

        try {
            console.log("開始發送請求...");
            const result = await window.api.invoke('fetch-google-script', url);
            console.log("收到主進程回應:", result);

            if (result.success) {
                const data = result.data;
                console.log("=== Google Sheets Response ===");
                console.log("Raw data:", data);

                if (data && data.result === 'success') {
                    const cloudUser1Total = parseInt(data.user1Total) || 0;
                    const cloudUser2Total = parseInt(data.user2Total) || 0;
                    const cloudUser1Sessions = parseInt(data.user1Sessions) || 0;
                    const cloudUser2Sessions = parseInt(data.user2Sessions) || 0;

                    if (cloudUser1Total >= 0 && cloudUser2Total >= 0) {
                        state.user1TotalTime = cloudUser1Total;
                        state.user2TotalTime = cloudUser2Total;
                        state.user1SessionCount = cloudUser1Sessions;
                        state.user2SessionCount = cloudUser2Sessions;
                        
                        updateStatsDisplay();
                        saveLocalBackup();
                    }
                    
                    updateSyncStatus('已同步');
                    showToast('已從雲端載入今日使用記錄');
                } else {
                    updateSyncStatus('載入失敗');
                    showToast('無法載入雲端記錄，使用本地備份');
                    console.error('Error loading data:', data ? data.message : 'Unknown error');
                }
            } else {
                updateSyncStatus('載入失敗');
                showToast('網路請求失敗，使用本地備份');
                console.error('Failed to fetch from Google Script:', result.error);
            }
        } catch (error) {
            updateSyncStatus('載入錯誤');
            showToast('發生預期外的錯誤，使用本地備份');
            console.error('Error in loadDataFromSheets:', error);
        }
    }
    
    // 保存記錄到Google Sheets
    async function saveRecordToSheets(user, category, duration, startTime, endTime, sessionCount) {
        updateSyncStatus('正在同步...', true);
        
        const today = getTodayDate();
        const formattedStartTime = formatTimeForSheets(startTime);
        const formattedEndTime = formatTimeForSheets(endTime);
        
        const url = `${SCRIPT_URL}?action=addRecord&date=${encodeURIComponent(today)}&user=${encodeURIComponent(user)}&category=${encodeURIComponent(category)}&duration=${duration}&startTime=${encodeURIComponent(formattedStartTime)}&endTime=${encodeURIComponent(formattedEndTime)}&sessions=${sessionCount}`;

        try {
            const result = await window.api.invoke('fetch-google-script', url);

            if (result.success && result.data.result === 'success') {
                updateSyncStatus('已同步');
                showToast('使用記錄已存到雲端');
                console.log('Record saved successfully');
                
                setTimeout(() => {
                    loadDataFromSheets();
                }, 1000);
            } else {
                updateSyncStatus('同步失敗');
                showToast('無法存檔到雲端，已保存本地備份');
                console.error('Error saving record:', result.error || (result.data ? result.data.message : 'Unknown error'));
            }
        } catch (error) {
            updateSyncStatus('同步錯誤');
            showToast('無法存檔到雲端，已保存本地備份');
            console.error('Error in saveRecordToSheets:', error);
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
    
    // 手動載入數據的方法（備用）
    window.manualLoadData = function() {
        console.log("手動載入數據...");
        loadDataFromSheets();
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
        renderDailyPieChart();
        renderUserComparisonChart();
    }
    
    function renderDailyPieChart() {
        const canvas = dom.dailyPieChart;
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 40;
        
        // 清除畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 計算數據
        const user1Minutes = Math.round(state.user1TotalTime / 60);
        const user2Minutes = Math.round(state.user2TotalTime / 60);
        const totalMinutes = user1Minutes + user2Minutes;
        
        if (totalMinutes === 0) {
            // 如果沒有數據，顯示空狀態
            const computedStyle = getComputedStyle(document.documentElement);
            const textColor = computedStyle.getPropertyValue('--text-secondary').trim();
            ctx.fillStyle = textColor;
            ctx.font = '16px Poppins';
            ctx.textAlign = 'center';
            ctx.fillText('今日尚無使用記錄', centerX, centerY);
            dom.dailyChartLegend.innerHTML = '<div class="legend-item">今日尚無使用記錄</div>';
            return;
        }
        
        // 計算角度
        const user1Angle = (user1Minutes / totalMinutes) * 2 * Math.PI;
        const user2Angle = (user2Minutes / totalMinutes) * 2 * Math.PI;
        
        // 顏色 - 使用CSS變數
        const computedStyle = getComputedStyle(document.documentElement);
        const user1Color = computedStyle.getPropertyValue('--user1-color').trim();
        const user2Color = computedStyle.getPropertyValue('--user2-color').trim();
        
        let currentAngle = -Math.PI / 2; // 從頂部開始
        
        // 繪製品瑜的扇形
        if (user1Minutes > 0) {
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + user1Angle);
            ctx.closePath();
            ctx.fillStyle = user1Color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            currentAngle += user1Angle;
        }
        
        // 繪製品榕的扇形
        if (user2Minutes > 0) {
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + user2Angle);
            ctx.closePath();
            ctx.fillStyle = user2Color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // 更新圖例
        const user1Percentage = Math.round((user1Minutes / totalMinutes) * 100);
        const user2Percentage = Math.round((user2Minutes / totalMinutes) * 100);
        
        dom.dailyChartLegend.innerHTML = `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${user1Color}"></span>
                品瑜: ${user1Minutes}分鐘 (${user1Percentage}%)
            </div>
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${user2Color}"></span>
                品榕: ${user2Minutes}分鐘 (${user2Percentage}%)
            </div>
        `;
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
        dom.themeToggle.textContent = state.isDarkMode ? '☀️' : '🌙';
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
        dom.themeToggle.textContent = state.isDarkMode ? '☀️' : '🌙';
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
    
    // 迷你模式進入/退出邏輯
    function enterMiniMode() {
        if (!state.isMiniMode && state.isRunning) {
            console.log('請求進入迷你模式');
            // 通知主進程進入迷你模式
            window.api.send('check-timer-status', 'minimize');
        }
    }
    
    function exitMiniMode() {
        if (state.isMiniMode) {
            console.log('請求退出迷你模式');
            // 通知主進程恢復正常模式
            window.api.send('restore-timer');
        } else {
            console.log('退出迷你模式請求被忽略 - 不在迷你模式中');
        }
    }

    // 強制退出迷你模式（用於錯誤恢復）
    function forceExitMiniMode() {
        console.log('強制退出迷你模式');
        if (state.isMiniMode) {
            state.isMiniMode = false;
            document.body.classList.remove('mini-mode-active');
            dom.miniMode.classList.add('hidden');
            dom.container.classList.remove('hidden');
        }
        // 通知主進程同步狀態
        window.api.send('sync-mini-mode-state', false);
    }

    // 定期同步迷你模式狀態（防止不同步）
    function syncMiniModeState() {
        window.api.send('sync-mini-mode-state', state.isMiniMode);
    }
    
    // 監聽主進程發送的事件
    window.api.on('timer-minimized', () => {
        console.log('渲染進程收到 timer-minimized 事件，當前狀態:', state.isMiniMode);
        if (!state.isMiniMode) {
            state.isMiniMode = true;
            document.body.classList.add('mini-mode-active');
            dom.container.classList.add('hidden');
            dom.miniMode.classList.remove('hidden');
            
            const userName = state.selectedUser === 'user1' ? '品瑜' : '品榕';
            dom.miniUserDisplay.textContent = userName;
            updateDisplay(); // 更新迷你模式的時間顯示
            
            console.log('迷你模式已激活');
        } else {
            console.log('已經在迷你模式中，忽略重複激活');
        }
    });
    
    window.api.on('timer-restored', () => {
        console.log('渲染進程收到 timer-restored 事件，當前狀態:', state.isMiniMode);
        if (state.isMiniMode) {
            state.isMiniMode = false;
            document.body.classList.remove('mini-mode-active');
            dom.miniMode.classList.add('hidden');
            dom.container.classList.remove('hidden');
            
            console.log('迷你模式已恢復為正常模式');
        } else {
            console.log('已經在正常模式中，忽略重複恢復');
        }
    });

    // 定期同步迷你模式狀態（每30秒檢查一次）
    setInterval(() => {
        if (state.isRunning) {
            syncMiniModeState();
        }
    }, 30000);

    // 添加全局錯誤恢復快捷鍵（Ctrl+Shift+X）
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'X') {
            console.log('執行迷你模式錯誤恢復');
            forceExitMiniMode();
            showToast('已強制退出迷你模式');
        }
    });

    // 計時結束時確保退出迷你模式
    function ensureExitMiniMode() {
        if (state.isMiniMode) {
            console.log('計時結束，確保退出迷你模式');
            exitMiniMode();
            // 設置超時強制退出，防止卡住
            setTimeout(() => {
                if (state.isMiniMode) {
                    console.log('迷你模式退出超時，強制退出');
                    forceExitMiniMode();
                }
            }, 2000);
        }
    }
    
    // === 用戶選擇功能 ===
    
    // 初始化用戶選擇
    function initializeUserSelection() {
        console.log('=== 初始化用戶選擇功能 ===');
        
        // 檢查DOM元素
        console.log('檢查DOM元素:');
        console.log('userSelectionOverlay:', !!dom.userSelectionOverlay);
        console.log('selectUser1Btn:', !!dom.selectUser1Btn);
        console.log('selectUser2Btn:', !!dom.selectUser2Btn);
        console.log('userSettingsBtn:', !!dom.userSettingsBtn);
        console.log('currentUserName:', !!dom.currentUserName);
        
        // 檢查是否有記住的用戶
        const rememberedUser = localStorage.getItem('rememberedUser');
        console.log('記住的用戶:', rememberedUser);
        
        if (rememberedUser) {
            // 如果有記住的用戶，直接設置並隱藏選擇界面
            console.log('設置記住的用戶:', rememberedUser);
            setSelectedUser(rememberedUser);
            hideUserSelection();
        } else {
            // 沒有記住的用戶，顯示選擇界面
            console.log('顯示用戶選擇界面');
            showUserSelection();
        }
        
        // 綁定事件監聽器
        setupUserSelectionEvents();
        console.log('用戶選擇初始化完成');
    }
    
    // 顯示用戶選擇界面
    function showUserSelection() {
        dom.userSelectionOverlay.classList.remove('hidden');
    }
    
    // 隱藏用戶選擇界面
    function hideUserSelection() {
        dom.userSelectionOverlay.classList.add('hidden');
    }
    
    // 設置選中的用戶
    function setSelectedUser(user) {
        console.log('=== 設置用戶 ===');
        console.log('用戶ID:', user);
        
        state.selectedUser = user;
        const userName = user === 'user1' ? '品瑜' : '品榕';
        console.log('用戶名稱:', userName);
        
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
        // 用戶選擇按鈕
        if (dom.selectUser1Btn) {
            dom.selectUser1Btn.addEventListener('click', () => {
                selectUserAndRemember('user1');
            });
        }
        
        if (dom.selectUser2Btn) {
            dom.selectUser2Btn.addEventListener('click', () => {
                selectUserAndRemember('user2');
            });
        }
        
        // 用戶設定按鈕（重新選擇用戶）
        if (dom.userSettingsBtn) {
            console.log('🔧 用戶設定按鈕找到，綁定點擊事件');
            dom.userSettingsBtn.addEventListener('click', () => {
                console.log('👤 用戶設定按鈕被點擊');
                showUserSelection();
            });
        } else {
            console.log('❌ 用戶設定按鈕未找到');
        }
    }
    
    // 選擇用戶並記憶
    function selectUserAndRemember(user) {
        // 設置選中的用戶
        setSelectedUser(user);
        
        // 如果勾選了記住選擇，保存到本地存儲
        if (dom.rememberUserCheckbox.checked) {
            localStorage.setItem('rememberedUser', user);
            showToast('已記住用戶選擇');
        }
        
        // 隱藏選擇界面
        hideUserSelection();
    }
    
    // 清除記住的用戶（用於重新選擇）
    function clearRememberedUser() {
        localStorage.removeItem('rememberedUser');
        state.selectedUser = null;
        dom.currentUserName.textContent = '未選擇';
        showUserSelection();
    }
    
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
    function renderCharts() {
        console.log('開始渲染圖表');
        
        try {
            // 獲取當前數據
            const user1Minutes = Math.round(state.user1TotalTime / 60);
            const user2Minutes = Math.round(state.user2TotalTime / 60);
            const user1Sessions = state.user1SessionCount;
            const user2Sessions = state.user2SessionCount;
            
            // 渲染今日活動分佈餅圖
            renderDailyPieChart(user1Minutes, user2Minutes);
            
            // 渲染用戶對比圖
            renderUserComparisonChart(user1Minutes, user1Sessions, user2Minutes, user2Sessions);
            
            showToast('圖表已更新');
        } catch (error) {
            console.error('渲染圖表時發生錯誤:', error);
            showToast('圖表渲染失敗');
        }
    }
    
    // 渲染今日活動分佈餅圖
    function renderDailyPieChart(user1Minutes, user2Minutes) {
        const canvas = dom.dailyPieChart;
        const ctx = canvas.getContext('2d');
        const total = user1Minutes + user2Minutes;
        
        // 清除畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (total === 0) {
            // 沒有數據時顯示提示
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('暫無數據', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        // 繪製餅圖
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        
        const user1Angle = (user1Minutes / total) * 2 * Math.PI;
        const user2Angle = (user2Minutes / total) * 2 * Math.PI;
        
        // 品瑜的部分（藍色）
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, user1Angle);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = 'rgb(100, 220, 255)';
        ctx.fill();
        
        // 品榕的部分（橙色）
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, user1Angle, user1Angle + user2Angle);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = 'rgb(255, 180, 100)';
        ctx.fill();
        
        // 更新圖例
        updateDailyChartLegend(user1Minutes, user2Minutes);
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
    
    // 更新今日圖表圖例
    function updateDailyChartLegend(user1Minutes, user2Minutes) {
        const total = user1Minutes + user2Minutes;
        const user1Percent = total > 0 ? Math.round((user1Minutes / total) * 100) : 0;
        const user2Percent = total > 0 ? Math.round((user2Minutes / total) * 100) : 0;
        
        dom.dailyChartLegend.innerHTML = `
            <div class="legend-item">
                <div class="legend-color" style="background-color: rgb(100, 220, 255);"></div>
                <span>品瑜: ${user1Minutes}分鐘 (${user1Percent}%)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: rgb(255, 180, 100);"></div>
                <span>品榕: ${user2Minutes}分鐘 (${user2Percent}%)</span>
            </div>
        `;
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
    
    // 暴露給全局使用（調試用）
    window.clearRememberedUser = clearRememberedUser;
    window.exportData = exportData;
    window.renderCharts = renderCharts;
});