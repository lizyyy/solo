"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    getState: () => electron_1.ipcRenderer.invoke('get-state'),
    selectFile: (fileType) => electron_1.ipcRenderer.invoke('select-file', fileType),
    selectMultipleFiles: (fileType) => electron_1.ipcRenderer.invoke('select-multiple-files', fileType),
    addItem: (itemData) => electron_1.ipcRenderer.invoke('add-item', itemData),
    updateItem: (id, updates) => electron_1.ipcRenderer.invoke('update-item', id, updates),
    deleteItem: (id) => electron_1.ipcRenderer.invoke('delete-item', id),
    markReviewed: (id) => electron_1.ipcRenderer.invoke('mark-reviewed', id),
    markDelivered: (id) => electron_1.ipcRenderer.invoke('mark-delivered', id),
    validateItem: (item) => electron_1.ipcRenderer.invoke('validate-item', item),
    exportManifest: (itemIds) => electron_1.ipcRenderer.invoke('export-manifest', itemIds)
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
