    // ==================== 背景圖片功能 ====================

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
            document.body.style.backgroundImage = `url(${savedBackground})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
            console.log(`✅ 已載入 ${userName} 的背景圖片`);
        } else {
            // 清除背景圖片,使用預設樣式
            document.body.style.backgroundImage = '';
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

                // 儲存並套用背景圖片
                saveUserBackground(base64Image);
                document.body.style.backgroundImage = `url(${base64Image})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';

                console.log('✅ 背景圖片已更新');
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

    // 當切換使用者時,重新載入背景圖片
    // (如果有使用者切換功能的話,需要在切換後呼叫 loadUserBackground)
