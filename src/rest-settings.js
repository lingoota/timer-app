// 休息畫面設定（齒輪面板 → 😴 休息畫面）
// Each kid picks what the full-screen rest overlay shows: the current background,
// a single image, or a folder slideshow. Stored in localStorage, which the rest
// overlay window shares because both pages are loaded from file://.
// Keys: rest-mode-<identity>, rest-image-<identity>, rest-folder-<identity>, rest-interval-<identity>
document.addEventListener('DOMContentLoaded', function() {
    const openBtn = document.getElementById('rest-settings-btn');
    const modal = document.getElementById('rest-settings-modal');
    const closeBtn = document.getElementById('rest-settings-close');
    const pickImageBtn = document.getElementById('rest-pick-image');
    const imageInput = document.getElementById('rest-image-input');
    const imageStatus = document.getElementById('rest-image-status');
    const pickFolderBtn = document.getElementById('rest-pick-folder');
    const folderStatus = document.getElementById('rest-folder-status');
    const intervalSelect = document.getElementById('rest-interval');
    if (!openBtn || !modal) return;

    const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

    function key(name) {
        return `rest-${name}-${localStorage.getItem('installedUser') || 'unknown'}`;
    }
    function toast(msg) {
        if (window.appShowToast) window.appShowToast(msg);
    }

    function load() {
        const mode = localStorage.getItem(key('mode')) || 'background';
        modal.querySelectorAll('input[name="rest-mode"]').forEach(r => { r.checked = r.value === mode; });
        imageStatus.textContent = localStorage.getItem(key('image')) ? '已選擇圖片' : '尚未選擇';
        const folder = localStorage.getItem(key('folder'));
        folderStatus.textContent = folder || '尚未選擇';
        intervalSelect.value = localStorage.getItem(key('interval')) || '30';
    }

    function saveMode(mode) {
        localStorage.setItem(key('mode'), mode);
    }

    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        load();
        modal.classList.remove('hidden');
    });
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    modal.querySelectorAll('input[name="rest-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const mode = radio.value;
            if (mode === 'image' && !localStorage.getItem(key('image'))) {
                toast('先選一張圖片');
            }
            if (mode === 'folder' && !localStorage.getItem(key('folder'))) {
                toast('先選一個資料夾');
            }
            saveMode(mode);
        });
    });

    pickImageBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        if (file.size > MAX_IMAGE_BYTES) {
            toast('圖片太大了，請選 4MB 以下的圖片');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                localStorage.setItem(key('image'), e.target.result);
                saveMode('image');
                load();
                toast('休息畫面圖片已設定');
            } catch (err) {
                // localStorage quota (shared with the main background image)
                toast('圖片存不進去，請換一張小一點的');
                console.error('儲存休息畫面圖片失敗:', err);
            }
        };
        reader.readAsDataURL(file);
    });

    pickFolderBtn.addEventListener('click', async () => {
        const folder = await window.api.invoke('pick-rest-folder');
        if (!folder) return;
        const files = await window.api.invoke('rest-list-folder', folder);
        if (!files.length) {
            toast('這個資料夾裡沒有圖片');
            return;
        }
        localStorage.setItem(key('folder'), folder);
        saveMode('folder');
        load();
        toast(`已設定資料夾輪播（${files.length} 張圖片）`);
    });

    intervalSelect.addEventListener('change', () => {
        localStorage.setItem(key('interval'), intervalSelect.value);
    });
});
