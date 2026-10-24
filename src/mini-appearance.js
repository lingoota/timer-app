// Mini timer appearance, shared by mini-window.html (the real thing) and the
// preview inside the 🎨 settings modal. Stored per kid in localStorage under
// `mini-style-<identity>`; both pages are file:// so they share localStorage.
// Shape: { text: '#rrggbb', bg: '#rrggbb' | null, bgAlpha: 0..1, image: dataURL | null, imageOpacity: 0..1 }
(function() {
    const DEFAULT_GRADIENT = 'linear-gradient(135deg, #4158D0 0%, #C850C0 100%)';
    const DEFAULTS = { text: '#ffffff', bg: null, bgAlpha: 1, image: null, imageOpacity: 0.6 };

    function storageKey() {
        return `mini-style-${localStorage.getItem('installedUser') || 'unknown'}`;
    }

    function load() {
        try {
            return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(storageKey()) || '{}'));
        } catch (e) {
            return Object.assign({}, DEFAULTS);
        }
    }

    function save(style) {
        localStorage.setItem(storageKey(), JSON.stringify(style));
    }

    function hexToRgba(hex, alpha) {
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
        if (!m) return `rgba(65, 88, 208, ${alpha})`;
        return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
    }

    // root: the element that plays the role of the mini window body.
    // imageLayer: an absolutely positioned child that carries the picture.
    function apply(root, imageLayer, style) {
        const s = Object.assign({}, DEFAULTS, style || {});
        root.style.background = s.bg ? hexToRgba(s.bg, s.bgAlpha) : DEFAULT_GRADIENT;
        root.style.setProperty('--mini-text', s.text);
        if (imageLayer) {
            imageLayer.style.backgroundImage = s.image ? `url("${s.image}")` : 'none';
            imageLayer.style.opacity = s.image ? String(s.imageOpacity) : '0';
        }
    }

    window.miniAppearance = { load, save, apply, DEFAULTS };
})();
