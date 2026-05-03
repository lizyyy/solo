const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  materials: {
    getAll: () => ipcRenderer.invoke('db:materials:getAll'),
    getById: (id) => ipcRenderer.invoke('db:materials:getById', id),
    create: (material) => ipcRenderer.invoke('db:materials:create', material),
    update: (id, material) => ipcRenderer.invoke('db:materials:update', id, material),
    delete: (id) => ipcRenderer.invoke('db:materials:delete', id),
    import: (materials) => ipcRenderer.invoke('db:materials:import', materials),
  },
  projects: {
    getAll: () => ipcRenderer.invoke('db:projects:getAll'),
    getById: (id) => ipcRenderer.invoke('db:projects:getById', id),
    create: (project) => ipcRenderer.invoke('db:projects:create', project),
    update: (id, project) => ipcRenderer.invoke('db:projects:update', id, project),
    delete: (id) => ipcRenderer.invoke('db:projects:delete', id),
  },
  timelines: {
    getByProject: (projectId) => ipcRenderer.invoke('db:timelines:getByProject', projectId),
    create: (timeline) => ipcRenderer.invoke('db:timelines:create', timeline),
    update: (id, timeline) => ipcRenderer.invoke('db:timelines:update', id, timeline),
    delete: (id) => ipcRenderer.invoke('db:timelines:delete', id),
  },
  export: {
    project: (projectId) => ipcRenderer.invoke('db:export:project', projectId),
  },
  import: {
    project: (data) => ipcRenderer.invoke('db:import:project', data),
  },
  sampleData: {
    init: () => ipcRenderer.invoke('db:sampleData:init'),
  },
  dialog: {
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  },
})
