# 🚀 版本發布指南

此文檔說明如何進行應用程式的版本控制和封裝發布。

## 📋 版本策略

### 版本編號格式：`主版本.次版本.修正版本`
- **主版本 (Major)**：重大功能變更或不相容更新
- **次版本 (Minor)**：新功能增加，向下相容
- **修正版本 (Patch)**：錯誤修復和小改進

### 目前版本：v1.2.0
- v1.0.0: 初始版本
- v1.1.0: 用戶選擇功能實作
- v1.2.0: 修復DOM元素引用錯誤，完善用戶切換功能

## 🔄 發布流程

### 1️⃣ 開發完成
```bash
# 確保所有變更已提交
git status
git add .
git commit -m "feat: 新功能描述"
```

### 2️⃣ 版本更新
```bash
# 自動更新版本號並提交
npm version patch  # 修正版本 (1.2.0 → 1.2.1)
npm version minor  # 次版本 (1.2.0 → 1.3.0)  
npm version major  # 主版本 (1.2.0 → 2.0.0)
```

### 3️⃣ 建置封裝
```bash
# 建置 Windows 可執行檔
npm run build

# 或者建置所有平台
npm run dist
```

### 4️⃣ 推送到遠端
```bash
# 推送程式碼和標籤
git push origin main
git push origin --tags
```

## 📦 封裝輸出

建置完成後，封裝檔案位於：
```
dist/
├── time-calculator-1.2.0.exe          # Windows 可攜式版本
├── time-calculator-1.2.0-win.zip      # Windows 壓縮檔
└── latest.yml                          # 更新元資料
```

## 🗂️ 版本控制策略

### Git 控制內容
✅ **包含在版本控制**
- 原始碼 (`src/`, `main.js`)
- 配置檔案 (`package.json`, `.gitignore`)
- 文檔 (`*.md`)
- 資源檔案 (如果有 `assets/`)

❌ **不包含在版本控制**
- 建置產物 (`dist/`, `build/`)
- 依賴套件 (`node_modules/`)
- 日誌檔案 (`*.log`)

### GitHub Releases
可以將封裝檔案上傳到 GitHub Releases：
1. 在 GitHub 頁面建立新的 Release
2. 選擇對應的 Git 標籤 (如 `v1.2.0`)
3. 上傳 `dist/` 中的封裝檔案
4. 撰寫發布說明

## 🔄 自動化發布 (進階)

可以使用 GitHub Actions 自動化建置：

```yaml
# .github/workflows/release.yml
name: Build and Release
on:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

## 📋 發布檢查清單

### 發布前確認
- [ ] 所有功能測試通過
- [ ] 版本號已更新
- [ ] CHANGELOG.md 已更新
- [ ] Git 標籤已建立

### 發布後確認  
- [ ] 封裝檔案可正常執行
- [ ] GitHub 遠端已更新
- [ ] 使用者可以下載新版本

## 🏷️ Git 標籤管理

```bash
# 查看所有標籤
git tag

# 查看特定標籤資訊
git show v1.2.0

# 刪除本地標籤
git tag -d v1.2.0

# 刪除遠端標籤
git push origin --delete v1.2.0
```

## 📈 版本歷史追蹤

每個版本都有完整的 Git 記錄：
- 原始碼變更
- 功能增加/修復
- 建置配置更新
- 文檔更新

這確保可以：
- 🔙 **回退到任何版本**
- 🔍 **追蹤特定功能的開發歷程**  
- 🐛 **快速定位問題出現的版本**
- 📊 **分析開發進度和週期**

---

**記住：版本控制不僅是備份，更是專案管理和協作的核心工具！**