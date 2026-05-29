import { create } from 'zustand';
import type {
  FontFile, License, Client, Channel, Project, AuditReport,
  RegressionCase, TodoItem, AuditStep, AuditRisk, AuditState,
  EntityStatus, AuditStepType, RiskLevel
} from '../types';
import {
  fontApi, licenseApi, clientApi, channelApi, projectApi,
  reportApi, regressionApi, todoApi, riskApi
} from '../services/api';

interface AppState {
  audit: AuditState;
  fonts: FontFile[];
  licenses: License[];
  clients: Client[];
  channels: Channel[];
  projects: Project[];
  reports: AuditReport[];
  regressionCases: RegressionCase[];
  todos: TodoItem[];
  loading: Record<string, boolean>;
  sidebarCollapsed: boolean;
  currentRoute: string;

  setAuditStep: (step: AuditStepType) => void;
  setUploadedFile: (file: File | null) => void;
  setRecognizedFonts: (fonts: FontFile[]) => void;
  setMatchedLicense: (fontId: string, license: License | null) => void;
  setValidatedChannel: (channelId: string, valid: boolean) => void;
  addAuditStep: (step: AuditStep) => void;
  addRisk: (risk: AuditRisk) => void;
  setAuditRisks: (risks: AuditRisk[]) => void;
  setSelectedProject: (projectId: string | undefined) => void;
  resetAudit: () => void;

  loadFonts: () => Promise<void>;
  addFont: (font: Omit<FontFile, 'id' | 'uploadDate'>) => Promise<void>;
  updateFontStatus: (id: string, status: EntityStatus) => Promise<void>;

  loadLicenses: () => Promise<void>;
  addLicense: (license: Omit<License, 'id'>) => Promise<void>;
  updateLicense: (license: License) => Promise<void>;

  loadClients: () => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => Promise<void>;

  loadChannels: () => Promise<void>;
  addChannel: (channel: Omit<Channel, 'id'>) => Promise<void>;
  updateChannelStatus: (id: string, status: EntityStatus) => Promise<void>;

  loadProjects: () => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'createDate' | 'auditStatus'>) => Promise<void>;
  updateProjectAuditStatus: (id: string, auditStatus: 'pending' | 'audited' | 'risk_found') => Promise<void>;

  loadReports: () => Promise<void>;
  loadReport: (id: string) => Promise<AuditReport | null>;
  generateReport: (params: { projectId?: string; steps: AuditStep[]; risks: AuditRisk[]; sampleFileName: string }) => Promise<AuditReport>;
  exportReport: (id: string, format: 'pdf' | 'excel') => Promise<Blob>;

  loadRegressionCases: () => Promise<void>;
  runRegressionCase: (caseId: string, modifications?: any) => Promise<{ passed: boolean; result: AuditReport; diff: any }>;

  loadTodos: () => Promise<void>;
  addTodo: (todo: Omit<TodoItem, 'id' | 'createDate' | 'status'>) => Promise<void>;
  completeTodo: (id: string) => Promise<void>;

  analyzeRisks: (params: { font: FontFile; license?: License; channels: Channel[]; project?: Project }) => Promise<{ risks: AuditRisk[]; overallRisk: RiskLevel }>;
  getRiskStatistics: () => Promise<any>;

  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentRoute: (route: string) => void;
  setLoading: (key: string, value: boolean) => void;
}

const initialAuditState: AuditState = {
  step: 'upload',
  uploadedFile: null,
  recognizedFonts: [],
  matchedLicenses: {},
  validatedChannels: {},
  risks: [],
  steps: [],
  selectedProjectId: undefined
};

