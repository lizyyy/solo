const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveProject: (projectData) => ipcRenderer.invoke('save-project', projectData),
  loadProject: (projectId) => ipcRenderer.invoke('load-project', projectId),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  deleteProject: (projectId) => ipcRenderer.invoke('delete-project', projectId),
  exportFile: (options) => ipcRenderer.invoke('export-file', options),
  importCsv: () => ipcRenderer.invoke('import-csv')
})
