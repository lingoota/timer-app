// ==================== 背景圖片功能 ====================

document.addEventListener('DOMContentLoaded', function() {
    // 取得當前使用者名稱
    function getCurrentUserName() {
        return localStorage.getItem('currentUser') || 'pinyu';
    }

    // 載入使用者的背景圖片
    function loadUserBackground() {
        const userName = getCurrentUserName();
        const backgroundKey = `background-image-${userName}`;
        const savedBackground = localStorage.getItem(backgroundKey);

        if (savedBackground) {
            // 檢查是否為深色模式
            const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
            const overlayColor = isDarkMode
                ? 'rgba(0, 0, 0, 0.4)'  // 深色模式:深色遮罩 40% 不透明
                : 'rgba(255, 255, 255, 0.3)';  // 淺色模式:淺色遮罩 30% 不透明

            // 使用線性漸層疊加半透明遮罩和背景圖片
            document.body.style.backgroundImage = `
                linear-gradient(${overlayColor}, ${overlayColor}),
                url(${savedBackground})
            `;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';

            // 加上 class 讓 UI 元素有背景
            document.body.classList.add('has-custom-background');

            console.log(`✅ 已載入 ${userName} 的背景圖片(含遮罩)`);
        } else {
            // 清除背景圖片,使用預設樣式
            document.body.style.backgroundImage = '';
            document.body.classList.remove('has-custom-background');
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
        console.log(`✅ 已重置 ${userName} 的背景圖片`);
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
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                alert('圖片檔案太大!請選擇小於 5MB 的圖片。');
                return;
            }

            // 讀取圖片並轉換為 base64
            const reader = new FileReader();

            reader.onload = (e) => {
                const base64Image = e.target.result;

                // 儲存背景圖片
                saveUserBackground(base64Image);

                // 套用背景圖片(含遮罩)
                const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
                const overlayColor = isDarkMode
                    ? 'rgba(0, 0, 0, 0.4)'
                    : 'rgba(255, 255, 255, 0.3)';

                document.body.style.backgroundImage = `
                    linear-gradient(${overlayColor}, ${overlayColor}),
                    url(${base64Image})
                `;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';

                // 加上 class 讓 UI 元素有背景
                document.body.classList.add('has-custom-background');

                console.log('✅ 背景圖片已更新(含遮罩)');
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

    // 在應用程式啟動時載入使用者的背景圖片
    loadUserBackground();

    // 暴露給全域使用(方便調試)
    window.resetUserBackground = resetUserBackground;
});
