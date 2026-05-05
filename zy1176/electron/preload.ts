import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectExportFolder: () => ipcRenderer.invoke('select-export-folder'),
  
  createProject: (folderPath: string, projectName: string) => 
    ipcRenderer.invoke('create-project', folderPath, projectName),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getProject: (projectId: string) => ipcRenderer.invoke('get-project', projectId),
  deleteProject: (projectId: string) => ipcRenderer.invoke('delete-project', projectId),
  
  scanFolder: (projectId: string, folderPath: string) => 
    ipcRenderer.invoke('scan-folder', projectId, folderPath),
  getFiles: (projectId: string) => ipcRenderer.invoke('get-files', projectId),
  
  analyzeFile: (fileId: string) => ipcRenderer.invoke('analyze-file', fileId),
  getSensitiveHits: (fileId: string) => ipcRenderer.invoke('get-sensitive-hits', fileId),
  updateHitStatus: (hitId: string, status: string) => 
    ipcRenderer.invoke('update-hit-status', hitId, status),
  
  processFile: (fileId: string) => ipcRenderer.invoke('process-file', fileId),
  exportProject: (projectId: string, outputPath: string) => 
    ipcRenderer.invoke('export-project', projectId, outputPath),
  
  loadSampleData: () => ipcRenderer.invoke('load-sample-data'),
});

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      selectExportFolder: () => Promise<string | null>;
      createProject: (folderPath: string, projectName: string) => Promise<any>;
      getProjects: () => Promise<any[]>;
      getProject: (projectId: string) => Promise<any>;
      deleteProject: (projectId: string) => Promise<void>;
      scanFolder: (projectId: string, folderPath: string) => Promise<any[]>;
      getFiles: (projectId: string) => Promise<any[]>;
      analyzeFile: (fileId: string) => Promise<any[]>;
      getSensitiveHits: (fileId: string) => Promise<any[]>;
      updateHitStatus: (hitId: string, status: string) => Promise<void>;
      processFile: (fileId: string) => Promise<any>;
      exportProject: (projectId: string, outputPath: string) => Promise<any>;
      loadSampleData: () => Promise<any>;
    };
  }
}
