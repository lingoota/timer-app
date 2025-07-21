# Google Sheets 整合設定指南

本應用程式支援將時間追蹤數據同步到用戶自己的 Google Sheets。要使用此功能，您需要設定 Google API 憑證。

## 📋 前置準備

### 1. 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 專案名稱建議：`time-tracker-universal`

### 2. 啟用必要的 API

在 Google Cloud Console 中啟用以下 API：
- **Google Sheets API**
- **Google Drive API**

路徑：APIs & Services → Library → 搜尋並啟用上述 API

### 3. 建立 OAuth 2.0 憑證

1. 前往 **APIs & Services → Credentials**
2. 點擊 **+ CREATE CREDENTIALS → OAuth client ID**
3. 如果是首次使用，需要先設定 OAuth consent screen：
   - User Type: 選擇 **External**
   - App name: `時間追蹤器 Universal`
   - User support email: 您的 email
   - Developer contact information: 您的 email
   - 在 Scopes 頁面添加：
     - `https://www.googleapis.com/auth/spreadsheets`
     - `https://www.googleapis.com/auth/drive.file`
   - Test users: 添加您要使用的 Google 帳戶

4. 建立 OAuth client ID：
   - Application type: **Desktop application**
   - Name: `時間追蹤器 Universal Desktop`

5. 下載 JSON 憑證檔案

## 🔧 設定應用程式憑證

### 方法 1: 環境變數 (推薦)

建立一個 `.env` 檔案在專案根目錄：

```bash
# Google OAuth 2.0 憑證
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

### 方法 2: 直接修改程式碼

編輯 `src/google-auth.js` 檔案，替換以下行：

```javascript
this.CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID';
this.CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
```

將 `YOUR_CLIENT_ID` 和 `YOUR_CLIENT_SECRET` 替換為您的實際憑證。

## 📦 安裝環境變數支援

如果使用環境變數方法，需要安裝 dotenv：

```bash
npm install dotenv
```

然後在 `main.js` 最上方添加：

```javascript
require('dotenv').config();
```

## 🧪 測試設定

1. 啟動應用程式：`npm start`
2. 在歡迎畫面後會出現 Google Sheets 設定嚮導
3. 點擊「開始設定」
4. 在認證步驟點擊「連接 Google 帳戶」
5. 系統會在瀏覽器中開啟 Google 授權頁面
6. 完成授權後返回應用程式
7. 選擇「創建新的 Sheets」或「使用現有 Sheets」
8. 測試連接是否成功

## 🔐 安全性說明

- **用戶數據所有權**：所有數據都保存在用戶自己的 Google 帳戶中
- **最小權限原則**：應用程式只要求存取 Google Sheets 和 Drive 的必要權限
- **本地憑證**：OAuth tokens 保存在用戶本地電腦，不會上傳到任何伺服器
- **撤銷授權**：用戶可隨時在 Google 帳戶設定中撤銷應用程式的存取權限

## 🚨 注意事項

1. **測試用戶限制**：在 OAuth consent screen 設定為「Testing」狀態時，只有添加為測試用戶的 Google 帳戶可以使用
2. **正式發佈**：如要公開發佈，需要提交 OAuth consent screen 進行 Google 審核
3. **配額限制**：Google Sheets API 有使用配額限制，正常使用不會達到上限
4. **憑證保密**：切勿將 Client Secret 提交到公開的程式碼庫

## 🆘 疑難排解

### 錯誤：「This app isn't verified」
- 在 OAuth consent screen 中添加您的 Google 帳戶為測試用戶
- 或在授權頁面點擊「Advanced」→「Go to 時間追蹤器 Universal (unsafe)」

### 錯誤：「access_denied」
- 檢查 OAuth consent screen 是否正確設定
- 確認使用的 Google 帳戶已添加為測試用戶

### 錯誤：「redirect_uri_mismatch」
- 確認 OAuth client 設定為「Desktop application」
- 檢查程式碼中的 REDIRECT_URI 是否正確

### 連接測試失敗
- 檢查 Google Sheets API 和 Drive API 是否已啟用
- 確認憑證設定正確
- 查看控制台錯誤訊息獲取更多資訊

## 📚 更多資源

- [Google Sheets API 文檔](https://developers.google.com/sheets/api)
- [Google OAuth 2.0 文檔](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)