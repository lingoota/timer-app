// ==================== 背景圖片功能 ====================

document.addEventListener('DOMContentLoaded', function() {
    const bgOverlay = document.getElementById('bg-overlay');

    // 取得當前使用者名稱
    function getCurrentUserName() {
        return localStorage.getItem('currentUser') || 'pinyu';
    }

    // 取得使用者的背景遮罩透明度
    function getUserOpacity() {
        const userName = getCurrentUserName();
        const saved = localStorage.getItem(`bg-opacity-${userName}`);
        return saved !== null ? parseInt(saved) : 35;
    }

    // 儲存使用者的背景遮罩透明度
    function saveUserOpacity(value) {
        const userName = getCurrentUserName();
        localStorage.setItem(`bg-opacity-${userName}`, value);
    }

    // 根據透明度值更新 #bg-overlay 的背景色
    function updateOverlay(opacity) {
        const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
        const fraction = opacity / 100;
        if (isDarkMode) {
            bgOverlay.style.backgroundColor = `rgba(0, 0, 0, ${fraction})`;
        } else {
            bgOverlay.style.backgroundColor = `rgba(255, 255, 255, ${fraction})`;
        }
    }

    // 套用背景圖片（body 只設圖片，遮罩交給 #bg-overlay）
    function applyBackground(base64Image, opacity) {
        document.body.style.backgroundImage = `url(${base64Image})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.classList.add('has-custom-background');
        updateOverlay(opacity);
    }

    // 載入使用者的背景圖片
    function loadUserBackground() {
        const userName = getCurrentUserName();
        const backgroundKey = `background-image-${userName}`;
        const savedBackground = localStorage.getItem(backgroundKey);

        if (savedBackground) {
            const opacity = getUserOpacity();
            applyBackground(savedBackground, opacity);
            showOpacityControl(opacity);
            console.log(`✅ 已載入 ${userName} 的背景圖片(遮罩 ${opacity}%)`);
        } else {
            document.body.style.backgroundImage = '';
            document.body.classList.remove('has-custom-background');
            bgOverlay.style.backgroundColor = 'transparent';
            hideOpacityControl();
            console.log(`ℹ️ ${userName} 尚未設定背景圖片`);
        }
    }

    // 儲存背景圖片
    function saveUserBackground(base64Image) {
        const userName = getCurrentUserName();
        const backgroundKey = `background-image-${userName}`;
        localStorage.setItem(backgroundKey, base64Image);
        console.log(`✅ 已儲存 ${userName} 的背景圖片`);
    }

    // 重置背景圖片
    function resetUserBackground() {
        const userName = getCurrentUserName();
        const backgroundKey = `background-image-${userName}`;
        localStorage.removeItem(backgroundKey);
        document.body.style.backgroundImage = '';
        document.body.classList.remove('has-custom-background');
        bgOverlay.style.backgroundColor = 'transparent';
        hideOpacityControl();
        console.log(`✅ 已重置 ${userName} 的背景圖片`);
    }

    // 透明度滑桿控制
    const opacityControl = document.getElementById('bg-opacity-control');
    const opacitySlider = document.getElementById('bg-opacity-slider');
    const opacityValue = document.getElementById('bg-opacity-value');

    function showOpacityControl(opacity) {
        if (opacityControl) {
            opacityControl.classList.remove('hidden');
            if (opacitySlider) opacitySlider.value = opacity;
            if (opacityValue) opacityValue.textContent = `${opacity}%`;
        }
    }

    function hideOpacityControl() {
        if (opacityControl) {
            opacityControl.classList.add('hidden');
        }
    }

    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            const opacity = parseInt(e.target.value);
            if (opacityValue) opacityValue.textContent = `${opacity}%`;
            // 即時更新遮罩層
            updateOverlay(opacity);
        });

        // 放開滑桿時儲存
        opacitySlider.addEventListener('change', (e) => {
            saveUserOpacity(parseInt(e.target.value));
        });
    }

    // 背景圖片按鈕點擊事件
    const backgroundBtn = document.getElementById('background-btn');
    const backgroundFileInput = document.getElementById('background-file-input');

    if (backgroundBtn && backgroundFileInput) {
        // 點擊按鈕時觸發檔案選擇器
        backgroundBtn.addEventListener('click', () => {
            backgroundFileInput.click();
        });

        // 處理檔案選擇
        backgroundFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];

            if (!file) {
                return;
            }

            // 檢查檔案類型
            if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
                alert('請選擇 PNG 或 JPG 格式的圖片!');
                return;
            }

            // 檢查檔案大小 (限制 5MB)
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                alert('圖片檔案太大!請選擇小於 5MB 的圖片。');
                return;
            }

            // 讀取圖片並轉換為 base64
            const reader = new FileReader();

            reader.onload = (e) => {
                const base64Image = e.target.result;
                saveUserBackground(base64Image);

                const opacity = getUserOpacity();
                applyBackground(base64Image, opacity);
                showOpacityControl(opacity);

                console.log('✅ 背景圖片已更新(整頁遮罩)');
            };

            reader.onerror = () => {
                alert('讀取圖片失敗,請重試!');
                console.error('❌ 讀取圖片錯誤:', reader.error);
            };

            reader.readAsDataURL(file);

            // 清空 input,允許重複選擇相同檔案
            event.target.value = '';
        });

        // 右鍵點擊背景按鈕可重置背景
        backgroundBtn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (confirm('確定要重置背景圖片嗎?')) {
                resetUserBackground();
            }
        });
    }

    // 監聽主題切換，自動更新遮罩顏色
    const observer = new MutationObserver(() => {
        if (document.body.classList.contains('has-custom-background')) {
            const opacity = getUserOpacity();
            updateOverlay(opacity);
        }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    // 在應用程式啟動時載入使用者的背景圖片
    loadUserBackground();

    // 暴露給全域使用
    window.resetUserBackground = resetUserBackground;
    window.reloadUserBackground = loadUserBackground;
});
