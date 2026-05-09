import type { IpcResult } from '../types'

const { ipcRenderer } = require('electron')

async function invoke(channel: string, ...args: any[]): Promise<IpcResult> {
  return ipcRenderer.invoke(channel, ...args)
}

export const ipc = {
  auth: {
    login: (username: string, password: string) => invoke('auth:login', username, password),
    changePassword: (userId: string, oldPass: string, newPass: string) =>
      invoke('auth:changePassword', userId, oldPass, newPass),
    listUsers: () => invoke('auth:listUsers'),
    createUser: (data: any) => invoke('auth:createUser', data),
    updateUser: (id: string, data: any) => invoke('auth:updateUser', id, data),
    deleteUser: (id: string) => invoke('auth:deleteUser', id),
  },

  inventory: {
    listProducts: (params?: any) => invoke('inventory:listProducts', params),
    createProduct: (data: any) => invoke('inventory:createProduct', data),
    updateProduct: (id: string, data: any) => invoke('inventory:updateProduct', id, data),
    updateInventory: (productId: string, data: any) =>
      invoke('inventory:updateInventory', productId, data),
    getHistory: (inventoryId: string, take?: number) =>
      invoke('inventory:getHistory', inventoryId, take),
    getCategories: () => invoke('inventory:getCategories'),
    getLowStock: (minQty: number) => invoke('inventory:getLowStock', minQty),
    batchUpdate: (items: any[], userId: string) =>
      invoke('inventory:batchUpdate', items, userId),
  },

  task: {
    listTasks: (params?: any) => invoke('task:listTasks', params),
    getById: (id: string) => invoke('task:getById', id),
    create: (data: any) => invoke('task:create', data),
    updateStatus: (data: any) => invoke('task:updateStatus', data),
    assign: (taskId: string, assigneeId: string, userId: string) =>
      invoke('task:assign', taskId, assigneeId, userId),
    addRecord: (data: any) => invoke('task:addRecord', data),
    batchAddRecords: (taskId: string, items: any[]) =>
      invoke('task:batchAddRecords', taskId, items),
    getHistory: (taskId: string) => invoke('task:getHistory', taskId),
    getStatistics: (taskId: string) => invoke('task:getStatistics', taskId),
  },

  sync: {
    addToQueue: (data: any) => invoke('sync:addToQueue', data),
    processQueue: () => invoke('sync:processQueue'),
    retryFailed: () => invoke('sync:retryFailed'),
    resetItem: (itemId: string) => invoke('sync:resetItem', itemId),
    getStats: () => invoke('sync:getStats'),
    listQueue: (params?: any) => invoke('sync:listQueue', params),
  },

  log: {
    getLogs: (params?: any) => invoke('log:getLogs', params),
  },

  export: {
    saveDialog: () => invoke('export:saveDialog'),
    openDialog: () => invoke('export:openDialog'),
    inventoryExcel: (filePath: string, params?: any) =>
      invoke('export:inventoryExcel', filePath, params),
    inventoryCSV: (filePath: string, params?: any) =>
      invoke('export:inventoryCSV', filePath, params),
    taskRecords: (taskId: string, filePath: string) =>
      invoke('export:taskRecords', taskId, filePath),
    logsExcel: (filePath: string, params?: any) =>
      invoke('export:logsExcel', filePath, params),
    importInventory: (filePath: string, userId: string) =>
      invoke('export:importInventory', filePath, userId),
  },
}
