# 設定變數
$version = "2.0.0-beta.3"
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
## ✨ 新功能

- 加入完整的自動更新 UI 通知系統
  - 發現新版本時顯示通知卡片
  - 下載進度即時顯示
  - 安裝完成提示

## 🐛 Bug 修復

- **修復按鈕無法點擊的問題** - 移除重複的 DOMContentLoaded 事件監聽器
- 所有按鈕（稍後提醒、下載更新、立即重啟、稍後重啟）現在都能正常運作

## 📦 安裝說明

1. 下載 ``時間計算器 Setup $version.exe``
2. 執行安裝程式
3. 未來版本將自動通知更新

---

🚀 Generated with [Claude Code](https://claude.com/claude-code)
"@

$releaseData = @{
    tag_name = $tagName
    name = "$tagName - 修復自動更新按鈕功能"
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
    "dist/時間計算器 Setup $version.exe",
    "dist/latest.yml",
    "dist/時間計算器 Setup $version.exe.blockmap"
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
