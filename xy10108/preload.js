const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    
    getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
    
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
    
    saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),
    
    copyAttachment: (sourcePath, instrumentId) => ipcRenderer.invoke('copy-attachment', sourcePath, instrumentId),
    
    deleteAttachment: (fileName) => ipcRenderer.invoke('delete-attachment', fileName),
    
    checkAttachmentExists: (fileName) => ipcRenderer.invoke('check-attachment-exists', fileName),
    
    openAttachment: (fileName) => ipcRenderer.invoke('open-attachment', fileName),
    
    getAttachmentInfo: (fileName) => ipcRenderer.invoke('get-attachment-info', fileName),
    
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    
    writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
    
    exportExcel: (data, fileName) => ipcRenderer.invoke('export-excel', data, fileName),
    
    checkAllAttachments: (instruments) => ipcRenderer.invoke('check-all-attachments', instruments),
    
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
    
    onMenuImportData: (callback) => ipcRenderer.on('menu-import-data', callback),
    onMenuImportCertificate: (callback) => ipcRenderer.on('menu-import-certificate', callback),
    onMenuExportJson: (callback) => ipcRenderer.on('menu-export-json', callback),
    onMenuExportCsv: (callback) => ipcRenderer.on('menu-export-csv', callback),
    onMenuExportExcel: (callback) => ipcRenderer.on('menu-export-excel', callback),
    onMenuCheckAttachments: (callback) => ipcRenderer.on('menu-check-attachments', callback)
});
