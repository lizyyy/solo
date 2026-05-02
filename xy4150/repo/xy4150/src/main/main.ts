import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: '手部康复节拍教练',
    icon: path.join(__dirname, '../../public/icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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

ipcMain.handle('save-report', async (_event, reportContent: string, defaultFileName: string) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '保存训练报告',
      defaultPath: path.join(app.getPath('documents'), defaultFileName),
      filters: [
        { name: 'Markdown 文件', extensions: ['md'] },
        { name: '文本文件', extensions: ['txt'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(result.filePath, reportContent, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Error saving report:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('export-plan', async (_event, planJson: string, defaultFileName: string) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出训练方案',
      defaultPath: path.join(app.getPath('documents'), defaultFileName),
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(result.filePath, planJson, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Error exporting plan:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('import-plan', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '导入训练方案',
      properties: ['openFile'],
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content, filePath };
  } catch (error) {
    console.error('Error importing plan:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});
