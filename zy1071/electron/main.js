const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow

const getAppDataPath = () => {
  return path.join(app.getPath('userData'), 'moving-box-data')
}

const ensureAppDataDir = () => {
  const dataPath = getAppDataPath()
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }
  return dataPath
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: '搬家装箱清单和易碎风险核对器'
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ensureAppDataDir()
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

ipcMain.handle('save-project', async (event, projectData) => {
  try {
    const dataPath = getAppDataPath()
    const projectFile = path.join(dataPath, `project-${projectData.id}.json`)
    fs.writeFileSync(projectFile, JSON.stringify(projectData, null, 2))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('load-project', async (event, projectId) => {
  try {
    const dataPath = getAppDataPath()
    const projectFile = path.join(dataPath, `project-${projectId}.json`)
    if (fs.existsSync(projectFile)) {
      const data = fs.readFileSync(projectFile, 'utf-8')
      return { success: true, data: JSON.parse(data) }
    }
    return { success: false, error: '项目不存在' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('list-projects', async () => {
  try {
    const dataPath = getAppDataPath()
    if (!fs.existsSync(dataPath)) {
      return { success: true, projects: [] }
    }
    const files = fs.readdirSync(dataPath)
      .filter(f => f.startsWith('project-') && f.endsWith('.json'))
    
    const projects = files.map(f => {
      const content = fs.readFileSync(path.join(dataPath, f), 'utf-8')
      return JSON.parse(content)
    })
    
    return { success: true, projects }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('delete-project', async (event, projectId) => {
  try {
    const dataPath = getAppDataPath()
    const projectFile = path.join(dataPath, `project-${projectId}.json`)
    if (fs.existsSync(projectFile)) {
      fs.unlinkSync(projectFile)
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('export-file', async (event, { filename, content, type }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出文件',
      defaultPath: filename,
      filters: [
        { name: type === 'csv' ? 'CSV文件' : type === 'md' ? 'Markdown文件' : 'HTML文件', 
          extensions: [type] }
      ]
    })
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content)
      return { success: true, path: result.filePath }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('import-csv', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入CSV文件',
      properties: ['openFile'],
      filters: [
        { name: 'CSV文件', extensions: ['csv'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8')
      return { success: true, content }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
