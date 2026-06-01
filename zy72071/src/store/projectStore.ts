import { create } from 'zustand';
import type { Project, Point, ReviewNote, JudgmentTrace, AnomalyStats } from '../types';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  selectedPointId: string | null;
  isLoading: boolean;
  
  loadProjects: () => void;
  saveProjects: () => void;
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  selectPoint: (pointId: string | null) => void;
  addReviewNote: (note: Omit<ReviewNote, 'id' | 'createdAt'>) => void;
  addJudgmentTrace: (trace: Omit<JudgmentTrace, 'id' | 'timestamp'>) => void;
  importProject: (data: unknown) => { success: boolean; error?: string };
  getAnomalyStats: () => AnomalyStats | null;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const STORAGE_KEY = 'flood-drill-projects';

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  selectedPointId: null,
  isLoading: false,

  loadProjects: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const projects = JSON.parse(stored) as Project[];
        set({ projects });
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  },

  saveProjects: () => {
    const { projects } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  },

  setCurrentProject: (project) => {
    set({ currentProject: project, selectedPointId: null });
  },

  addProject: (project) => {
    set((state) => ({
      projects: [...state.projects, project],
    }));
    get().saveProjects();
  },

  updateProject: (updatedProject) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === updatedProject.id ? updatedProject : p
      ),
      currentProject:
        state.currentProject?.id === updatedProject.id
          ? updatedProject
          : state.currentProject,
    }));
    get().saveProjects();
  },

  deleteProject: (projectId) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      currentProject:
        state.currentProject?.id === projectId ? null : state.currentProject,
    }));
    get().saveProjects();
  },

  selectPoint: (pointId) => {
    set({ selectedPointId: pointId });
  },

  addReviewNote: (note) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const newNote: ReviewNote = {
      ...note,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...currentProject,
      reviewNotes: [...currentProject.reviewNotes, newNote],
      updatedAt: new Date().toISOString(),
    };

    get().updateProject(updatedProject);
  },

  addJudgmentTrace: (trace) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const newTrace: JudgmentTrace = {
      ...trace,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...currentProject,
      judgmentTraces: [...currentProject.judgmentTraces, newTrace],
      updatedAt: new Date().toISOString(),
    };

    get().updateProject(updatedProject);
  },

  importProject: (data) => {
    try {
      const project = data as Project;
      
      if (!project.name || !Array.isArray(project.points)) {
        return { success: false, error: '数据格式错误：缺少必要字段' };
      }

      const errors: string[] = [];
      
      project.points.forEach((point: Point, index: number) => {
        if (!point.id) {
          errors.push(`点位 ${index + 1}: 缺少ID`);
        }
        if (!point.position) {
          errors.push(`点位 ${point.name || point.id}: 缺少坐标`);
        }
        if (point.hasPhoto && !point.photoUrl) {
          errors.push(`点位 ${point.name || point.id}: 照片数据缺失`);
        }
      });

      if (errors.length > 0) {
        return { success: false, error: errors.join('\n') };
      }

      const newProject: Project = {
        ...project,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      get().addProject(newProject);
      return { success: true };
    } catch (error) {
      return { success: false, error: '导入失败：JSON格式无效' };
    }
  },

  getAnomalyStats: () => {
    const { currentProject } = get();
    if (!currentProject) return null;

    const stats: AnomalyStats = {
      coordinate_offset: 0,
      duplicate_name: 0,
      missing_photo: 0,
      cross_floor: 0,
      total: 0,
    };

    const countedPoints = new Set<string>();

    currentProject.points.forEach((point) => {
      point.anomalies.forEach((anomaly) => {
        if (!countedPoints.has(point.id)) {
          countedPoints.add(point.id);
          stats.total++;
        }
        stats[anomaly.type]++;
      });
    });

    return stats;
  },
}));
