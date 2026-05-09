import type { ProjectData } from '../types';

const STORAGE_KEY = 'evacuation-simulator-projects';
const CURRENT_PROJECT_KEY = 'evacuation-simulator-current';

export function saveProject(project: ProjectData): void {
  const projects = getAllProjects();
  const existingIndex = projects.findIndex(p => p.id === project.id);
  
  project.updatedAt = new Date().toISOString();
  
  if (existingIndex >= 0) {
    projects[existingIndex] = project;
  } else {
    project.createdAt = new Date().toISOString();
    projects.push(project);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  localStorage.setItem(CURRENT_PROJECT_KEY, project.id);
}

export function loadProject(id: string): ProjectData | null {
  const projects = getAllProjects();
  const project = projects.find(p => p.id === id);
  
  if (project) {
    localStorage.setItem(CURRENT_PROJECT_KEY, id);
  }
  
  return project || null;
}

export function getAllProjects(): ProjectData[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function deleteProject(id: string): void {
  const projects = getAllProjects();
  const filtered = projects.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  
  const current = getCurrentProjectId();
  if (current === id) {
    localStorage.removeItem(CURRENT_PROJECT_KEY);
  }
}

export function getCurrentProjectId(): string | null {
  return localStorage.getItem(CURRENT_PROJECT_KEY);
}

export function getCurrentProject(): ProjectData | null {
  const id = getCurrentProjectId();
  return id ? loadProject(id) : null;
}

export function exportProjectToJson(project: ProjectData): string {
  return JSON.stringify(project, null, 2);
}

export function importProjectFromJson(jsonString: string): ProjectData {
  const project = JSON.parse(jsonString) as ProjectData;
  
  if (!project.id || !project.name) {
    throw new Error('无效的项目数据');
  }
  
  project.id = generateId();
  project.name = `${project.name} (导入)`;
  project.createdAt = new Date().toISOString();
  project.updatedAt = new Date().toISOString();
  
  return project;
}

export function downloadProject(project: ProjectData): void {
  const json = exportProjectToJson(project);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateId(): string {
  return 'proj_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}
