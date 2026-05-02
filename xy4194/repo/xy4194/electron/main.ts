import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseSceneSheet, parsePropStatus, parseActorCallSheet } from './parsers'
import { validateContinuity, ValidationIssue } from './validators'
import { Database, initializeDatabase } from './database'
import { exportMarkdown, exportCSV, exportJSON } from './exporters'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let database: Database | null = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '连续性穿帮核对台',
  })

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

async function initializeApp() {
  const userDataPath = app.getPath('userData')
  database = await initializeDatabase(userDataPath)
  console.log('Database initialized at:', userDataPath)
}

app.whenReady().then(async () => {
  await initializeApp()
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

// IPC Handlers
ipcMain.handle('open-file-dialog', async (event, options) => {
  if (!mainWindow) return null
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters,
  })
  
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('open-directory-dialog', async () => {
  if (!mainWindow) return null
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('parse-scene-sheet', async (event, filePath: string) => {
  return await parseSceneSheet(filePath)
})

ipcMain.handle('parse-prop-status', async (event, filePath: string) => {
  return await parsePropStatus(filePath)
})

ipcMain.handle('parse-actor-call-sheet', async (event, filePath: string) => {
  return await parseActorCallSheet(filePath)
})

ipcMain.handle('validate-continuity', async (event, data) => {
  return validateContinuity(data)
})

// Database operations
ipcMain.handle('get-all-reviews', async () => {
  if (!database) return []
  return database.getAllReviews()
})

ipcMain.handle('save-review', async (event, review) => {
  if (!database) return null
  return database.saveReview(review)
})

ipcMain.handle('get-review-by-issue-id', async (event, issueId: string) => {
  if (!database) return null
  return database.getReviewByIssueId(issueId)
})

ipcMain.handle('get-all-projects', async () => {
  if (!database) return []
  return database.getAllProjects()
})

ipcMain.handle('save-project', async (event, project) => {
  if (!database) return null
  return database.saveProject(project)
})

ipcMain.handle('get-project', async (event, projectId: string) => {
  if (!database) return null
  return database.getProject(projectId)
})

// Export handlers
ipcMain.handle('export-markdown', async (event, data, savePath?: string) => {
  if (!mainWindow && !savePath) return null
  
  if (!savePath) {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出Markdown复盘单',
      defaultPath: '连续性复盘单.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (result.canceled) return null
    savePath = result.filePath!
  }
  
  return await exportMarkdown(data, savePath)
})

ipcMain.handle('export-csv', async (event, data, savePath?: string) => {
  if (!mainWindow && !savePath) return null
  
  if (!savePath) {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出CSV问题表',
      defaultPath: '连续性问题表.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (result.canceled) return null
    savePath = result.filePath!
  }
  
  return await exportCSV(data, savePath)
})

ipcMain.handle('export-json', async (event, data, savePath?: string) => {
  if (!mainWindow && !savePath) return null
  
  if (!savePath) {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出JSON审计包',
      defaultPath: '连续性审计包.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled) return null
    savePath = result.filePath!
  }
  
  return await exportJSON(data, savePath)
})
