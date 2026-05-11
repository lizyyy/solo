"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    auth: {
        login: (username, password) => electron_1.ipcRenderer.invoke('auth:login', username, password)
    },
    users: {
        list: (params) => electron_1.ipcRenderer.invoke('users:list', params),
        create: (data) => electron_1.ipcRenderer.invoke('users:create', data),
        update: (id, updates) => electron_1.ipcRenderer.invoke('users:update', id, updates),
        resetPassword: (id, newPassword) => electron_1.ipcRenderer.invoke('users:resetPassword', id, newPassword)
    },
    devices: {
        list: (params) => electron_1.ipcRenderer.invoke('devices:list', params),
        get: (id) => electron_1.ipcRenderer.invoke('devices:get', id),
        create: (data, operator) => electron_1.ipcRenderer.invoke('devices:create', data, operator),
        update: (id, updates, operator) => electron_1.ipcRenderer.invoke('devices:update', id, updates, operator),
        lend: (deviceId, borrowerId, borrowerName, operator, expectedReturnAt, purpose) => electron_1.ipcRenderer.invoke('devices:lend', deviceId, borrowerId, borrowerName, operator, expectedReturnAt, purpose),
        return: (deviceId, operator, notes) => electron_1.ipcRenderer.invoke('devices:return', deviceId, operator, notes),
        changeStatus: (deviceId, newStatus, operator, notes) => electron_1.ipcRenderer.invoke('devices:changeStatus', deviceId, newStatus, operator, notes),
        delete: (deviceId, operator) => electron_1.ipcRenderer.invoke('devices:delete', deviceId, operator),
        history: (deviceId) => electron_1.ipcRenderer.invoke('devices:history', deviceId),
        restore: (historyId, operator) => electron_1.ipcRenderer.invoke('devices:restore', historyId, operator)
    },
    borrows: {
        list: (params) => electron_1.ipcRenderer.invoke('borrows:list', params)
    },
    logs: {
        list: (params) => electron_1.ipcRenderer.invoke('logs:list', params)
    },
    retry: {
        list: (params) => electron_1.ipcRenderer.invoke('retry:list', params),
        cancel: (id) => electron_1.ipcRenderer.invoke('retry:cancel', id)
    },
    batch: {
        list: (params) => electron_1.ipcRenderer.invoke('batch:list', params),
        get: (id) => electron_1.ipcRenderer.invoke('batch:get', id),
        lend: (deviceIds, borrowerId, borrowerName, operator, expectedReturnAt, purpose) => electron_1.ipcRenderer.invoke('batch:lend', deviceIds, borrowerId, borrowerName, operator, expectedReturnAt, purpose),
        return: (deviceIds, operator) => electron_1.ipcRenderer.invoke('batch:return', deviceIds, operator)
    },
    export: {
        devices: (options) => electron_1.ipcRenderer.invoke('export:devices', options),
        borrows: (options) => electron_1.ipcRenderer.invoke('export:borrows', options)
    },
    import: {
        devices: (operator) => electron_1.ipcRenderer.invoke('import:devices', operator)
    }
};
electron_1.contextBridge.exposeInMainWorld('api', api);
//# sourceMappingURL=preload.js.map