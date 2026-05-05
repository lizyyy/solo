const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow
const userDataPath = app.getPath('userData')
const dataFilePath = path.join(userDataPath, 'tea-review-data.json')

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: '茶叶审评盲样核对工具',
    icon: path.join(__dirname, '../public/icon.png')
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
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

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  return result.filePaths
})

ipcMain.handle('select-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  return result.filePaths
})

ipcMain.handle('save-file', async (event, defaultPath, filters) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath,
    filters: filters || [
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  return result.filePath
})

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, data: content }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('list-directory', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath)
    const fileInfo = files.map(file => {
      const fullPath = path.join(dirPath, file)
      const stat = fs.statSync(fullPath)
      return {
        name: file,
        path: fullPath,
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        size: stat.size,
        mtime: stat.mtime
      }
    })
    return { success: true, data: fileInfo }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-image-base64', async (event, imagePath) => {
  try {
    const imageBuffer = fs.readFileSync(imagePath)
    const base64 = imageBuffer.toString('base64')
    const ext = path.extname(imagePath).toLowerCase().slice(1)
    const mimeType = {
      'jpg': 'jpeg',
      'jpeg': 'jpeg',
      'png': 'png',
      'gif': 'gif',
      'webp': 'webp'
    }[ext] || 'jpeg'
    return { 
      success: true, 
      data: `data:image/${mimeType};base64,${base64}` 
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('load-local-data', async () => {
  try {
    if (fs.existsSync(dataFilePath)) {
      const content = fs.readFileSync(dataFilePath, 'utf-8')
      const data = JSON.parse(content)
      return { success: true, data }
    } else {
      return { success: true, data: null }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-local-data', async (event, data) => {
  try {
    const dir = path.dirname(dataFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-data-file-path', async () => {
  return dataFilePath
})
