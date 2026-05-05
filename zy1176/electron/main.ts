import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDatabase } from './database';
import { FileScanner } from './services/fileScanner';
import { MaskingEngine } from './services/maskingEngine';
import { ExportService } from './services/exportService';
import { ProjectService } from './services/projectService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'DataMask Desktop - 会议素材脱敏工具',
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await initializeDatabase();
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

const projectService = new ProjectService();
const fileScanner = new FileScanner();
const maskingEngine = new MaskingEngine();
const exportService = new ExportService();

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: '选择项目文件夹',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('create-project', async (_, folderPath: string, projectName: string) => {
  return projectService.createProject(folderPath, projectName);
});

ipcMain.handle('get-projects', async () => {
  return projectService.getAllProjects();
});

ipcMain.handle('get-project', async (_, projectId: string) => {
  return projectService.getProject(projectId);
});

ipcMain.handle('scan-folder', async (_, projectId: string, folderPath: string) => {
  return fileScanner.scanFolder(projectId, folderPath);
});

ipcMain.handle('get-files', async (_, projectId: string) => {
  return projectService.getProjectFiles(projectId);
});

ipcMain.handle('get-sensitive-hits', async (_, fileId: string) => {
  return projectService.getSensitiveHits(fileId);
});

ipcMain.handle('analyze-file', async (_, fileId: string) => {
  const db = getDatabase();
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
  if (!file) throw new Error('File not found');
  
  return maskingEngine.analyzeFile(fileId, file.file_path, file.file_type);
});

ipcMain.handle('update-hit-status', async (_, hitId: string, status: string) => {
  return projectService.updateHitStatus(hitId, status);
});

ipcMain.handle('process-file', async (_, fileId: string) => {
  const db = getDatabase();
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
  if (!file) throw new Error('File not found');
  
  const hits = projectService.getSensitiveHits(fileId);
  const confirmedHits = hits.filter(h => h.status === 'confirmed');
  
  return maskingEngine.processFile(fileId, file.file_path, file.file_type, confirmedHits);
});

ipcMain.handle('export-project', async (_, projectId: string, outputPath: string) => {
  return exportService.exportProject(projectId, outputPath);
});

ipcMain.handle('select-export-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择导出目录',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('load-sample-data', async () => {
  return projectService.createSampleProject();
});

ipcMain.handle('delete-project', async (_, projectId: string) => {
  return projectService.deleteProject(projectId);
});
