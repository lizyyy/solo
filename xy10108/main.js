const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const userDataPath_local = path.join(__dirname, 'data');
app.setPath('userData', userDataPath_local);
app.setPath('sessionData', path.join(userDataPath_local, 'session'));
app.setPath('cache', path.join(userDataPath_local, 'cache'));

let mainWindow = null;
let userDataPath = userDataPath_local;
let attachmentsPath = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: '实验仪器校准提醒桌面台',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    createMenu();
}

function createMenu() {
    const isMac = process.platform === 'darwin';
    
    const template = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: '文件',
            submenu: [
                {
                    label: '导入台账数据',
                    click: () => {
                        mainWindow.webContents.send('menu-import-data');
                    }
                },
                {
                    label: '导入证书文件',
                    click: () => {
                        mainWindow.webContents.send('menu-import-certificate');
                    }
                },
                { type: 'separator' },
                {
                    label: '导出为 JSON',
                    click: () => {
                        mainWindow.webContents.send('menu-export-json');
                    }
                },
                {
                    label: '导出为 CSV',
                    click: () => {
                        mainWindow.webContents.send('menu-export-csv');
                    }
                },
                {
                    label: '导出为 Excel',
                    click: () => {
                        mainWindow.webContents.send('menu-export-excel');
                    }
                },
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' }
            ]
        },
        {
            label: '视图',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: '工具',
            submenu: [
                {
                    label: '检查附件文件完整性',
                    click: () => {
                        mainWindow.webContents.send('menu-check-attachments');
                    }
                },
                {
                    label: '打开附件文件夹',
                    click: () => {
                        if (attachmentsPath) {
                            shell.openPath(attachmentsPath);
                        }
                    }
                },
                {
                    label: '打开数据文件夹',
                    click: () => {
                        if (userDataPath) {
                            shell.openPath(userDataPath);
                        }
                    }
                }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '使用说明',
                    click: () => {
                        shell.openExternal('https://github.com');
                    }
                },
                { type: 'separator' },
                {
                    label: '关于',
                    role: 'about'
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function ensureDataDirectories() {
    userDataPath = path.join(__dirname, 'data');
    attachmentsPath = path.join(userDataPath, 'attachments');
    
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    if (!fs.existsSync(attachmentsPath)) {
        fs.mkdirSync(attachmentsPath, { recursive: true });
    }
    
    console.log('数据目录:', userDataPath);
    console.log('附件目录:', attachmentsPath);
}

app.whenReady().then(() => {
    ensureDataDirectories();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('get-app-paths', () => {
    return {
        userData: userDataPath,
        attachments: attachmentsPath
    };
});

ipcMain.handle('open-file-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

ipcMain.handle('save-file-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

ipcMain.handle('copy-attachment', async (event, sourcePath, instrumentId) => {
    try {
        if (!fs.existsSync(sourcePath)) {
            return { success: false, error: '源文件不存在' };
        }
        
        const fileName = path.basename(sourcePath);
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const timestamp = Date.now();
        const newFileName = `${instrumentId}_${baseName}_${timestamp}${ext}`;
        const destPath = path.join(attachmentsPath, newFileName);
        
        fs.copyFileSync(sourcePath, destPath);
        
        return {
            success: true,
            filePath: destPath,
            fileName: newFileName,
            originalName: fileName
        };
    } catch (error) {
        console.error('复制附件失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-attachment', async (event, fileName) => {
    try {
        const filePath = path.join(attachmentsPath, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        }
        return { success: false, error: '文件不存在' };
    } catch (error) {
        console.error('删除附件失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('check-attachment-exists', async (event, fileName) => {
    try {
        const filePath = path.join(attachmentsPath, fileName);
        const exists = fs.existsSync(filePath);
        return { exists, filePath };
    } catch (error) {
        return { exists: false, error: error.message };
    }
});

ipcMain.handle('open-attachment', async (event, fileName) => {
    try {
        const filePath = path.join(attachmentsPath, fileName);
        if (fs.existsSync(filePath)) {
            await shell.openPath(filePath);
            return { success: true };
        }
        return { success: false, error: '文件不存在' };
    } catch (error) {
        console.error('打开附件失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-attachment-info', async (event, fileName) => {
    try {
        const filePath = path.join(attachmentsPath, fileName);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            return {
                exists: true,
                size: stats.size,
                modifiedTime: stats.mtime.toISOString(),
                filePath
            };
        }
        return { exists: false };
    } catch (error) {
        return { exists: false, error: error.message };
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('export-excel', async (event, data, fileName) => {
    try {
        const defaultPath = path.join(app.getPath('documents'), fileName || '仪器校准清单.xlsx');
        
        const result = await dialog.showSaveDialog(mainWindow, {
            title: '保存 Excel 文件',
            defaultPath,
            filters: [
                { name: 'Excel 文件', extensions: ['xlsx'] }
            ]
        });
        
        if (result.canceled || !result.filePath) {
            return { success: false, canceled: true };
        }
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '仪器清单');
        
        XLSX.writeFile(wb, result.filePath);
        
        return { success: true, filePath: result.filePath };
    } catch (error) {
        console.error('导出 Excel 失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('check-all-attachments', async (event, instruments) => {
    const results = [];
    
    for (const instrument of instruments) {
        if (instrument.attachments && instrument.attachments.length > 0) {
            for (const attachment of instrument.attachments) {
                const filePath = path.join(attachmentsPath, attachment.fileName);
                const exists = fs.existsSync(filePath);
                
                results.push({
                    instrumentId: instrument.id,
                    instrumentName: instrument.name,
                    fileName: attachment.fileName,
                    originalName: attachment.originalName,
                    exists,
                    filePath: exists ? filePath : null
                });
            }
        }
    }
    
    return results;
});

ipcMain.handle('show-message-box', async (event, options) => {
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
});
