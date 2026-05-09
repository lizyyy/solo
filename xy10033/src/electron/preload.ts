import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  auth: {
    login: (username: string, password: string) => 
      ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser')
  },
  user: {
    list: () => ipcRenderer.invoke('user:list'),
    create: (data: any) => ipcRenderer.invoke('user:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('user:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('user:delete', id)
  },
  order: {
    list: (params: any) => ipcRenderer.invoke('order:list', params),
    get: (id: string) => ipcRenderer.invoke('order:get', id),
    create: (data: any) => ipcRenderer.invoke('order:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('order:update', id, data),
    changeStatus: (id: string, newStatus: string, reason: string | null) => 
      ipcRenderer.invoke('order:changeStatus', id, newStatus, reason),
    delete: (id: string) => ipcRenderer.invoke('order:delete', id),
    history: (orderId: string) => ipcRenderer.invoke('order:history', orderId)
  },
  batch: {
    changeStatus: (orderIds: string[], newStatus: string, reason: string | null) =>
      ipcRenderer.invoke('batch:changeStatus', orderIds, newStatus, reason),
    assign: (orderIds: string[], assigneeId: string, assigneeName: string) =>
      ipcRenderer.invoke('batch:assign', orderIds, assigneeId, assigneeName)
  },
  failed: {
    list: () => ipcRenderer.invoke('failed:list'),
    retry: (failedOpId: string) => ipcRenderer.invoke('failed:retry', failedOpId),
    clear: (failedOpId: string) => ipcRenderer.invoke('failed:clear', failedOpId)
  },
  log: {
    list: (params: any) => ipcRenderer.invoke('log:list', params)
  },
  import: {
    excel: (filePath: string) => ipcRenderer.invoke('import:excel', filePath),
    csv: (filePath: string) => ipcRenderer.invoke('import:csv', filePath)
  },
  export: {
    excel: (orderIds?: string[]) => ipcRenderer.invoke('export:excel', orderIds),
    csv: (orderIds?: string[]) => ipcRenderer.invoke('export:csv', orderIds),
    template: () => ipcRenderer.invoke('export:template')
  },
  file: {
    openDialog: (options: any) => ipcRenderer.invoke('file:openDialog', options)
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
