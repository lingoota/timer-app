// 🎨 小計時器外觀設定（齒輪面板）
// Text colour and background colour use the built-in Chromium colour picker
// (saturation square + hue slider + RGB/HEX + eyedropper) plus quick swatches.
// Every change is saved immediately and pushed to an open mini window.
// Depends on: mini-appearance.js (window.miniAppearance)
document.addEventListener('DOMContentLoaded', function() {
    const $ = (id) => document.getElementById(id);
    const openBtn = $('mini-style-btn');
    const modal = $('mini-style-modal');
    if (!openBtn || !modal || !window.miniAppearance) return;

    const preview = $('mini-preview');
    const previewImage = $('mini-preview-image');
    const textColor = $('mini-text-color');
    const bgCustom = $('mini-bg-custom');
    const bgColor = $('mini-bg-color');
    const bgAlpha = $('mini-bg-alpha');
    const bgAlphaValue = $('mini-bg-alpha-value');
    const imageInput = $('mini-image-input');
    const imageOpacity = $('mini-image-opacity');
    const imageOpacityValue = $('mini-image-opacity-value');

    const TEXT_SWATCHES = ['#ffffff', '#000000', '#ffeb3b', '#00e5ff', '#76ff03', '#ff4081', '#ff9100', '#e040fb'];
    const BG_SWATCHES = ['#4158d0', '#1a1a2e', '#000000', '#ffffff', '#e53935', '#43a047', '#fb8c00', '#8e24aa'];
    const MAX_IMAGE_BYTES = 1024 * 1024; // the mini window is 280x70, a big file buys nothing

    let style = window.miniAppearance.load();

    function toast(msg) {
        if (window.appShowToast) window.appShowToast(msg);
    }

    function commit() {
        try {
            window.miniAppearance.save(style);
        } catch (e) {
            toast('存不進去，底圖可能太大了');
            console.error('儲存小計時器外觀失敗:', e);
            return;
        }
        window.miniAppearance.apply(preview, previewImage, style);
        window.api.send('mini-appearance-changed');
    }

    function syncControls() {
        textColor.value = style.text;
        bgCustom.checked = !!style.bg;
        bgColor.value = style.bg || '#4158d0';
        bgAlpha.value = Math.round(style.bgAlpha * 100);
        bgAlphaValue.textContent = `${bgAlpha.value}%`;
        imageOpacity.value = Math.round(style.imageOpacity * 100);
        imageOpacityValue.textContent = `${imageOpacity.value}%`;
        window.miniAppearance.apply(preview, previewImage, style);
    }

    function buildSwatches(containerId, colors, onPick) {
        const box = $(containerId);
        colors.forEach(c => {
            const b = document.createElement('button');
            b.className = 'color-swatch';
            b.style.background = c;
            b.title = c;
            b.addEventListener('click', () => onPick(c));
            box.appendChild(b);
        });
    }

    buildSwatches('mini-text-swatches', TEXT_SWATCHES, (c) => {
        style.text = c;
        syncControls();
        commit();
    });
    buildSwatches('mini-bg-swatches', BG_SWATCHES, (c) => {
        style.bg = c;
        syncControls();
        commit();
    });

    textColor.addEventListener('input', () => { style.text = textColor.value; commit(); });
    bgColor.addEventListener('input', () => { style.bg = bgColor.value; bgCustom.checked = true; commit(); });
    bgCustom.addEventListener('change', () => { style.bg = bgCustom.checked ? bgColor.value : null; commit(); });
    bgAlpha.addEventListener('input', () => {
        style.bgAlpha = parseInt(bgAlpha.value, 10) / 100;
        bgAlphaValue.textContent = `${bgAlpha.value}%`;
        if (!style.bg) { style.bg = bgColor.value; bgCustom.checked = true; }
        commit();
    });
    imageOpacity.addEventListener('input', () => {
        style.imageOpacity = parseInt(imageOpacity.value, 10) / 100;
        imageOpacityValue.textContent = `${imageOpacity.value}%`;
        commit();
    });

    $('mini-pick-image').addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        if (file.size > MAX_IMAGE_BYTES) {
            toast('底圖請選 1MB 以下的圖片');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            style.image = e.target.result;
            commit();
            toast('小計時器底圖已設定');
        };
        reader.readAsDataURL(file);
    });
    $('mini-clear-image').addEventListener('click', () => { style.image = null; commit(); });
    $('mini-style-reset').addEventListener('click', () => {
        style = Object.assign({}, window.miniAppearance.DEFAULTS);
        syncControls();
        commit();
    });

    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        style = window.miniAppearance.load(); // identity may have changed since load
        const nameEl = preview.querySelector('.mini-preview-name');
        const identity = localStorage.getItem('installedUser');
        if (nameEl) nameEl.textContent = identity === 'user2' ? '品榕' : '品瑜';
        syncControls();
        modal.classList.remove('hidden');
    });
    $('mini-style-close').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
});
