import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false, // Tắt nodeIntegration
            contextIsolation: true, // Bật contextIsolation cho bảo mật
            preload: path.join(__dirname, '../preload.js'), // Sử dụng preload script
        },
    });

    if (process.env.NODE_ENV === 'development') {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools(); // Mở DevTools để debug
    } else {
        win.loadFile(path.join(__dirname, '/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();
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

    // Handler cho recent files
    const recentFilesPath = path.join(__dirname, 'recent-files.json');
    if (!fs.existsSync(recentFilesPath)) {
        fs.writeFileSync(recentFilesPath, JSON.stringify([], null, 2));
    }

    ipcMain.handle('get-recent-files', async () => {
        try {
            const data = fs.readFileSync(recentFilesPath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading recent files:', error);
            return [];
        }
    });

    // // Handler để mở file .txt
    // ipcMain.handle('open-file-request', async (event, filePath: string) => {
    //     try {
    //         const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
    //         const content = fs.readFileSync(absolutePath, 'utf-8');
    //         return { path: filePath, content };
    //     } catch (error) {
    //         console.error('Failed to open file:', error);
    //         return { error: error.message || 'File not found or inaccessible' };
    //     }
    // });

    // ipcMain.handle('add-recent-file', async (_, filePath: string) => {
    //     try {
    //         const files = await ipcMain.handle('get-recent-files') as string[];
    //         if (!files.includes(filePath)) {
    //             files.unshift(filePath);
    //             fs.writeFileSync(recentFilesPath, JSON.stringify(files.slice(0, 10), null, 2));
    //         }
    //     } catch (error) {
    //         console.error('Error adding recent file:', error);
    //     }
    // });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});