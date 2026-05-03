import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Cue 安全预演台',
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 处理程序
ipcMain.handle('open-file', async (event, fileType: string) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: getFilterName(fileType), extensions: getFilterExtensions(fileType) }
    ]
  });
  
  if (result.canceled) {
    return { canceled: true };
  }
  
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  
  return {
    canceled: false,
    filePath,
    content,
    fileName: path.basename(filePath)
  };
});

ipcMain.handle('save-file', async (event, data: string, defaultPath?: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: defaultPath || 'cue-project.json',
    filters: [
      { name: 'JSON 文件', extensions: ['json'] }
    ]
  });
  
  if (result.canceled) {
    return { canceled: true };
  }
  
  const filePath = result.filePath!;
  fs.writeFileSync(filePath, data, 'utf-8');
  
  return {
    canceled: false,
    filePath,
    fileName: path.basename(filePath)
  };
});

ipcMain.handle('export-markdown', async (event, content: string, defaultPath?: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: defaultPath || 'cue-review.md',
    filters: [
      { name: 'Markdown 文件', extensions: ['md'] }
    ]
  });
  
  if (result.canceled) {
    return { canceled: true };
  }
  
  const filePath = result.filePath!;
  fs.writeFileSync(filePath, content, 'utf-8');
  
  return {
    canceled: false,
    filePath,
    fileName: path.basename(filePath)
  };
});

function getFilterName(fileType: string): string {
  switch (fileType) {
    case 'csv':
      return 'CSV 文件';
    case 'json':
      return 'JSON 文件';
    case 'all':
      return '所有文件';
    default:
      return '所有文件';
  }
}

function getFilterExtensions(fileType: string): string[] {
  switch (fileType) {
    case 'csv':
      return ['csv'];
    case 'json':
      return ['json'];
    case 'all':
      return ['*'];
    default:
      return ['*'];
  }
}
