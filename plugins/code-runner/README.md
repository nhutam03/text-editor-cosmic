# Code Runner Plugin

Plugin chạy code cho Text Editor, hỗ trợ nhiều ngôn ngữ lập trình khác nhau.

## Tính năng

- Chạy code trực tiếp từ editor
- Hỗ trợ nhiều ngôn ngữ: JavaScript, Python, TypeScript, C++, C, Java, HTML
- Hiển thị kết quả trong terminal tích hợp
- Dừng quá trình chạy code bất cứ lúc nào
- Tích hợp trình biên dịch cho C/C++ (đang phát triển)

## Cài đặt

Plugin này được cài đặt tự động khi cài đặt Text Editor.

## Sử dụng

1. Mở file code trong editor
2. Nhấn F5 hoặc chọn "Run > Run Code" từ menu
3. Kết quả sẽ hiển thị trong terminal

## Phím tắt

- **F5**: Chạy code
- **Shift+F5**: Dừng chạy code

## Ngôn ngữ được hỗ trợ

| Ngôn ngữ | Phần mở rộng | Yêu cầu |
|----------|--------------|---------|
| JavaScript | .js | Node.js |
| Python | .py | Python |
| TypeScript | .ts | Node.js, ts-node |
| C++ | .cpp, .cc, .cxx | g++ hoặc MinGW |
| C | .c | gcc hoặc MinGW |
| Java | .java | JDK |
| HTML | .html | Trình duyệt mặc định |

## Cài đặt trình biên dịch C/C++

Để chạy code C/C++, bạn cần cài đặt trình biên dịch. Xem hướng dẫn chi tiết trong file [INSTALL_COMPILER.md](./INSTALL_COMPILER.md).

Trong phiên bản tương lai, plugin sẽ tích hợp sẵn trình biên dịch, giúp bạn không cần cài đặt thêm.

## Phát triển

Để phát triển plugin này:

1. Clone repository
2. Cài đặt dependencies: `npm install`
3. Chỉnh sửa code
4. Kiểm tra thay đổi: `npm test`

## Đóng góp

Mọi đóng góp đều được hoan nghênh! Vui lòng tạo issue hoặc pull request.

## Giấy phép

MIT
