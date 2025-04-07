// const { app, BrowserWindow } = require('electron')

// let mainWindow

// function createWindow() {
//     mainWindow = new BrowserWindow({ width: 800, height: 600 })
//     mainWindow.loadURL('https://www.google.com')
//     mainWindow.on('closed', () => {
//         mainWindow = null
//     })
// }

// app.on('ready', createWindow)

// app.on('window-all-closed', () => {
//     if (process.platform !== 'darwin') app.quit()
// })

// app.on('activate', () => {
//     if (mainWindow === null) createWindow()
// })
const { app, BrowserWindow } = require('electron');
const path = require('path');
let mainWindow;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        
        width: 800,
        height: 600,
        resizable: true,
        icon: path.join(__dirname, 'public/logo.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
        },
    });
    mainWindow.loadFile('src/index.html');
});
