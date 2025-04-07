import * as monaco from 'monaco-editor';

let editor = null;
let isContentCollapsed = false;
let isResizing = false; // Trạng thái đang kéo resizer

// Khởi tạo Monaco Editor
document.addEventListener('DOMContentLoaded', () => {
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: '// Your code here\n',
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        readOnly: false,
        
        
    });

    // Xử lý sự kiện thay đổi kích thước cửa sổ
    window.addEventListener('resize', () => {
        if (editor) {
            editor.layout(); // Cập nhật kích thước của Monaco Editor
        }
    });

    // Xử lý sự kiện click vào các icon trong sidebar
    const sidebarIcons = document.querySelectorAll('#sidebar i[data-lucide]');
    const contentArea = document.getElementById('contentArea');

    sidebarIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            // Chuyển đổi trạng thái thu gọn/mở rộng
            isContentCollapsed = !isContentCollapsed;

            if (isContentCollapsed) {
                // Thu gọn contentArea về 0px
                contentArea.style.width = '0px';
                contentArea.style.padding = '0';
                contentArea.style.overflow = 'hidden';
            } else {
                // Mở rộng contentArea về 300px (hoặc giá trị hiện tại nếu đã kéo)
                contentArea.style.width = contentArea.dataset.defaultWidth || '300px';
                contentArea.style.padding = '2';
                contentArea.style.overflow = 'auto';
            }

            // Cập nhật kích thước của Monaco Editor sau khi thay đổi
            if (editor) {
                editor.layout();
            }
        });
    });

    // Xử lý kéo resizer để điều chỉnh độ rộng của contentArea
    const resizer = document.getElementById('resizer');
    const minWidth = 45; // Độ rộng tối thiểu (tương ứng với sidebar)

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.userSelect = 'none'; // Ngăn chặn chọn văn bản khi kéo
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const sidebar = document.getElementById('sidebar');
        const newWidth = e.clientX - sidebar.offsetWidth;

        if (newWidth >= minWidth) {
            contentArea.style.width = `${newWidth}px`;
            contentArea.dataset.defaultWidth = `${newWidth}px`; // Lưu độ rộng mặc định
        }

        // Cập nhật kích thước của Monaco Editor sau khi kéo
        if (editor) {
            editor.layout();
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.userSelect = 'auto'; // Khôi phục khả năng chọn văn bản
    });

    // Khởi tạo Lucide icons
    lucide.createIcons();
});

// Xử lý sự kiện cho các nút trong sidebar (nếu cần)
document.querySelectorAll('nav button').forEach(button => {
    button.addEventListener('click', () => {
        console.log('Tab clicked:', button.textContent);
    });
});