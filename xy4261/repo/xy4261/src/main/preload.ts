import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (fileType: string) => ipcRenderer.invoke('open-file', fileType),
  saveFile: (data: string, defaultPath?: string) => 
    ipcRenderer.invoke('save-file', data, defaultPath),
  exportMarkdown: (content: string, defaultPath?: string) => 
    ipcRenderer.invoke('export-markdown', content, defaultPath)
});

declare global {
  interface Window {
    electronAPI: {
      openFile: (fileType: string) => Promise<{
        canceled: boolean;
        filePath?: string;
        content?: string;
        fileName?: string;
      }>;
      saveFile: (data: string, defaultPath?: string) => Promise<{
        canceled: boolean;
        filePath?: string;
        fileName?: string;
      }>;
      exportMarkdown: (content: string, defaultPath?: string) => Promise<{
        canceled: boolean;
        filePath?: string;
        fileName?: string;
      }>;
    };
  }
}
