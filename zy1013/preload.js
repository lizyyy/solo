const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  
  scanPhotos: (folderPath) => ipcRenderer.invoke('scan-photos', folderPath),
  getPhotoInfo: (filePath) => ipcRenderer.invoke('get-photo-info', filePath),
  
  loadProject: (filePath) => ipcRenderer.invoke('load-project', filePath),
  saveProject: (filePath, data) => ipcRenderer.invoke('save-project', filePath, data),
  
  checkDuplicates: (photos) => ipcRenderer.invoke('check-duplicates', photos),
  
  exportProject: (outputPath, data) => ipcRenderer.invoke('export-project', outputPath, data),
  
  generateThumbnail: (filePath, width, height) => ipcRenderer.invoke('generate-thumbnail', filePath, width, height)
});
