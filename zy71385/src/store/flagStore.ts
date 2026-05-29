import { create } from 'zustand';
import type {
  FeatureFlag,
  FlagWithDetails,
  CodeReference,
  EnvironmentStatus,
  RiskAssessment,
  CleanupLog,
  Report,
  RuleConfig,
  FilterParams,
  PaginationParams,
  ImportResult,
  ImportConflictStrategy,
} from '../types';
import {
  getMockFlagsWithDetails,
  generateMockFlags,
  generateMockCodeReferences,
  generateMockEnvironmentStatuses,
  generateRiskAssessments,
  generateMockCleanupLogs,
  generateMockReports,
  mockRules,
} from '../mock/data';
import { getDefaultRules } from '../utils/riskCalculator';

interface FlagState {
  flags: FlagWithDetails[];
  codeReferences: CodeReference[];
  environmentStatuses: EnvironmentStatus[];
  riskAssessments: RiskAssessment[];
  cleanupLogs: CleanupLog[];
  reports: Report[];
  rules: RuleConfig[];
  selectedFlags: string[];
  filters: FilterParams;
  pagination: PaginationParams;
  loading: boolean;
  searchQuery: string;
  showImportModal: boolean;
  importResult: ImportResult | null;
  importPendingConflicts: { flagKey: string; existing: FeatureFlag; incoming: Partial<FeatureFlag> }[];
}

