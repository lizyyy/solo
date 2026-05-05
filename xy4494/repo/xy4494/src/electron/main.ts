import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DataStore } from './services/dataStore';
import { ExportService } from './services/exportService';
import { ImportService } from './services/importService';
import { AutoJudgeService } from './services/autoJudge';
import { LostItem, ItemStatus, ExportOptions, AppSettings, ImportData } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
const dataStore = new DataStore();
const exportService = new ExportService();
const importService = new ImportService();
const autoJudgeService = new AutoJudgeService();

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '地铁失物招领管理系统',
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入数据',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow?.webContents.send('menu:import');
          },
        },
        {
          label: '导出数据',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow?.webContents.send('menu:export');
          },
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      ],
    },
    {
      label: '查看',
      submenu: [
        { label: '刷新', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '强制刷新', accelerator: 'Shift+CmdOrCtrl+R', role: 'forceReload' },
        { type: 'separator' },
        { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于',
              message: '地铁失物招领管理系统',
              detail: `版本: ${app.getVersion()}\n\n用于管理地铁失物招领的本地桌面应用。`,
            });
          },
        },
      ],
    },
  ];

  if (isDev) {
    template[2].submenu?.push(
      { type: 'separator' },
      {
        label: '开发者工具',
        accelerator: 'F12',
        click: () => {
          mainWindow?.webContents.openDevTools();
        },
      }
    );
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
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

ipcMain.handle('data:getAllItems', async () => {
  return dataStore.getAllItems();
});

ipcMain.handle('data:getItemById', async (_, id: string) => {
  return dataStore.getItemById(id);
});

ipcMain.handle('data:saveItem', async (_, item: LostItem) => {
  if (item.autoJudgeResult === null && dataStore.getSettings().autoJudgeEnabled) {
    const judgeResult = autoJudgeService.judge(item);
    item.autoJudgeResult = judgeResult;
    
    if (judgeResult.needSupervisor) {
      item.status = ItemStatus.NEED_SUPERVISOR;
    } else if (judgeResult.needProof) {
      item.status = ItemStatus.NEED_PROOF;
    } else if (judgeResult.canReturn) {
      item.status = ItemStatus.APPROVED;
    }
  }
  
  return dataStore.saveItem(item);
});

ipcMain.handle('data:deleteItem', async (_, id: string) => {
  return dataStore.deleteItem(id);
});

ipcMain.handle('data:searchItems', async (_, query: string, filters?: {
  stations?: string[];
  categories?: string[];
  statuses?: string[];
  dateRange?: { start: string; end: string };
}) => {
  return dataStore.searchItems(query, filters);
});

ipcMain.handle('data:getStats', async () => {
  return dataStore.getStats();
});

ipcMain.handle('data:getUniqueStations', async () => {
  return dataStore.getUniqueStations();
});

ipcMain.handle('data:addPhoto', async (_, itemId: string, photoData: { filePath: string; fileName: string; tags: string[]; description: string }) => {
  return dataStore.addPhoto(itemId, photoData);
});

ipcMain.handle('data:updatePhoto', async (_, itemId: string, photoId: string, updates: Partial<{ tags: string[]; description: string }>) => {
  return dataStore.updatePhoto(itemId, photoId, updates);
});

ipcMain.handle('data:deletePhoto', async (_, itemId: string, photoId: string) => {
  return dataStore.deletePhoto(itemId, photoId);
});

ipcMain.handle('import:fromFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择导入文件',
    properties: ['openFile'],
    filters: [
      { name: 'Excel/CSV/JSON', extensions: ['xlsx', 'xls', 'csv', 'json'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  return importService.importFromFile(filePath);
});

ipcMain.handle('import:previewFile', async (_, filePath: string) => {
  return importService.previewFile(filePath);
});

ipcMain.handle('import:applyData', async (_, importData: ImportData) => {
  return importService.applyImportData(importData, dataStore);
});

ipcMain.handle('export:toMarkdown', async (_, options: ExportOptions) => {
  const items = dataStore.getAllItems();
  const filteredItems = exportService.filterItems(items, options);
  const markdown = exportService.exportToMarkdown(filteredItems, options);
  
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: '保存 Markdown 文件',
    defaultPath: path.join(
      dataStore.getSettings().exportPath || app.getPath('documents'),
      `失物招领清单_${new Date().toISOString().split('T')[0]}.md`
    ),
    filters: [
      { name: 'Markdown 文件', extensions: ['md'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  fs.writeFileSync(result.filePath, markdown, 'utf-8');
  return result.filePath;
});

ipcMain.handle('export:toJson', async (_, options: ExportOptions) => {
  const items = dataStore.getAllItems();
  const filteredItems = exportService.filterItems(items, options);
  const jsonContent = exportService.exportToJson(filteredItems, options);
  
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: '保存 JSON 文件',
    defaultPath: path.join(
      dataStore.getSettings().exportPath || app.getPath('documents'),
      `失物招领数据_${new Date().toISOString().split('T')[0]}.json`
    ),
    filters: [
      { name: 'JSON 文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  fs.writeFileSync(result.filePath, jsonContent, 'utf-8');
  return result.filePath;
});

ipcMain.handle('export:previewMarkdown', async (_, options: ExportOptions) => {
  const items = dataStore.getAllItems();
  const filteredItems = exportService.filterItems(items, options);
  return exportService.exportToMarkdown(filteredItems, options);
});

ipcMain.handle('export:previewJson', async (_, options: ExportOptions) => {
  const items = dataStore.getAllItems();
  const filteredItems = exportService.filterItems(items, options);
  return exportService.exportToJson(filteredItems, options);
});

ipcMain.handle('settings:get', async () => {
  return dataStore.getSettings();
});

ipcMain.handle('settings:save', async (_, settings: Partial<AppSettings>) => {
  return dataStore.updateSettings(settings);
});

ipcMain.handle('dialog:selectPhoto', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择物品照片',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths.map(filePath => ({
    filePath,
    fileName: path.basename(filePath),
  }));
});

ipcMain.handle('dialog:selectFolder', async (_, title: string = '选择文件夹') => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title,
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('judge:autoJudge', async (_, item: LostItem) => {
  return autoJudgeService.judge(item);
});
