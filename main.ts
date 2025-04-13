import { app, BrowserWindow, dialog, ipcMain, SaveDialogReturnValue } from 'electron';
import path from 'path';
import fs from 'fs';
import { OpenDialogReturnValue } from 'electron';
import { PluginManager } from './src/plugin/PluginManager';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

let selectedFolder: string | null = null;
let mainWindow: BrowserWindow | null = null;
let pluginManager: PluginManager;
const PORT = process.env.VITE_PLUGIN_PORT ? parseInt(process.env.VITE_PLUGIN_PORT) : 5000;

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

async function initializePluginManager() {
    // Khởi tạo Plugin Manager
    pluginManager = new PluginManager(PORT);

    // Đăng ký callback khi danh sách plugin thay đổi
    pluginManager.setPluginListChangedCallback((plugins) => {
        if (mainWindow) {
            mainWindow.webContents.send('plugin-list', plugins);
        }
    });

    // Khởi động Plugin Manager
    await pluginManager.start();
}

app.whenReady().then(async () => {
    createWindow();
    await initializePluginManager();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // Handler cho load dictionary
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

    // Xử lý mở hộp thoại chọn thư mục
    ipcMain.on('open-folder-request', async (event) => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory']
            }) as unknown as OpenDialogReturnValue;

            if (!result.canceled && result.filePaths.length > 0) {
                const folderPath = result.filePaths[0];
                selectedFolder = folderPath;

                // Đọc cấu trúc thư mục
                const folderStructure = getFolderStructure(folderPath);
                event.sender.send('folder-structure', folderStructure);
            }
        } catch (error: any) {
            console.error('Error opening folder:', error);
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

    // Handle saving a file
    ipcMain.on('save-file', async (event, data: { content: string, fileName: string }) => {
        try {
            if (!selectedFolder) {
                throw new Error('No folder selected');
            }
            const { content, fileName } = data;
            const filePath = path.join(selectedFolder, fileName);
            fs.writeFileSync(filePath, content, 'utf-8');
            event.sender.send('file-saved', { success: true, filePath });
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to save file';
            event.sender.send('file-saved', { error: errorMessage });
        }
    });

    // Handle save file dialog
    ipcMain.on('save-file-request', async (event, data: { filePath: string, content: string }) => {
        try {
            const { filePath, content } = data;
            const result = await dialog.showSaveDialog({
                defaultPath: filePath,
                filters: [
                    { name: 'Text Files', extensions: ['txt', 'md', 'js', 'ts', 'html', 'css', 'json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            }) as unknown as SaveDialogReturnValue;

            if (!result.canceled && result.filePath) {
                fs.writeFileSync(result.filePath, content, 'utf-8');
                selectedFolder = path.dirname(result.filePath);
                const fileName = path.basename(result.filePath);
                event.sender.send('file-saved', { success: true, filePath: result.filePath, fileName });
            } else {
                event.sender.send('file-saved', { error: 'Save operation canceled' });
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to save file';
            event.sender.send('file-saved', { error: errorMessage });
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

    // Lấy danh sách plugin đã cài đặt
    ipcMain.handle("get-plugins", async () => {
        return pluginManager.getPlugins().map(plugin => plugin.name);
    });

    // Lấy danh sách plugin có sẵn từ Firebase
    ipcMain.handle("get-available-plugins", async () => {
        return await pluginManager.getAvailablePlugins();
    });

    // Cài đặt plugin
    ipcMain.handle("install-plugin", async (event, pluginName) => {
        try {
            const result = await pluginManager.installPlugin(pluginName);
            return { success: true, plugin: result };
        } catch (error: any) {
            console.error(`Error installing plugin ${pluginName}:`, error);
            return { success: false, error: error.message };
        }
    });

    // Gỡ cài đặt plugin
    ipcMain.handle("uninstall-plugin", async (event, pluginName) => {
        try {
            const result = await pluginManager.uninstallPlugin(pluginName);
            return { success: result };
        } catch (error: any) {
            console.error(`Error uninstalling plugin ${pluginName}:`, error);
            return { success: false, error: error.message };
        }
    });

    // Áp dụng plugin
    ipcMain.on("apply-plugin", async (event, pluginName: string, content: string) => {
        try {
            // Hiển thị SaveDialog để chọn nơi lưu file
            const result = await dialog.showSaveDialog(mainWindow!, {
                title: "Save Output",
                defaultPath: "output.pdf",
                filters: [{ name: "PDF Files", extensions: ["pdf"] }],
            }) as unknown as SaveDialogReturnValue;

            if (!result.canceled && result.filePath) {
                try {
                    // Thực thi plugin
                    await pluginManager.executePlugin(pluginName, content, result.filePath);
                    event.reply("plugin-applied", `File exported successfully to ${result.filePath}`);
                } catch (error: any) {
                    event.reply("plugin-applied", `Error: ${error.message}`);
                }
            } else {
                event.reply("plugin-applied", "Operation cancelled by user");
            }
        } catch (error: any) {
            event.reply("plugin-applied", `Error: ${error.message}`);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Dừng Plugin Manager trước khi thoát
        if (pluginManager) {
            pluginManager.stop();
        }
        app.quit();
    }
});

// Hàm đệ quy để đọc cấu trúc thư mục
function getFolderStructure(folderPath: string) {
    const name = path.basename(folderPath);
    const structure: any = {
        name,
        type: 'directory',
        children: []
    };

    const items = fs.readdirSync(folderPath);
    for (const item of items) {
        const itemPath = path.join(folderPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
            structure.children.push(getFolderStructure(itemPath));
        } else {
            structure.children.push({
                name: item,
                type: 'file'
            });
        }
    }

    return structure;
}
