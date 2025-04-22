# Hướng dẫn cài đặt trình biên dịch C/C++

Để chạy được code C/C++ trong Text Editor, bạn cần cài đặt trình biên dịch C/C++. Dưới đây là hướng dẫn cài đặt cho từng hệ điều hành.

## Windows

### Cài đặt MinGW

1. Tải MinGW từ trang chủ: https://sourceforge.net/projects/mingw/
2. Chạy trình cài đặt và làm theo hướng dẫn
3. Trong quá trình cài đặt, chọn các gói cần thiết: mingw32-base, mingw32-gcc-g++
4. Sau khi cài đặt, thêm đường dẫn đến thư mục bin của MinGW vào biến môi trường PATH (thường là C:\MinGW\bin)
5. Khởi động lại máy tính hoặc ít nhất là khởi động lại terminal

### Cài đặt MSYS2 (Khuyến nghị)

1. Tải MSYS2 từ trang chủ: https://www.msys2.org/
2. Cài đặt MSYS2 và mở MSYS2 terminal
3. Chạy lệnh: `pacman -S mingw-w64-x86_64-gcc`
4. Thêm đường dẫn đến thư mục bin của MinGW vào biến môi trường PATH (thường là C:\msys64\mingw64\bin)

## macOS

### Sử dụng Xcode Command Line Tools

1. Mở Terminal
2. Chạy lệnh: `xcode-select --install`
3. Làm theo hướng dẫn để cài đặt Xcode Command Line Tools

### Sử dụng Homebrew

1. Cài đặt Homebrew (nếu chưa có): `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
2. Cài đặt GCC: `brew install gcc`

## Linux

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install build-essential
```

### Fedora

```bash
sudo dnf install gcc-c++
```

### Arch Linux

```bash
sudo pacman -S gcc
```

## Kiểm tra cài đặt

Sau khi cài đặt, mở terminal/command prompt và chạy lệnh sau để kiểm tra:

```bash
g++ --version
```

Nếu hiển thị phiên bản của g++, bạn đã cài đặt thành công.

## Lưu ý

- Trong phiên bản tương lai, plugin sẽ tích hợp sẵn trình biên dịch, giúp bạn không cần cài đặt thêm.
- Nếu gặp vấn đề trong quá trình cài đặt, vui lòng tham khảo tài liệu chính thức của trình biên dịch hoặc liên hệ hỗ trợ.
