const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Database = require('./src/database/database');
const RiskEngine = require('./src/services/risk-engine');
const DataImporter = require('./src/services/data-importer');
const DataExporter = require('./src/services/data-exporter');

let mainWindow;
let db;
let riskEngine;
let dataImporter;
let dataExporter;
let dbReady = false;

async function initServices() {
  const dbPath = path.join(app.getPath('userData'), 'opticare-audit.db');
  db = new Database(dbPath);
  await db.ensureReady();
  riskEngine = new RiskEngine(db);
  dataImporter = new DataImporter(db);
  dataExporter = new DataExporter(db);
  dbReady = true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/ui/index.html');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  await initServices();
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

async function ensureDbReady() {
  if (!dbReady) {
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (dbReady) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
}

function setupIpcHandlers() {
  ipcMain.handle('getOrders', async (event, filters) => {
    await ensureDbReady();
    return db.getAllOrders(filters);
  });

  ipcMain.handle('getOrderById', async (event, id) => {
    await ensureDbReady();
    return db.getOrderById(id);
  });

  ipcMain.handle('getOrderRisks', async (event, orderId) => {
    await ensureDbReady();
    return db.getOrderRisks(orderId);
  });

  ipcMain.handle('createOrder', async (event, orderData) => {
    await ensureDbReady();
    const orderId = db.createOrder(orderData);
    riskEngine.analyzeOrder(orderId);
    return orderId;
  });

  ipcMain.handle('updateOrder', async (event, id, orderData) => {
    await ensureDbReady();
    db.updateOrder(id, orderData);
    riskEngine.analyzeOrder(id);
    return true;
  });

  ipcMain.handle('updateRiskStatus', async (event, riskId, status, remark) => {
    await ensureDbReady();
    db.updateRiskStatus(riskId, status, remark);
    return true;
  });

  ipcMain.handle('addNote', async (event, orderId, note) => {
    await ensureDbReady();
    return db.addNote(orderId, note);
  });

  ipcMain.handle('getNotes', async (event, orderId) => {
    await ensureDbReady();
    return db.getNotes(orderId);
  });

  ipcMain.handle('importExcel', async () => {
    await ensureDbReady();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'CSV Files', extensions: ['csv'] }
      ]
    });

    if (result.canceled) {
      return { success: false, message: '取消选择' };
    }

    try {
      const filePath = result.filePaths[0];
      const importedCount = dataImporter.importFromFile(filePath);
      return { success: true, count: importedCount, message: `成功导入 ${importedCount} 条记录` };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('exportMarkdown', async (event, orderId) => {
    await ensureDbReady();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出交接单',
      defaultPath: `交接单_${orderId}.md`,
      filters: [
        { name: 'Markdown 文件', extensions: ['md'] }
      ]
    });

    if (result.canceled) {
      return { success: false };
    }

    try {
      dataExporter.exportMarkdown(orderId, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('exportJSON', async () => {
    await ensureDbReady();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出审计明细',
      defaultPath: `审计明细_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [
        { name: 'JSON 文件', extensions: ['json'] }
      ]
    });

    if (result.canceled) {
      return { success: false };
    }

    try {
      dataExporter.exportJSON(result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('getRiskStatistics', async () => {
    await ensureDbReady();
    return db.getRiskStatistics();
  });

  ipcMain.handle('searchOrders', async (event, keyword) => {
    await ensureDbReady();
    return db.searchOrders(keyword);
  });
}
