const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const Store = require('electron-store')

const store = new Store()

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('store:get', (event, key) => {
  return store.get(key)
})

ipcMain.handle('store:set', (event, key, value) => {
  store.set(key, value)
  return true
})

ipcMain.handle('store:delete', (event, key) => {
  store.delete(key)
  return true
})

ipcMain.handle('store:clear', (event) => {
  store.clear()
  return true
})

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
    defaultPath: options.defaultPath,
    filters: options.filters || []
  })
  return result
})

ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
    properties: ['openFile'],
    filters: options.filters || []
  })
  return result
})
