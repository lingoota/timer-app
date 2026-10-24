// Renderer side of the usage guard (lib/usage-guard.js in the main process).
// - keeps window.appState.guard in sync so the start button / time options can be gated
// - writes guard records to Firebase one at a time and acknowledges them
// - mirrors the rest end time to Firebase and reads it back on start
// - drives the 📘 online-class button and the one-line status under it
// Depends on: renderer.js (appState, appCheckStartButtonState, appShowToast, appReloadStats),
//             firebase-helpers.js (writeGuardRecord, setRestEndAt, getRestEndAt)
document.addEventListener('DOMContentLoaded', function() {
    const state = window.appState;
    const classBtn = document.getElementById('class-mode-btn');
    const statusLine = document.getElementById('guard-status-line');
    const USER_IDS = { user1: 'pinyu', user2: 'pinrong' };

    function toast(msg) {
        if (window.appShowToast) window.appShowToast(msg);
    }
    function mmss(sec) {
        const s = Math.max(0, sec);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    function identity() {
        return localStorage.getItem('installedUser');
    }

    // ---------- state ----------
    window.api.on('guard-state', (snap) => {
        state.guard = snap;
        if (window.appCheckStartButtonState) window.appCheckStartButtonState();
        renderClassButton(snap);
        renderStatusLine(snap);
    });

    function renderClassButton(snap) {
        if (!classBtn) return;
        const isChild = snap && snap.active;
        classBtn.parentElement.style.display = isChild ? '' : 'none';
        if (!isChild) return;
        if (snap.mode === 'class') {
            classBtn.textContent = `📘 結束線上課（剩 ${mmss(Math.ceil((snap.classEndAt - snap.now) / 1000))}）`;
            classBtn.classList.add('in-class');
        } else if (!confirmPending) {
            classBtn.textContent = '📘 線上課';
            classBtn.classList.remove('in-class');
        }
    }

    function renderStatusLine(snap) {
        if (!statusLine) return;
        if (!snap || !snap.active) {
            statusLine.textContent = '';
            return;
        }
        let text = '';
        if (snap.mode === 'rest') {
            text = `😴 休息中，還有 ${mmss(snap.restRemainingSec)}`;
        } else if (snap.mode === 'class') {
            text = '📘 線上課中：不計時、不提醒，下課後休息 5 分鐘';
        } else if (snap.mode === 'wrapup') {
            text = `⏳ 收尾中，剩 ${mmss(Math.ceil((snap.wrapupEndAt - snap.now) / 1000))}`;
        } else if (snap.roundUsedSec >= 60) {
            text = `這一輪已用 ${Math.floor(snap.roundUsedSec / 60)} 分，還可以計時 ${Math.floor((snap.allowanceSec + 30) / 60)} 分`;
        }
        statusLine.textContent = text;
    }

    // ---------- online class button ----------
    // While a timer is running, the first click only arms the button (switching ends the
    // current session), so a stray click does not cut a session short.
    let confirmPending = false;
    let confirmTimer = null;
    if (classBtn) {
        classBtn.addEventListener('click', () => {
            const snap = state.guard;
            if (!snap || !snap.active) return;
            if (snap.mode === 'class') {
                window.api.send('guard-end-class');
                return;
            }
            if (snap.mode === 'timing' && !confirmPending) {
                confirmPending = true;
                classBtn.textContent = '📘 再按一次：結束目前計時並開始線上課';
                clearTimeout(confirmTimer);
                confirmTimer = setTimeout(() => { confirmPending = false; }, 4000);
                return;
            }
            confirmPending = false;
            clearTimeout(confirmTimer);
            // main hides the main window and shows the class countdown in the mini window
            window.api.send('guard-start-class');
        });
    }

    // ---------- records ----------
    // Serial queue: one Firestore write at a time, skipping ids already in flight.
    const inFlight = new Set();
    let chain = Promise.resolve();
    let reloadTimer = null;

    window.api.on('guard-record', (rec) => {
        if (!rec || inFlight.has(rec.id)) return;
        inFlight.add(rec.id);
        chain = chain.then(async () => {
            try {
                await window.writeGuardRecord(rec);
                window.api.send('guard-record-ack', rec.id);
                document.dispatchEvent(new CustomEvent('guard-record-written', { detail: rec }));
                clearTimeout(reloadTimer);
                reloadTimer = setTimeout(() => {
                    if (window.appReloadStats) window.appReloadStats();
                }, 800);
            } catch (e) {
                console.error('❌ 寫入使用記錄失敗（稍後重送）:', e);
            } finally {
                inFlight.delete(rec.id);
            }
        });
    });

    // ---------- rest sync ----------
    window.api.on('guard-rest-sync', (ms) => {
        const userId = USER_IDS[identity()];
        if (userId && window.setRestEndAt) window.setRestEndAt(userId, ms);
    });

    window.api.on('guard-rest-ended', () => toast('休息時間結束，可以重新計時了！'));

    async function pullRemoteRest() {
        const userId = USER_IDS[identity()];
        if (!userId || !window.getRestEndAt) return;
        const ms = await window.getRestEndAt(userId);
        if (ms && ms > Date.now()) window.api.send('guard-remote-rest', ms);
    }

    // ---------- start ----------
    window.api.send('guard-ready');
    window.api.invoke('guard-get-state').then((snap) => {
        state.guard = snap;
        if (window.appCheckStartButtonState) window.appCheckStartButtonState();
        renderClassButton(snap);
        renderStatusLine(snap);
    });
    pullRemoteRest();
    // Retry records that failed to write (offline, Firebase not ready yet).
    setInterval(() => window.api.send('guard-ready'), 5 * 60 * 1000);
});
