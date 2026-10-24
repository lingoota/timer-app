// Full-screen rest overlay page (one per display, see lib/rest-window.js).
// Shows the countdown pushed by the main-process usage guard and the kid's chosen
// picture / folder slideshow. No close button by design.
(function() {
    const isPrimary = new URLSearchParams(location.search).get('primary') === '1';
    const identity = localStorage.getItem('installedUser') || 'unknown';
    const key = (name) => `rest-${name}-${identity}`;

    const el = (id) => document.getElementById(id);
    const bgA = el('bg-a');
    const bgB = el('bg-b');
    const headline = el('headline');
    const countdown = el('countdown');
    const sub = el('sub');
    const btnWrapup = el('btn-wrapup');
    const btnClass = el('btn-class');
    const btnScreenOff = el('btn-screen-off');
    const btnMusic = el('btn-music');
    const slideControls = el('slide-controls');
    const slidePause = el('slide-pause');
    const slideNext = el('slide-next');

    function mmss(sec) {
        const s = Math.max(0, sec);
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }

    // Windows path -> file:// URL (keep the drive letter, encode spaces / Chinese / '#').
    function toFileUrl(p) {
        const parts = p.replace(/\\/g, '/').split('/');
        return 'file:///' + parts.map((seg, i) => (i === 0 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg))).join('/');
    }

    // ---------- background / slideshow ----------
    let front = bgA;
    let back = bgB;
    function showImage(url) {
        if (!url) return;
        back.style.backgroundImage = `url("${url}")`;
        back.classList.remove('next');
        front.classList.add('next');
        const t = front; front = back; back = t;
    }

    let slides = [];
    let slideIndex = 0;
    let slideTimer = null;
    let slidePaused = false;

    function nextSlide() {
        if (!slides.length) return;
        slideIndex = (slideIndex + 1) % slides.length;
        showImage(toFileUrl(slides[slideIndex]));
    }
    function startSlideTimer() {
        clearInterval(slideTimer);
        const sec = parseInt(localStorage.getItem(key('interval')) || '30', 10);
        slideTimer = setInterval(() => { if (!slidePaused) nextSlide(); }, Math.max(5, sec) * 1000);
    }

    async function setupBackground() {
        const mode = localStorage.getItem(key('mode')) || 'background';
        if (mode === 'folder') {
            const folder = localStorage.getItem(key('folder'));
            slides = folder ? await window.api.invoke('rest-list-folder', folder) : [];
            if (slides.length) {
                slideIndex = Math.floor(Math.random() * slides.length);
                showImage(toFileUrl(slides[slideIndex]));
                slideControls.classList.remove('hidden');
                startSlideTimer();
                return;
            }
        }
        if (mode === 'image') {
            const img = localStorage.getItem(key('image'));
            if (img) { showImage(img); return; }
        }
        // Default: the same background picture as the main window (background.js key).
        const bgUser = localStorage.getItem('currentUser') || 'pinyu';
        const bg = localStorage.getItem(`background-image-${bgUser}`);
        if (bg) showImage(bg);
    }

    slidePause.addEventListener('click', () => {
        slidePaused = !slidePaused;
        slidePause.textContent = slidePaused ? '▶' : '⏸';
        slidePause.title = slidePaused ? '繼續輪播' : '暫停輪播';
    });
    slideNext.addEventListener('click', () => {
        nextSlide();
        startSlideTimer();
    });

    // ---------- time-up chime (primary display only, respects the mute setting) ----------
    let chimed = false;
    function chime() {
        if (chimed || !isPrimary || localStorage.getItem('soundEnabled') === 'false') return;
        chimed = true;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [0, 0.35, 0.7].forEach((t) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.3);
                osc.start(ctx.currentTime + t);
                osc.stop(ctx.currentTime + t + 0.3);
            });
        } catch (e) {
            console.log('chime failed:', e);
        }
    }

    // ---------- state from main ----------
    window.api.on('rest-state', (snap) => {
        if (!snap) return;
        countdown.textContent = mmss(snap.restRemainingSec);
        if (snap.justCompleted) {
            headline.textContent = '⏰ 時間到！';
            chime();
        } else if (snap.restReason === 'class') {
            headline.textContent = '下課了，讓眼睛休息一下';
        } else {
            headline.textContent = '休息時間';
        }
        btnMusic.classList.toggle('hidden', !snap.musicBreakAvailable);
        if (snap.wrapupAvailable) {
            btnWrapup.classList.remove('hidden');
            btnWrapup.textContent = `⏳ 收尾 5 分鐘（${mmss(snap.wrapupOfferRemainingSec)} 內可以按）`;
            sub.textContent = '遊戲打到一半？可以按一次收尾，收尾的時間也會算進休息';
        } else {
            btnWrapup.classList.add('hidden');
            sub.textContent = '讓眼睛休息一下，倒數結束就可以再開始計時';
        }
    });

    btnWrapup.addEventListener('click', () => window.api.send('rest-action', 'wrapup'));
    btnClass.addEventListener('click', () => window.api.send('rest-action', 'class'));
    btnScreenOff.addEventListener('click', () => window.api.send('rest-action', 'screen-off'));
    btnMusic.addEventListener('click', () => window.api.send('rest-action', 'music'));
    el('btn-media-prev').addEventListener('click', () => window.api.send('rest-action', 'media-prev'));
    el('btn-media-play').addEventListener('click', () => window.api.send('rest-action', 'media-play'));
    el('btn-media-pause').addEventListener('click', () => window.api.send('rest-action', 'media-pause'));
    el('btn-media-next').addEventListener('click', () => window.api.send('rest-action', 'media-next'));

    // Now playing (from the SMTC helper in lib/music.js), so a press visibly worked.
    const nowPlaying = el('now-playing');
    window.api.on('rest-media', (info) => {
        if (!info || info.status === 'none' || !info.title) {
            nowPlaying.classList.add('hidden');
            return;
        }
        const icon = info.status === 'Playing' ? '🎵 正在播放' : '⏸ 已暫停';
        nowPlaying.textContent = `${icon}：${info.title}${info.artist ? ' – ' + info.artist : ''}`;
        nowPlaying.classList.remove('hidden');
    });

    setupBackground();
})();
