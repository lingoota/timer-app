# 技術決策記錄 (Technical Decision Record)

本文件記錄了電腦使用時間追蹤器專案中的重要技術決策和設計選擇。

## 決策概覽

| 決策編號 | 日期 | 決策主題 | 狀態 |
|---------|------|----------|------|
| TDR-001 | 2025-06-22 | 選擇 Electron 作為桌面應用框架 | ✅ 已實施 |
| TDR-002 | 2025-06-22 | 使用 Google Apps Script 作為後端 | ✅ 已實施 |
| TDR-003 | 2025-06-22 | 實施活動分類系統 | ✅ 已實施 |
| TDR-004 | 2025-06-22 | 設計迷你模式功能 | ✅ 已實施 |
| TDR-005 | 2025-06-22 | 實施智能窗口攔截機制 | ✅ 已實施 |
| TDR-006 | 2025-06-22 | v1.1.0 功能擴展與問題修復 | ✅ 已實施 |
| TDR-007 | 2025-06-26 | 應用程式打包與分發 | ✅ 已實施 |
| TDR-008 | 2025-06-28 | Google Sheets 連動問題修復 | ✅ 已實施 |
| TDR-009 | 2025-06-28 | Git 版本控制系統建立 | ✅ 已實施 |

---

## TDR-001: 選擇 Electron 作為桌面應用框架

### 背景
用戶的原始 HTML 檔案在瀏覽器中遇到 CORS 問題，無法直接與 Google Sheets API 通信。

### 考慮的選項
1. **純 HTML + 代理服務器**：建立後端代理來處理 API 請求
2. **Electron 桌面應用**：將 HTML 包裝為桌面應用
3. **瀏覽器擴展**：開發 Chrome/Firefox 擴展
4. **Progressive Web App (PWA)**：使用 Service Worker

### 決策
選擇 **Electron** 作為解決方案。

### 理由
- ✅ **CORS 解決**：Electron 環境不受瀏覽器 CORS 限制
- ✅ **跨平台**：支援 Windows、macOS、Linux
- ✅ **獨立運行**：無需瀏覽器即可使用
- ✅ **原生體驗**：可實現系統級功能（always-on-top、窗口管理）
- ✅ **開發效率**：可直接重用現有 HTML/CSS/JavaScript 代碼

### 影響
- 應用程式變為獨立的桌面軟體
- 檔案大小增加（~100MB）
- 獲得更多系統權限和 API

---

## TDR-002: 使用 Google Apps Script 作為後端

### 背景
需要一個簡單、免費的後端服務來處理數據存儲和檢索。

### 考慮的選項
1. **Google Apps Script**：無服務器腳本平台
2. **Firebase**：Google 的後端服務
3. **Node.js + Express**：自建後端服務
4. **Supabase**：開源 Firebase 替代品

### 決策
選擇 **Google Apps Script + Google Sheets**。

### 理由
- ✅ **零成本**：完全免費使用
- ✅ **簡單部署**：一鍵部署為 Web App
- ✅ **無需維護**：Google 管理基礎設施
- ✅ **直接整合**：與 Google Sheets 無縫連接
- ✅ **JSONP 支援**：可處理跨域請求

### 影響
- 數據存儲在 Google Sheets 中
- API 請求需要使用 JSONP 格式
- 受 Google Apps Script 執行時間限制（6分鐘）

---

## TDR-003: 實施活動分類系統

### 背景
用戶希望能夠追蹤不同類型的活動，而非只是總時間。

### 考慮的選項
1. **預設分類**：固定的活動類別
2. **自定義分類**：用戶可自行添加類別
3. **標籤系統**：多標籤支援
4. **階層式分類**：父子關係的分類結構

### 決策
選擇 **預設分類** 系統。

### 理由
- ✅ **簡單實施**：UI 和邏輯較簡單
- ✅ **用戶友好**：無需額外配置
- ✅ **一致性**：所有用戶使用相同分類標準
- ✅ **快速選擇**：點擊即可選擇，無需輸入

