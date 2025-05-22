# Build Release Script for Cosmic Text Editor
# This script builds and packages the application for distribution

Write-Host "🚀 Starting Cosmic Text Editor Release Build..." -ForegroundColor Green

# Step 1: Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
npm run clean
if (Test-Path "release-test") {
    Remove-Item -Path "release-test" -Recurse -Force -ErrorAction SilentlyContinue
}

# Step 2: Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Step 3: Build the application
Write-Host "🔨 Building application..." -ForegroundColor Yellow
npm run build

# Step 4: Build Electron main process
Write-Host "⚡ Building Electron main process..." -ForegroundColor Yellow
npm run build-electron

# Step 5: Create installer
Write-Host "📱 Creating installer..." -ForegroundColor Yellow
npx electron-builder --win --config electron-builder-config.json

# Step 6: Check results
if (Test-Path "release-test\Cosmic Text Editor Setup 0.0.0.exe") {
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    Write-Host "📁 Installer location: release-test\Cosmic Text Editor Setup 0.0.0.exe" -ForegroundColor Cyan
    
    # Get file size
    $installer = Get-ChildItem "release-test\Cosmic Text Editor Setup 0.0.0.exe"
    $sizeInMB = [math]::Round($installer.Length / 1MB, 2)
    Write-Host "📊 Installer size: $sizeInMB MB" -ForegroundColor Cyan
    
    # Test the unpacked application
    Write-Host "🧪 Testing unpacked application..." -ForegroundColor Yellow
    $testProcess = Start-Process "release-test\win-unpacked\Cosmic Text Editor.exe" -PassThru
    Start-Sleep -Seconds 3
    
    if ($testProcess -and !$testProcess.HasExited) {
        Write-Host "✅ Application test successful!" -ForegroundColor Green
        Write-Host "🔄 Stopping test application..." -ForegroundColor Yellow
        $testProcess.Kill()
    } else {
        Write-Host "❌ Application test failed!" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "🎉 Release build completed!" -ForegroundColor Green
    Write-Host "📋 Summary:" -ForegroundColor White
    Write-Host "   • Installer: release-test\Cosmic Text Editor Setup 0.0.0.exe ($sizeInMB MB)" -ForegroundColor White
    Write-Host "   • Unpacked: release-test\win-unpacked\" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 To install the application, run the installer as administrator." -ForegroundColor Cyan
    
} else {
    Write-Host "❌ Build failed! Installer not found." -ForegroundColor Red
    exit 1
}
