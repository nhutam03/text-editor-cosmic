# Script để build ứng dụng Electron từ đầu

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

# Tạo thư mục build mới
$buildDir = "build-fresh"
if (Test-Path -Path $buildDir) {
    Write-Host "Removing existing build directory..." -ForegroundColor Green
    Remove-Item -Path $buildDir -Recurse -Force
}

# Tạo thư mục build mới
Write-Host "Creating new build directory..." -ForegroundColor Green
New-Item -Path $buildDir -ItemType Directory | Out-Null

# Sao chép các file cần thiết vào thư mục build
Write-Host "Copying necessary files to build directory..." -ForegroundColor Green
Copy-Item -Path "src" -Destination "$buildDir/src" -Recurse
Copy-Item -Path "public" -Destination "$buildDir/public" -Recurse
Copy-Item -Path "resources" -Destination "$buildDir/resources" -Recurse
Copy-Item -Path "package.json" -Destination "$buildDir/package.json"
Copy-Item -Path "package-lock.json" -Destination "$buildDir/package-lock.json"
Copy-Item -Path "tsconfig.json" -Destination "$buildDir/tsconfig.json"
Copy-Item -Path "tsconfig.electron.json" -Destination "$buildDir/tsconfig.electron.json"
Copy-Item -Path "vite.config.ts" -Destination "$buildDir/vite.config.ts"
Copy-Item -Path "main.ts" -Destination "$buildDir/main.ts"
Copy-Item -Path "preload.js" -Destination "$buildDir/preload.js"
Copy-Item -Path ".env" -Destination "$buildDir/.env"
Copy-Item -Path "postcss.config.js" -Destination "$buildDir/postcss.config.js"
Copy-Item -Path "tailwind.config.js" -Destination "$buildDir/tailwind.config.js"

# Di chuyển vào thư mục build
Set-Location -Path $buildDir

# Cài đặt dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
npm install

# Xóa thư mục dist nếu tồn tại
if (Test-Path -Path "dist") {
    Write-Host "Removing dist directory..." -ForegroundColor Green
    Remove-Item -Path "dist" -Recurse -Force
}

# Build ứng dụng
Write-Host "Building application..." -ForegroundColor Green
npm run build

# Build Electron
Write-Host "Building Electron..." -ForegroundColor Green
npm run build-electron

# Đóng gói ứng dụng
Write-Host "Packaging application..." -ForegroundColor Green
npx electron-builder --publish never

# Kiểm tra kết quả
if ($LASTEXITCODE -eq 0) {
    Write-Host "Application packaged successfully!" -ForegroundColor Green
    
    # Hiển thị thông tin về file cài đặt
    $installerPath = Get-ChildItem -Path "release" -Filter "*.exe" -Recurse | Select-Object -First 1
    
    if ($installerPath) {
        Write-Host "Installer created at: $($installerPath.FullName)" -ForegroundColor Green
        Write-Host "Installer size: $([math]::Round($installerPath.Length / 1MB, 2)) MB" -ForegroundColor Green
        
        # Sao chép file cài đặt vào thư mục gốc
        $destPath = "../$($installerPath.Name)"
        Copy-Item -Path $installerPath.FullName -Destination $destPath
        Write-Host "Installer copied to: $destPath" -ForegroundColor Green
    } else {
        Write-Host "Installer file not found in release directory." -ForegroundColor Yellow
    }
} else {
    Write-Host "Failed to package application." -ForegroundColor Red
}

# Quay lại thư mục gốc
Set-Location -Path ".."
