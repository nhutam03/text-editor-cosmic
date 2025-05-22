# Hướng dẫn Build và Triển khai Cosmic Text Editor

Tài liệu này hướng dẫn cách build và triển khai Cosmic Text Editor thành ứng dụng desktop.

## Yêu cầu

- Node.js 14.0 trở lên
- npm 6.0 trở lên
- Git

## Bước 1: Chuẩn bị môi trường

### 1.1. Clone repository

```bash
git clone <repository-url>
cd text-editor-app
```

### 1.2. Cài đặt dependencies

```bash
npm install
```

## Bước 2: Cấu hình Firebase

### 2.1. Tạo file .env

Tạo file `.env` trong thư mục `text-editor-app` với nội dung:

```
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com  # Phải sử dụng định dạng .appspot.com, KHÔNG phải .firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id

# Plugin Configuration
VITE_PLUGIN_PORT=5000

# Application Settings
VITE_APP_NAME=Cosmic
VITE_APP_VERSION=1.0.0
```

## Bước 3: Triển khai AI Proxy Functions

### 3.1. Cài đặt Firebase CLI

```bash
npm install -g firebase-tools
```

### 3.2. Đăng nhập vào Firebase

```bash
firebase login
```

### 3.3. Di chuyển đến thư mục AI Proxy Functions

```bash
cd ../ai-proxy-functions
```

### 3.4. Cài đặt dependencies

```bash
npm install
```

### 3.5. Thiết lập biến môi trường cho API key Gemini

```bash
firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"
```

### 3.6. Triển khai functions

```bash
firebase deploy --only functions
```

Sau khi triển khai, bạn sẽ nhận được URL của function, ví dụ:
```
https://us-central1-cosmic-text-editor.cloudfunctions.net/geminiProxy
```

## Bước 4: Cập nhật và đóng gói AI Assistant Plugin

### 4.1. Cập nhật URL proxy trong plugin

Mở file `plugins/ai-assistant/src/index.ts` và cập nhật URL proxy:

```typescript
const proxyUrl = 'https://us-central1-cosmic-text-editor.cloudfunctions.net/geminiProxy';
```

### 4.2. Build plugin

```bash
cd ../plugins/ai-assistant
npm install
npm run build
```

### 4.3. Đóng gói plugin

```bash
node package-plugin.js
```

### 4.4. Tải plugin lên Firebase Storage

```bash
node upload-to-firebase.js
```

## Bước 5: Build ứng dụng desktop

### 5.1. Quay lại thư mục text-editor-app

```bash
cd ../../text-editor-app
```

### 5.2. Build ứng dụng

```bash
npm run dist
```

Sau khi build, bạn sẽ tìm thấy file cài đặt trong thư mục `release`:

- Windows: `release/Cosmic Text Editor Setup x.x.x.exe`
- macOS: `release/Cosmic Text Editor-x.x.x.dmg`
- Linux: `release/cosmic-text-editor-x.x.x.AppImage`

## Bước 6: Ký số ứng dụng (tùy chọn)

Để tránh cảnh báo bảo mật trên Windows, bạn nên ký số ứng dụng:

### 6.1. Mua chứng chỉ code signing

Mua chứng chỉ code signing từ nhà cung cấp tin cậy như DigiCert, Comodo, v.v.

### 6.2. Cấu hình electron-builder để ký ứng dụng

Thêm cấu hình sau vào `package.json`:

```json
"build": {
  "win": {
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "password"
  }
}
```

### 6.3. Build lại ứng dụng

```bash
npm run dist
```

## Bước 7: Phân phối ứng dụng

### 7.1. Tạo trang web phân phối

Tạo trang web đơn giản để phân phối ứng dụng, bao gồm:
- Link tải xuống
- Hướng dẫn cài đặt
- Thông tin phiên bản
- Yêu cầu hệ thống

### 7.2. Tải file cài đặt lên trang web

Tải file cài đặt từ thư mục `release` lên trang web phân phối.

## Xử lý sự cố

### Lỗi build

Nếu gặp lỗi khi build, hãy thử:

```bash
npm run clean
npm install
npm run dist
```

### Lỗi khi chạy ứng dụng

Kiểm tra log tại:
- Windows: `%USERPROFILE%\AppData\Roaming\Cosmic Text Editor\logs`
- macOS: `~/Library/Logs/Cosmic Text Editor`
- Linux: `~/.config/Cosmic Text Editor/logs`
