import { app, BrowserWindow, dialog, ipcMain, SaveDialogReturnValue } from 'electron';
import path from 'path';
import fs from 'fs';
import { OpenDialogReturnValue } from 'electron';
import net from 'net';

let selectedFolder: string | null = null;
let mainWindow: BrowserWindow | null = null;
interface Plugin {
    name: string;
    socket: net.Socket;
}

const plugins: Plugin[] = [];
const PORT = 5000;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '../public/logo.ico'),
        autoHideMenuBar: true, // Ẩn thanh menu mặc định
        webPreferences: {
            nodeIntegration: false, // Tắt nodeIntegration
            contextIsolation: true, // Bật contextIsolation cho bảo mật
            preload: path.join(__dirname, '../preload.js'), // Sử dụng preload script
        },
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools(); // Mở DevTools để debug
    } else {
        mainWindow.loadFile(path.join(__dirname, '/index.html'));
    }
    return mainWindow;
}
function startSocketServer() {
    const server = net.createServer((socket) => {
        console.log("Plugin connected");

        socket.on("data", (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === "register-plugin") {
                plugins.push({ name: message.name, socket });
                console.log(`Plugin registered: ${message.name}`);
                mainWindow?.webContents.send("plugin-list", plugins.map((p) => p.name));
            }
        });

        socket.on("end", () => {
            const index = plugins.findIndex((p) => p.socket === socket);
            if (index !== -1) {
                console.log(`Plugin disconnected: ${plugins[index].name}`);
                plugins.splice(index, 1);
                mainWindow?.webContents.send("plugin-list", plugins.map((p) => p.name));
            }
        });

        socket.on("error", (err) => {
            console.error("Socket error:", err);
        });
    });

    server.listen(PORT, "localhost", () => {
        console.log(`Core socket server running on port ${PORT}`);
    });
}

