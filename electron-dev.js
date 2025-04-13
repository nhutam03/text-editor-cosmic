const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

let electronProcess = null;

function startElectron() {
    electronProcess = spawn(electron, ['.'], {
        stdio: 'inherit'
    });
}

function restartElectron() {
    if (electronProcess) {
        electronProcess.kill();
        electronProcess = null;
    }
    startElectron();
}

// Watch TypeScript files
require('chokidar')
    .watch(['src/**/*.ts', 'src/**/*.tsx'], {
        ignored: /node_modules/,
    })
    .on('change', (path) => {
        console.log(`File ${path} has been changed`);
        restartElectron();
    });

startElectron();
