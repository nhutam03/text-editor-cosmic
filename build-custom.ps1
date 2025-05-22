# Script để build ứng dụng Electron với cấu hình tùy chỉnh

# Dừng tất cả các tiến trình Electron
Write-Host "Stopping all Electron processes..." -ForegroundColor Green
Get-Process | Where-Object { $_.ProcessName -like "*electron*" -or $_.ProcessName -like "*Cosmic Text Editor*" } | ForEach-Object { 
    try {
        $_.Kill()
        Write-Host "Killed process: $($_.ProcessName)" -ForegroundColor Yellow
    } catch {
        Write-Host "Failed to kill process: $($_.ProcessName)" -ForegroundColor Red
    }
}

# Đợi một chút để đảm bảo tất cả các tiến trình đã dừng
Start-Sleep -Seconds 2

# Xóa thư mục dist
Write-Host "Cleaning dist directory..." -ForegroundColor Green
npm run clean

# Build lại ứng dụng
Write-Host "Building application..." -ForegroundColor Green
npm run build

# Build Electron
Write-Host "Building Electron..." -ForegroundColor Green
npm run build-electron

# Đóng gói ứng dụng với cấu hình tùy chỉnh
Write-Host "Packaging application with custom config..." -ForegroundColor Green
npx electron-builder --config electron-builder-custom.json --publish never

# Kiểm tra kết quả
if ($LASTEXITCODE -eq 0) {
    Write-Host "Application packaged successfully!" -ForegroundColor Green
    
    # Hiển thị thông tin về file cài đặt
    $installerPath = Get-ChildItem -Path "release-new" -Filter "*.exe" -Recurse | Select-Object -First 1
    
    if ($installerPath) {
        Write-Host "Installer created at: $($installerPath.FullName)" -ForegroundColor Green
        Write-Host "Installer size: $([math]::Round($installerPath.Length / 1MB, 2)) MB" -ForegroundColor Green
    } else {
        Write-Host "Installer file not found in release-new directory." -ForegroundColor Yellow
    }
} else {
    Write-Host "Failed to package application." -ForegroundColor Red
    exit 1
}