### 分類列表
- 🎮 遊戲
- 📺 YouTube  
- 🔍 查資料
- 📝 編寫文件
- 📚 學習
- ⭐ 其他

### 影響
- Google Sheets 需要新增 "活動類別" 欄位
- UI 需要添加分類選擇器
- 統計數據按分類分組顯示

---

## TDR-004: 設計迷你模式功能

### 背景
用戶希望計時時能夠縮小應用程式窗口，避免干擾工作但仍能看到剩餘時間。

### 考慮的選項
1. **系統托盤**：縮小到系統托盤
2. **浮動窗口**：小型浮動窗口
3. **任務欄預覽**：顯示在任務欄
4. **桌面小工具**：桌面 widget 形式

### 決策
選擇 **小型浮動窗口** (160x60 像素)。

### 理由
- ✅ **即時可見**：無需點擊即可看到時間
- ✅ **不干擾**：尺寸小，位於右上角
- ✅ **易操作**：點擊即可回到正常模式
- ✅ **跨平台**：所有平台都支援

### 技術實現
- 使用 `setBounds()` 調整窗口大小
- `setAlwaysOnTop(true)` 保持在最上層
- CSS 切換顯示不同界面
- IPC 通信協調主進程和渲染進程

### 影響
- 窗口最小尺寸需要動態調整
- 需要兩套 UI：正常模式和迷你模式
- 增加 IPC 通信複雜度

---

## TDR-005: 實施智能窗口攔截機制

### 背景
用戶希望在計時過程中誤點關閉或最小化按鈕時，不會中斷計時，而是進入迷你模式。

### 考慮的選項
1. **禁用按鈕**：計時時禁用關閉/最小化按鈕
2. **確認對話框**：彈出確認是否真的要關閉
3. **智能攔截**：自動轉為迷你模式
4. **無操作**：保持默認行為

### 決策
選擇 **智能攔截** 機制。

### 理由
- ✅ **用戶友好**：符合用戶直覺，不需要學習新行為
- ✅ **防止誤操作**：避免意外中斷計時
- ✅ **一致體驗**：與自動迷你模式行為一致
- ✅ **透明操作**：用戶感覺窗口管理更"智能"

### 技術實現
```javascript
// 攔截關閉事件
mainWindow.on('close', (event) => {
  if (!isMinimized) {
    event.preventDefault();
    mainWindow.webContents.send('check-timer-status');
  }
});

// 攔截最小化事件  
mainWindow.on('minimize', (event) => {
  if (!isMinimized) {
    event.preventDefault();
    mainWindow.webContents.send('check-timer-status');
  }
});
```

### 影響
- 需要增加 IPC 通信來檢查計時狀態
- 正常情況下（未計時）保持原有行為
- 計時中的用戶體驗更加順暢

---

## 架構決策總結

### 技術棧
- **前端**：HTML5 + CSS3 + JavaScript (Vanilla)
- **桌面框架**：Electron
- **後端**：Google Apps Script
- **數據庫**：Google Sheets
- **本地存儲**：localStorage
- **通信**：JSONP + IPC

### 設計原則
1. **用戶體驗優先**：所有決策都以提升用戶體驗為目標
2. **簡單可靠**：選擇成熟、穩定的技術方案
3. **零成本運營**：使用免費服務，降低維護成本
4. **跨平台兼容**：確保所有主流平台都能正常使用

### 未來考慮
- **自定義分類**：可考慮添加用戶自定義活動分類
- ~~**數據導出**：提供 CSV/Excel 導出功能~~ ✅ v1.1.0 已實施
- ~~**快捷鍵**：添加全局快捷鍵支援~~ ✅ v1.1.0 已實施
- **多語言**：國際化支援
- ~~**主題系統**：深色模式等主題選項~~ ✅ v1.1.0 已實施

---

## TDR-006: v1.1.0 功能擴展與問題修復

### 背景
在 v1.0.0 基礎功能穩定後，用戶回饋了幾個關鍵問題：
1. 無法正常關閉應用程式
2. 計時後無法縮放窗口
3. 迷你模式大小異常
4. 缺乏進階功能（數據導出、圖表、快捷鍵）

