const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const Store = require('electron-store')

const store = new Store()

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: '听力服务回访管理工具'
  })

  const isDev = !app.isPackaged
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC 通信 - 数据存储
ipcMain.handle('store-get', (_, key) => {
  return store.get(key)
})

ipcMain.handle('store-set', (_, key, value) => {
  store.set(key, value)
  return true
})

ipcMain.handle('store-delete', (_, key) => {
  store.delete(key)
  return true
})

// IPC 通信 - 文件对话框
ipcMain.handle('dialog-save-file', async (_, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result
})

ipcMain.handle('dialog-open-file', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result
})
