const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  importFiles: () => ipcRenderer.invoke('import-files'),
  getInvoices: (filters) => ipcRenderer.invoke('get-invoices', filters),
  getInvoice: (id) => ipcRenderer.invoke('get-invoice', id),
  saveInvoice: (id, data) => ipcRenderer.invoke('save-invoice', id, data),
  reviewInvoice: (id, reviewer) => ipcRenderer.invoke('review-invoice', id, reviewer),
  unreviewInvoice: (id) => ipcRenderer.invoke('unreview-invoice', id),
  deleteInvoice: (id) => ipcRenderer.invoke('delete-invoice', id),
  getOperationsLog: (limit) => ipcRenderer.invoke('get-operations-log', limit),
  exportExcel: (filters) => ipcRenderer.invoke('export-excel', filters),
  getStats: () => ipcRenderer.invoke('get-stats'),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  showFileInFolder: (filePath) => ipcRenderer.invoke('show-file-in-folder', filePath),
  getFilePreview: (filePath) => ipcRenderer.invoke('get-file-preview', filePath),
  onMenuImportFiles: (callback) => {
    ipcRenderer.on('menu-import-files', callback);
  },
  onMenuExport: (callback) => {
    ipcRenderer.on('menu-export', callback);
  }
});
