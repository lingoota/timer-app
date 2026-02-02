# 設定變數
$version = "2.0.0-beta.8"
$repoOwner = "lingoota"
$repoName = "timer-app"
$tagName = "v$version"

# 從環境變數或命令列參數取得 GitHub token
$token = $env:GITHUB_TOKEN
if (-not $token) {
    Write-Error "請設定 GITHUB_TOKEN 環境變數"
    exit 1
}

# 建立 Release
Write-Host "正在建立 GitHub Release $tagName..."
$releaseBody = @"
## 🎨 重大改進

### ⬇️ 手動檢查更新功能
- **新增「檢查更新」按鈕** - 點擊右上角 ⬇️ 按鈕即可手動檢查更新
- **更穩定可靠** - 取代自動更新,避免不必要的問題
- **完整更新流程** - 發現新版本 → 下載更新 → 安裝提示
- **使用者完全掌控** - 自己決定何時更新,不會被打斷

### 🖼️ 背景圖片 UI 元素優化
- **UI 元素半透明背景** - 所有按鈕、卡片、文字區域加上毛玻璃效果背景
- **完美可讀性** - 背景圖片淡化,UI 元素清晰可見
- **淺色模式** - UI 元素使用白色半透明背景 (15% 不透明度)
- **深色模式** - UI 元素使用黑色半透明背景 (40% 不透明度)
- **毛玻璃效果** - backdrop-filter 模糊效果,現代化 UI 設計

### 🖼️ 背景圖片功能 (延續 beta.6)
- 品瑜和品榕可以各自設定專屬背景圖片
- 支援 PNG 和 JPG 格式
- 最大 5MB 圖片大小
- 右鍵點擊背景按鈕可重置為預設背景
- 切換使用者時自動載入對應背景

### 使用方式
1. 點擊右上角 🖼️ 按鈕選擇背景圖片
2. 點擊右上角 ⬇️ 按鈕檢查更新
3. 右鍵點擊 🖼️ 按鈕可重置背景

## 📦 安裝說明

1. 下載 ``time-calculator-setup-$version.exe``
2. 執行安裝程式
3. 安裝完成後,可使用「檢查更新」功能隨時更新

## 🔧 技術改進

- 手動檢查更新機制,更穩定可靠
- 背景圖片半透明遮罩 (淺色 30%、深色 40%)
- UI 元素獨立半透明背景 + 毛玻璃效果
- 自動偵測深色/淺色模式並套用對應樣式
- 完整的更新下載與安裝 UI 系統

---

🚀 Generated with [Claude Code](https://claude.com/claude-code)
"@

$releaseData = @{
    tag_name = $tagName
    name = "$tagName - 手動檢查更新 + UI 優化"
    body = $releaseBody
    prerelease = $true
} | ConvertTo-Json -Depth 10

$headers = @{
    'Authorization' = "Bearer $token"
    'Accept' = 'application/vnd.github+json'
}

try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repoOwner/$repoName/releases" `
        -Method Post `
        -Headers $headers `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($releaseData)) `
        -ContentType 'application/json; charset=utf-8'

    Write-Host "✅ Release 已建立，ID: $($release.id)"
    $releaseId = $release.id
} catch {
    Write-Error "建立 Release 失敗: $_"
    exit 1
}

# 上傳檔案
$files = @(
    "dist/time-calculator-setup-$version.exe",
    "dist/latest.yml",
    "dist/time-calculator-setup-$version.exe.blockmap"
)

foreach ($file in $files) {
    $fileName = Split-Path $file -Leaf
    Write-Host "正在上傳 $fileName..."

    $uploadUrl = "https://uploads.github.com/repos/$repoOwner/$repoName/releases/$releaseId/assets?name=$fileName"

    try {
        $result = Invoke-RestMethod -Uri $uploadUrl `
            -Method Post `
            -Headers $headers `
            -InFile $file `
            -ContentType 'application/octet-stream'

        Write-Host "  ✅ $fileName 上傳成功 ($(([math]::Round($result.size / 1MB, 2))) MB)"
    } catch {
        Write-Error "上傳 $fileName 失敗: $_"
    }
}

Write-Host ""
Write-Host "🎉 完成！Release URL: $($release.html_url)"
