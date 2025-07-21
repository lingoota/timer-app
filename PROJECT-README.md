# 時間追蹤器專案 - Time Tracker Project

這是一個雙版本的時間追蹤應用程式專案，包含家庭版和通用版兩個不同版本。

## 📁 專案結構

```
timer-app-project/
├── family-version/          # v1.5.0 家庭版 (原版本)
│   ├── main.js             
│   ├── package.json        
│   ├── src/                
│   └── README.md           
├── universal-version/       # v2.0.0 通用版 (新版本)
│   ├── main.js             
│   ├── package.json        
│   ├── src/                
│   │   ├── google-auth.js      # Google OAuth 認證
│   │   ├── google-sheets.js    # Google Sheets API
│   │   └── ...
│   ├── GOOGLE_SETUP.md         # Google API 設定指南
│   ├── test-config.js          # 配置檢查工具
│   └── test-google-sheets.js   # 功能測試程式
└── PROJECT-README.md        # 專案總覽 (本檔案)
```

## 🎯 版本差異

### 家庭版 (v1.5.0)
- **目標用戶**: 家庭內部使用
- **用戶系統**: A/B雙用戶選擇 (品瑜/品榕)
- **數據存儲**: Google Sheets (固定連接)
- **特色功能**: 
  - 活動類別統計圖表
  - 匯出數據功能
  - 迷你模式計時
  - 成就系統

### 通用版 (v2.0.0)
- **目標用戶**: 一般用戶使用
- **用戶系統**: Windows 用戶自動檢測
- **數據存儲**: 用戶自有 Google Sheets 或本地存儲
- **新增功能**:
  - Google OAuth 認證系統
  - 用戶自有 Google Sheets 連接
  - 完整的設定嚮導
  - 數據移轉功能
  - 多種測試工具

## 🚀 開始使用

### 家庭版
```bash
cd family-version
npm install
npm start
```

### 通用版
```bash
cd universal-version
npm install
# 設定 Google API 憑證 (參考 GOOGLE_SETUP.md)
npm start
```

## 🔧 Google Sheets 整合

通用版支援用戶連接自己的 Google Sheets 來存儲時間追蹤數據：

1. **設定 Google API**: 參考 `universal-version/GOOGLE_SETUP.md`
2. **配置檢查**: 運行 `node test-config.js`
3. **功能測試**: 運行 `node test-google-sheets.js`

## 📊 技術架構

- **框架**: Electron (跨平台桌面應用)
- **前端**: HTML + CSS + JavaScript
- **後端**: Node.js
- **API 整合**: Google Sheets API + Google Drive API
- **認證**: Google OAuth 2.0
- **存儲**: localStorage + Google Sheets

## 🎨 核心功能

### 共同功能
- ⏰ 可自訂時間的計時器
- 📊 活動類別分類
- 📈 使用統計和圖表
- 🔔 計時完成提醒
- 🎯 成就系統
- 📱 迷你模式

### 通用版獨有
- 🔐 Google OAuth 認證
- ☁️ 用戶自有雲端存儲
- 🛠️ 完整設定嚮導
- 🧪 測試和配置工具
- 👤 Windows 用戶自動檢測

## 🌟 開發歷程

- **v1.0-1.3**: 基礎計時功能開發
- **v1.4.0**: 活動類別統計圖表系統
- **v1.5.0**: 靈活自定義時間與活動類別優化
- **v2.0.0**: 通用版開發，支援用戶自有 Google Sheets

## 🤝 協作開發

本專案使用 Claude Code 進行 AI 輔助開發，結合人工智慧和開發者的創意，實現高效的功能開發。

---

**Created with Claude Code** 🤖