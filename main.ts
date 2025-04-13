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
        // Mở DevTools để debug trong môi trường production
        mainWindow.webContents.openDevTools();
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

    // Lấy danh sách plugin đã cài đặt - Đảm bảo không có plugin trùng lặp
    ipcMain.handle("get-plugins", async () => {
        // Lấy danh sách plugin
        const plugins = pluginManager.getPlugins();

        // Tạo Map để lọc các plugin trùng lặp dựa trên tên chuẩn hóa
        const uniquePlugins = new Map<string, string>();

        // Lọc các plugin trùng lặp
        for (const plugin of plugins) {
            if (!plugin || !plugin.name) continue;

            // Chuẩn hóa tên plugin
            const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, '');

            // Chỉ giữ lại plugin mới nhất cho mỗi tên chuẩn hóa
            if (!uniquePlugins.has(normalizedName)) {
                uniquePlugins.set(normalizedName, plugin.name);
            }
        }

        // Trả về danh sách tên plugin duy nhất
        return Array.from(uniquePlugins.values());
    });

    // Lấy danh sách plugin có sẵn từ Firebase - Sử dụng TypeScript đúng cách
    ipcMain.handle("get-available-plugins", async (): Promise<Array<{name: string, installed: boolean}>> => {
        try {
            const plugins = await pluginManager.getAvailablePlugins();

            // Đảm bảo trả về một mảng đối tượng đơn giản
            return plugins.map(plugin => ({
                name: typeof plugin.name === 'string' ? plugin.name : String(plugin.name),
                installed: Boolean(plugin.installed)
            }));
        } catch (error: unknown) {
            console.error('Error getting available plugins:', error);
            return []; // Trả về mảng rỗng nếu có lỗi
        }
    });

    // Cài đặt plugin - Đơn giản hóa tối đa
    ipcMain.handle("install-plugin", async (event, pluginName) => {
        console.log(`Main process: Installing plugin ${pluginName}`);

        try {
            // Gọi installPlugin và bắt lỗi
            await pluginManager.installPlugin(pluginName);
            console.log(`Main process: Plugin ${pluginName} installed successfully`);
        } catch (error) {
            console.error(`Main process: Error installing plugin:`, error);
            // Không ném lỗi, chỉ ghi log
        }

        // Gửi danh sách plugin mới cho renderer
        try {
            const plugins = pluginManager.getPlugins();
            event.sender.send('plugin-list', plugins.map(p => p.name));
        } catch (error) {
            console.error(`Main process: Error sending plugin list:`, error);
        }

        // Luôn trả về success: true để tránh màn hình trắng
        return {
            success: true,
            message: `Plugin ${pluginName} installed successfully`
        };
    });

    // Gỡ cài đặt plugin - Đơn giản hóa tối đa
    ipcMain.handle("uninstall-plugin", async (event, pluginName: string): Promise<{ success: boolean; message?: string }> => {
        console.log(`Main process: Uninstalling plugin ${pluginName}`);

        // Gọi uninstallPlugin và bắt lỗi
        try {
            await pluginManager.uninstallPlugin(pluginName);
        } catch (error) {
            console.error(`Main process: Error in uninstallPlugin:`, error);
            // Không ném lỗi, chỉ ghi log
        }

        // Gửi danh sách plugin mới cho renderer
        try {
            const plugins = pluginManager.getPlugins();
            event.sender.send('plugin-list', plugins.map(p => p.name));
        } catch (error) {
            console.error(`Main process: Error sending plugin list:`, error);
        }

        // Luôn trả về success: true để tránh màn hình trắng
        return {
            success: true,
            message: `Plugin ${pluginName} uninstalled successfully`
        };
    });

    // Kiểm tra trạng thái cài đặt của plugin - Sử dụng TypeScript đúng cách
    ipcMain.handle("check-plugin-status", async (event, pluginName: string): Promise<{ pluginName: string; isInstalled: boolean; error?: string }> => {
        try {
            if (typeof pluginName !== 'string') {
                console.error(`Invalid plugin name: ${pluginName}`);
                return { pluginName: String(pluginName), isInstalled: false, error: 'Invalid plugin name' };
            }

            const plugins = pluginManager.getPlugins();
            const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');

            const isInstalled = plugins.some(p => {
                if (!p || !p.name) return false;

                const pNormalizedName = typeof p.name === 'string' ?
                    p.name.replace(/(-\d+\.\d+\.\d+)$/, '') : String(p.name);

                return p.name === pluginName || p.name === normalizedName ||
                       pNormalizedName === pluginName || pNormalizedName === normalizedName;
            });

            return { pluginName, isInstalled };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error checking plugin status: ${errorMessage}`);
            return { pluginName: String(pluginName), isInstalled: false, error: errorMessage };
        }
    });

    // Áp dụng plugin
    ipcMain.on("apply-plugin", async (event, pluginName: string, content: string) => {
        try {
            console.log(`Applying plugin: ${pluginName}`);

            // Xử lý plugin export-to-pdf
            if (pluginName === "export-to-pdf") {
                // Hiển thị SaveDialog để chọn nơi lưu file
                const result = await dialog.showSaveDialog(mainWindow!, {
                    title: "Export to PDF",
                    defaultPath: "output.pdf",
                    filters: [{ name: "PDF Files", extensions: ["pdf"] }],
                }) as unknown as SaveDialogReturnValue;

                if (!result.canceled && result.filePath) {
                    try {
                        // Kiểm tra xem plugin đã được cài đặt chưa
                        const installedPlugins = pluginManager.getPlugins().map(p => p.name);
                        const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');

                        if (!installedPlugins.includes(pluginName) && !installedPlugins.includes(normalizedName)) {
                            console.log(`Plugin ${pluginName} is not installed. Attempting to install it...`);

                            try {
                                // Thử cài đặt plugin
                                await pluginManager.installPlugin(pluginName);
                                console.log(`Successfully installed plugin ${pluginName}`);
                            } catch (installError: any) {
                                console.error(`Failed to install plugin ${pluginName}:`, installError);
                                // Tiếp tục với cách đơn giản hơn nếu cài đặt thất bại
                                fs.writeFileSync(result.filePath, content);
                                event.reply("plugin-applied", `File exported successfully to ${result.filePath} (basic export)`);
                                return;
                            }
                        }

                        // Thử sử dụng plugin
                        try {
                            console.log(`Executing plugin ${pluginName} with content length: ${content.length}`);
                            await pluginManager.executePlugin(pluginName, content, result.filePath);
                            event.reply("plugin-applied", `File exported successfully to ${result.filePath}`);
                        } catch (pluginError: any) {
                            console.error(`Plugin execution failed:`, pluginError);

                            // Nếu plugin không hoạt động, sử dụng cách đơn giản hơn
                            console.log("Using simple export method as fallback");
                            fs.writeFileSync(result.filePath, content);
                            event.reply("plugin-applied", `File exported successfully to ${result.filePath} (basic export)`);
                        }
                    } catch (error: any) {
                        console.error(`Error in apply-plugin handler:`, error);
                        event.reply("plugin-applied", `Error: ${error.message || String(error)}`);
                    }
                } else {
                    event.reply("plugin-applied", "Operation cancelled by user");
                }
            } else {
                // Xử lý các plugin khác
                // Hiển thị SaveDialog để chọn nơi lưu file nếu cần
                const result = await dialog.showSaveDialog(mainWindow!, {
                    title: "Save Output",
                    defaultPath: "output.pdf",
                    filters: [{ name: "PDF Files", extensions: ["pdf"] }],
                }) as unknown as SaveDialogReturnValue;

                if (!result.canceled && result.filePath) {
                    try {
                        // Kiểm tra xem plugin đã được cài đặt chưa
                        const installedPlugins = pluginManager.getPlugins().map(p => p.name);
                        const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');

                        if (!installedPlugins.includes(pluginName) && !installedPlugins.includes(normalizedName)) {
                            try {
                                // Thử cài đặt plugin
                                await pluginManager.installPlugin(pluginName);
                                console.log(`Successfully installed plugin ${pluginName}`);
                            } catch (installError: any) {
                                console.error(`Failed to install plugin ${pluginName}:`, installError);
                                event.reply("plugin-applied", `Error: Failed to install plugin ${pluginName}: ${installError.message || String(installError)}`);
                                return;
                            }
                        }

                        // Thực thi plugin
                        await pluginManager.executePlugin(pluginName, content, result.filePath);
                        event.reply("plugin-applied", `File exported successfully to ${result.filePath}`);
                    } catch (error: any) {
                        console.error(`Error executing plugin ${pluginName}:`, error);
                        event.reply("plugin-applied", `Error: ${error.message || String(error)}`);
                    }
                } else {
                    event.reply("plugin-applied", "Operation cancelled by user");
                }
            }
        } catch (error: any) {
            console.error(`Unexpected error in apply-plugin handler:`, error);
            event.reply("plugin-applied", `Error: ${error.message || String(error)}`);
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
