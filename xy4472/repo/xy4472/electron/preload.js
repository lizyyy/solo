const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 数据存储
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key) => ipcRenderer.invoke('store-delete', key),
  
  // 文件对话框
  dialogSaveFile: (options) => ipcRenderer.invoke('dialog-save-file', options),
  dialogOpenFile: (options) => ipcRenderer.invoke('dialog-open-file', options)
})
