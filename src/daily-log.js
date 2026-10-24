// 今日明細: every record of today with start–end times, colour-coded by kind, plus a
// one-line daily summary (timed / untimed / overtime / online class / snoozes).
// Kids see their own log; parent mode gets a 品瑜 / 品榕 toggle.
// Depends on: firebase-helpers.js (getTodayActivities)
document.addEventListener('DOMContentLoaded', function() {
    const listEl = document.getElementById('daily-log-list');
    const summaryEl = document.getElementById('daily-log-summary');
    const tabsEl = document.getElementById('daily-log-tabs');
    if (!listEl) return;

    const USER_IDS = { user1: 'pinyu', user2: 'pinrong' };
    const CATEGORY_ICONS = {
        '遊戲': '🎮', 'YouTube': '📺', '查資料': '🔍', '看漫畫': '📚',
        '學習': '📚', '寫作': '✍️', '繪畫': '🎨', '其他': '⭐',
    };
    let parentViewUser = 'pinyu';

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function hhmm(date) {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    function fmtDuration(sec) {
        if (sec < 60) return `${sec} 秒`;
        return `${Math.round(sec / 60)} 分`;
    }

    function currentUserId() {
        const identity = localStorage.getItem('installedUser');
        if (identity === 'parent') return parentViewUser;
        return USER_IDS[identity] || null;
    }

    // Normalise legacy records (only end time + duration) into the new shape.
    function normalise(r) {
        if (r.kind) {
            return Object.assign({}, r, { sortKey: r.startIso || r.timestamp || '' });
        }
        const end = r.timestamp ? new Date(r.timestamp) : null;
        const start = end ? new Date(end.getTime() - (r.duration || 0) * 1000) : null;
        return {
            kind: 'timed', type: r.type, duration: r.duration || 0, counted: true, completed: true,
            start: start ? hhmm(start) : '?', end: r.time || (end ? hhmm(end) : '?'),
            legacy: true, flags: [], sortKey: start ? start.toISOString() : '',
        };
    }

    function describe(r) {
        const range = r.start === r.end ? r.start : `${r.legacy ? '≈' : ''}${r.start}–${r.end}`;
        const notes = [];
        let icon = '';
        let label = r.type;
        let cls = `log-${r.kind}`;
        switch (r.kind) {
            case 'timed':
                icon = CATEGORY_ICONS[r.type] || '⏱️';
                if (r.flags && r.flags.includes('interrupted')) notes.push('程式中斷，補記');
                else if (r.flags && r.flags.includes('switch-class')) notes.push('切換線上課');
                else if (r.flags && r.flags.includes('round-limit')) notes.push('本輪滿 30 分');
                else if (r.completed === false) notes.push('提早結束');
                if (r.legacy) notes.push('舊版記錄，開始時間為推算');
                break;
            case 'untimed':
                icon = '⚠️';
                if (r.snoozes) notes.push(`稍後提醒 ×${r.snoozes}`);
                // Never touched keyboard/mouse: only a playing video was detected
                if (r.flags && r.flags.includes('video-only')) notes.push('只偵測到畫面在播放');
                break;
            case 'wrapup':
                icon = '⏳';
                break;
            case 'overtime':
                icon = '🔒';
                label = '休息中持續使用';
                notes.push('已鎖定電腦');
                break;
            case 'class':
                icon = '📘';
                if (r.flags && r.flags.includes('started-during-rest')) notes.push('休息中開始');
                if (r.flags && r.flags.includes('switched-from-timer')) notes.push('從計時切換');
                if (r.flags && r.flags.includes('chained')) notes.push('接續上一段');
                break;
            case 'event':
                if (r.flags && r.flags.includes('app-gap')) {
                    icon = '⚠️';
                    cls = 'log-gap';
                    const sec = Math.round((new Date(r.endIso) - new Date(r.startIso)) / 1000);
                    notes.push(fmtDuration(sec));
                } else if (r.flags && r.flags.includes('identity-change')) {
                    icon = '⚠️';
                    cls = 'log-gap';
                } else {
                    icon = '🔄';
                }
                break;
        }
        const showDuration = r.kind !== 'event';
        return `
            <div class="daily-log-row ${cls}">
                <span class="log-time">${esc(range)}</span>
                <span class="log-label">${icon} ${esc(label)}${showDuration ? ` <b>${fmtDuration(r.duration)}</b>` : ''}</span>
                ${notes.length ? `<span class="log-note">（${esc(notes.join('，'))}）</span>` : ''}
            </div>`;
    }

    function summarise(rows) {
        const sum = (list) => list.reduce((a, r) => a + (r.duration || 0), 0);
        const timed = rows.filter(r => r.kind === 'timed');
        const untimed = rows.filter(r => r.kind === 'untimed');
        const overtime = rows.filter(r => r.kind === 'overtime');
        const wrapup = rows.filter(r => r.kind === 'wrapup');
        const cls = rows.filter(r => r.kind === 'class');
        const gaps = rows.filter(r => r.kind === 'event' && r.flags && r.flags.includes('app-gap'));
        const identitySwitches = rows.filter(r => r.kind === 'event' && r.flags && r.flags.includes('identity-change'));
        const snoozes = untimed.reduce((a, r) => a + (r.snoozes || 0), 0);
        const counted = rows.filter(r => r.counted !== false);

        const parts = [`總計 <b>${fmtDuration(sum(counted))}</b>`, `計時 ${timed.length} 次 ${fmtDuration(sum(timed))}`];
        if (untimed.length) parts.push(`<span class="sum-warn">⚠️ 未計時 ${untimed.length} 次 ${fmtDuration(sum(untimed))}</span>`);
        if (wrapup.length) parts.push(`⏳ 收尾 ${wrapup.length} 次`);
        if (overtime.length) parts.push(`<span class="sum-warn">🔒 休息中被鎖定 ${overtime.length} 次</span>`);
        if (snoozes) parts.push(`💤 稍後提醒 ${snoozes} 次`);
        if (cls.length) parts.push(`<span class="sum-class">📘 線上課 ${cls.length} 段 ${fmtDuration(sum(cls))}（不算總計）</span>`);
        if (gaps.length) parts.push(`<span class="sum-warn">⚠️ 計時程式沒執行 ${gaps.length} 次</span>`);
        if (identitySwitches.length) parts.push(`<span class="sum-warn">⚠️ 切換身份 ${identitySwitches.length} 次</span>`);
        return parts.join(' · ');
    }

    let refreshing = false;
    async function refresh() {
        const userId = currentUserId();
        if (tabsEl) tabsEl.style.display = localStorage.getItem('installedUser') === 'parent' ? '' : 'none';
        if (!userId || !window.getTodayActivities || refreshing) return;
        refreshing = true;
        try {
            const records = await window.getTodayActivities(userId);
            const rows = records.map(normalise).sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
            if (rows.length === 0) {
                listEl.innerHTML = '<div class="daily-log-empty">今天還沒有記錄</div>';
                summaryEl.innerHTML = '';
            } else {
                listEl.innerHTML = rows.map(describe).join('');
                summaryEl.innerHTML = summarise(rows);
            }
        } catch (e) {
            console.error('❌ 載入今日明細失敗:', e);
        } finally {
            refreshing = false;
        }
    }

    if (tabsEl) {
        tabsEl.querySelectorAll('.daily-log-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                tabsEl.querySelectorAll('.daily-log-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                parentViewUser = btn.dataset.user;
                refresh();
            });
        });
    }

    let debounce = null;
    document.addEventListener('guard-record-written', () => {
        clearTimeout(debounce);
        debounce = setTimeout(refresh, 1500);
    });
    setTimeout(refresh, 1500);
    setInterval(refresh, 60 * 1000);
    window.refreshDailyLog = refresh;
});
