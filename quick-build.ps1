# Quick Build Script for Cosmic Text Editor
# This script quickly builds the application without full cleanup

Write-Host "⚡ Quick Build for Cosmic Text Editor..." -ForegroundColor Green

# Build the application
Write-Host "🔨 Building application..." -ForegroundColor Yellow
npm run build

# Build Electron main process
Write-Host "⚡ Building Electron main process..." -ForegroundColor Yellow
npm run build-electron

# Create installer
Write-Host "📱 Creating installer..." -ForegroundColor Yellow
npx electron-builder --win --config electron-builder-config.json

if (Test-Path "release-test\Cosmic Text Editor Setup 0.0.0.exe") {
    Write-Host "✅ Quick build completed!" -ForegroundColor Green
    $installer = Get-ChildItem "release-test\Cosmic Text Editor Setup 0.0.0.exe"
    $sizeInMB = [math]::Round($installer.Length / 1MB, 2)
    Write-Host "📊 Installer: $sizeInMB MB" -ForegroundColor Cyan
} else {
    Write-Host "❌ Build failed!" -ForegroundColor Red
}
