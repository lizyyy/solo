const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const isDev = require('electron-is-dev')
const dbManager = require('./database')
const { initSampleData } = require('./sample-data')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const url = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`

  mainWindow.loadURL(url)

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  await dbManager.initDatabase()
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

ipcMain.handle('db:materials:getAll', async () => {
  return dbManager.getAllMaterials()
})

ipcMain.handle('db:materials:getById', async (_, id) => {
  return dbManager.getMaterialById(id)
})

ipcMain.handle('db:materials:create', async (_, material) => {
  return dbManager.createMaterial(material)
})

ipcMain.handle('db:materials:update', async (_, id, material) => {
  return dbManager.updateMaterial(id, material)
})

ipcMain.handle('db:materials:delete', async (_, id) => {
  return dbManager.deleteMaterial(id)
})

ipcMain.handle('db:materials:import', async (_, materials) => {
  return dbManager.importMaterials(materials)
})

ipcMain.handle('db:projects:getAll', async () => {
  return dbManager.getAllProjects()
})

ipcMain.handle('db:projects:getById', async (_, id) => {
  return dbManager.getProjectById(id)
})

ipcMain.handle('db:projects:create', async (_, project) => {
  return dbManager.createProject(project)
})

ipcMain.handle('db:projects:update', async (_, id, project) => {
  return dbManager.updateProject(id, project)
})

ipcMain.handle('db:projects:delete', async (_, id) => {
  return dbManager.deleteProject(id)
})

ipcMain.handle('db:timelines:getByProject', async (_, projectId) => {
  return dbManager.getTimelinesByProject(projectId)
})

ipcMain.handle('db:timelines:create', async (_, timeline) => {
  return dbManager.createTimeline(timeline)
})

ipcMain.handle('db:timelines:update', async (_, id, timeline) => {
  return dbManager.updateTimeline(id, timeline)
})

ipcMain.handle('db:timelines:delete', async (_, id) => {
  return dbManager.deleteTimeline(id)
})

ipcMain.handle('db:export:project', async (_, projectId) => {
  return dbManager.exportProject(projectId)
})

ipcMain.handle('db:import:project', async (_, data) => {
  return dbManager.importProject(data)
})

ipcMain.handle('db:sampleData:init', async () => {
  return initSampleData()
})

ipcMain.handle('dialog:saveFile', async (_, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result
})

ipcMain.handle('dialog:openFile', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result
})
