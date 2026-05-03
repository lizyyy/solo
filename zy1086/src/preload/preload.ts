import { contextBridge, ipcRenderer } from 'electron';
import { Project, Recipe, Ingredient, ContainerType, ShoppingListItem, PrepTask, BatchPrepGroup, RiskWarning, ExportOptions } from '@shared/types';

interface ElectronAPI {
  getDataPath: () => Promise<string>;
  
  getRecipes: () => Promise<Recipe[]>;
  getRecipeById: (id: string) => Promise<Recipe | undefined>;
  saveRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (id: string) => Promise<boolean>;
  
  getIngredients: () => Promise<Ingredient[]>;
  saveIngredient: (ingredient: Ingredient) => Promise<void>;
  
  getContainerTypes: () => Promise<ContainerType[]>;
  
  getProjects: () => Promise<Project[]>;
  getProjectById: (id: string) => Promise<Project | undefined>;
  saveProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<boolean>;
  
  generateShoppingList: (projectId: string) => Promise<ShoppingListItem[]>;
  generatePrepTasks: (projectId: string) => Promise<{ tasks: PrepTask[]; batchGroups: BatchPrepGroup[] }>;
  checkRisks: (projectId: string) => Promise<RiskWarning[]>;
  
  exportMarkdown: (projectId: string, options: ExportOptions) => Promise<string>;
  exportShoppingListCSV: (projectId: string) => Promise<string>;
  exportStorageLabelsHTML: (projectId: string) => Promise<string>;
  
  showSaveDialog: (options: { title: string; defaultPath: string; filters: { name: string; extensions: string[] }[] }) => Promise<string | undefined>;
  showOpenDialog: (options: { title: string; filters: { name: string; extensions: string[] }[]; properties?: ('openFile' | 'multiSelections')[] }) => Promise<string[]>;
  
  writeFile: (filePath: string, content: string) => Promise<void>;
  readFile: (filePath: string) => Promise<string>;
  
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<void>;
  
  resetApp: () => Promise<void>;
  
  onMenuNewProject: (callback: () => void) => () => void;
  onMenuOpenProject: (callback: () => void) => () => void;
  onMenuExportProject: (callback: () => void) => () => void;
  onMenuImportProject: (callback: () => void) => () => void;
}

const electronAPI: ElectronAPI = {
  getDataPath: () => ipcRenderer.invoke('app:get-data-path'),
  
  getRecipes: () => ipcRenderer.invoke('recipes:get-all'),
  getRecipeById: (id: string) => ipcRenderer.invoke('recipes:get-by-id', id),
  saveRecipe: (recipe: Recipe) => ipcRenderer.invoke('recipes:save', recipe),
  deleteRecipe: (id: string) => ipcRenderer.invoke('recipes:delete', id),
  
  getIngredients: () => ipcRenderer.invoke('ingredients:get-all'),
  saveIngredient: (ingredient: Ingredient) => ipcRenderer.invoke('ingredients:save', ingredient),
  
  getContainerTypes: () => ipcRenderer.invoke('container-types:get-all'),
  
  getProjects: () => ipcRenderer.invoke('projects:get-all'),
  getProjectById: (id: string) => ipcRenderer.invoke('projects:get-by-id', id),
  saveProject: (project: Project) => ipcRenderer.invoke('projects:save', project),
  deleteProject: (id: string) => ipcRenderer.invoke('projects:delete', id),
  
  generateShoppingList: (projectId: string) => ipcRenderer.invoke('projects:generate-shopping-list', projectId),
  generatePrepTasks: (projectId: string) => ipcRenderer.invoke('projects:generate-prep-tasks', projectId),
  checkRisks: (projectId: string) => ipcRenderer.invoke('projects:check-risks', projectId),
  
  exportMarkdown: (projectId: string, options: ExportOptions) => ipcRenderer.invoke('export:markdown', projectId, options),
  exportShoppingListCSV: (projectId: string) => ipcRenderer.invoke('export:shopping-list-csv', projectId),
  exportStorageLabelsHTML: (projectId: string) => ipcRenderer.invoke('export:storage-labels-html', projectId),
  
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:save-file', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:open-file', options),
  
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  
  resetApp: () => ipcRenderer.invoke('app:reset'),
  
  onMenuNewProject: (callback) => {
    ipcRenderer.on('menu:new-project', callback);
    return () => ipcRenderer.removeListener('menu:new-project', callback);
  },
  onMenuOpenProject: (callback) => {
    ipcRenderer.on('menu:open-project', callback);
    return () => ipcRenderer.removeListener('menu:open-project', callback);
  },
  onMenuExportProject: (callback) => {
    ipcRenderer.on('menu:export-project', callback);
    return () => ipcRenderer.removeListener('menu:export-project', callback);
  },
  onMenuImportProject: (callback) => {
    ipcRenderer.on('menu:import-project', callback);
    return () => ipcRenderer.removeListener('menu:import-project', callback);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
