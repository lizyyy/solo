const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  importFile: () => ipcRenderer.invoke('import-file'),
  importFiles: () => ipcRenderer.invoke('import-files'),
  getContracts: () => ipcRenderer.invoke('get-contracts'),
  getContract: (id) => ipcRenderer.invoke('get-contract', id),
  updateContractStatus: (id, status) => ipcRenderer.invoke('update-contract-status', { id, status }),
  deleteContract: (id) => ipcRenderer.invoke('delete-contract', id),
  getComments: (contractId) => ipcRenderer.invoke('get-comments', contractId),
  saveComment: (comment) => ipcRenderer.invoke('save-comment', comment),
  updateComment: (comment) => ipcRenderer.invoke('update-comment', comment),
  deleteComment: (id) => ipcRenderer.invoke('delete-comment', id),
  getHistory: (contractId) => ipcRenderer.invoke('get-history', contractId),
  exportExcel: (contractId) => ipcRenderer.invoke('export-excel', contractId),
  exportAllExcel: () => ipcRenderer.invoke('export-all-excel'),
  checkDuplicate: (filePath) => ipcRenderer.invoke('check-duplicate', filePath),
  verifyFileExists: (filePath) => ipcRenderer.invoke('verify-file-exists', filePath)
})
