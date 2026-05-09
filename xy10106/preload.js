const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getInspections: () => ipcRenderer.invoke('get-inspections'),
  saveInspection: (inspection) => ipcRenderer.invoke('save-inspection', inspection),
  deleteInspection: (id) => ipcRenderer.invoke('delete-inspection', id),
  selectZipFile: () => ipcRenderer.invoke('select-zip-file'),
  importZip: (zipPath) => ipcRenderer.invoke('import-zip', zipPath),
  exportInspection: (inspection) => ipcRenderer.invoke('export-inspection', inspection),
  openPhoto: (photoPath) => ipcRenderer.invoke('open-photo', photoPath),
  getPhotoData: (photoPath) => ipcRenderer.invoke('get-photo-data', photoPath),
  checkDuplicate: (zipName) => ipcRenderer.invoke('check-duplicate', zipName)
});
