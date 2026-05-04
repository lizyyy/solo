const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear')
  },
  dialog: {
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options)
  }
})
