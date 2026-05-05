const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getOrders: () => ipcRenderer.invoke('get-orders'),
  getOrderDetail: (orderId) => ipcRenderer.invoke('get-order-detail', orderId),
  importData: (data) => ipcRenderer.invoke('import-data', data),
  runRiskCheck: (orderId) => ipcRenderer.invoke('run-risk-check', orderId),
  saveJudgment: (judgment) => ipcRenderer.invoke('save-judgment', judgment),
  saveNote: (note) => ipcRenderer.invoke('save-note', note),
  exportMarkdown: (orderId) => ipcRenderer.invoke('export-markdown', orderId),
  exportJson: (orderId) => ipcRenderer.invoke('export-json', orderId),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content)
})
