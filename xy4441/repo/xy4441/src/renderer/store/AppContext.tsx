import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Project,
  SceneSchedule,
  CostumeItem,
  WashRecord,
  AlterationRecord,
  ReferencePhoto,
  RiskItem,
  ExportOptions,
} from '../../shared/types';

interface AppState {
  currentProject: Project | null;
  projects: Project[];
  scenes: SceneSchedule[];
  costumes: CostumeItem[];
  washRecords: WashRecord[];
  alterationRecords: AlterationRecord[];
  photos: ReferencePhoto[];
  risks: RiskItem[];
  isLoading: boolean;
}

interface AppContextType extends AppState {
  loadProjects: () => Promise<void>;
  selectProject: (project: Project) => Promise<void>;
  createProject: (name: string) => Promise<Project>;
  loadProjectData: (projectId: string) => Promise<void>;
  runRiskAnalysis: () => Promise<void>;
  updateRisk: (riskId: string, updates: Partial<RiskItem>) => Promise<void>;
  exportMarkdown: (options: ExportOptions) => Promise<string | null>;
  exportJson: (options: ExportOptions) => Promise<string | null>;
  importScenesCsv: (filePath: string) => Promise<void>;
  importCostumesCsv: (filePath: string) => Promise<void>;
  importRecordsJson: (filePath: string) => Promise<void>;
  importPhotosDirectory: (dirPath: string) => Promise<void>;
}

const initialState: AppState = {
  currentProject: null,
  projects: [],
  scenes: [],
  costumes: [],
  washRecords: [],
  alterationRecords: [],
  photos: [],
  risks: [],
  isLoading: false,
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);

  const loadProjects = useCallback(async () => {
    try {
      const projects = await window.api.getProjects();
      setState((prev) => ({ ...prev, projects }));
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }, []);

  const selectProject = useCallback(async (project: Project) => {
    setState((prev) => ({ ...prev, currentProject: project, isLoading: true }));
    await loadProjectData(project.id);
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  const createProject = useCallback(async (name: string): Promise<Project> => {
    const project = await window.api.createProject(name);
    await loadProjects();
    return project;
  }, [loadProjects]);

  const loadProjectData = useCallback(async (projectId: string) => {
    try {
      const data = await window.api.getAllData(projectId);
      setState((prev) => ({
        ...prev,
        scenes: data.scenes,
        costumes: data.costumes,
        washRecords: data.washRecords,
        alterationRecords: data.alterationRecords,
        photos: data.photos,
        risks: data.risks,
      }));
    } catch (error) {
      console.error('Failed to load project data:', error);
    }
  }, []);

  const runRiskAnalysis = useCallback(async () => {
    if (!state.currentProject) return;
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const risks = await window.api.runRiskAnalysis(state.currentProject.id);
      setState((prev) => ({ ...prev, risks, isLoading: false }));
    } catch (error) {
      console.error('Failed to run risk analysis:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [state.currentProject]);

  const updateRisk = useCallback(async (riskId: string, updates: Partial<RiskItem>) => {
    if (!state.currentProject) return;
    try {
      await window.api.updateRisk(state.currentProject.id, riskId, updates);
      setState((prev) => ({
        ...prev,
        risks: prev.risks.map((r) =>
          r.id === riskId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
        ),
      }));
    } catch (error) {
      console.error('Failed to update risk:', error);
    }
  }, [state.currentProject]);

  const exportMarkdown = useCallback(async (options: ExportOptions): Promise<string | null> => {
    if (!state.currentProject) return null;
    return window.api.exportMarkdown(state.currentProject.id, options);
  }, [state.currentProject]);

  const exportJson = useCallback(async (options: ExportOptions): Promise<string | null> => {
    if (!state.currentProject) return null;
    return window.api.exportJson(state.currentProject.id, options);
  }, [state.currentProject]);

  const importScenesCsv = useCallback(async (filePath: string) => {
    if (!state.currentProject) return;
    try {
      const result = await window.api.importScenesCsv(filePath, state.currentProject.id);
      if (result.success && result.data) {
        setState((prev) => ({ ...prev, scenes: result.data! }));
      }
    } catch (error) {
      console.error('Failed to import scenes:', error);
    }
  }, [state.currentProject]);

  const importCostumesCsv = useCallback(async (filePath: string) => {
    if (!state.currentProject) return;
    try {
      const result = await window.api.importCostumesCsv(filePath, state.currentProject.id);
      if (result.success && result.data) {
        setState((prev) => ({ ...prev, costumes: result.data! }));
      }
    } catch (error) {
      console.error('Failed to import costumes:', error);
    }
  }, [state.currentProject]);

  const importRecordsJson = useCallback(async (filePath: string) => {
    if (!state.currentProject) return;
    try {
      const result = await window.api.importRecordsJson(filePath, state.currentProject.id);
      if (result.washRecords.success && result.washRecords.data) {
        setState((prev) => ({ ...prev, washRecords: result.washRecords.data! }));
      }
      if (result.alterationRecords.success && result.alterationRecords.data) {
        setState((prev) => ({ ...prev, alterationRecords: result.alterationRecords.data! }));
      }
    } catch (error) {
      console.error('Failed to import records:', error);
    }
  }, [state.currentProject]);

  const importPhotosDirectory = useCallback(async (dirPath: string) => {
    if (!state.currentProject) return;
    try {
      const result = await window.api.importPhotosDirectory(dirPath, state.currentProject.id);
      if (result.success && result.data) {
        setState((prev) => ({ ...prev, photos: result.data! }));
      }
    } catch (error) {
      console.error('Failed to import photos:', error);
    }
  }, [state.currentProject]);

  const contextValue: AppContextType = {
    ...state,
    loadProjects,
    selectProject,
    createProject,
    loadProjectData,
    runRiskAnalysis,
    updateRisk,
    exportMarkdown,
    exportJson,
    importScenesCsv,
    importCostumesCsv,
    importRecordsJson,
    importPhotosDirectory,
  };

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
