import { create } from 'zustand';
import type {
  Project,
  Material,
  CheckSnapshot,
  Issue,
  TimelineAlignment,
  OperationLog,
  MaterialType,
  ProjectStatus,
} from '@/types';
import { generateId, safeJsonParse } from '@/utils/helpers';
import { parseMaterial } from '@/services/parseService';
import { runCheck, type CheckResult } from '@/services/checkService';

const STORAGE_KEYS = {
  projects: 'cue_checker_projects',
  materials: 'cue_checker_materials',
  snapshots: 'cue_checker_snapshots',
  issues: 'cue_checker_issues',
  alignments: 'cue_checker_alignments',
  logs: 'cue_checker_logs',
};

interface AppState {
  projects: Project[];
  materials: Material[];
  snapshots: CheckSnapshot[];
  issues: Issue[];
  alignments: TimelineAlignment[];
  logs: OperationLog[];
  currentProjectId: string | null;
  currentSnapshotId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AppActions {
  init: () => void;
  createProject: (name: string, description: string) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (id: string | null) => void;
  addMaterial: (projectId: string, type: MaterialType, file: File, content: string) => Promise<Material>;
  removeMaterial: (materialId: string) => void;
  parseAllMaterials: (projectId: string) => Promise<void>;
  runCheck: (projectId: string) => Promise<CheckResult | null>;
  setCurrentSnapshot: (snapshotId: string | null) => void;
  resolveIssue: (issueId: string) => void;
  getProjectMaterials: (projectId: string) => Material[];
  getSnapshotIssues: (snapshotId: string) => Issue[];
  getSnapshotAlignments: (snapshotId: string) => TimelineAlignment[];
  getProjectSnapshots: (projectId: string) => CheckSnapshot[];
  getProjectLogs: (projectId: string) => OperationLog[];
  addLog: (projectId: string, action: string, detail: string, isError?: boolean) => void;
  clearError: () => void;
}

const initialState: AppState = {
  projects: [],
  materials: [],
  snapshots: [],
  issues: [],
  alignments: [],
  logs: [],
  currentProjectId: null,
  currentSnapshotId: null,
  isLoading: false,
  error: null,
};

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  ...initialState,

  init: () => {
    try {
      const projects = safeJsonParse<Project[]>(localStorage.getItem(STORAGE_KEYS.projects) || '[]', []);
      const materials = safeJsonParse<Material[]>(localStorage.getItem(STORAGE_KEYS.materials) || '[]', []);
      const snapshots = safeJsonParse<CheckSnapshot[]>(localStorage.getItem(STORAGE_KEYS.snapshots) || '[]', []);
      const issues = safeJsonParse<Issue[]>(localStorage.getItem(STORAGE_KEYS.issues) || '[]', []);
      const alignments = safeJsonParse<TimelineAlignment[]>(localStorage.getItem(STORAGE_KEYS.alignments) || '[]', []);
      const logs = safeJsonParse<OperationLog[]>(localStorage.getItem(STORAGE_KEYS.logs) || '[]', []);

      set({ projects, materials, snapshots, issues, alignments, logs });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载数据失败';
      set({ error: errorMessage });
    }
  },

  createProject: (name: string, description: string) => {
    const now = new Date().toISOString();
    const project: Project = {
      id: generateId(),
      name,
      description,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    const projects = [...get().projects, project];
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
    set({ projects });

    get().addLog(project.id, '创建项目', `创建项目「${name}」`);

    return project;
  },

  updateProject: (id: string, updates: Partial<Project>) => {
    const projects = get().projects.map(p =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
    set({ projects });
  },

  deleteProject: (id: string) => {
    const { projects, materials, snapshots, issues, alignments, logs } = get();

    const newProjects = projects.filter(p => p.id !== id);
    const newMaterials = materials.filter(m => m.projectId !== id);
    const snapshotIds = snapshots.filter(s => s.projectId === id).map(s => s.id);
    const newSnapshots = snapshots.filter(s => s.projectId !== id);
    const newIssues = issues.filter(i => !snapshotIds.includes(i.snapshotId));
    const newAlignments = alignments.filter(a => !snapshotIds.includes(a.snapshotId));
    const newLogs = logs.filter(l => l.projectId !== id);

    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(newProjects));
    localStorage.setItem(STORAGE_KEYS.materials, JSON.stringify(newMaterials));
    localStorage.setItem(STORAGE_KEYS.snapshots, JSON.stringify(newSnapshots));
    localStorage.setItem(STORAGE_KEYS.issues, JSON.stringify(newIssues));
    localStorage.setItem(STORAGE_KEYS.alignments, JSON.stringify(newAlignments));
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(newLogs));

    set({
      projects: newProjects,
      materials: newMaterials,
      snapshots: newSnapshots,
      issues: newIssues,
      alignments: newAlignments,
      logs: newLogs,
      currentProjectId: get().currentProjectId === id ? null : get().currentProjectId,
    });
  },

  setCurrentProject: (id: string | null) => {
    set({ currentProjectId: id, currentSnapshotId: null });
  },

