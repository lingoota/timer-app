# 🕐 時間追蹤器家庭版 - Claude Code 專案說明檔

## 📋 專案概覽

**專案名稱**: 時間追蹤器家庭版 (Time Calculator - Family Edition)
**當前版本**: v2.0.0-beta.8
**技術架構**: Electron + HTML/CSS/JavaScript + Firebase Firestore
**開發環境**: Windows 11 + VS Code
**目標用戶**: 品瑜、品榕（家庭成員時間追蹤）
**GitHub**: https://github.com/lingoota/timer-app

## 🎯 核心功能

### ✅ 已完成功能
- **計時系統**: 5/10/15/20/30 分鐘預設 + 1-30 分鐘自定義
- **雙用戶系統**: 品瑜/品榕切換，獨立統計
- **活動分類**: 遊戲、YouTube、查資料、看漫畫、學習、寫作、其他（7 種）
- **Firebase 雲端同步**: 即時資料同步 + localStorage 本地備份
- **家長觀察模式**: 即時監控孩子計時狀態
- **手動更新機制**: electron-updater + GitHub Releases
- **個人化背景圖片**: 毛玻璃效果、深淺模式自動適配
- **統計圖表**: 圓餅圖、長條圖、24 小時時間線
- **迷你模式**: 160x60 always-on-top 小窗口
- **深色模式 + 全局快捷鍵 + CSV/JSON 匯出**

### 🚧 開發中（beta.9）
- 身份綁定（首次啟動選擇，永久記住）
- 開機自啟動（小孩身份自動啟用）
- 閒置偵測提醒（未計時彈出提醒）
- UI 改版（齒輪面板 Bug 修復）

## 📁 專案結構

```
family-version/
├── main.js                    # Electron 主程序 + 更新邏輯
├── package.json               # 專案配置
├── src/
│   ├── index.html            # 主界面
│   ├── renderer.js           # 前端邏輯
│   ├── styles.css            # 樣式表
│   ├── preload.js            # IPC 通道（預載腳本）
│   ├── firebase-helpers.js   # Firebase 操作函數
│   └── background.js         # 背景圖片功能
├── dist/                     # 建置輸出
├── todo.md                   # 待辦清單
├── 專案概況.md                # 專案狀態總覽
├── 需求規格與指令.md           # 需求與指令記錄
└── CLAUDE.md                 # 本檔案
```

## 🔧 常用指令

```bash
npm start          # 啟動開發模式
npm run build      # 建置 NSIS 安裝檔
```

## 🎯 開發原則

- **繁體中文註解**: 所有程式碼註解使用繁體中文
- **簡單優先**: 使用簡單穩定的解決方案
- **新手友善**: 清晰的程式結構
- **向下相容**: 新功能不影響現有資料

## ⚠️ 重要注意事項

- **Firebase 安全規則**已更新為正式規則（2026-02-26），永久有效
- **建置產出**: NSIS 安裝版（非免安裝版），支援 electron-updater
- **GitHub Releases**: 發版時必須上傳 .exe + .exe.blockmap + latest.yml
- **不可標記 Pre-release**: electron-updater 預設忽略 Pre-release

## ⚡ Claude Code 快捷指令

- `/繼續` - 查看現況並繼續工作
- `/狀態` - 快速檢視專案狀態
- `/完成` - 標記工作完成
- `/暫停` - 暫停並記錄進度
- `/推送` - 推送到 GitHub + 更新狀態
- `/紀錄` - 更新工作記錄

---

**建立日期**: 2025-07-20
**最後更新**: 2026-03-03
**維護者**: Claude Code Assistant
**專案狀態**: 活躍開發中（beta.9 開發中）
