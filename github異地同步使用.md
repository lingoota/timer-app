# GitHub 異地同步使用指南

這是Git分散式版本控制的核心優勢！本文檔詳細說明多設備協作流程。

## 🖥️ 在新電腦上開始工作

### 第1步: 克隆專案
```bash
# 在新電腦上執行
git clone https://github.com/lingoota/timer-app.git
cd timer-app

# 安裝依賴
npm install
```

### 第2步: 確認環境
```bash
git status                    # 檢查狀態
git log --oneline            # 查看版本歷史
npm start                    # 測試應用程式
```

## 🔄 多設備工作流程

### 🏠 在家裡電腦 (電腦A)
```bash
# 1. 先同步最新版本
git pull origin main         # 下載最新變更

# 2. 開發新功能
# ... 修改代碼 ...

# 3. 提交變更
git add .
git commit -m "新增用戶設定頁面"

# 4. 推送到GitHub
git push origin main
```

### 🏢 在公司電腦 (電腦B)  
```bash
# 1. 同步家裡的變更
git pull origin main         # 獲取最新版本

# 2. 繼續開發
# ... 修改代碼 ...

# 3. 提交並推送
git add .
git commit -m "修復設定頁面的bug"
git push origin main
```

## ⚠️ 重要注意事項

### 🔄 同步是關鍵
```bash
# ❌ 錯誤做法：直接開始工作
git add .
git commit -m "新功能"
git push    # 可能失敗！

# ✅ 正確做法：先同步再工作  
git pull origin main         # 先獲取最新版本
# ... 開發工作 ...
git add .
git commit -m "新功能"
git push origin main
```

### 🚨 處理衝突情況

如果兩台電腦同時修改同一個檔案：

```bash
# 推送時可能看到這個錯誤
! [rejected] main -> main (fetch first)
error: failed to push some refs to 'https://github.com/lingoota/timer-app.git'

# 解決步驟：
git pull origin main         # 先拉取遠端變更
# Git會自動合併或提示衝突
# 如果有衝突，手動解決後：
git add .
git commit -m "解決合併衝突"
git push origin main
```

## 📋 實際場景示例

### 場景：你有2台電腦

**今天在家裡電腦：**
```bash
git pull                     # 同步
# 新增了匯出功能
git commit -m "新增CSV匯出功能"
git push
```

**明天在公司電腦：**
```bash
git pull                     # 獲取昨天的匯出功能
# 修復匯出功能的bug
git commit -m "修復CSV格式錯誤" 
git push
```

**晚上回家：**
```bash
git pull                     # 獲取公司修復的bug
# 繼續開發新功能...
```

## 🛠️ 設置新電腦的完整步驟

### 1️⃣ 環境準備
```bash
# 安裝必要工具
# Git (通常已預裝)
# Node.js (從官網下載)

# 設置Git身份
git config --global user.name "lingoota"
git config --global user.email "lingoota@msn.com"
```

### 2️⃣ 克隆專案
```bash
git clone https://github.com/lingoota/timer-app.git
cd timer-app
```

### 3️⃣ 安裝依賴
```bash
npm install                  # 安裝所有依賴套件
npm start                   # 測試運行
```

### 4️⃣ 驗證環境
```bash
git log --oneline           # 應該看到完整的版本歷史
git remote -v              # 確認GitHub連接
```

## 💡 最佳實踐建議

### 📅 每日工作流程
```bash
# 開始工作前
git pull

# 工作中（頻繁提交）
git add .
git commit -m "完成功能X的基礎架構"
git add .  
git commit -m "新增功能X的UI介面"

# 結束工作時
git push
```

### 🔒 備份策略
- **GitHub = 雲端主備份**
- **每台電腦 = 完整副本**
- **每個commit = 時間點備份**

### 📱 團隊協作擴展
如果未來有其他人參與：
```bash
# 邀請協作者到GitHub倉庫
# 每個人都用相同流程：
git clone → git pull → 工作 → git commit → git push
```

## 🔧 常用Git指令參考

### 基本操作
```bash
git status                   # 查看當前狀態
git log --oneline           # 查看提交歷史
git log --graph             # 圖形化歷史
git diff                    # 查看變更差異
```

### 同步操作
```bash
git pull origin main        # 拉取遠端變更
git push origin main        # 推送本地變更
git fetch                   # 僅下載不合併
```

### 分支操作（進階）
```bash
git branch                  # 查看分支
git checkout -b feature     # 創建新分支
git merge feature           # 合併分支
```

## 🚨 緊急情況處理

### 如果推送被拒絕
```bash
git pull origin main        # 先拉取
# 解決任何衝突
git push origin main        # 重新推送
```

### 如果本地檔案遺失
```bash
git clone https://github.com/lingoota/timer-app.git
# 重新獲取完整專案
```

### 如果想回到舊版本
```bash
git log --oneline           # 找到版本號
git checkout [版本號]       # 切換到該版本
git checkout main           # 回到最新版本
```

---

## 📞 技術支援

如果遇到問題，可以：
1. 查看Git官方文檔
2. 檢查GitHub倉庫狀態
3. 使用 `git status` 診斷當前狀況

**記住：Git的設計就是為了讓多人、多設備安全協作！**