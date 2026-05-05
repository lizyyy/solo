import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { initDatabase, database } from './database';
import { setupIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '服装连续性管理工具',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 设置 IPC 处理器
  setupIpcHandlers(mainWindow);
}

// 初始化数据库
initDatabase();

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await database.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await database.close();
});
