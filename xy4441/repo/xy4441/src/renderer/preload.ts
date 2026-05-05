import { contextBridge, ipcRenderer } from 'electron';
import {
  Project,
  SceneSchedule,
  CostumeItem,
  WashRecord,
  AlterationRecord,
  ReferencePhoto,
  RiskItem,
  ImportResult,
  ExportOptions,
} from '../shared/types';

export interface Api {
  // 项目操作
  getProjects: () => Promise<Project[]>;
  createProject: (name: string) => Promise<Project>;
  getProject: (id: string) => Promise<Project | null>;
  updateProject: (id: string, name: string) => Promise<void>;

  // 文件选择
  selectFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
  selectDirectory: () => Promise<string | null>;

  // 数据导入
  importScenesCsv: (filePath: string, projectId: string) => Promise<ImportResult<SceneSchedule>>;
  importCostumesCsv: (filePath: string, projectId: string) => Promise<ImportResult<CostumeItem>>;
  importRecordsJson: (filePath: string, projectId: string) => Promise<{
    washRecords: ImportResult<WashRecord>;
    alterationRecords: ImportResult<AlterationRecord>;
  }>;
  importPhotosDirectory: (dirPath: string, projectId: string) => Promise<ImportResult<ReferencePhoto>>;

  // 数据获取
  getAllData: (projectId: string) => Promise<{
    scenes: SceneSchedule[];
    costumes: CostumeItem[];
    washRecords: WashRecord[];
    alterationRecords: AlterationRecord[];
    photos: ReferencePhoto[];
    risks: RiskItem[];
  }>;

  // 风险分析
  runRiskAnalysis: (projectId: string) => Promise<RiskItem[]>;
  updateRisk: (projectId: string, riskId: string, updates: Partial<RiskItem>) => Promise<void>;

  // 导出
  exportMarkdown: (projectId: string, options: ExportOptions) => Promise<string | null>;
  exportJson: (projectId: string, options: ExportOptions) => Promise<string | null>;
}

const api: Api = {
  // 项目操作
  getProjects: () => ipcRenderer.invoke('get-projects'),
  createProject: (name: string) => ipcRenderer.invoke('create-project', name),
  getProject: (id: string) => ipcRenderer.invoke('get-project', id),
  updateProject: (id: string, name: string) => ipcRenderer.invoke('update-project', id, name),

  // 文件选择
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  // 数据导入
  importScenesCsv: (filePath, projectId) => ipcRenderer.invoke('import-scenes-csv', filePath, projectId),
  importCostumesCsv: (filePath, projectId) => ipcRenderer.invoke('import-costumes-csv', filePath, projectId),
  importRecordsJson: (filePath, projectId) => ipcRenderer.invoke('import-records-json', filePath, projectId),
  importPhotosDirectory: (dirPath, projectId) => ipcRenderer.invoke('import-photos-directory', dirPath, projectId),

  // 数据获取
  getAllData: (projectId) => ipcRenderer.invoke('get-all-data', projectId),

  // 风险分析
  runRiskAnalysis: (projectId) => ipcRenderer.invoke('run-risk-analysis', projectId),
  updateRisk: (projectId, riskId, updates) => ipcRenderer.invoke('update-risk', projectId, riskId, updates),

  // 导出
  exportMarkdown: (projectId, options) => ipcRenderer.invoke('export-markdown', projectId, options),
  exportJson: (projectId, options) => ipcRenderer.invoke('export-json', projectId, options),
};

contextBridge.exposeInMainWorld('api', api);
