const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
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

// IPC 处理程序
ipcMain.handle('save-data', async (event, data) => {
  try {
    const dataPath = path.join(app.getPath('userData'), 'specimen-data.json')
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('load-data', async () => {
  try {
    const dataPath = path.join(app.getPath('userData'), 'specimen-data.json')
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf-8')
      return { success: true, data: JSON.parse(data) }
    } else {
      return { success: true, data: null }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('export-file', async (event, { type, content }) => {
  try {
    const ext = type === 'markdown' ? 'md' : 'json'
    const defaultPath = path.join(
      app.getPath('documents'),
      `specimen-disposition.${ext}`
    )

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [
        { name: type === 'markdown' ? 'Markdown 文件' : 'JSON 文件', extensions: [ext] }
      ]
    })

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content)
      return { success: true, filePath: result.filePath }
    }

    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