app.whenReady().then(() => {
    createWindow();
    startSocketServer();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // // Handler cho load dictionary
    ipcMain.handle('load-dictionary', async () => {
        const dictPath = path.join(__dirname, 'public', 'en_US.dic');
        try {
            const dictContent = fs.readFileSync(dictPath, 'utf-8');
            return dictContent;
        } catch (error) {
            console.error('Failed to load dictionary:', error);
            return null;
        }
    });

    // Xử lý mở thư mục
    ipcMain.on('open-folder-request', async (event) => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        }) as unknown as OpenDialogReturnValue;

        if (!result.canceled && result.filePaths.length > 0) {
            selectedFolder = result.filePaths[0];
            const structure = readFolderStructure(selectedFolder);
            event.sender.send('folder-structure', { ...structure });
        }
    });

    // Xử lý mở hộp thoại chọn file
    ipcMain.on('open-file-dialog', async (event) => {
        console.log('Received open-file-dialog event');
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                    { name: 'Text Files', extensions: ['txt', 'md', 'js', 'ts', 'html', 'css', 'json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            }) as unknown as OpenDialogReturnValue;

            if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                selectedFolder = path.dirname(filePath);
                const fileName = path.basename(filePath);
                const content = fs.readFileSync(filePath, 'utf-8');
                // Đổi tên sự kiện thành 'file-opened' để phù hợp với App.tsx
                console.log('Sending file-opened event with:', { fileName, contentLength: content.length });
                event.sender.send('file-opened', { content, fileName, filePath });
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to open file';
            event.sender.send('file-opened', { error: errorMessage });
        }
    });

    // Handle opening a file
    ipcMain.on('open-file-request', async (event, fileName: string) => {
        try {
            if (!selectedFolder) {
                throw new Error('No folder selected');
            }
            // Lấy tên file từ đường dẫn được truyền vào
            const fileBaseName = path.basename(fileName);
            const absolutePath = path.join(selectedFolder, fileBaseName);

            // Kiểm tra xem file có tồn tại không
            if (!fs.existsSync(absolutePath)) {
                throw new Error('File does not exist');
            }

            const content = fs.readFileSync(absolutePath, 'utf-8');
            console.log('Sending file content for:', fileBaseName);
            // Gửi cả hai sự kiện để đảm bảo tương thích
            event.sender.send('file-content', { content, filePath: absolutePath, fileName: fileBaseName });
            event.sender.send('file-opened', { content, filePath: absolutePath, fileName: fileBaseName });
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'File not found or inaccessible';
            console.error('Error reading file:', errorMessage);
            // Gửi cả hai sự kiện để đảm bảo tương thích
            event.sender.send('file-content', { error: errorMessage });
            event.sender.send('file-opened', { error: errorMessage });
        }
    });


    // Xử lý lưu file với hộp thoại
    ipcMain.on('save-file-request', async (event, { filePath, content }: { filePath: string, content: string }) => {
        console.log('Received save-file-request for:', filePath);
        try {
            // Determine default extension based on file content or name
            let defaultExtension = 'txt';
            if (filePath) {
                const ext = path.extname(filePath).replace('.', '');
                if (ext) defaultExtension = ext;
            }

            const result = await dialog.showSaveDialog({
                defaultPath: filePath.startsWith('new-file-') ? 'Untitled.txt' : filePath,
                filters: [
                    { name: 'Text Files', extensions: ['txt', 'md'] },
                    { name: 'JavaScript', extensions: ['js', 'jsx'] },
                    { name: 'TypeScript', extensions: ['ts', 'tsx'] },
                    { name: 'HTML', extensions: ['html', 'htm'] },
                    { name: 'CSS', extensions: ['css'] },
                    { name: 'JSON', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
            }) as unknown as SaveDialogReturnValue;

            if (!result.canceled && result.filePath) {
                const absolutePath = result.filePath;
                fs.writeFileSync(absolutePath, content, 'utf-8');
                const fileName = path.basename(absolutePath);
                selectedFolder = path.dirname(absolutePath); // Update selected folder
                event.sender.send('file-saved', { success: true, filePath: fileName, error: undefined });
            } else {
                event.sender.send('file-saved', { success: false, filePath, error: 'Save cancelled by user' });
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to save file';
            event.sender.send('file-saved', { success: false, filePath, error: errorMessage });
        }
    });

    // Xử lý lưu file trực tiếp (không hiển thị hộp thoại)
    ipcMain.on('save-file', async (event, { content, fileName }: { content: string, fileName: string }) => {
        console.log('Received save-file request for:', fileName, 'Content length:', content.length);
        try {
            if (!selectedFolder) {
                // Nếu chưa có thư mục được chọn, hiển thị hộp thoại save
                const result = await dialog.showSaveDialog({
                    defaultPath: fileName || 'Untitled.txt',
                    filters: [{ name: 'Text Files', extensions: ['txt', 'md', 'js', 'ts', 'html', 'css', 'json'] }],
                }) as unknown as SaveDialogReturnValue;

                if (!result.canceled && result.filePath) {
                    const absolutePath = result.filePath;
                    fs.writeFileSync(absolutePath, content, 'utf-8');
                    const savedFileName = path.basename(absolutePath);
                    selectedFolder = path.dirname(absolutePath);
                    event.sender.send('file-saved', { success: true, filePath: savedFileName, error: undefined });
                } else {
                    event.sender.send('file-saved', { success: false, filePath: fileName, error: 'Save cancelled by user' });
                }
            } else {
                // Nếu đã có thư mục được chọn, lưu trực tiếp vào thư mục đó
                const absolutePath = path.join(selectedFolder, fileName);
                console.log('Saving file to:', absolutePath);
                fs.writeFileSync(absolutePath, content, 'utf-8');
                event.sender.send('file-saved', { success: true, filePath: fileName, error: undefined });
                console.log('File saved successfully:', fileName);
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to save file';
            event.sender.send('file-saved', { success: false, filePath: fileName, error: errorMessage });
        }
    });
    // Handle creating a new file
    ipcMain.on('create-new-file-request', async (event, fileName: string) => {
        try {
            if (!selectedFolder) {
                throw new Error('No folder selected');
            }
            const absolutePath = path.join(selectedFolder, fileName);
            if (!fs.existsSync(absolutePath)) {
                fs.writeFileSync(absolutePath, '', 'utf-8'); // Tạo file mới rỗng
                event.sender.send('new-file-created', { fileName, success: true, error: undefined });
            } else {
                throw new Error('File already exists');
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create new file';
            event.sender.send('new-file-created', { fileName, success: false, error: errorMessage });
        }
    });

    // Helper function to read folder structure recursively
    function readFolderStructure(folderPath: string) {
        const items = fs.readdirSync(folderPath, { withFileTypes: true });

        return {
            name: path.basename(folderPath),
            type: "directory",
            children: items.map(item => ({
                name: item.name,
                type: item.isDirectory() ? 'directory' : 'file'
            })),

        };
    }

    // // Đăng ký plugin
    // kernel.registerPlugin(pdfExportPlugin.name, pdfExportPlugin);

    // // IPC để gọi plugin từ renderer
    // ipcMain.handle("export-pdf", async (_event, content: string) => {
    //     if (!mainWindow) {
    //         console.error("mainWindow is null");
    //         return null;
    //     }
    //     console.log("Opening save dialog for PDF...");
    //     const result = await dialog.showSaveDialog(mainWindow, {
    //         title: "Save PDF",
    //         defaultPath: "document.pdf",
    //         filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    //     }) as unknown as SaveDialogReturnValue;
    //     console.log("Save dialog result:", result);

    //     if (result.canceled || !result.filePath) {
    //         console.log("Save dialog canceled or no file path selected");
    //         return null;
    //     }
    //     try {
    //         const pdfPath = await kernel.executePlugin("pdf-export", content, result.filePath);
    //         console.log("PDF exported successfully:", pdfPath);
    //         return pdfPath;
    //     } catch (error) {
    //         console.error("Error executing pdf-export plugin:", error);
    //         return null;
    //     }
    // });

    // // Thêm IPC handler để lấy danh sách plugin
    // ipcMain.handle("get-plugins", async () => {
    //     return kernel.getPlugins();
    // });
    ipcMain.handle("get-plugins", async () => {
        return plugins.map((p) => p.name);
    });

    ipcMain.on("apply-plugin", async (event, pluginName: string, content: string) => {
        const plugin = plugins.find((p) => p.name === pluginName);
        if (plugin) {
            // Hiển thị SaveDialog để chọn nơi lưu file
            // const result = await dialog.showSaveDialog(mainWindow!, {
            //     title: "Save PDF",
            //     defaultPath: "document.pdf",
            //     filters: [{ name: "PDF Files", extensions: ["pdf"] }],
            // });
            const result = await dialog.showSaveDialog(mainWindow!, {
                    title: "Save PDF",
                    defaultPath: "document.pdf",
                    filters: [{ name: "PDF Files", extensions: ["pdf"] }],
                }) as unknown as SaveDialogReturnValue;

            if (!result.canceled && result.filePath) {
                // Gửi yêu cầu tới plugin với nội dung và đường dẫn file
                plugin.socket.write(JSON.stringify({
                    type: "execute-plugin",
                    content,
                    filePath: result.filePath,
                }));

                // Lắng nghe phản hồi từ plugin
                plugin.socket.once("data", (data) => {
                    const result = JSON.parse(data.toString());
                    event.reply("plugin-applied", result.message);
                });
            } else {
                event.reply("plugin-applied", "PDF export cancelled by user");
            }
        } else {
            event.reply("plugin-applied", `Plugin ${pluginName} not found`);
        }
    });
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});