### 決策
實施 v1.1.0 大版本更新，包含功能擴展和關鍵問題修復。

### 實施內容

#### 🆕 新功能實現
1. **全局快捷鍵系統**
   - `Ctrl+Space`：快速開始/暫停計時
   - `Ctrl+Shift+M`：切換迷你模式
   - `Ctrl+Shift+R`：重置計時器
   - 使用 Electron globalShortcut API
   - 應用程式選單整合

2. **數據導出功能**
   - CSV/JSON 格式支援
   - 今日/本週/全部數據範圍
   - 模態對話框操作介面
   - 客戶端 Blob API 實現檔案下載

3. **統計圖表系統**
   - HTML5 Canvas 繪製
   - 今日活動分佈餅圖
   - 用戶使用時間對比長條圖
   - 動態主題色彩適配

4. **深色模式主題**
   - CSS 變數驅動的主題系統
   - 跟隨系統主題自動切換
   - 設定持久化儲存
   - 完整 UI 元件適配

#### 🐛 關鍵問題修復
1. **智能窗口關閉機制**
   ```javascript
   // 問題：所有關閉都被攔截
   // 解決：根據計時狀態智能處理
   if (isTimerRunning) {
     mainWindow.hide(); // 計時中：隱藏到托盤
   } else {
     forceQuit = true;  // 沒計時：真正退出
     app.quit();
   }
   ```

2. **窗口尺寸管理**
   ```javascript
   // 問題：最小尺寸設置衝突
   // 解決：統一尺寸標準
   // 正常模式：minSize 400x500
   // 迷你模式：minSize 160x60
   ```

3. **迷你模式尺寸修復**
   ```javascript
   // 問題：設置順序錯誤
   // 解決：先設最小尺寸，後設實際尺寸
   mainWindow.setMinimumSize(160, 60);
   mainWindow.setBounds({width: 160, height: 60});
   // 添加驗證和強制修正機制
   ```

### 技術選擇

#### 全局快捷鍵
- **選擇**：Electron globalShortcut API
- **原因**：系統級註冊，應用背景運行時也能響應
- **替代方案**：瀏覽器 keydown 事件（僅應用焦點時有效）

#### 圖表渲染
- **選擇**：HTML5 Canvas 原生實現
- **原因**：輕量級，無外部依賴，完全自定義
- **替代方案**：Chart.js（增加檔案大小）

#### 主題系統
- **選擇**：CSS 變數 + data attribute
- **原因**：性能好，易於維護，支援即時切換
- **替代方案**：CSS class 切換（需要重複定義樣式）

#### 檔案導出
- **選擇**：客戶端 Blob API
- **原因**：無需後端支援，即時生成
- **替代方案**：後端生成（增加複雜度）

### 實施結果
- ✅ 所有回饋問題已修復
- ✅ 用戶體驗顯著提升
- ✅ 功能完整性大幅增強
- ✅ 技術架構保持簡潔

### 影響評估
- **正面影響**：
  - 解決了所有關鍵可用性問題
  - 提供了豐富的進階功能
  - 建立了穩定的技術基礎
  - 實現跨平台分發能力
- **考慮事項**：
  - 應用程式大小略有增加
  - 複雜度提升，需要更多測試

---

## TDR-007: 應用程式打包與分發

### 背景
用戶希望能夠將應用程式打包成可執行檔案，在其他電腦上免安裝使用，不需要透過命令列啟動。

### 決策
使用 **electron-builder** 建立跨平台可執行檔案。

### 實施內容

#### 📦 打包配置
- **Windows**: 可攜式 .exe 檔案 (portable target)
- **Linux**: AppImage 格式
- **macOS**: DMG 安裝包 (配置但需在 macOS 環境建置)

