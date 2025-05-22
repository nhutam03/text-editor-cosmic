# Dừng tất cả các tiến trình Electron
Write-Host "Stopping all Electron processes..."
Get-Process | Where-Object { $_.ProcessName -like "*electron*" -or $_.ProcessName -like "*Cosmic Text Editor*" } | ForEach-Object { 
    try {
        $_.Kill()
        Write-Host "Killed process: $($_.ProcessName)"
    } catch {
        Write-Host "Failed to kill process: $($_.ProcessName)"
    }
}

# Đợi một chút để đảm bảo tất cả các tiến trình đã dừng
Start-Sleep -Seconds 2

# Xóa thư mục release nếu tồn tại
if (Test-Path -Path "release") {
    Write-Host "Removing release directory..."
    try {
        Remove-Item -Path "release" -Recurse -Force -ErrorAction Stop
        Write-Host "Release directory removed successfully."
    } catch {
        Write-Host "Failed to remove release directory: $_"
        Write-Host "Trying alternative method..."
        
        # Thử phương pháp khác để xóa thư mục
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "rmdir", "/S", "/Q", "release" -Wait
        
        if (Test-Path -Path "release") {
            Write-Host "Failed to remove release directory using alternative method."
            exit 1
        } else {
            Write-Host "Release directory removed successfully using alternative method."
        }
    }
}

# Xóa thư mục dist
Write-Host "Cleaning dist directory..."
npm run clean

# Build lại ứng dụng
Write-Host "Rebuilding application..."
npm run rebuild

# Đóng gói ứng dụng
Write-Host "Packaging application..."
npx electron-builder --config electron-builder-config.json --publish never

# Kiểm tra kết quả
if ($LASTEXITCODE -eq 0) {
    Write-Host "Application packaged successfully!"
    
    # Hiển thị thông tin về file cài đặt
    $installerPath = Get-ChildItem -Path "release" -Filter "*.exe" -Recurse | Select-Object -First 1
    
    if ($installerPath) {
        Write-Host "Installer created at: $($installerPath.FullName)"
        Write-Host "Installer size: $([math]::Round($installerPath.Length / 1MB, 2)) MB"
    } else {
        Write-Host "Installer file not found in release directory."
    }
} else {
    Write-Host "Failed to package application."
    exit 1
}
