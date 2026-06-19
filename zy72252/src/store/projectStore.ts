import { create } from 'zustand';
import type { Project, HoistingPoint, Route, ObstacleNote, FloorSketch, DetectionIssue } from '../types';
import { RouteDetectionEngine } from '../services/RouteDetectionEngine';
import { sampleProjects, samplePoints, sampleRoutes, sampleObstacles, sampleSketches, sampleIssues } from '../data/sampleData';

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  points: HoistingPoint[];
  routes: Route[];
  obstacles: ObstacleNote[];
  sketches: FloorSketch[];
  issues: DetectionIssue[];
  viewMode: '3d' | 'chart';
  selectedIssueId: string | null;

  loadSampleData: () => void;
  setCurrentProject: (id: string) => void;
  addFloorSketch: (sketch: Omit<FloorSketch, 'id' | 'uploadedAt'>) => void;
  supplementIssue: (issueId: string, sketchId?: string) => void;
  resolveIssue: (issueId: string, reviewNotes: string) => void;
  setViewMode: (mode: '3d' | 'chart') => void;
  setSelectedIssue: (id: string | null) => void;
  addObstacleNote: (note: Omit<ObstacleNote, 'id' | 'createdAt'>) => void;
  runDetection: () => void;
  importProjectData: (data: {
    project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;
    points: HoistingPoint[];
    routes: Route[];
    obstacles?: Omit<ObstacleNote, 'id' | 'createdAt'>[];
  }) => void;
}

const DATA_VERSION = 'v2';

const STORAGE_KEYS = {
  version: 'stage-safety:version',
  projects: 'stage-safety:projects',
  points: (id: string) => `stage-safety:project:${id}:points`,
  routes: (id: string) => `stage-safety:project:${id}:routes`,
  sketches: (id: string) => `stage-safety:project:${id}:sketches`,
  issues: (id: string) => `stage-safety:project:${id}:issues`,
  obstacles: (id: string) => `stage-safety:project:${id}:obstacles`,
};

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
    return defaultValue;
  }
}

