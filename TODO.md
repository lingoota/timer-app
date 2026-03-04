# 📝 時間追蹤器 Family 版 Todo List

> **專案**: 時間追蹤器家庭版 (Time Calculator - Family Edition)
> **最後更新**: 2026-03-04
> **狀態**: v2.0.0-beta.9 已發布，待使用者測試

本文件管理家庭版的開發計劃與待辦事項。

---

## 🎯 當前重點：v2.0.0-beta.9 新功能移植

> ⚠️ 2026-03-03：在 universal-version 實作完成並測試通過，需要移植到 family-version。

### 📋 移植待辦
- [x] **main.js** — 新增 `powerMonitor` import、閒置偵測變數、5 個 IPC handler（`set-auto-launch`、`user-identity`、`timer-running-status`、`show-timer-reminder`、`snooze-reminder`）、`setupActivityReminder()` / `stopActivityReminder()` 函數
- [x] **src/renderer.js** — 改造 `initializeUserSelection()` 為身份綁定系統（`installedUser` 取代 `rememberedUser`）、移除 checkbox、新增提醒對話框監聯、新增 `startTimerStatusReporting()`
- [x] **src/index.html** — 用戶選擇改為首次設定風格（品瑜/品榕/家長三按鈕）、移除 checkbox、新增提醒對話框 HTML、新增「切換使用者」按鈕
- [x] **src/styles.css** — 新增身份選擇按鈕樣式、提醒對話框樣式、壓縮整體間距避免捲動
- [ ] **測試驗證** — 首次身份選擇 → 永久記住 → 開機自啟動 → 60 秒未計時彈提醒 → 稍後提醒冷卻（⚠️ 需手動啟動 app 測試）

### 📝 參考來源
universal-version 已完成的程式碼可直接參考，邏輯相同，只需適配 family-version 的差異（Firebase、背景圖片等）

---

## 🚧 進行中：UI 大改版（整頁遮罩 + 設定收折 + 文字可讀性）

> 背景：用戶設定自訂背景圖片後，文字和按鈕被背景干擾、難以辨識。右上角 8 個功能按鈕佔版面且使用頻率低。

### 已完成的改動
- [x] **步驟 1：整頁遮罩層** — 取代各區塊獨立遮罩
  - `index.html` 加入 `<div id="bg-overlay">`
  - `styles.css` 加入 `.bg-overlay` (fixed, pointer-events:none)
  - `background.js` 重寫：body 只設背景圖，`#bg-overlay` 控制遮罩 rgba
  - 移除所有 `body.has-custom-background .xxx` 獨立遮罩 CSS
- [x] **步驟 2：全域文字陰影** — 所有文字加 text-shadow 提升可讀性
- [x] **步驟 3：功能按鈕收折為齒輪面板**
  - 8 個按鈕改為齒輪 ⚙️ + 下拉 4x2 grid 面板
  - 每個按鈕有圖示 + 小字標籤
  - 透明度滑桿移入面板內
  - soundToggle/themeToggle 的 textContent 改為 innerHTML（保留標籤）
- [x] **步驟 4：間距壓縮** — body padding、計時器圓圈、統計區間距壓縮

### 待修正的 Bug
- [x] **齒輪按鈕點擊無反應** — 已修復（⚠️ 需手動測試驗證）
  - 修復 1：`.user-selection-overlay.hidden` 加入 `visibility: hidden`，避免遮罩攔截點擊
  - 修復 2：document click handler 改用 `.closest('.settings-wrapper')` 判斷，避免點擊 emoji 文字時誤關面板
  - 修復 3：移除 index.html 中重複的更新通知 HTML 區塊
  - 修復 4：移除 renderer.js 中的 debug console.log

---

## ✅ 已完成功能總覽

### v2.0.0-beta.8（2025-02-01）✅ 已發布
- ⬇️ 手動檢查更新功能
- 🎨 背景圖片 UI 優化（毛玻璃效果）
- 🔧 停用 GitHub Actions 自動建置

### v2.0.0-beta.6~7（2025-02-01）✅
- 🖼️ 個人化背景圖片功能
- 🎨 背景圖片半透明遮罩

### v2.0.0-beta.1（2025-01-31）✅
- ⚡ Firebase Firestore 整合（取代 Google Sheets）
- 📦 NSIS 安裝程式
- 🔄 electron-updater 手動更新後端邏輯
- 👨‍👩‍👧‍👧 家長觀察模式

### v1.5.2（2025-12-09）✅
- 🐛 修復圓餅圖顯示錯誤

### v1.5.1（2025-10-15）✅
- ✍️ 新增「寫作」活動類別
- 🎨 UI 優化（標題靠左對齊）
- 📦 封裝完成（249MB 免安裝版）

### v1.5.0（2025-07-20）✅
- ⏱️ 自定義時間功能（1-30 分鐘）
- 🤖 Claude Code 協作環境建立

### v1.0.0~v1.4.0（2025-06）✅
- ⏱️ 基礎計時（開始/暫停/重置）
- 👥 雙用戶系統（品瑜/品榕）
- 📚 7 種活動分類
- 🔧 迷你模式、深色模式、全局快捷鍵
- 📊 統計圖表（圓餅圖、長條圖）
- ☁️ Google Sheets 雲端同步（v2.0.0 前）
- 📤 CSV/JSON 匯出

---

## 🎉 v2.0.0 最終發布準備

### 📋 實際使用測試（待進行）
- [ ] 測試從 beta.7 更新到 beta.8
- [ ] 確認手動檢查更新功能
- [ ] 確認下載進度顯示
- [ ] 確認安裝更新流程
- [ ] 確認更新後資料完整
- [ ] 測試背景圖片設定與重置
- [ ] 測試深色/淺色模式切換
- [ ] 長時間運行測試（1-2 週）
- [ ] 收集使用者反饋

### 📋 正式發布準備
- [ ] 完成所有測試
- [ ] 更新所有文檔
- [ ] 準備發布說明
- [ ] 更新版本號到 v2.0.0
- [ ] 建置正式版
- [ ] 建立 GitHub Release

---

## 💡 重要提醒

### 🔒 備份與安全
- ✅ Firebase 安全規則已更新為正式規則（2026-02-26）— 不再有到期問題
- ✅ 本地 localStorage 備份機制已完成

### ⚠️ 踩過的坑
- **Private repo 無法自動更新**：electron-updater 用公開 API 讀取 Release
- **Pre-release 不會被偵測到**：electron-updater 預設只看 "Latest" Release
- **必須上傳 latest.yml**：只上傳 .exe 不夠
- **手動更新比自動更新更可控**：不會打斷使用者工作

---

**維護者**: Claude Code Assistant
**專案倉庫**: https://github.com/lingoota/timer-app