#### 🔧 技術實現
```json
{
  "build": {
    "appId": "com.example.timecalculator",
    "productName": "時間計算器",
    "win": {
      "target": [{"target": "portable", "arch": ["x64"]}],
      "certificateFile": null,
      "certificatePassword": null,
      "sign": null
    }
  }
}
```

#### 🚀 建置流程
- **Windows 環境**: `npm run build` → 產生 `時間計算器-1.1.0.exe`
- **Linux 環境**: `npm run build` → 產生 `時間計算器-1.1.0.AppImage`
- **跨平台限制**: 需在對應平台環境中建置

### 技術選擇

#### electron-builder vs 其他方案
- **選擇**: electron-builder
- **原因**: 
  - 成熟穩定的 Electron 官方推薦工具
  - 支援多平台打包
  - 豐富的配置選項
  - 活躍的社群支援
- **替代方案**: electron-forge, electron-packager (功能較簡單)

#### 可攜式 vs 安裝包
- **選擇**: 可攜式 (portable)
- **原因**:
  - 免安裝，雙擊即用
  - 不需要管理員權限
  - 適合個人工具類應用
  - 避免註冊表修改
- **替代方案**: NSIS 安裝包 (需要安裝程序)

#### 代碼簽名處理
- **選擇**: 禁用代碼簽名
- **原因**:
  - 避免 Windows 權限問題
  - 個人專案無需付費憑證
  - 簡化建置流程
- **影響**: Windows 可能顯示"未知發行者"警告

### 實施結果
- ✅ 成功配置 electron-builder
- ✅ Windows 可攜式 .exe 建置流程確立
- ✅ Linux AppImage 成功建立
- ✅ 解決代碼簽名權限問題
- ✅ 建立跨平台分發能力

### 使用體驗
- **Windows**: 下載 .exe 檔案，雙擊即可執行
- **Linux**: 下載 AppImage 檔案，賦予執行權限後雙擊執行
- **檔案大小**: 約 100-150MB (包含 Electron 運行時)
- **啟動速度**: 2-3 秒 (冷啟動)

---

## TDR-008: Google Sheets 連動問題修復

### 背景
應用程式在啟動時無法正常載入Google Sheets中的今日使用記錄，導致統計數據顯示不正確。

### 問題診斷
經過檢查發現主要問題在於 `renderer.js:339` 存在JavaScript語法錯誤：
```javascript
// 錯誤的CSS選擇器語法
const range = document.querySelector('input[name="export-range']:checked').value;
//                                                             ↑ 缺少結尾括號
```

### 決策
修復JavaScript語法錯誤並增強調試機制。

### 實施內容

#### 🐛 問題修復
1. **CSS選擇器語法修復**
   ```javascript
   // 修復前：缺少括號
   const range = document.querySelector('input[name="export-range']:checked').value;
   
   // 修復後：完整語法
   const range = document.querySelector('input[name="export-range"]:checked').value;
   ```

2. **增強調試日誌**
   - 在主進程的 `fetchGoogleScript()` 函數中加入詳細的請求/響應日誌
   - 在渲染進程的 `loadDataFromSheets()` 函數中加入完整的調試輸出
   - 設置 `maxRedirects: 5` 確保Google Apps Script重定向正常處理

#### ✅ 驗證結果
修復後的連動測試顯示：
```
=== 發送請求到 Google Apps Script ===
URL: https://script.google.com/macros/s/AKfycbx.../exec?action=getTodayTotal&date=2025%2F06%2F28
=== 響應狀態 ===
Status: 200
Data: {
  result: 'success',
  user1Total: 5400,    // 品瑜: 90分鐘
  user2Total: 9300,    // 品榕: 155分鐘
  user1Sessions: 5,
  user2Sessions: 8
}
```

### 技術選擇

#### 調試策略
- **選擇**: 增加詳細的console.log輸出
- **原因**: JavaScript語法錯誤會阻止後續代碼執行，詳細日誌有助於快速定位問題
- **替代方案**: 使用try-catch捕獲（無法捕獲語法錯誤）

