"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    auth: {
        login: (username, password) => electron_1.ipcRenderer.invoke('auth:login', username, password),
        logout: () => electron_1.ipcRenderer.invoke('auth:logout'),
        getCurrentUser: () => electron_1.ipcRenderer.invoke('auth:getCurrentUser')
    },
    user: {
        list: () => electron_1.ipcRenderer.invoke('user:list'),
        create: (data) => electron_1.ipcRenderer.invoke('user:create', data),
        update: (id, data) => electron_1.ipcRenderer.invoke('user:update', id, data),
        delete: (id) => electron_1.ipcRenderer.invoke('user:delete', id)
    },
    order: {
        list: (params) => electron_1.ipcRenderer.invoke('order:list', params),
        get: (id) => electron_1.ipcRenderer.invoke('order:get', id),
        create: (data) => electron_1.ipcRenderer.invoke('order:create', data),
        update: (id, data) => electron_1.ipcRenderer.invoke('order:update', id, data),
        changeStatus: (id, newStatus, reason) => electron_1.ipcRenderer.invoke('order:changeStatus', id, newStatus, reason),
        delete: (id) => electron_1.ipcRenderer.invoke('order:delete', id),
        history: (orderId) => electron_1.ipcRenderer.invoke('order:history', orderId)
    },
    batch: {
        changeStatus: (orderIds, newStatus, reason) => electron_1.ipcRenderer.invoke('batch:changeStatus', orderIds, newStatus, reason),
        assign: (orderIds, assigneeId, assigneeName) => electron_1.ipcRenderer.invoke('batch:assign', orderIds, assigneeId, assigneeName)
    },
    failed: {
        list: () => electron_1.ipcRenderer.invoke('failed:list'),
        retry: (failedOpId) => electron_1.ipcRenderer.invoke('failed:retry', failedOpId),
        clear: (failedOpId) => electron_1.ipcRenderer.invoke('failed:clear', failedOpId)
    },
    log: {
        list: (params) => electron_1.ipcRenderer.invoke('log:list', params)
    },
    import: {
        excel: (filePath) => electron_1.ipcRenderer.invoke('import:excel', filePath),
        csv: (filePath) => electron_1.ipcRenderer.invoke('import:csv', filePath)
    },
    export: {
        excel: (orderIds) => electron_1.ipcRenderer.invoke('export:excel', orderIds),
        csv: (orderIds) => electron_1.ipcRenderer.invoke('export:csv', orderIds),
        template: () => electron_1.ipcRenderer.invoke('export:template')
    },
    file: {
        openDialog: (options) => electron_1.ipcRenderer.invoke('file:openDialog', options)
    }
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
