import { contextBridge, ipcRenderer } from 'electron'

const api = {
  openFile: (filters: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:openFile', filters),
  
  saveFile: (options: { title: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:saveFile', options),
  
  readFile: (filePath: string) =>
    ipcRenderer.invoke('file:read', filePath),
  
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('file:write', filePath, content),
  
  fileExists: (filePath: string) =>
    ipcRenderer.invoke('file:exists', filePath),
  
  getAppPath: (name: string) =>
    ipcRenderer.invoke('app:getPath', name)
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: typeof api
  }
}
