const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Database = require('./database');
const DataImporter = require('./importer');
const ConflictDetector = require('./detector');
const Exporter = require('./exporter');

let mainWindow;
let db;

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

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  db = new Database();
  db.init();
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

ipcMain.handle('import-data', async (event, options) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Excel/CSV文件', extensions: ['xlsx', 'xls', 'csv'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, message: '未选择文件' };
    }

    const importer = new DataImporter(db);
    const results = await importer.importFiles(filePaths, options);
    return { success: true, data: results };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-appointments', (event, filters) => {
  return db.getAppointments(filters);
});

ipcMain.handle('get-volunteers', (event) => {
  return db.getVolunteers();
});

ipcMain.handle('get-tools', (event) => {
  return db.getTools();
});

ipcMain.handle('get-elders', (event) => {
  return db.getElders();
});

ipcMain.handle('detect-conflicts', (event, date) => {
  const detector = new ConflictDetector(db);
  return detector.detectAll(date);
});

ipcMain.handle('save-manual-override', (event, override) => {
  return db.saveManualOverride(override);
});

ipcMain.handle('save-note', (event, note) => {
  return db.saveNote(note);
});

ipcMain.handle('export-markdown', async (event, options) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `交接单_${new Date().toISOString().split('T')[0]}.md`,
      filters: [
        { name: 'Markdown文件', extensions: ['md'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, message: '未选择保存位置' };
    }

    const exporter = new Exporter(db);
    exporter.exportMarkdown(filePath, options);
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('export-json', async (event, options) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `明细_${new Date().toISOString().split('T')[0]}.json`,
      filters: [
        { name: 'JSON文件', extensions: ['json'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, message: '未选择保存位置' };
    }

    const exporter = new Exporter(db);
    exporter.exportJson(filePath, options);
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-current-event', (event) => {
  return db.getCurrentEvent();
});

ipcMain.handle('create-event', (event, eventData) => {
  return db.createEvent(eventData);
});

ipcMain.handle('get-rooms', (event) => {
  return db.getRooms();
});
