# Simple Test Script for Cosmic Text Editor

Write-Host "Testing Cosmic Text Editor Build..." -ForegroundColor Green

# Check if build exists
if (Test-Path "release-test\win-unpacked\Cosmic Text Editor.exe") {
    Write-Host "✅ Unpacked application found!" -ForegroundColor Green
} else {
    Write-Host "❌ Unpacked application not found!" -ForegroundColor Red
}

if (Test-Path "release-test\Cosmic Text Editor Setup 0.0.0.exe") {
    Write-Host "Installer found!" -ForegroundColor Green
    $installer = Get-ChildItem "release-test\Cosmic Text Editor Setup 0.0.0.exe"
    $sizeInMB = [math]::Round($installer.Length / 1MB, 2)
    Write-Host "Installer size: $sizeInMB MB" -ForegroundColor Cyan
} else {
    Write-Host "Installer not found!" -ForegroundColor Red
}

Write-Host "Test completed!" -ForegroundColor Green
