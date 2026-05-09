const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const Database = require('./database')
const FileHandler = require('./fileHandler')
const Exporter = require('./exporter')

let mainWindow
let db
let fileHandler
let exporter

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
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
  db = new Database()
  db.init()
  fileHandler = new FileHandler(db)
  exporter = new Exporter(db)
  
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
ipcMain.handle('import-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Word 文档', extensions: ['docx'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    
    const filePath = result.filePaths[0]
    return await fileHandler.importFile(filePath)
  } catch (error) {
    console.error('Import error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('import-files', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Word 文档', extensions: ['docx'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    
    const results = []
    for (const filePath of result.filePaths) {
      results.push(await fileHandler.importFile(filePath))
    }
    
    return { success: true, results }
  } catch (error) {
    console.error('Import error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-contracts', () => {
  return db.getContracts()
})

ipcMain.handle('get-contract', (event, id) => {
  return db.getContract(id)
})

ipcMain.handle('update-contract-status', (event, { id, status }) => {
  return db.updateContractStatus(id, status)
})

ipcMain.handle('delete-contract', (event, id) => {
  return db.deleteContract(id)
})

ipcMain.handle('get-comments', (event, contractId) => {
  return db.getComments(contractId)
})

ipcMain.handle('save-comment', (event, comment) => {
  return db.saveComment(comment)
})

ipcMain.handle('update-comment', (event, comment) => {
  return db.updateComment(comment)
})

ipcMain.handle('delete-comment', (event, id) => {
  return db.deleteComment(id)
})

ipcMain.handle('get-history', (event, contractId) => {
  return db.getHistory(contractId)
})

ipcMain.handle('export-excel', async (event, contractId) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出批注清单',
      defaultPath: `合同批注清单_${Date.now()}.xlsx`,
      filters: [
        { name: 'Excel 文件', extensions: ['xlsx'] },
        { name: 'CSV 文件', extensions: ['csv'] }
      ]
    })
    
    if (result.canceled) {
      return { success: false, canceled: true }
    }
    
    return exporter.exportToExcel(contractId, result.filePath)
  } catch (error) {
    console.error('Export error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('export-all-excel', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出全部批注清单',
      defaultPath: `全部合同批注清单_${Date.now()}.xlsx`,
      filters: [
        { name: 'Excel 文件', extensions: ['xlsx'] }
      ]
    })
    
    if (result.canceled) {
      return { success: false, canceled: true }
    }
    
    return exporter.exportAllToExcel(result.filePath)
  } catch (error) {
    console.error('Export error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('check-duplicate', (event, filePath) => {
  return db.checkDuplicate(filePath)
})

ipcMain.handle('verify-file-exists', (event, filePath) => {
  return fileHandler.verifyFileExists(filePath)
})