interface FlagActions {
  initData: () => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<FilterParams>) => void;
  setPagination: (pagination: Partial<PaginationParams>) => void;
  toggleFlagSelection: (flagId: string) => void;
  selectAllFlags: () => void;
  clearSelection: () => void;
  getFilteredFlags: () => FlagWithDetails[];
  getPaginatedFlags: () => FlagWithDetails[];
  getTotalPages: () => number;
  getFlagById: (id: string) => FlagWithDetails | undefined;
  getReferencesByFlagId: (flagId: string) => CodeReference[];
  getEnvStatusByFlagId: (flagId: string) => EnvironmentStatus[];
  getRiskAssessmentByFlagId: (flagId: string) => RiskAssessment | undefined;
  getStatistics: () => {
    total: number;
    safeToDelete: number;
    highRisk: number;
    pending: number;
    byRiskLevel: Record<string, number>;
  };
  updateFlag: (id: string, updates: Partial<FeatureFlag>) => void;
  deleteFlag: (id: string) => void;
  addFlag: (flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  setShowImportModal: (show: boolean) => void;
  processImport: (file: File) => Promise<void>;
  resolveImportConflict: (flagKey: string, strategy: ImportConflictStrategy) => void;
  resolveAllConflicts: (strategy: ImportConflictStrategy) => void;
  executeCleanup: (flagIds: string[], note: string) => void;
  rollbackCleanup: (logId: string) => void;
  reAssessAll: () => void;
  runScan: (config?: { paths?: string[] }) => Promise<void>;
  generateReport: (type: 'cleanup' | 'risk' | 'scan') => Report;
  updateRule: (ruleKey: string, value: any) => void;
  toggleRule: (ruleKey: string) => void;
  exportFlags: (format: 'xlsx' | 'json', flagIds?: string[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useFlagStore = create<FlagState & FlagActions>((set, get) => ({
  flags: [],
  codeReferences: [],
  environmentStatuses: [],
  riskAssessments: [],
  cleanupLogs: [],
  reports: [],
  rules: [],
  selectedFlags: [],
  filters: {},
  pagination: { page: 1, pageSize: 10 },
  loading: false,
  searchQuery: '',
  showImportModal: false,
  importResult: null,
  importPendingConflicts: [],

  initData: () => {
    const flagsWithDetails = getMockFlagsWithDetails();
    const flags = generateMockFlags();
    const codeRefs = generateMockCodeReferences(flags);
    const envStatuses = generateMockEnvironmentStatuses(flags);
    const assessments = generateRiskAssessments(flags, codeRefs, envStatuses);
    const logs = generateMockCleanupLogs(flags);
    const reports = generateMockReports(flags, assessments);

    set({
      flags: flagsWithDetails,
      codeReferences: codeRefs,
      environmentStatuses: envStatuses,
      riskAssessments: assessments,
      cleanupLogs: logs,
      reports,
      rules: getDefaultRules(),
    });
  },

  setSearchQuery: (query) => set({ searchQuery: query, pagination: { ...get().pagination, page: 1 } }),

  setFilters: (filters) => set({ filters: { ...get().filters, ...filters }, pagination: { ...get().pagination, page: 1 } }),

  setPagination: (pagination) => set({ pagination: { ...get().pagination, ...pagination } }),

  toggleFlagSelection: (flagId) => {
    const { selectedFlags } = get();
    if (selectedFlags.includes(flagId)) {
      set({ selectedFlags: selectedFlags.filter(id => id !== flagId) });
    } else {
      set({ selectedFlags: [...selectedFlags, flagId] });
    }
  },

  selectAllFlags: () => {
    const filtered = get().getFilteredFlags();
    set({ selectedFlags: filtered.map(f => f.id) });
  },

  clearSelection: () => set({ selectedFlags: [] }),

  getFilteredFlags: () => {
    const { flags, filters, searchQuery } = get();
    let result = [...flags];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.owner && f.owner.toLowerCase().includes(q))
      );
    }

    if (filters.riskLevel?.length) {
      result = result.filter(f => f.riskLevel && filters.riskLevel!.includes(f.riskLevel));
    }

    if (filters.status?.length) {
      result = result.filter(f => filters.status!.includes(f.status));
    }

    if (filters.owner) {
      result = result.filter(f => f.owner === filters.owner);
    }

    if (filters.hasCodeReferences !== undefined) {
      result = result.filter(f => filters.hasCodeReferences ? f.codeReferences.length > 0 : f.codeReferences.length === 0);
    }

    if (filters.hasGrayUsers !== undefined) {
      result = result.filter(f => {
        const maxGray = Math.max(...f.environmentStatuses.map(e => e.grayUsers), 0);
        return filters.hasGrayUsers ? maxGray > 0 : maxGray === 0;
      });
    }

    return result;
  },

  getPaginatedFlags: () => {
    const { getFilteredFlags, pagination } = get();
    const filtered = getFilteredFlags();
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filtered.slice(start, end);
  },

  getTotalPages: () => {
    const { getFilteredFlags, pagination } = get();
    return Math.ceil(getFilteredFlags().length / pagination.pageSize);
  },

  getFlagById: (id) => get().flags.find(f => f.id === id),

  getReferencesByFlagId: (flagId) => get().codeReferences.filter(r => r.flagId === flagId),

  getEnvStatusByFlagId: (flagId) => get().environmentStatuses.filter(e => e.flagId === flagId),

  getRiskAssessmentByFlagId: (flagId) => get().riskAssessments.find(a => a.flagId === flagId),

  getStatistics: () => {
    const { flags } = get();
    const byRiskLevel: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      blocker: 0,
    };

    let safeToDelete = 0;
    let highRisk = 0;
    let pending = 0;

    flags.forEach(f => {
      if (f.riskLevel) {
        byRiskLevel[f.riskLevel]++;
        if (f.suggestedAction === 'safe_delete') safeToDelete++;
        if (f.riskLevel === 'high' || f.riskLevel === 'blocker') highRisk++;
        if (f.status === 'pending_cleanup') pending++;
      }
    });

    return {
      total: flags.length,
      safeToDelete,
      highRisk,
      pending,
      byRiskLevel,
    };
  },

  updateFlag: (id, updates) => {
    const { flags } = get();
    const updatedFlags = flags.map(f =>
      f.id === id ? { ...f, ...updates, updatedAt: new Date().toISOString() } : f
    );
    set({ flags: updatedFlags });
  },

  deleteFlag: (id) => {
    const { flags, cleanupLogs, selectedFlags } = get();
    const flag = flags.find(f => f.id === id);
    if (!flag) return;

    const newLog: CleanupLog = {
      id: `log-${generateId()}`,
      flagId: id,
      action: 'delete',
      operator: '当前用户',
      timestamp: new Date().toISOString(),
      beforeSnapshot: flag,
      afterSnapshot: { ...flag, status: 'inactive' },
      note: '手动删除开关',
    };

    set({
      flags: flags.filter(f => f.id !== id),
      cleanupLogs: [newLog, ...cleanupLogs],
      selectedFlags: selectedFlags.filter(fid => fid !== id),
    });
  },

  addFlag: (flag) => {
    const { flags } = get();
    const now = new Date().toISOString();
    const newFlag: FlagWithDetails = {
      ...flag,
      id: `flag-${generateId()}`,
      createdAt: now,
      updatedAt: now,
      codeReferences: [],
      environmentStatuses: [],
      riskReasons: [],
    };
    set({ flags: [newFlag, ...flags] });
  },

  setShowImportModal: (show) => set({ showImportModal: show, importResult: null, importPendingConflicts: [] }),

  processImport: async (file) => {
    set({ loading: true });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { flags } = get();
    const mockIncoming: Partial<FeatureFlag>[] = [
      { name: '新增测试开关', key: 'feature.test_new', description: '导入测试', owner: '测试用户', status: 'active' },
      { name: '支付通道灰度', key: 'feature.payment_channel_gray', description: '更新后的描述', owner: '新负责人' },
    ];

    const conflicts: { flagKey: string; existing: FeatureFlag; incoming: Partial<FeatureFlag> }[] = [];
    const newFlags: FlagWithDetails[] = [];
    const skipped = 0;

    mockIncoming.forEach(incoming => {
      const existing = flags.find(f => f.key === incoming.key);
      if (existing) {
        conflicts.push({ flagKey: incoming.key!, existing, incoming });
      } else {
        const now = new Date().toISOString();
        newFlags.push({
          ...incoming,
          id: `flag-${generateId()}`,
          key: incoming.key!,
          name: incoming.name!,
          description: incoming.description || '',
          owner: incoming.owner || null,
          launchDate: null,
          status: incoming.status || 'active',
          createdAt: now,
          updatedAt: now,
          codeReferences: [],
          environmentStatuses: [],
          riskReasons: [],
        });
      }
    });

    if (conflicts.length > 0) {
      set({
        importPendingConflicts: conflicts,
        loading: false,
      });
    } else {
      set({
        flags: [...newFlags, ...flags],
        importResult: {
          total: mockIncoming.length,
          success: newFlags.length,
          skipped,
          overwritten: 0,
          appended: 0,
          conflicts: [],
        },
        loading: false,
      });
    }
  },

  resolveImportConflict: (flagKey, strategy) => {
    const { flags, importPendingConflicts } = get();
    const conflict = importPendingConflicts.find(c => c.flagKey === flagKey);
    if (!conflict) return;

    let updatedFlags = [...flags];
    let overwritten = 0;
    let skipped = 0;
    let appended = 0;

    if (strategy === 'overwrite') {
      updatedFlags = flags.map(f =>
        f.key === flagKey ? { ...f, ...conflict.incoming, updatedAt: new Date().toISOString() } as FlagWithDetails : f
      );
      overwritten = 1;
    } else if (strategy === 'skip') {
      skipped = 1;
    } else if (strategy === 'append') {
      const now = new Date().toISOString();
      const newFlag: FlagWithDetails = {
        ...conflict.incoming,
        id: `flag-${generateId()}`,
        key: `${flagKey}_${Date.now()}`,
        name: conflict.incoming.name || conflict.existing.name,
        description: conflict.incoming.description || conflict.existing.description,
        owner: conflict.incoming.owner || conflict.existing.owner,
        launchDate: null,
        status: conflict.incoming.status || conflict.existing.status,
        createdAt: now,
        updatedAt: now,
        codeReferences: [],
        environmentStatuses: [],
        riskReasons: [],
      };
      updatedFlags = [newFlag, ...flags];
      appended = 1;
    }

    const remainingConflicts = importPendingConflicts.filter(c => c.flagKey !== flagKey);

    if (remainingConflicts.length === 0) {
      set({
        flags: updatedFlags,
        importPendingConflicts: [],
        importResult: {
          total: importPendingConflicts.length + 1,
          success: overwritten + appended,
          skipped,
          overwritten,
          appended,
          conflicts: [],
        },
      });
    } else {
      set({
        flags: updatedFlags,
        importPendingConflicts: remainingConflicts,
      });
    }
  },

  resolveAllConflicts: (strategy) => {
    const { importPendingConflicts } = get();
    importPendingConflicts.forEach(conflict => {
      get().resolveImportConflict(conflict.flagKey, strategy);
    });
  },

  executeCleanup: (flagIds, note) => {
    const { flags, cleanupLogs } = get();
    const now = new Date().toISOString();
    const newLogs: CleanupLog[] = [];

    const updatedFlags = flags.map(f => {
      if (flagIds.includes(f.id)) {
        newLogs.push({
          id: `log-${generateId()}`,
          flagId: f.id,
          action: 'delete',
          operator: '当前用户',
          timestamp: now,
          beforeSnapshot: f,
          afterSnapshot: { ...f, status: 'inactive' },
          note,
        });
        return { ...f, status: 'inactive' as const, updatedAt: now };
      }
      return f;
    });

    set({
      flags: updatedFlags,
      cleanupLogs: [...newLogs, ...cleanupLogs],
      selectedFlags: [],
    });
  },

  rollbackCleanup: (logId) => {
    const { cleanupLogs, flags } = get();
    const log = cleanupLogs.find(l => l.id === logId);
    if (!log) return;

    const updatedFlags = flags.map(f =>
      f.id === log.flagId ? { ...f, ...log.beforeSnapshot, updatedAt: new Date().toISOString() } : f
    );

    const newLog: CleanupLog = {
      id: `log-${generateId()}`,
      flagId: log.flagId,
      action: 'rollback',
      operator: '当前用户',
      timestamp: new Date().toISOString(),
      beforeSnapshot: log.afterSnapshot,
      afterSnapshot: log.beforeSnapshot,
      note: '回滚清理操作',
    };

    set({
      flags: updatedFlags,
      cleanupLogs: [newLog, ...cleanupLogs],
    });
  },

  reAssessAll: () => {
    const { flags, codeReferences, environmentStatuses, rules } = get();
    const assessments = generateRiskAssessments(flags, codeReferences, environmentStatuses, rules);
    
    const updatedFlags = flags.map(f => {
      const assessment = assessments.find(a => a.flagId === f.id);
      return {
        ...f,
        riskLevel: assessment?.level,
        suggestedAction: assessment?.suggestedAction,
        riskReasons: assessment?.reasons || [],
      };
    });

    set({
      flags: updatedFlags,
      riskAssessments: assessments,
    });
  },

  runScan: async (config) => {
    set({ loading: true });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    get().reAssessAll();
    set({ loading: false });
  },

  generateReport: (type) => {
    const { flags, riskAssessments } = get();
    const stats = get().getStatistics();
    
    const newReport: Report = {
      id: `report-${generateId()}`,
      title: `${type === 'cleanup' ? '清理' : type === 'risk' ? '风险' : '扫描'}报告 - ${new Date().toLocaleDateString('zh-CN')}`,
      type,
      generatedAt: new Date().toISOString(),
      generatedBy: '当前用户',
      summary: {
        totalFlags: stats.total,
        safeToDelete: stats.safeToDelete,
        needVerification: stats.byRiskLevel.medium,
        doNotDelete: stats.byRiskLevel.blocker,
        blockers: stats.byRiskLevel.blocker,
      },
      flagIds: flags.filter(f => f.suggestedAction === 'safe_delete').map(f => f.id),
    };

    set({ reports: [newReport, ...get().reports] });
    return newReport;
  },

  updateRule: (ruleKey, value) => {
    const { rules } = get();
    const updatedRules = rules.map(r =>
      r.ruleKey === ruleKey ? { ...r, value, updatedAt: new Date().toISOString() } : r
    );
    set({ rules: updatedRules });
  },

  toggleRule: (ruleKey) => {
    const { rules } = get();
    const updatedRules = rules.map(r =>
      r.ruleKey === ruleKey ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r
    );
    set({ rules: updatedRules });
  },

  exportFlags: (format, flagIds) => {
    const { flags } = get();
    const dataToExport = flagIds ? flags.filter(f => flagIds.includes(f.id)) : flags;
    
    console.log(`Exporting ${dataToExport.length} flags as ${format}`, dataToExport);
  },
}));
