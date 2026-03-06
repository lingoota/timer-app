/**
 * charts.js — 統計圖表 + 匯出功能模組
 * 依賴：window.appDom, window.appState, window.getHistoryStats, window.api
 */
document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    const dom = window.appDom;
    const state = window.appState;

    // === 顏色常數 ===
    const CATEGORY_COLORS = {
        '遊戲': '#ff6384',
        'YouTube': '#ff9f40',
        '查資料': '#ffcd56',
        '看漫畫': '#4bc0c0',
        '學習': '#36a2eb',
        '寫作': '#ff69b4',
        '其他': '#9966ff',
        '未分類': '#808080'
    };
    const USER_COLORS = { pinyu: '#64dcff', pinrong: '#ffb464' };

    // === 工具函數 ===
    function showToast(msg) {
        if (window.appShowToast) window.appShowToast(msg);
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // === 圖表功能 ===

    // 主渲染入口
    async function renderCharts() {
        const u1Min = Math.round(state.user1TotalTime / 60);
        const u2Min = Math.round(state.user2TotalTime / 60);

        // 更新摘要數字
        if (dom.summaryPinyu) dom.summaryPinyu.textContent = `${u1Min} 分`;
        if (dom.summaryPinrong) dom.summaryPinrong.textContent = `${u2Min} 分`;
        if (dom.summaryTotal) dom.summaryTotal.textContent = `${u1Min + u2Min} 分`;

        renderDailyPieChart();
        renderUserComparisonChart();

        // 取得目前選中的天數 tab
        const activeTab = document.querySelector('.trend-tab.active');
        const days = activeTab ? parseInt(activeTab.dataset.days) : 7;
        await renderHistoryTrend(days);
    }

    // 圓餅圖：當前使用者的活動分佈
    function renderDailyPieChart() {
        const canvas = dom.dailyPieChart;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const currentUser = state.pieChartUser || state.selectedUser || 'user1';
        let catData = currentUser === 'user1' ? state.user1CategoryTime : state.user2CategoryTime;
        const userName = currentUser === 'user1' ? '品瑜' : '品榕';
        const userTotal = currentUser === 'user1' ? state.user1TotalTime : state.user2TotalTime;

        // 舊資料相容
        const catTotal = Object.values(catData).reduce((s, t) => s + t, 0);
        if (userTotal > 0 && catTotal === 0) {
            catData = { ...catData, '未分類': userTotal };
            if (currentUser === 'user1') state.user1CategoryTime = catData;
            else state.user2CategoryTime = catData;
        }

        const total = Object.values(catData).reduce((s, t) => s + t, 0);
        if (total === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${userName} 暫無活動數據`, canvas.width / 2, canvas.height / 2);
            dom.dailyChartLegend.innerHTML = '';
            return;
        }

        const cx = canvas.width / 2, cy = canvas.height / 2;
        const outerR = Math.min(cx, cy) - 16;
        const innerR = outerR * 0.55;
        let angle = -Math.PI / 2;

        Object.entries(catData).forEach(([cat, time]) => {
            if (time <= 0) return;
            const sweep = (time / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, outerR, angle, angle + sweep);
            ctx.arc(cx, cy, innerR, angle + sweep, angle, true);
            ctx.closePath();
            ctx.fillStyle = CATEGORY_COLORS[cat] || '#808080';
            ctx.fill();
            angle += sweep;
        });

        // 中間文字
        ctx.fillStyle = 'white';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(total / 60)}分`, cx, cy - 8);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(userName, cx, cy + 14);

        // 圖例
        let legend = '';
        Object.entries(catData).forEach(([cat, time]) => {
            if (time <= 0) return;
            const min = Math.round(time / 60);
            const pct = Math.round((time / total) * 100);
            legend += `<div class="legend-item"><span class="legend-color" style="background:${CATEGORY_COLORS[cat] || '#808080'}"></span>${cat} ${min}分 (${pct}%)</div>`;
        });
        dom.dailyChartLegend.innerHTML = legend;
    }

    // 長條圖：品瑜 vs 品榕
    function renderUserComparisonChart() {
        const canvas = dom.userComparisonChart;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const u1Min = Math.round(state.user1TotalTime / 60);
        const u2Min = Math.round(state.user2TotalTime / 60);
        const maxVal = Math.max(u1Min, u2Min, 1);

        const pad = { top: 30, bottom: 40, left: 20, right: 20 };
        const barArea = H - pad.top - pad.bottom;
        const barW = 70;
        const gap = 40;
        const startX = (W - barW * 2 - gap) / 2;

        // 圓角長條函數
        function roundedBar(x, y, w, h, r) {
            if (h < r * 2) r = h / 2;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
        }

        // 品瑜
        const u1H = Math.max((u1Min / maxVal) * barArea, 2);
        ctx.fillStyle = USER_COLORS.pinyu;
        roundedBar(startX, pad.top + barArea - u1H, barW, u1H, 8);

        // 品榕
        const u2H = Math.max((u2Min / maxVal) * barArea, 2);
        ctx.fillStyle = USER_COLORS.pinrong;
        roundedBar(startX + barW + gap, pad.top + barArea - u2H, barW, u2H, 8);

        // 數值標籤
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${u1Min}分`, startX + barW / 2, pad.top + barArea - u1H - 6);
        ctx.fillText(`${u2Min}分`, startX + barW + gap + barW / 2, pad.top + barArea - u2H - 6);

        // 名稱標籤
        ctx.font = '13px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.textBaseline = 'top';
        ctx.fillText('品瑜', startX + barW / 2, H - pad.bottom + 8);
        ctx.fillText('品榕', startX + barW + gap + barW / 2, H - pad.bottom + 8);

        // 次數
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(`${state.user1SessionCount}次`, startX + barW / 2, H - pad.bottom + 24);
        ctx.fillText(`${state.user2SessionCount}次`, startX + barW + gap + barW / 2, H - pad.bottom + 24);
    }

    // 歷史趨勢圖
    async function renderHistoryTrend(days) {
        const canvas = dom.historyTrendChart;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // 載入提示
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('載入中...', W / 2, H / 2);

        let history = [];
        try {
            history = await window.getHistoryStats(days);
        } catch (e) {
            console.error('取得歷史資料失敗:', e);
        }

        ctx.clearRect(0, 0, W, H);

        if (!history || history.length === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText('暫無歷史資料', W / 2, H / 2);
            return;
        }

        const pad = { top: 20, right: 30, bottom: 35, left: 45 };
        const cW = W - pad.left - pad.right;
        const cH = H - pad.top - pad.bottom;
        const n = history.length;
        const maxVal = Math.max(...history.map(d => Math.max(d.pinyu, d.pinrong)), 10);
        const xStep = cW / Math.max(n - 1, 1);

        // 網格線
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (cH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + cW, y);
            ctx.stroke();
        }

        // Y 軸標籤
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round(maxVal * (4 - i) / 4);
            ctx.fillText(`${val}分`, pad.left - 8, pad.top + (cH / 4) * i);
        }

        // X 軸標籤
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelStep = n <= 10 ? 1 : Math.ceil(n / 10);
        history.forEach((d, i) => {
            if (i % labelStep === 0 || i === n - 1) {
                ctx.fillText(d.label, pad.left + i * xStep, pad.top + cH + 8);
            }
        });

        // 繪製面積 + 折線
        function drawLine(key, color) {
            const points = history.map((d, i) => ({
                x: pad.left + i * xStep,
                y: pad.top + cH - (d[key] / maxVal) * cH
            }));

            // 半透明填充
            ctx.beginPath();
            ctx.moveTo(points[0].x, pad.top + cH);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length - 1].x, pad.top + cH);
            ctx.closePath();
            ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
            ctx.fill();

            // 折線
            ctx.beginPath();
            points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.stroke();

            // 資料點
            points.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            });
        }

        drawLine('pinyu', USER_COLORS.pinyu);
        drawLine('pinrong', USER_COLORS.pinrong);

        // 圖例（右上角）
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const legendX = W - pad.right - 100;

        ctx.fillStyle = USER_COLORS.pinyu;
        ctx.beginPath(); ctx.arc(legendX, pad.top + 6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('品瑜', legendX + 10, pad.top + 6);

        ctx.fillStyle = USER_COLORS.pinrong;
        ctx.beginPath(); ctx.arc(legendX + 52, pad.top + 6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('品榕', legendX + 62, pad.top + 6);
    }

    // === 匯出功能 ===

    async function exportData(format, range) {
        console.log(`開始匯出數據 - 格式: ${format}, 範圍: ${range}`);

        try {
            let data = [];
            const today = new Date().toDateString();

            if (range === 'today') {
                // 直接從記憶體中的 state 取得今日資料
                data = [{
                    date: today,
                    user1Total: state.user1TotalTime || 0,
                    user1Sessions: state.user1SessionCount || 0,
                    user2Total: state.user2TotalTime || 0,
                    user2Sessions: state.user2SessionCount || 0
                }];
            } else if (range === 'week' || range === 'all') {
                // 從 Firebase 取歷史資料
                const days = range === 'week' ? 7 : 30;
                try {
                    const history = await window.getHistoryStats(days);
                    if (history && history.length > 0) {
                        data = history.map(d => ({
                            date: d.date,
                            user1Total: (d.pinyu || 0) * 60,
                            user1Sessions: 0,
                            user2Total: (d.pinrong || 0) * 60,
                            user2Sessions: 0
                        }));
                    }
                } catch (error) {
                    console.log('從 Firebase 獲取歷史數據失敗:', error);
                    showToast('無法取得歷史資料');
                }
            }

            if (data.length === 0) {
                showToast('暫無數據可匯出');
                return;
            }

            if (format === 'csv') {
                exportToCsv(data, range);
            } else if (format === 'json') {
                exportToJson(data, range);
            }
        } catch (error) {
            console.error('匯出數據時發生錯誤:', error);
            showToast('匯出失敗，請稍後再試');
        }
    }

    function exportToCsv(data, range) {
        const headers = ['日期', '品瑜總時間(分鐘)', '品瑜會話次數', '品榕總時間(分鐘)', '品榕會話次數'];
        const csvContent = [
            headers.join(','),
            ...data.map(row => [
                row.date || '今日',
                Math.round((row.user1Total || 0) / 60),
                row.user1Sessions || 0,
                Math.round((row.user2Total || 0) / 60),
                row.user2Sessions || 0
            ].join(','))
        ].join('\n');

        downloadFile(csvContent, `timer-data-${range}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        showToast('CSV 檔案已下載');
    }

    function exportToJson(data, range) {
        const jsonContent = JSON.stringify({
            exportDate: new Date().toISOString(),
            range: range,
            data: data.map(row => ({
                date: row.date || '今日',
                user1: {
                    totalMinutes: Math.round((row.user1Total || 0) / 60),
                    sessions: row.user1Sessions || 0
                },
                user2: {
                    totalMinutes: Math.round((row.user2Total || 0) / 60),
                    sessions: row.user2Sessions || 0
                }
            }))
        }, null, 2);

        downloadFile(jsonContent, `timer-data-${range}-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        showToast('JSON 檔案已下載');
    }

    // === 事件綁定 ===

    function initChartEvents() {
        // 圖表按鈕 → 開啟圖表 modal
        if (dom.chartsBtn) {
            dom.chartsBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                dom.chartsModal.classList.remove('hidden');
                setTimeout(() => { renderCharts(); }, 100);
            });
        }

        // 關閉圖表 modal
        dom.chartsModalClose.addEventListener('click', function() {
            dom.chartsModal.classList.add('hidden');
        });
        dom.chartsModal.addEventListener('click', function(e) {
            if (e.target === dom.chartsModal) {
                dom.chartsModal.classList.add('hidden');
            }
        });

        // 趨勢圖 tab 切換
        document.querySelectorAll('.trend-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.trend-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                renderHistoryTrend(parseInt(this.dataset.days));
            });
        });

        // 圓餅圖使用者切換
        document.querySelectorAll('.pie-toggle-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.pie-toggle-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                state.pieChartUser = this.dataset.user;
                renderDailyPieChart();
            });
        });

        // 匯出按鈕 → 開啟匯出 modal
        if (dom.exportBtn) {
            dom.exportBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                dom.exportModal.classList.remove('hidden');
            });
        }

        // 關閉匯出 modal
        dom.modalClose.addEventListener('click', function() {
            dom.exportModal.classList.add('hidden');
        });
        dom.exportModal.addEventListener('click', function(e) {
            if (e.target === dom.exportModal) {
                dom.exportModal.classList.add('hidden');
            }
        });

        // CSV / JSON 匯出按鈕
        dom.exportCsvBtn.addEventListener('click', function() {
            const range = document.querySelector('input[name="export-range"]:checked').value;
            exportData('csv', range);
            dom.exportModal.classList.add('hidden');
        });
        dom.exportJsonBtn.addEventListener('click', function() {
            const range = document.querySelector('input[name="export-range"]:checked').value;
            exportData('json', range);
            dom.exportModal.classList.add('hidden');
        });
    }

    // 初始化事件
    initChartEvents();

    // 暴露給全域
    window.renderCharts = renderCharts;
    window.renderDailyPieChart = renderDailyPieChart;
    window.renderHistoryTrend = renderHistoryTrend;
    window.exportData = exportData;
});
