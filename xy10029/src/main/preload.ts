import { contextBridge, ipcRenderer } from 'electron'
import { ApiResponse, User, Device, DeviceStatus, PaginationParams, ExportOptions } from '@shared/types'

const api = {
  auth: {
    login: (username: string, password: string): Promise<ApiResponse<User>> =>
      ipcRenderer.invoke('auth:login', username, password)
  },

  users: {
    list: (params: PaginationParams): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('users:list', params),
    create: (data: any): Promise<ApiResponse<User>> =>
      ipcRenderer.invoke('users:create', data),
    update: (id: string, updates: any): Promise<ApiResponse<User | null>> =>
      ipcRenderer.invoke('users:update', id, updates),
    resetPassword: (id: string, newPassword?: string): Promise<ApiResponse<string>> =>
      ipcRenderer.invoke('users:resetPassword', id, newPassword)
  },

  devices: {
    list: (params: any): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('devices:list', params),
    get: (id: string): Promise<ApiResponse<Device | null>> =>
      ipcRenderer.invoke('devices:get', id),
    create: (data: any, operator: User): Promise<ApiResponse<Device>> =>
      ipcRenderer.invoke('devices:create', data, operator),
    update: (id: string, updates: any, operator: User): Promise<ApiResponse<Device | null>> =>
      ipcRenderer.invoke('devices:update', id, updates, operator),
    lend: (deviceId: string, borrowerId: string, borrowerName: string, operator: User, expectedReturnAt?: string, purpose?: string): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('devices:lend', deviceId, borrowerId, borrowerName, operator, expectedReturnAt, purpose),
    return: (deviceId: string, operator: User, notes?: string): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('devices:return', deviceId, operator, notes),
    changeStatus: (deviceId: string, newStatus: DeviceStatus, operator: User, notes?: string): Promise<ApiResponse<Device | null>> =>
      ipcRenderer.invoke('devices:changeStatus', deviceId, newStatus, operator, notes),
    delete: (deviceId: string, operator: User): Promise<ApiResponse<boolean>> =>
      ipcRenderer.invoke('devices:delete', deviceId, operator),
    history: (deviceId: string): Promise<ApiResponse<any[]>> =>
      ipcRenderer.invoke('devices:history', deviceId),
    restore: (historyId: string, operator: User): Promise<ApiResponse<Device | null>> =>
      ipcRenderer.invoke('devices:restore', historyId, operator)
  },

  borrows: {
    list: (params: any): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('borrows:list', params)
  },

  logs: {
    list: (params: any): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('logs:list', params)
  },

  retry: {
    list: (params: any): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('retry:list', params),
    cancel: (id: string): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('retry:cancel', id)
  },

  batch: {
    list: (params: PaginationParams): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('batch:list', params),
    get: (id: string): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('batch:get', id),
    lend: (deviceIds: string[], borrowerId: string, borrowerName: string, operator: User, expectedReturnAt?: string, purpose?: string): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('batch:lend', deviceIds, borrowerId, borrowerName, operator, expectedReturnAt, purpose),
    return: (deviceIds: string[], operator: User): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('batch:return', deviceIds, operator)
  },

  export: {
    devices: (options: ExportOptions): Promise<ApiResponse<string>> =>
      ipcRenderer.invoke('export:devices', options),
    borrows: (options: ExportOptions): Promise<ApiResponse<string>> =>
      ipcRenderer.invoke('export:borrows', options)
  },

  import: {
    devices: (operator: User): Promise<ApiResponse<any>> =>
      ipcRenderer.invoke('import:devices', operator)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
