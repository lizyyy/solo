import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { DatabaseService } from './services/database';
import { ImportService } from './services/import';
import { RiskDetectionService } from './services/risk-detection';
import { ExportService } from './services/export';

let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService;
let importService: ImportService;
let riskService: RiskDetectionService;
let exportService: ExportService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: '室内攀岩馆线路定线复盘器',
  });

  mainWindow.loadFile(path.join(__dirname, './renderer/index.html'));

  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const dataDir = path.join(__dirname, '..', 'data');
app.setPath('userData', path.join(dataDir, 'app-data'));

function initializeServices() {
  const dbPath = path.join(dataDir, 'climbing-reviewer.json');
  dbService = new DatabaseService(dbPath);
  importService = new ImportService(dbService);
  riskService = new RiskDetectionService(dbService);
  exportService = new ExportService(dbService, riskService);
}

app.whenReady().then(() => {
  initializeServices();
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

// IPC Handlers
ipcMain.handle('import-json-wall', async (_event, filePath: string) => {
  return importService.importWallZones(filePath);
});

ipcMain.handle('import-csv-routes', async (_event, filePath: string) => {
  return importService.importRoutes(filePath);
});

ipcMain.handle('import-wear-records', async (_event, filePath: string) => {
  return importService.importWearRecords(filePath);
});

ipcMain.handle('import-feedback', async (_event, filePath: string) => {
  return importService.importFeedback(filePath);
});

ipcMain.handle('get-all-routes', async () => {
  return dbService.getAllRoutes();
});

ipcMain.handle('get-all-holds', async () => {
  return dbService.getAllHolds();
});

ipcMain.handle('get-wall-zones', async () => {
  return dbService.getWallZones();
});

ipcMain.handle('get-feedback', async () => {
  return dbService.getAllFeedback();
});

ipcMain.handle('get-reviews', async () => {
  return dbService.getAllReviews();
});

ipcMain.handle('detect-risks', async () => {
  return riskService.detectAllRisks();
});

ipcMain.handle('save-route', async (_event, route: any) => {
  return dbService.saveRoute(route);
});

ipcMain.handle('delete-route', async (_event, id: number) => {
  return dbService.deleteRoute(id);
});

ipcMain.handle('save-hold', async (_event, hold: any) => {
  return dbService.saveHold(hold);
});

ipcMain.handle('save-review', async (_event, review: any) => {
  return dbService.saveReview(review);
});

ipcMain.handle('export-markdown', async () => {
  return exportService.exportMarkdownReview();
});

ipcMain.handle('export-csv-maintenance', async () => {
  return exportService.exportMaintenanceList();
});

ipcMain.handle('export-json-audit', async () => {
  return exportService.exportAuditPackage();
});

ipcMain.handle('show-open-dialog', async (_event, options: any) => {
  if (!mainWindow) return { canceled: true };
  return dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('show-save-dialog', async (_event, options: any) => {
  if (!mainWindow) return { canceled: true };
  return dialog.showSaveDialog(mainWindow, options);
});

