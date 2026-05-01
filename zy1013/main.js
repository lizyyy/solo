const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');

const FileScanner = require('./src/fileScanner');
const DuplicateChecker = require('./src/duplicateChecker');
const DataManager = require('./src/dataManager');
const Exporter = require('./src/exporter');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    ...options
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('save-file', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    ...options
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('scan-photos', async (event, folderPath) => {
  try {
    const photos = await FileScanner.scanFolder(folderPath);
    return { success: true, data: photos };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-photo-info', async (event, filePath) => {
  try {
    const info = await FileScanner.getPhotoInfo(filePath);
    return { success: true, data: info };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-project', async (event, filePath) => {
  try {
    const data = await DataManager.loadProject(filePath);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-project', async (event, filePath, data) => {
  try {
    await DataManager.saveProject(filePath, data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-duplicates', async (event, photos) => {
  try {
    const duplicates = await DuplicateChecker.check(photos);
    return { success: true, data: duplicates };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-project', async (event, outputPath, data) => {
  try {
    const result = await Exporter.export(outputPath, data);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-thumbnail', async (event, filePath, width, height) => {
  try {
    const thumbnail = await FileScanner.generateThumbnail(filePath, width, height);
    return { success: true, data: thumbnail };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
