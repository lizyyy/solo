const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getData: (filename, defaultValue) => ipcRenderer.invoke('get-data', filename, defaultValue),
  saveData: (filename, data) => ipcRenderer.invoke('save-data', filename, data),
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  copyFile: (sourcePath, destPath) => ipcRenderer.invoke('copy-file', sourcePath, destPath),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  writeBinaryFile: (filePath, base64Data) => ipcRenderer.invoke('write-binary-file', filePath, base64Data),
});
