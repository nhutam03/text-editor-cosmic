import { app, BrowserWindow, dialog, ipcMain, SaveDialogReturnValue } from 'electron';
import path from 'path';
import fs from 'fs';
import kernel from './src/renderer/plugins/kernel';
import pdfExportPlugin from './src/plugins/exportToPDF/index';
import { OpenDialogReturnValue } from 'electron';
import { env } from 'process';

let selectedFolder: string | null = null;
const apiAnvil = env.MY_ANVIL_SECRET_KEY;
const pdfTemplateID = env.TEMPLATE_ID || '';
let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '../public/logo.ico'),
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

app.whenReady().then(() => {
    createWindow();
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

    // Handle opening a file
    ipcMain.on('open-file-request', async (event, fileName: string) => {
        try {
            if (!selectedFolder) {
                throw new Error('No folder selected');
            }
            // const absolutePath = path.join(selectedFolder, fileName);
            const absolutePath = path.join(selectedFolder, path.basename(fileName));
            // Kiểm tra xem file có tồn tại không
            if (!fs.existsSync(absolutePath)) {
                throw new Error('File does not exist');
            }
            const content = fs.readFileSync(absolutePath, 'utf-8');
            event.sender.send('file-content', { content, filePath: absolutePath });
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'File not found or inaccessible';
            event.sender.send('file-content', { error: errorMessage });
        }
    });


    ipcMain.on('save-file-request', async (event, { filePath, content }: { filePath: string, content: string }) => {
        console.log('Received save-file-request for:', filePath);
        try {
            const result = await dialog.showSaveDialog({
                defaultPath: filePath || 'Untitled.txt',
                filters: [{ name: 'Text Files', extensions: ['txt'] }],
            }) as unknown as SaveDialogReturnValue;

            if (!result.canceled && result.filePath) {
                const absolutePath = result.filePath;
                fs.writeFileSync(absolutePath, content, 'utf-8');
                const fileName = path.basename(absolutePath);
                event.sender.send('file-saved', { success: true, filePath: fileName, error: undefined });
            } else {
                event.sender.send('file-saved', { success: false, filePath, error: 'Save cancelled by user' });
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to save file';
            event.sender.send('file-saved', { success: false, filePath, error: errorMessage });
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

    // Đăng ký plugin
    kernel.registerPlugin(pdfExportPlugin.name, pdfExportPlugin);

    // IPC để gọi plugin từ renderer
    ipcMain.handle("export-pdf", async (_event, content: string) => {
        if (!mainWindow) {
            console.error("mainWindow is null");
            return null;
        }
        console.log("Opening save dialog for PDF...");
        const result = await dialog.showSaveDialog(mainWindow, {
            title: "Save PDF",
            defaultPath: "document.pdf",
            filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        }) as unknown as SaveDialogReturnValue;
        console.log("Save dialog result:", result);

        if (result.canceled || !result.filePath) {
            console.log("Save dialog canceled or no file path selected");
            return null;
        }
        try {
            const pdfPath = await kernel.executePlugin("pdf-export", content, result.filePath);
            console.log("PDF exported successfully:", pdfPath);
            return pdfPath;
        } catch (error) {
            console.error("Error executing pdf-export plugin:", error);
            return null;
        }
    });

        //return await kernel.executePlugin("pdf-export", content, result.filePath);
    //});

    // Thêm IPC handler để lấy danh sách plugin
    ipcMain.handle("get-plugins", async () => {
        return kernel.getPlugins();
    });

});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});