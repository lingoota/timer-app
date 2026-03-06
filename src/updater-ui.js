/**
 * updater-ui.js — 自動更新通知 UI + 按鈕事件
 * 依賴：window.api
 */
(function() {
    'use strict';

    // === UI 函數 ===

    function showUpdateNotification(info) {
        const notification = document.getElementById('update-notification');
        const versionEl = notification.querySelector('.update-version');
        const messageEl = notification.querySelector('.update-message');

        versionEl.textContent = `版本 ${info.version}`;
        messageEl.textContent = info.releaseNotes ? '有新功能和改進' : '';

        notification.style.display = 'block';
        console.log('🔄 顯示更新通知:', info);
    }

    function hideUpdateNotification() {
        document.getElementById('update-notification').style.display = 'none';
    }

    function showDownloadProgress() {
        document.getElementById('download-progress').style.display = 'block';
    }

    function hideDownloadProgress() {
        document.getElementById('download-progress').style.display = 'none';
    }

    function updateDownloadProgress(progressObj) {
        const progressFill = document.querySelector('.progress-fill');
        const progressPercent = document.querySelector('.progress-percent');
        const percent = Math.round(progressObj.percent);

        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        console.log(`📥 下載進度: ${percent}%`);
    }

    function showInstallNotification(info) {
        hideDownloadProgress();
        document.getElementById('install-notification').style.display = 'block';
        console.log('✅ 更新已下載完成，顯示安裝提示');
    }

    function hideInstallNotification() {
        document.getElementById('install-notification').style.display = 'none';
    }

    // === IPC 監聽 ===

    if (window.api) {
        window.api.on('update-available', (info) => {
            console.log('🔔 收到更新通知:', info);
            showUpdateNotification(info);
        });

        window.api.on('download-progress', (progressObj) => {
            updateDownloadProgress(progressObj);
        });

        window.api.on('update-downloaded', (info) => {
            console.log('📦 更新已下載完成:', info);
            showInstallNotification(info);
        });

        window.api.on('update-not-available', (info) => {
            console.log('✅ 目前已是最新版本:', info.version);
            alert('✅ 您目前使用的已經是最新版本!');
        });

        window.api.on('update-error', (error) => {
            console.error('❌ 更新錯誤:', error);
        });
    }

    // === 按鈕事件 ===

    const downloadBtn = document.getElementById('download-update-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (window.api) window.api.send('download-update');
            hideUpdateNotification();
            showDownloadProgress();
        });
    }

    const dismissBtn = document.getElementById('dismiss-update-btn');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            hideUpdateNotification();
        });
    }

    const installNowBtn = document.getElementById('install-now-btn');
    if (installNowBtn) {
        installNowBtn.addEventListener('click', () => {
            if (window.api) window.api.send('quit-and-install');
        });
    }

    const installLaterBtn = document.getElementById('install-later-btn');
    if (installLaterBtn) {
        installLaterBtn.addEventListener('click', () => {
            hideInstallNotification();
        });
    }

    const checkUpdateBtn = document.getElementById('check-update-btn');
    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', () => {
            if (window.api) {
                window.api.send('check-for-updates');
            } else {
                alert('更新功能目前不可用');
            }
        });
    }

    // 暴露給全域（調試用）
    window.showUpdateNotification = showUpdateNotification;
})();
