# 時間追蹤器家庭版 - Claude Code 專案說明檔

## 專案概覽

**專案名稱**: 時間追蹤器家庭版 (Time Calculator - Family Edition)
**當前版本**: v2.0.0-beta.18
**技術架構**: Electron + HTML/CSS/JavaScript + Firebase Firestore
**GitHub**: https://github.com/lingoota/timer-app

## 專案結構

```
family-version/
├── main.js                  # Electron 主程序
├── package.json
├── assets/icon.png          # 應用圖示
├── src/
│   ├── index.html           # 主界面
│   ├── renderer.js          # 前端邏輯（主入口）
│   ├── charts.js            # 統計圖表 + 匯出
│   ├── updater-ui.js        # 更新通知 UI
│   ├── styles.css           # 樣式表
│   ├── preload.js           # IPC 橋接
│   ├── firebase-helpers.js  # Firebase CRUD
│   └── background.js        # 背景圖片
├── todo.md                  # 待辦事項
├── 專案概況.md               # 版本里程碑
└── 功能架構.md               # 功能模組 + 函數索引
```

## 開發與測試

```bash
npm start          # 啟動開發模式
npm run build      # 建置 NSIS 安裝檔
```

**⚠️ 測試限制**：Claude Code 沙盒環境無法啟動 Electron GUI（`app` 為 undefined）。
- `node --check main.js` 和 `node --check src/renderer.js` 可驗證語法
- **功能測試必須由使用者手動執行 `npm start`**，不要嘗試在 CLI 中啟動 Electron

## 開發原則

- 繁體中文註解
- 簡單優先、新手友善
- 修改功能前先查 `功能架構.md` → 直接定位目標函數

## 重要注意事項

- Firebase 安全規則已更新為正式規則（永久有效）
- 發版必傳 `.exe` + `.exe.blockmap` + `latest.yml`，不可標記 Pre-release
- 視窗狀態儲存於 `app.getPath('userData')/window-state.json`

---

**最後更新**: 2026-03-09
**專案狀態**: 活躍開發中（穩定測試階段）
