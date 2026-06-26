const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const log = require('electron-log');
const { ipcMain } = require('electron');
const AdmZip = require('adm-zip');
const packageJson = require(path.join(__dirname, 'package.json'));
const { spawn } = require('child_process');
const { cupidbotDir, openLocation } = require(path.join(
    __dirname,
    'libs',
    'dir-module.js'
));

process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error);
});

let mainWindow = null;

// Ensure the .cupidbot directory exists
if (!fs.existsSync(cupidbotDir)) {
    fs.mkdirSync(cupidbotDir);
}

async function loadLibraries() {
    log.info('Loading libraries...');

    const ipcHandlersPath = path.join(__dirname, 'libs', 'ipc-handlers.js');

    try {
        log.info('Requiring ipc-handlers...');
        const handler = require(ipcHandlersPath);
        const deps = {
            AdmZip: AdmZip,
            axios: axios,
            ipcMain: ipcMain,
            cupidbotDir: cupidbotDir,
            packageJson: packageJson,
            path: path,
            log: log,
            spawn: spawn,
            dialog: dialog,
            shell: shell,
            projectDir: __dirname,
            fs: fs,
            app: app,
            mainWindow: mainWindow
        };
        try {
            const mockAuthHandler = require(path.join(
                __dirname,
                'libs',
                'mock-auth.js'
            ));
            if (typeof mockAuthHandler === 'function') {
                mockAuthHandler({ ipcMain, log });
            } else {
                log.error('mock-auth does not export a function');
            }
        } catch (authError) {
            log.error('Error requiring mock-auth:', authError);
        }
        if (typeof handler === 'function') {
            await handler(deps);
        } else {
            log.error('ipcHandlers does not export a function');
        }
        log.info('Done requiring ipcHandlers...');
    } catch (error) {
        log.error('Error requiring ipcHandlers:', error);
    }
}

async function createWindow() {
    // Create the main window, but don't show it yet
    mainWindow = new BrowserWindow({
        width: 1280,
        height: process.env.DEBUG !== 'true' ? 750 : 800,
        show: false, // Don't show the main window immediately
        title: 'CupidBot Launcher',
        autoHideMenuBar: process.env.DEBUG !== 'true',
        icon: path.join(__dirname, 'images/cupidbot_transparent.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: true,
            webviewTag: true
        },
        titleBarStyle: process.env.DEBUG !== 'true' ? 'hidden' : '',
        frame: process.env.DEBUG === 'true'
    });

    if (process.platform === 'darwin') {
        mainWindow.setWindowButtonVisibility(false);
    }

    try {
        const extraHandlers = require(path.join(
            __dirname,
            'libs',
            'extra-ipc-handlers.js'
        ));
        if (typeof extraHandlers === 'function') {
            await extraHandlers(app, ipcMain, mainWindow, log, openLocation);
        } else {
            log.error('extra-ipc-handlers does not export a function');
        }
    } catch (e) {
        log.error('Failed to load extra-ipc-handlers:', e);
    }

    await mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => {
    log.info('App starting...');

    await loadLibraries();
    await createWindow();

    mainWindow.show();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