export const useStore = create<AppState>((set, get) => ({
  audit: initialAuditState,
  fonts: [],
  licenses: [],
  clients: [],
  channels: [],
  projects: [],
  reports: [],
  regressionCases: [],
  todos: [],
  loading: {},
  sidebarCollapsed: false,
  currentRoute: '/',

  setAuditStep: (step) => set(state => ({
    audit: { ...state.audit, step }
  })),

  setUploadedFile: (file) => set(state => ({
    audit: { ...state.audit, uploadedFile: file }
  })),

  setRecognizedFonts: (fonts) => set(state => ({
    audit: { ...state.audit, recognizedFonts: fonts }
  })),

  setMatchedLicense: (fontId, license) => set(state => ({
    audit: {
      ...state.audit,
      matchedLicenses: { ...state.audit.matchedLicenses, [fontId]: license }
    }
  })),

  setValidatedChannel: (channelId, valid) => set(state => ({
    audit: {
      ...state.audit,
      validatedChannels: { ...state.audit.validatedChannels, [channelId]: valid }
    }
  })),

  addAuditStep: (step) => set(state => ({
    audit: { ...state.audit, steps: [...state.audit.steps, step] }
  })),

  addRisk: (risk) => set(state => ({
    audit: { ...state.audit, risks: [...state.audit.risks, risk] }
  })),

  setAuditRisks: (risks) => set(state => ({
    audit: { ...state.audit, risks }
  })),

  setSelectedProject: (projectId) => set(state => ({
    audit: { ...state.audit, selectedProjectId: projectId }
  })),

  resetAudit: () => set({ audit: { ...initialAuditState } }),

  loadFonts: async () => {
    set({ loading: { ...get().loading, fonts: true } });
    try {
      const fonts = await fontApi.getFonts();
      set({ fonts });
    } finally {
      set({ loading: { ...get().loading, fonts: false } });
    }
  },

  addFont: async (font) => {
    const newFont = await fontApi.addFont(font);
    set(state => ({ fonts: [...state.fonts, newFont] }));
  },

  updateFontStatus: async (id, status) => {
    const updatedFont = await fontApi.updateFontStatus(id, status);
    set(state => ({
      fonts: state.fonts.map(f => f.id === id ? updatedFont : f)
    }));
  },

  loadLicenses: async () => {
    set({ loading: { ...get().loading, licenses: true } });
    try {
      const licenses = await licenseApi.getLicenses();
      set({ licenses });
    } finally {
      set({ loading: { ...get().loading, licenses: false } });
    }
  },

  addLicense: async (license) => {
    const newLicense = await licenseApi.addLicense(license);
    set(state => ({ licenses: [...state.licenses, newLicense] }));
  },

  updateLicense: async (license) => {
    const updatedLicense = await licenseApi.updateLicense(license);
    set(state => ({
      licenses: state.licenses.map(l => l.id === license.id ? updatedLicense : l)
    }));
  },

  loadClients: async () => {
    set({ loading: { ...get().loading, clients: true } });
    try {
      const clients = await clientApi.getClients();
      set({ clients });
    } finally {
      set({ loading: { ...get().loading, clients: false } });
    }
  },

  addClient: async (client) => {
    const newClient = await clientApi.addClient(client);
    set(state => ({ clients: [...state.clients, newClient] }));
  },

  loadChannels: async () => {
    set({ loading: { ...get().loading, channels: true } });
    try {
      const channels = await channelApi.getChannels();
      set({ channels });
    } finally {
      set({ loading: { ...get().loading, channels: false } });
    }
  },

  addChannel: async (channel) => {
    const newChannel = await channelApi.addChannel(channel);
    set(state => ({ channels: [...state.channels, newChannel] }));
  },

  updateChannelStatus: async (id, status) => {
    const updatedChannel = await channelApi.updateChannelStatus(id, status);
    set(state => ({
      channels: state.channels.map(c => c.id === id ? updatedChannel : c)
    }));
  },

  loadProjects: async () => {
    set({ loading: { ...get().loading, projects: true } });
    try {
      const projects = await projectApi.getProjects();
      set({ projects });
    } finally {
      set({ loading: { ...get().loading, projects: false } });
    }
  },

  addProject: async (project) => {
    const newProject = await projectApi.addProject(project);
    set(state => ({ projects: [...state.projects, newProject] }));
  },

  updateProjectAuditStatus: async (id, auditStatus) => {
    const updatedProject = await projectApi.updateProjectAuditStatus(id, auditStatus);
    set(state => ({
      projects: state.projects.map(p => p.id === id ? updatedProject : p)
    }));
  },

  loadReports: async () => {
    set({ loading: { ...get().loading, reports: true } });
    try {
      const reports = await reportApi.getReports();
      set({ reports });
    } finally {
      set({ loading: { ...get().loading, reports: false } });
    }
  },

  loadReport: async (id) => {
    return await reportApi.getReport(id);
  },

  generateReport: async (params) => {
    const report = await reportApi.generateReport(params);
    set(state => ({ reports: [report, ...state.reports] }));
    return report;
  },

  exportReport: async (id, format) => {
    return await reportApi.exportReport(id, format);
  },

  loadRegressionCases: async () => {
    set({ loading: { ...get().loading, regressionCases: true } });
    try {
      const cases = await regressionApi.getCases();
      set({ regressionCases: cases });
    } finally {
      set({ loading: { ...get().loading, regressionCases: false } });
    }
  },

  runRegressionCase: async (caseId, modifications) => {
    const result = await regressionApi.runCase(caseId, modifications);
    set(state => ({
      regressionCases: state.regressionCases.map(c =>
        c.id === caseId
          ? { ...c, lastRunDate: result.result.createDate, lastRunResult: result.passed ? 'passed' : 'failed' }
          : c
      )
    }));
    return result;
  },

  loadTodos: async () => {
    set({ loading: { ...get().loading, todos: true } });
    try {
      const todos = await todoApi.getTodos();
      set({ todos });
    } finally {
      set({ loading: { ...get().loading, todos: false } });
    }
  },

  addTodo: async (todo) => {
    const newTodo = await todoApi.addTodo(todo);
    set(state => ({ todos: [...state.todos, newTodo] }));
  },

  completeTodo: async (id) => {
    const updatedTodo = await todoApi.completeTodo(id);
    set(state => ({
      todos: state.todos.map(t => t.id === id ? updatedTodo : t)
    }));
  },

  analyzeRisks: async (params) => {
    return await riskApi.analyzeRisks(params);
  },

  getRiskStatistics: async () => {
    return await riskApi.getRiskStatistics();
  },

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setCurrentRoute: (route) => set({ currentRoute: route }),
  setLoading: (key, value) => set(state => ({
    loading: { ...state.loading, [key]: value }
  }))
}));
