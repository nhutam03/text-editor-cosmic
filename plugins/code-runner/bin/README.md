# Trình biên dịch tích hợp cho Code Runner

Thư mục này chứa các trình biên dịch tích hợp cho plugin Code Runner, giúp người dùng có thể chạy code mà không cần cài đặt thêm công cụ bên ngoài.

## Cấu trúc thư mục

```
bin/
  ├── win32/     # Trình biên dịch cho Windows
  ├── darwin/    # Trình biên dịch cho macOS
  └── linux/     # Trình biên dịch cho Linux
```

## Cách tích hợp trình biên dịch

### Cho Windows (MinGW)

1. Tải MinGW Portable từ: https://sourceforge.net/projects/mingw-w64/files/
2. Giải nén và sao chép các file sau vào thư mục `bin/win32/`:
   - `g++.exe`
   - `gcc.exe`
   - Các file DLL cần thiết

### Cho macOS

1. Tạo bản build nhỏ gọn của clang/LLVM
2. Sao chép các file thực thi vào thư mục `bin/darwin/`

### Cho Linux

1. Tạo bản build nhỏ gọn của GCC
2. Sao chép các file thực thi vào thư mục `bin/linux/`

## Lưu ý

- Các trình biên dịch tích hợp nên được đóng gói nhỏ gọn, chỉ bao gồm các thành phần cần thiết
- Đảm bảo các file thực thi có quyền chạy (executable permission)
- Kiểm tra tính tương thích với các phiên bản hệ điều hành khác nhau

## Cách sử dụng trong plugin

Plugin sẽ tự động kiểm tra và sử dụng trình biên dịch tích hợp nếu có, hoặc sử dụng trình biên dịch hệ thống nếu không có trình biên dịch tích hợp.