#### 錯誤處理增強
- **選擇**: 保留原有的三層錯誤處理（本地備份、網路請求失敗、解析錯誤）
- **原因**: 確保應用程式在各種網路環境下都能正常運作
- **改進**: 更明確的錯誤提示訊息

### 實施結果
- ✅ Google Sheets讀取功能完全恢復
- ✅ 今日使用統計正確顯示
- ✅ 雲端同步功能正常運作
- ✅ 調試機制完善，便於未來問題排查

### 影響評估
- **正面影響**:
  - 核心功能恢復正常
  - 用戶數據準確同步
  - 建立了更好的調試基礎
- **無負面影響**: 純粹的錯誤修復，不影響其他功能

---

## TDR-009: Git 版本控制系統建立

### 背景
為了更好地管理專案代碼、追蹤變更歷史和實現雲端備份，需要建立完整的Git版本控制系統。

### 決策
建立基於Git的版本控制工作流程，連接GitHub進行雲端代碼託管。

### 實施內容

#### 📋 Git倉庫初始化
1. **本地倉庫建立**
   ```bash
   git init                    # 初始化Git倉庫
   git branch -M main          # 設置主分支為main
   ```

2. **忽略檔案配置**
   - 創建 `.gitignore` 檔案
   - 排除 `node_modules/`, `dist/`, `package-lock.json` 等不需要版本控制的檔案
   - 排除系統檔案和編輯器配置檔案

3. **用戶配置**
   ```bash
   git config --global user.name "lingoota"
   git config --global user.email "lingoota@msn.com"
   ```

#### 🚀 初始提交
- **提交範圍**: 13個核心檔案
  - 應用程式主要代碼 (`main.js`, `src/`)
  - 配置檔案 (`package.json`)
  - 文檔檔案 (`*.md`)
  - 設定檔案 (`.gitignore`)

- **提交訊息格式**: 採用結構化提交訊息
  ```
  Initial commit: 電腦使用時間追蹤計時器應用
  
  - 功能列表
  - 🤖 Generated with [Claude Code](https://claude.ai/code)
  - Co-Authored-By: Claude <noreply@anthropic.com>
  ```

#### 🌐 GitHub整合
1. **遠端倉庫連接**
   ```bash
   git remote add origin https://github.com/lingoota/timer-app.git
   ```

2. **雲端備份準備**
   - 配置完成，等待用戶手動推送
   - 提供推送指令: `git push -u origin main`

### 技術選擇

#### Git vs 其他版本控制
- **選擇**: Git
- **原因**: 
  - 業界標準，生態系統完整
  - 分散式架構，本地完整歷史
  - GitHub整合度最高
  - 豐富的工具支援
- **替代方案**: SVN, Mercurial (使用率較低)

#### GitHub vs 其他託管平台
- **選擇**: GitHub
- **原因**:
  - 最大的開源社群
  - 免費私人倉庫
  - 優秀的Web界面
  - 豐富的CI/CD整合
- **替代方案**: GitLab, Bitbucket (功能相似)

#### .gitignore 策略
- **選擇**: 排除所有建置產物和依賴
- **原因**:
  - 減少倉庫大小
  - 避免平台特定檔案衝突
  - 專注於源代碼版本控制
- **包含**: 源代碼、配置、文檔
- **排除**: node_modules, dist, logs, 系統檔案

### 實施結果
- ✅ Git倉庫成功初始化
- ✅ 完整的 `.gitignore` 配置
- ✅ 初始提交包含所有核心檔案
- ✅ GitHub遠端倉庫連接就緒
- ✅ 建立標準化的版本控制工作流程

### 未來工作流程
```bash
# 日常開發流程
git add .                           # 暫存變更
git commit -m "描述變更內容"        # 提交變更
git push                           # 推送到GitHub

# 查看歷史
git log --oneline                  # 查看提交歷史
git status                         # 查看當前狀態
```

### 影響評估
- **正面影響**:
  - 建立完整的代碼歷史追蹤
  - 實現雲端代碼備份
  - 支援多人協作開發
  - 便於版本發布管理
- **維護成本**: 極低，只需要定期提交變更