function generateId(prefix: string): string {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6);
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  points: [],
  routes: [],
  obstacles: [],
  sketches: [],
  issues: [],
  viewMode: '3d',
  selectedIssueId: null,

  loadSampleData: () => {
    const storedVersion = loadFromStorage<string>(STORAGE_KEYS.version, '');
    const storedProjects = loadFromStorage<Project[]>(STORAGE_KEYS.projects, []);
    const needsReset = storedVersion !== DATA_VERSION;

    if (storedProjects.length === 0 || needsReset) {
      saveToStorage(STORAGE_KEYS.projects, sampleProjects);
      saveToStorage(STORAGE_KEYS.version, DATA_VERSION);
      
      Object.entries(samplePoints).forEach(([projectId, data]) => {
        saveToStorage(STORAGE_KEYS.points(projectId), data);
      });
      Object.entries(sampleRoutes).forEach(([projectId, data]) => {
        saveToStorage(STORAGE_KEYS.routes(projectId), data);
      });
      Object.entries(sampleSketches).forEach(([projectId, data]) => {
        saveToStorage(STORAGE_KEYS.sketches(projectId), data);
      });
      Object.entries(sampleIssues).forEach(([projectId, data]) => {
        saveToStorage(STORAGE_KEYS.issues(projectId), data);
      });
      Object.entries(sampleObstacles).forEach(([projectId, data]) => {
        saveToStorage(STORAGE_KEYS.obstacles(projectId), data);
      });

      set({ projects: sampleProjects });
    } else {
      set({ projects: storedProjects });
    }
  },

  setCurrentProject: (id: string) => {
    const points = loadFromStorage<HoistingPoint[]>(STORAGE_KEYS.points(id), []);
    const routes = loadFromStorage<Route[]>(STORAGE_KEYS.routes(id), []);
    const sketches = loadFromStorage<FloorSketch[]>(STORAGE_KEYS.sketches(id), []);
    const issues = loadFromStorage<DetectionIssue[]>(STORAGE_KEYS.issues(id), []);
    const obstacles = loadFromStorage<ObstacleNote[]>(STORAGE_KEYS.obstacles(id), []);

    set({
      currentProjectId: id,
      points,
      routes,
      sketches,
      issues,
      obstacles,
      selectedIssueId: null
    });
  },

  addFloorSketch: (sketchData) => {
    const { currentProjectId, sketches } = get();
    if (!currentProjectId) return;

    const newSketch: FloorSketch = {
      ...sketchData,
      id: generateId('SKETCH'),
      uploadedAt: new Date().toISOString(),
    };

    const updatedSketches = [...sketches, newSketch];
    saveToStorage(STORAGE_KEYS.sketches(currentProjectId), updatedSketches);
    set({ sketches: updatedSketches });
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  supplementIssue: (issueId: string, sketchId?: string) => {
    const { currentProjectId, issues } = get();
    if (!currentProjectId) return;

    const updatedIssues = issues.map(issue => {
      if (issue.id === issueId) {
        const updatedMissing = issue.missingMaterials.filter(m => 
          !m.includes('楼层剖面草图')
        );
        return {
          ...issue,
          status: 'supplemented' as const,
          supplementedAt: new Date().toISOString(),
          missingMaterials: updatedMissing.length > 0 ? updatedMissing : ['复核确认记录'],
          nextAction: 'contact_customer' as const,
        };
      }
      return issue;
    });

    saveToStorage(STORAGE_KEYS.issues(currentProjectId), updatedIssues);
    
    const projects = get().projects;
    const updatedProjects = projects.map(p => {
      if (p.id === currentProjectId) {
        return { ...p, status: 'pending_review' as const, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    saveToStorage(STORAGE_KEYS.projects, updatedProjects);

    set({ issues: updatedIssues, projects: updatedProjects });
  },

  resolveIssue: (issueId: string, reviewNotes: string) => {
    const { currentProjectId, issues, routes } = get();
    if (!currentProjectId) return;

    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;

    const updatedIssues = issues.map(i => {
      if (i.id === issueId) {
        return {
          ...i,
          status: 'resolved' as const,
          resolvedAt: new Date().toISOString(),
          reviewNotes,
        };
      }
      return i;
    });

    const updatedRoutes = routes.map(r => {
      if (r.id === issue.routeId) {
        return { ...r, recalculated: true, hasWarning: false };
      }
      return r;
    });

    const allResolved = updatedIssues.every(i => i.status === 'resolved');
    const projects = get().projects;
    const updatedProjects = projects.map(p => {
      if (p.id === currentProjectId) {
        return {
          ...p,
          status: allResolved ? 'normal' as const : 'warning' as const,
          stage: allResolved ? 'completed' as const : 'review' as const,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    saveToStorage(STORAGE_KEYS.issues(currentProjectId), updatedIssues);
    saveToStorage(STORAGE_KEYS.routes(currentProjectId), updatedRoutes);
    saveToStorage(STORAGE_KEYS.projects, updatedProjects);

    set({ issues: updatedIssues, routes: updatedRoutes, projects: updatedProjects });
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedIssue: (id) => set({ selectedIssueId: id }),

  addObstacleNote: (noteData) => {
    const { currentProjectId, obstacles } = get();
    if (!currentProjectId) return;

    const newNote: ObstacleNote = {
      ...noteData,
      id: generateId('NOTE'),
      createdAt: new Date().toISOString(),
    };

    const updatedObstacles = [...obstacles, newNote];
    saveToStorage(STORAGE_KEYS.obstacles(currentProjectId), updatedObstacles);
    set({ obstacles: updatedObstacles });
  },

  runDetection: () => {
    const { currentProjectId, routes } = get();
    if (!currentProjectId) return;

    const detectedIssues = RouteDetectionEngine.detectSupplementaryRoutes(routes);
    const existingIssues = loadFromStorage<DetectionIssue[]>(STORAGE_KEYS.issues(currentProjectId), []);
    
    const newIssues = detectedIssues.filter(newIssue => 
      !existingIssues.some(existing => existing.routeId === newIssue.routeId && existing.status !== 'resolved')
    );
    
    const updatedIssues = [...existingIssues, ...newIssues];
    saveToStorage(STORAGE_KEYS.issues(currentProjectId), updatedIssues);

    const hasOpenIssues = updatedIssues.some(i => i.status !== 'resolved');
    const projects = get().projects;
    const updatedProjects = projects.map(p => {
      if (p.id === currentProjectId) {
        return {
          ...p,
          status: hasOpenIssues ? 'warning' as const : 'normal' as const,
          stage: hasOpenIssues ? 'detection' as const : 'completed' as const,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    saveToStorage(STORAGE_KEYS.projects, updatedProjects);

    set({ issues: updatedIssues, projects: updatedProjects });
  },

  importProjectData: (data) => {
    const projectId = generateId('PROJ');
    const now = new Date().toISOString();

    const newProject: Project = {
      ...data.project,
      id: projectId,
      createdAt: now,
      updatedAt: now,
    };

    const projects = [...get().projects, newProject];
    saveToStorage(STORAGE_KEYS.projects, projects);
    saveToStorage(STORAGE_KEYS.points(projectId), data.points);
    saveToStorage(STORAGE_KEYS.routes(projectId), data.routes);
    
    if (data.obstacles) {
      const obstaclesWithId = data.obstacles.map(o => ({
        ...o,
        id: generateId('NOTE'),
        createdAt: now,
      }));
      saveToStorage(STORAGE_KEYS.obstacles(projectId), obstaclesWithId);
    }

    const detectedIssues = RouteDetectionEngine.detectSupplementaryRoutes(data.routes);
    saveToStorage(STORAGE_KEYS.issues(projectId), detectedIssues);

    const hasIssues = detectedIssues.length > 0;
    const finalProjects = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          status: hasIssues ? 'warning' as const : 'normal' as const,
          stage: hasIssues ? 'detection' as const : 'completed' as const,
        };
      }
      return p;
    });
    saveToStorage(STORAGE_KEYS.projects, finalProjects);

    set({ projects: finalProjects });
  },
}));
