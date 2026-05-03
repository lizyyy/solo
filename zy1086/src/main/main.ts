import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import { DataStore } from './store/dataStore';
import { Project, Recipe, Ingredient, ContainerType, ExportOptions } from '@shared/types';
import { generateShoppingList } from '@shared/utils/shoppingListGenerator';
import { generatePrepTasks } from '@shared/utils/prepPlanner';
import { checkAllRisks } from '@shared/utils/riskDetector';
import { exportToMarkdown, exportShoppingListToCSV, exportStorageLabelsToHTML, exportProjectToJSON, importProjectFromJSON } from '@shared/utils/exporter';

let mainWindow: BrowserWindow | null = null;
let dataStore: DataStore | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    },
    title: '备餐小助手',
    icon: path.join(__dirname, '../../public/icon.png')
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建项目',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu:new-project');
          }
        },
        {
          label: '打开项目',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu:open-project');
          }
        },
        { type: 'separator' },
        {
          label: '导出项目',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('menu:export-project');
          }
        },
        {
          label: '导入项目',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow?.webContents.send('menu:import-project');
          }
        },
        { type: 'separator' },
        {
          label: isDev ? '退出' : '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '刷新', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '强制刷新', accelerator: 'Shift+CmdOrCtrl+R', role: 'forceReload' },
        { type: 'separator' },
        { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', accelerator: 'CmdOrCtrl+F', role: 'togglefullscreen' }
      ]
    },
    {
      label: '工具',
      submenu: [
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于备餐小助手',
              message: '备餐小助手 v1.0.0',
              detail: '一款帮助您规划周末备餐的本地桌面工具。\n\n功能包括：\n- 菜谱管理\n- 食材换算\n- 备料规划\n- 存储管理\n- 风险提示'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function initialize(): Promise<void> {
  dataStore = new DataStore();
  await dataStore.initialize();
  createWindow();
}

app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('app:get-data-path', () => {
  return dataStore?.getDataPath() || '';
});

ipcMain.handle('recipes:get-all', async () => {
  if (!dataStore) return [];
  return dataStore.getRecipes();
});

ipcMain.handle('recipes:get-by-id', async (_event, id: string) => {
  if (!dataStore) return undefined;
  return dataStore.getRecipeById(id);
});

ipcMain.handle('recipes:save', async (_event, recipe: Recipe) => {
  if (!dataStore) return;
  await dataStore.saveRecipe(recipe);
});

ipcMain.handle('recipes:delete', async (_event, id: string) => {
  if (!dataStore) return false;
  return dataStore.deleteRecipe(id);
});

ipcMain.handle('ingredients:get-all', async () => {
  if (!dataStore) return [];
  return dataStore.getIngredients();
});

ipcMain.handle('ingredients:save', async (_event, ingredient: Ingredient) => {
  if (!dataStore) return;
  await dataStore.saveIngredient(ingredient);
});

ipcMain.handle('container-types:get-all', async () => {
  if (!dataStore) return [];
  return dataStore.getContainerTypes();
});

ipcMain.handle('projects:get-all', async () => {
  if (!dataStore) return [];
  return dataStore.getProjects();
});

ipcMain.handle('projects:get-by-id', async (_event, id: string) => {
  if (!dataStore) return undefined;
  return dataStore.getProjectById(id);
});

ipcMain.handle('projects:save', async (_event, project: Project) => {
  if (!dataStore) return;
  await dataStore.saveProject(project);
});

ipcMain.handle('projects:delete', async (_event, id: string) => {
  if (!dataStore) return false;
  return dataStore.deleteProject(id);
});

ipcMain.handle('projects:generate-shopping-list', async (_event, projectId: string) => {
  if (!dataStore) return [];
  
  const project = await dataStore.getProjectById(projectId);
  const recipes = await dataStore.getRecipes();
  
  if (!project) return [];
  
  const shoppingList = generateShoppingList(
    recipes,
    project.selectedRecipes,
    project.existingIngredients,
    { roundToPractical: true }
  );
  
  return shoppingList;
});

ipcMain.handle('projects:generate-prep-tasks', async (_event, projectId: string) => {
  if (!dataStore) return { tasks: [], batchGroups: [] };
  
  const project = await dataStore.getProjectById(projectId);
  const recipes = await dataStore.getRecipes();
  
  if (!project) return { tasks: [], batchGroups: [] };
  
  const result = generatePrepTasks(
    recipes,
    project.selectedRecipes,
    { considerDependencies: true, enableBatching: true }
  );
  
  return result;
});

ipcMain.handle('projects:check-risks', async (_event, projectId: string) => {
  if (!dataStore) return [];
  
  const project = await dataStore.getProjectById(projectId);
  const recipes = await dataStore.getRecipes();
  
  if (!project) return [];
  
  const risks = checkAllRisks(project, recipes);
  return risks;
});

ipcMain.handle('export:markdown', async (_event, projectId: string, options: ExportOptions) => {
  if (!dataStore) return '';
  
  const project = await dataStore.getProjectById(projectId);
  const recipes = await dataStore.getRecipes();
  
  if (!project) return '';
  
  return exportToMarkdown(project, recipes, options);
});

ipcMain.handle('export:shopping-list-csv', async (_event, projectId: string) => {
  if (!dataStore) return '';
  
  const project = await dataStore.getProjectById(projectId);
  if (!project) return '';
  
  return exportShoppingListToCSV(project.shoppingList);
});

ipcMain.handle('export:storage-labels-html', async (_event, projectId: string) => {
  if (!dataStore) return '';
  
  const project = await dataStore.getProjectById(projectId);
  const recipes = await dataStore.getRecipes();
  
  if (!project) return '';
  
  return exportStorageLabelsToHTML(project, recipes);
});

ipcMain.handle('dialog:save-file', async (_event, options: { title: string; defaultPath: string; filters: Electron.FileFilter[] }) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: options.title,
    defaultPath: options.defaultPath,
    filters: options.filters
  });
  return result.filePath;
});

ipcMain.handle('dialog:open-file', async (_event, options: { title: string; filters: Electron.FileFilter[]; properties?: ('openFile' | 'multiSelections')[] }) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: options.title,
    filters: options.filters,
    properties: options.properties || ['openFile']
  });
  return result.filePaths;
});

ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
  const fs = require('fs/promises');
  await fs.writeFile(filePath, content, 'utf-8');
});

ipcMain.handle('file:read', async (_event, filePath: string) => {
  const fs = require('fs/promises');
  return fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('settings:get', async () => {
  if (!dataStore) return null;
  return dataStore.getSettings();
});

ipcMain.handle('settings:save', async (_event, settings: any) => {
  if (!dataStore) return;
  await dataStore.saveSettings(settings);
});

ipcMain.handle('app:reset', async () => {
  if (!dataStore) return;
  await dataStore.resetToDefaults();
});
