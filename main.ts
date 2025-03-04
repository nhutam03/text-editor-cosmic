import { app, BrowserWindow, dialog, ipcMain, SaveDialogReturnValue } from 'electron';
import path from 'path';
import fs from 'fs';
import { OpenDialogReturnValue } from 'electron';

let selectedFolder: string | null = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, './public/logo.ico'),
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

    // Handle opening a folder
    // ipcMain.on('open-folder-request', async (event) => {
    //     const result = await dialog.showOpenDialog({
    //         properties: ['openDirectory']
    //     });
    //     if (!result.canceled && result.filePaths.length > 0) {
    //         // const folderPath = result.filePaths[0];
    //         selectedFolder = result.filePaths[0]; // Store the selected folder
    //         // const structure = readFolderStructure(folderPath);
    //         // event.sender.send('folder-structure', { path: folderPath, ...structure });
    //         const structure = readFolderStructure(selectedFolder);
    //         event.sender.send('folder-structure', { path: selectedFolder, ...structure });
    //     }
    // });
    ipcMain.on('open-folder-request', async (event) => {
        const result = (await dialog.showOpenDialog({
            properties: ['openDirectory']
        })) as unknown as OpenDialogReturnValue; // Ép kiểu qua unknown trước, sau đó sang OpenDialogReturnValue
        if (!result.canceled && result.filePaths.length > 0) {
            selectedFolder = result.filePaths[0];
            const structure = readFolderStructure(selectedFolder);
            event.sender.send('folder-structure', { path: selectedFolder, ...structure });
        }
    });
    // Handle opening a file
    ipcMain.on('open-file-request', async (event, fileName: string) => {
        try {
            if (!selectedFolder) {
                throw new Error('No folder selected');
            }
            const absolutePath = path.join(selectedFolder, fileName);
            const content = fs.readFileSync(absolutePath, 'utf-8');
            event.sender.send('file-content', { content, filePath: absolutePath });
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'File not found or inaccessible';
            event.sender.send('file-content', { error: errorMessage });
        }
    });

    // Handle saving a file
    // ipcMain.on('save-file-request', async (event, { filePath, content }: { filePath: string, content: string }) => {
    //     try {
    //         const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(selectedFolder || '', filePath);
    //         fs.writeFileSync(absolutePath, content, 'utf-8');
    //         event.sender.send('file-saved', { success: true, filePath, error: undefined });
    //     } catch (error: any) {
    //         const errorMessage = error instanceof Error ? error.message : 'Failed to save file';
    //         event.sender.send('file-saved', { success: false, filePath, error: errorMessage });
    //     }
    // });
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
    function readFolderStructure(folderPath: string): any {
        const items = fs.readdirSync(folderPath, { withFileTypes: true });
        const structure: any = {};
        items.forEach(item => {
            const fullPath = path.join(folderPath, item.name);
            if (item.isDirectory()) {
                structure[item.name] = 'directory';
                structure[item.name] = readFolderStructure(fullPath); // Recursive for subdirectories
            } else if (item.isFile()) {
                structure[item.name] = 'file';
            }
        });
        return structure;
    }

    // Handler cho recent files
    // const recentFilesPath = path.join(__dirname, 'recent-files.json');
    // if (!fs.existsSync(recentFilesPath)) {
    //     fs.writeFileSync(recentFilesPath, JSON.stringify([], null, 2));
    // }

    // ipcMain.handle('get-recent-files', async () => {
    //     try {
    //         const data = fs.readFileSync(recentFilesPath, 'utf-8');
    //         return JSON.parse(data);
    //     } catch (error) {
    //         console.error('Error reading recent files:', error);
    //         return [];
    //     }
    // });

});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});