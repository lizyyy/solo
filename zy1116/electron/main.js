const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Database = require('./database')

let mainWindow
let db

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: '剧场CUE管理器'
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'theater-cue.db')
  db = new Database(dbPath)
  db.init()
  
  console.log('Database initialized at:', dbPath)
}

function setupIPC() {
  ipcMain.handle('db:query', (event, sql, params = []) => {
    return db.query(sql, params)
  })

  ipcMain.handle('db:run', (event, sql, params = []) => {
    return db.run(sql, params)
  })

  ipcMain.handle('db:get', (event, sql, params = []) => {
    return db.get(sql, params)
  })

  ipcMain.handle('db:transaction', (event, fnName) => {
    return db.transaction(fnName)
  })
}

app.whenReady().then(() => {
  initDatabase()
  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (db) {
    db.close()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
