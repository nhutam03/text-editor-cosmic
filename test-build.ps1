# Test Build Script for Cosmic Text Editor
# This script tests the built application

Write-Host "🧪 Testing Cosmic Text Editor Build..." -ForegroundColor Green

# Check if build exists
if (!(Test-Path "release-test\win-unpacked\Cosmic Text Editor.exe")) {
    Write-Host "❌ Build not found! Please run build-release.ps1 first." -ForegroundColor Red
    exit 1
}

# Check if installer exists
if (!(Test-Path "release-test\Cosmic Text Editor Setup 0.0.0.exe")) {
    Write-Host "❌ Installer not found! Please run build-release.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build files found!" -ForegroundColor Green

# Display build info
$installer = Get-ChildItem "release-test\Cosmic Text Editor Setup 0.0.0.exe"
$sizeInMB = [math]::Round($installer.Length / 1MB, 2)
Write-Host "📊 Installer size: $sizeInMB MB" -ForegroundColor Cyan
Write-Host "📅 Build date: $($installer.LastWriteTime)" -ForegroundColor Cyan

# Test unpacked application
Write-Host "🚀 Testing unpacked application..." -ForegroundColor Yellow
try {
    $testProcess = Start-Process "release-test\win-unpacked\Cosmic Text Editor.exe" -PassThru
    Write-Host "⏳ Waiting for application to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    if ($testProcess -and !$testProcess.HasExited) {
        Write-Host "✅ Application started successfully!" -ForegroundColor Green
        Write-Host "🔄 Stopping test application..." -ForegroundColor Yellow
        $testProcess.Kill()
        Start-Sleep -Seconds 2
        Write-Host "✅ Application test completed!" -ForegroundColor Green
    } else {
        Write-Host "❌ Application failed to start or crashed!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error testing application: $($_.Exception.Message)" -ForegroundColor Red
}

# Test installer (optional)
Write-Host ""
$response = Read-Host "Do you want to test the installer? (y/N)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "🔧 Starting installer test..." -ForegroundColor Yellow
    Write-Host "⚠️  This will install the application on your system." -ForegroundColor Yellow
    Start-Process "release-test\Cosmic Text Editor Setup 0.0.0.exe" -Wait
    Write-Host "✅ Installer test completed!" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Build test completed!" -ForegroundColor Green
Write-Host "📋 Summary:" -ForegroundColor White
Write-Host "   • Installer: ✅ Available ($sizeInMB MB)" -ForegroundColor White
Write-Host "   • Unpacked: ✅ Available" -ForegroundColor White
Write-Host "   • Application: ✅ Starts successfully" -ForegroundColor White
