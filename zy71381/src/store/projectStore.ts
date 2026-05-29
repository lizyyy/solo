import { create } from 'zustand';
import type { Project } from '../types';
import { generateId, getCurrentUser } from '../types';
import { db } from '../db';

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  loading: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  setCurrentProject: (id: string) => Promise<void>;
  createProject: (name: string, description: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projects: [],
  loading: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await db.projects.orderBy('createdAt').reverse().toArray();
      set({ projects, loading: false });

      if (projects.length > 0 && !get().currentProject) {
        const lastProjectId = localStorage.getItem('licenseWall_lastProject');
        const lastProject = lastProjectId
          ? projects.find((p) => p.id === lastProjectId)
          : null;
        set({ currentProject: lastProject || projects[0] });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  setCurrentProject: async (id: string) => {
    const project = await db.projects.get(id);
    if (project) {
      set({ currentProject: project });
      localStorage.setItem('licenseWall_lastProject', id);
    }
  },

  createProject: async (name: string, description: string) => {
    const now = Date.now();
    const project: Project = {
      id: generateId(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
    };

    await db.projects.add(project);
    set((state) => ({
      projects: [project, ...state.projects],
      currentProject: project,
    }));
    localStorage.setItem('licenseWall_lastProject', project.id);

    return project;
  },

  deleteProject: async (id: string) => {
    await db.transaction('rw', [
      db.projects,
      db.dependencyFiles,
      db.dependencies,
      db.waivers,
      db.reports,
      db.reportEntries,
      db.exports,
      db.statusLogs,
    ], async () => {
      await db.dependencyFiles.where('projectId').equals(id).delete();
      await db.dependencies.where('projectId').equals(id).delete();
      await db.waivers.where('projectId').equals(id).delete();

      const reports = await db.reports.where('projectId').equals(id).toArray();
      const reportIds = reports.map((r) => r.id);
      await db.reportEntries.where('reportId').anyOf(reportIds).delete();
      await db.exports.where('reportId').anyOf(reportIds).delete();
      await db.reports.where('projectId').equals(id).delete();

      const depIds = await db.dependencies
        .where('projectId')
        .equals(id)
        .primaryKeys();
      await db.statusLogs.where('dependencyId').anyOf(depIds as string[]).delete();

      await db.projects.delete(id);
    });

    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject:
        get().currentProject?.id === id
          ? state.projects.filter((p) => p.id !== id)[0] || null
          : state.currentProject,
    }));
  },

  updateProject: async (id: string, data: Partial<Project>) => {
    const updates = { ...data, updatedAt: Date.now() };
    await db.projects.update(id, updates);

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
      currentProject:
        get().currentProject?.id === id
          ? { ...get().currentProject!, ...updates }
          : get().currentProject,
    }));
  },
}));
