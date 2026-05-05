const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  saveFile: (defaultPath, filters) => ipcRenderer.invoke('save-file', defaultPath, filters),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  listDirectory: (dirPath) => ipcRenderer.invoke('list-directory', dirPath),
  getImageBase64: (imagePath) => ipcRenderer.invoke('get-image-base64', imagePath),
  loadLocalData: () => ipcRenderer.invoke('load-local-data'),
  saveLocalData: (data) => ipcRenderer.invoke('save-local-data', data),
  getDataFilePath: () => ipcRenderer.invoke('get-data-file-path')
})
