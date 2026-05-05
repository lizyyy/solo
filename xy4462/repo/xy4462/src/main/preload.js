const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  importData: (options) => ipcRenderer.invoke('import-data', options),
  getAppointments: (filters) => ipcRenderer.invoke('get-appointments', filters),
  getVolunteers: () => ipcRenderer.invoke('get-volunteers'),
  getTools: () => ipcRenderer.invoke('get-tools'),
  getElders: () => ipcRenderer.invoke('get-elders'),
  detectConflicts: (date) => ipcRenderer.invoke('detect-conflicts', date),
  saveManualOverride: (override) => ipcRenderer.invoke('save-manual-override', override),
  saveNote: (note) => ipcRenderer.invoke('save-note', note),
  exportMarkdown: (options) => ipcRenderer.invoke('export-markdown', options),
  exportJson: (options) => ipcRenderer.invoke('export-json', options),
  getCurrentEvent: () => ipcRenderer.invoke('get-current-event'),
  createEvent: (eventData) => ipcRenderer.invoke('create-event', eventData),
  getRooms: () => ipcRenderer.invoke('get-rooms')
});
