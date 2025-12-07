# Kiro Account Manager 发布脚本
# 用法: .\scripts\release.ps1 -Version "1.3.0" -Notes "更新内容"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [string]$Notes = ""
)

$PublicRepo = "hj01857655/kiro-account-manager"
$PrivateRepo = "hj01857655/kiro-account-manager_dev"
$TagName = "v$Version"

Write-Host "`n========== Kiro Account Manager 发布脚本 ==========" -ForegroundColor Cyan
Write-Host "版本: $TagName" -ForegroundColor Yellow

# 1. 检查 gh 是否登录
Write-Host "`n[1/5] 检查 GitHub CLI..." -ForegroundColor Green
$ghStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 请先运行 'gh auth login' 登录 GitHub" -ForegroundColor Red
    exit 1
}
Write-Host "✓ GitHub CLI 已登录" -ForegroundColor Green

# 2. 检查公开仓库是否已有该 tag
Write-Host "`n[2/5] 检查 tag 是否存在..." -ForegroundColor Green
$existingTags = gh api "repos/$PublicRepo/tags" --jq ".[].name" 2>$null
if ($existingTags -contains $TagName) {
    Write-Host "警告: Tag $TagName 已存在" -ForegroundColor Yellow
    $confirm = Read-Host "是否删除并重新创建? (y/n)"
    if ($confirm -eq "y") {
        Write-Host "删除旧 tag..." -ForegroundColor Yellow
        gh api -X DELETE "repos/$PublicRepo/git/refs/tags/$TagName" 2>$null
        # 同时删除 release
        gh release delete $TagName --repo $PublicRepo --yes 2>$null
        Write-Host "✓ 已删除旧 tag 和 release" -ForegroundColor Green
    } else {
        Write-Host "取消发布" -ForegroundColor Red
        exit 0
    }
}

# 3. 获取公开仓库最新 commit sha
Write-Host "`n[3/5] 获取公开仓库最新 commit..." -ForegroundColor Green
$sha = gh api "repos/$PublicRepo/commits/releases" --jq ".sha"
if (-not $sha) {
    Write-Host "错误: 无法获取公开仓库 commit sha" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Commit SHA: $($sha.Substring(0,7))..." -ForegroundColor Green

# 4. 创建 tag
Write-Host "`n[4/5] 创建 tag $TagName..." -ForegroundColor Green
$result = gh api "repos/$PublicRepo/git/refs" -f ref="refs/tags/$TagName" -f sha="$sha" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 创建 tag 失败" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}
Write-Host "✓ Tag 创建成功" -ForegroundColor Green

# 5. 等待 Actions 开始
Write-Host "`n[5/5] 等待 Actions 启动..." -ForegroundColor Green
Start-Sleep -Seconds 3

$runs = gh run list --repo $PublicRepo -L 1 --json databaseId,status,name | ConvertFrom-Json
if ($runs.Count -gt 0) {
    $runId = $runs[0].databaseId
    Write-Host "✓ Actions 已启动 (Run ID: $runId)" -ForegroundColor Green
    Write-Host "`n查看构建进度:" -ForegroundColor Cyan
    Write-Host "  gh run watch $runId --repo $PublicRepo" -ForegroundColor White
    Write-Host "`n或访问:" -ForegroundColor Cyan
    Write-Host "  https://github.com/$PublicRepo/actions/runs/$runId" -ForegroundColor White
}

Write-Host "`n========== 发布流程已启动 ==========" -ForegroundColor Cyan
Write-Host "构建完成后会自动创建 Release" -ForegroundColor Yellow
Write-Host "Release 页面: https://github.com/$PublicRepo/releases" -ForegroundColor Yellow

# 如果提供了 notes，等构建完成后更新
if ($Notes) {
    Write-Host "`n提示: 构建完成后运行以下命令更新 Release Notes:" -ForegroundColor Cyan
    Write-Host "  gh release edit $TagName --repo $PublicRepo --notes `"$Notes`"" -ForegroundColor White
}
