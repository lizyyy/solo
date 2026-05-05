import { contextBridge, ipcRenderer } from 'electron';
import { LostItem, ExportOptions, AppSettings, AutoJudgeResult, ImportData } from '../shared/types';

const electronAPI = {
  data: {
    getAllItems: (): Promise<LostItem[]> => ipcRenderer.invoke('data:getAllItems'),
    getItemById: (id: string): Promise<LostItem | null> => ipcRenderer.invoke('data:getItemById', id),
    saveItem: (item: LostItem): Promise<LostItem> => ipcRenderer.invoke('data:saveItem', item),
    deleteItem: (id: string): Promise<boolean> => ipcRenderer.invoke('data:deleteItem', id),
    searchItems: (query: string, filters?: {
      stations?: string[];
      categories?: string[];
      statuses?: string[];
      dateRange?: { start: string; end: string };
    }): Promise<LostItem[]> => ipcRenderer.invoke('data:searchItems', query, filters),
    getStats: (): Promise<{
      total: number;
      byStatus: Record<string, number>;
      byCategory: Record<string, number>;
      byStation: Record<string, number>;
    }> => ipcRenderer.invoke('data:getStats'),
    getUniqueStations: (): Promise<string[]> => ipcRenderer.invoke('data:getUniqueStations'),
    addPhoto: (itemId: string, photoData: {
      filePath: string;
      fileName: string;
      tags: string[];
      description: string;
    }): Promise<LostItem | null> => ipcRenderer.invoke('data:addPhoto', itemId, photoData),
    updatePhoto: (itemId: string, photoId: string, updates: Partial<{
      tags: string[];
      description: string;
    }>): Promise<LostItem | null> => ipcRenderer.invoke('data:updatePhoto', itemId, photoId, updates),
    deletePhoto: (itemId: string, photoId: string): Promise<LostItem | null> => ipcRenderer.invoke('data:deletePhoto', itemId, photoId),
  },

  import: {
    fromFile: (): Promise<ImportData | null> => ipcRenderer.invoke('import:fromFile'),
    previewFile: (filePath: string): Promise<ImportData | null> => ipcRenderer.invoke('import:previewFile', filePath),
    applyData: (importData: ImportData): Promise<{ success: number; errors: string[] }> => 
      ipcRenderer.invoke('import:applyData', importData),
  },

  export: {
    toMarkdown: (options: ExportOptions): Promise<string | null> => 
      ipcRenderer.invoke('export:toMarkdown', options),
    toJson: (options: ExportOptions): Promise<string | null> => 
      ipcRenderer.invoke('export:toJson', options),
    previewMarkdown: (options: ExportOptions): Promise<string> => 
      ipcRenderer.invoke('export:previewMarkdown', options),
    previewJson: (options: ExportOptions): Promise<string> => 
      ipcRenderer.invoke('export:previewJson', options),
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    save: (settings: Partial<AppSettings>): Promise<AppSettings> => 
      ipcRenderer.invoke('settings:save', settings),
  },

  dialog: {
    selectPhoto: (): Promise<Array<{ filePath: string; fileName: string }> | null> => 
      ipcRenderer.invoke('dialog:selectPhoto'),
    selectFolder: (title?: string): Promise<string | null> => 
      ipcRenderer.invoke('dialog:selectFolder', title),
  },

  judge: {
    autoJudge: (item: LostItem): Promise<AutoJudgeResult> => 
      ipcRenderer.invoke('judge:autoJudge', item),
  },

  onMenuImport: (callback: () => void) => {
    ipcRenderer.on('menu:import', callback);
    return () => ipcRenderer.removeListener('menu:import', callback);
  },

  onMenuExport: (callback: () => void) => {
    ipcRenderer.on('menu:export', callback);
    return () => ipcRenderer.removeListener('menu:export', callback);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