  addMaterial: async (projectId: string, type: MaterialType, file: File, content: string) => {
    const material: Material = {
      id: generateId(),
      projectId,
      type,
      fileName: file.name,
      fileFormat: file.name.split('.').pop()?.toLowerCase() || 'txt',
      content,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      parseStatus: 'pending',
      parseErrors: [],
    };

    const materials = [...get().materials, material];
    localStorage.setItem(STORAGE_KEYS.materials, JSON.stringify(materials));
    set({ materials });

    get().addLog(projectId, '上传材料', `上传${type === 'timeline' ? '时间轴' : type === 'dialog' ? '对白轨' : type === 'music' ? '音乐文件' : type === 'cue' ? 'Cue清单' : '导演备注'}：${file.name}`);

    get().updateProject(projectId, { status: 'uploading' });

    return material;
  },

  removeMaterial: (materialId: string) => {
    const material = get().materials.find(m => m.id === materialId);
    if (!material) return;

    const materials = get().materials.filter(m => m.id !== materialId);
    localStorage.setItem(STORAGE_KEYS.materials, JSON.stringify(materials));
    set({ materials });

    get().addLog(material.projectId, '删除材料', `删除材料：${material.fileName}`);
  },

  parseAllMaterials: async (projectId: string) => {
    set({ isLoading: true });
    const { materials } = get();
    const projectMaterials = materials.filter(m => m.projectId === projectId);

    const updatedMaterials: Material[] = [];
    let hasErrors = false;

    for (const material of projectMaterials) {
      if (material.parseStatus === 'success') {
        updatedMaterials.push(material);
        continue;
      }

      const result = await parseMaterial(material);
      updatedMaterials.push(result);

      if (result.parseStatus === 'failed') {
        hasErrors = true;
        for (const error of result.parseErrors) {
          get().addLog(projectId, '解析失败', `${material.fileName}: ${error.friendlyMessage}`, true);
        }
      }
    }

    const allMaterials = materials.map(m => {
      const updated = updatedMaterials.find(u => u.id === m.id);
      return updated || m;
    });

    localStorage.setItem(STORAGE_KEYS.materials, JSON.stringify(allMaterials));
    set({ materials: allMaterials, isLoading: false });

    const allSuccess = updatedMaterials.every(m => m.parseStatus === 'success');
    const newStatus: ProjectStatus = hasErrors ? 'has_issues' : allSuccess ? 'completed' : 'draft';
    get().updateProject(projectId, { status: newStatus });

    get().addLog(projectId, '材料解析', `完成${projectMaterials.length}份材料解析`);
  },

  runCheck: async (projectId: string) => {
    set({ isLoading: true });
    const { materials, snapshots } = get();
    const projectMaterials = materials.filter(m => m.projectId === projectId && m.parseStatus === 'success');

    if (projectMaterials.length === 0) {
      set({ isLoading: false, error: '没有可用于核对的材料，请先上传并解析材料' });
      return null;
    }

    const projectSnapshots = snapshots.filter(s => s.projectId === projectId);
    const versionNumber = projectSnapshots.length + 1;

    const result = runCheck(projectId, projectMaterials, versionNumber);

    const newSnapshots = [...snapshots, result.snapshot];
    const newIssues = [...get().issues, ...result.issues];
    const newAlignments = [...get().alignments, ...result.alignments];

    localStorage.setItem(STORAGE_KEYS.snapshots, JSON.stringify(newSnapshots));
    localStorage.setItem(STORAGE_KEYS.issues, JSON.stringify(newIssues));
    localStorage.setItem(STORAGE_KEYS.alignments, JSON.stringify(newAlignments));

    const status: ProjectStatus = result.snapshot.errorCount > 0 ? 'has_issues' : 'completed';
    get().updateProject(projectId, { status, currentSnapshotId: result.snapshot.id });

    set({
      snapshots: newSnapshots,
      issues: newIssues,
      alignments: newAlignments,
      currentSnapshotId: result.snapshot.id,
      isLoading: false,
    });

    get().addLog(projectId, '执行核对', `生成核对报告 v${versionNumber}，${result.snapshot.summary}`);

    return result;
  },

  setCurrentSnapshot: (snapshotId: string | null) => {
    set({ currentSnapshotId: snapshotId });
  },

  resolveIssue: (issueId: string) => {
    const issues = get().issues.map(i =>
      i.id === issueId ? { ...i, resolved: true } : i
    );
    localStorage.setItem(STORAGE_KEYS.issues, JSON.stringify(issues));
    set({ issues });

    const issue = get().issues.find(i => i.id === issueId);
    if (issue) {
      get().addLog(issue.projectId || '', '标记问题已解决', issue.description);
    }
  },

  getProjectMaterials: (projectId: string) => {
    return get().materials.filter(m => m.projectId === projectId);
  },

  getSnapshotIssues: (snapshotId: string) => {
    return get().issues.filter(i => i.snapshotId === snapshotId);
  },

  getSnapshotAlignments: (snapshotId: string) => {
    return get().alignments.filter(a => a.snapshotId === snapshotId);
  },

  getProjectSnapshots: (projectId: string) => {
    return get().snapshots.filter(s => s.projectId === projectId).sort((a, b) => b.versionNumber - a.versionNumber);
  },

  getProjectLogs: (projectId: string) => {
    return get().logs.filter(l => l.projectId === projectId).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  addLog: (projectId: string, action: string, detail: string, isError = false) => {
    const log: OperationLog = {
      id: generateId(),
      projectId,
      action,
      detail,
      timestamp: new Date().toISOString(),
      operator: '当前用户',
      isError,
    };

    const logs = [...get().logs, log];
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
    set({ logs });
  },

  clearError: () => {
    set({ error: null });
  },
}));
