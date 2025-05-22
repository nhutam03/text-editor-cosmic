# Cosmic Text Editor - Build & Distribution Guide

## 📋 Tổng quan

Cosmic Text Editor là một ứng dụng desktop được xây dựng bằng Electron, React, và TypeScript. Ứng dụng hỗ trợ:

- ✅ Text editing với Monaco Editor
- ✅ Plugin system với Firebase Storage
- ✅ AI Assistant tích hợp
- ✅ File management
- ✅ Code execution (JavaScript, Python, TypeScript, C++)
- ✅ Export to PDF
- ✅ Spell checking
- ✅ Syntax highlighting

## 🛠️ Yêu cầu hệ thống

### Để phát triển:
- Node.js 18+ 
- npm hoặc yarn
- Windows 10/11 (để build Windows installer)

### Để chạy ứng dụng:
- Windows 10/11
- 4GB RAM (khuyến nghị 8GB+)
- 500MB dung lượng trống

## 🚀 Cách build ứng dụng

### 1. Build đầy đủ (khuyến nghị)
```powershell
.\build-release.ps1
```

Script này sẽ:
- Dọn dẹp build cũ
- Cài đặt dependencies
- Build ứng dụng
- Tạo installer
- Test ứng dụng

### 2. Build nhanh
```powershell
.\quick-build.ps1
```

### 3. Build thủ công
```bash
# Dọn dẹp
npm run clean

# Cài đặt dependencies
npm install

# Build ứng dụng
npm run build
npm run build-electron

# Tạo installer
npx electron-builder --win --config electron-builder-config.json
```

## 📁 Cấu trúc output

Sau khi build thành công, bạn sẽ có:

```
release-test/
├── Cosmic Text Editor Setup 0.0.0.exe    # Installer (154MB)
├── win-unpacked/                          # Ứng dụng đã giải nén
│   ├── Cosmic Text Editor.exe            # File thực thi chính
│   └── resources/                        # Resources và dependencies
└── latest.yml                           # Metadata cho auto-updater
```

## 📦 Distribution

### Installer
- **File**: `Cosmic Text Editor Setup 0.0.0.exe`
- **Kích thước**: ~154MB
- **Loại**: NSIS installer
- **Tính năng**:
  - Cho phép chọn thư mục cài đặt
  - Tạo shortcut trên Desktop
  - Tạo shortcut trong Start Menu
  - Uninstaller tự động

### Portable Version
- **Thư mục**: `release-test/win-unpacked/`
- **File chính**: `Cosmic Text Editor.exe`
- **Ưu điểm**: Không cần cài đặt, chạy trực tiếp

## 🔧 Cấu hình build

### Electron Builder Config
File cấu hình chính: `electron-builder-config.json`

```json
{
  "appId": "com.cosmic.texteditor",
  "productName": "Cosmic Text Editor",
  "win": {
    "target": ["nsis"],
    "icon": "resources/icon.ico",
    "signingHashAlgorithms": null,
    "signAndEditExecutable": false
  }
}
```

### Environment Variables
File `.env` chứa cấu hình Firebase và các settings khác:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=cosmic-text-editor
VITE_PLUGIN_PORT=5001
```

## 🧪 Testing

### Test ứng dụng sau build:
```powershell
# Chạy version unpacked
Start-Process "release-test\win-unpacked\Cosmic Text Editor.exe"

# Hoặc cài đặt và test installer
Start-Process "release-test\Cosmic Text Editor Setup 0.0.0.exe"
```

### Checklist test:
- [ ] Ứng dụng khởi động thành công
- [ ] UI hiển thị đúng
- [ ] Có thể mở/lưu file
- [ ] Plugin system hoạt động
- [ ] AI Assistant hoạt động
- [ ] Code execution hoạt động
- [ ] Export PDF hoạt động

## 🐛 Troubleshooting

### Lỗi thường gặp:

1. **"Process cannot access the file"**
   - Đóng tất cả instance của ứng dụng
   - Xóa thư mục `release-test`
   - Build lại

2. **"Code signing failed"**
   - Đã được fix bằng cách disable code signing
   - Nếu vẫn gặp lỗi, check `electron-builder-config.json`

3. **"Module not found"**
   - Chạy `npm install` lại
   - Xóa `node_modules` và cài lại

## 📝 Notes

- Ứng dụng được build cho Windows x64
- Không có code signing (để đơn giản hóa)
- Firebase config được embed trong build
- Plugin system cần internet để tải plugins từ Firebase

## 🔄 Auto-update

Ứng dụng hỗ trợ auto-update thông qua electron-updater. File `latest.yml` chứa metadata cần thiết.

## 📞 Support

Nếu gặp vấn đề khi build hoặc sử dụng, vui lòng tạo issue trên repository.
