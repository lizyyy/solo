import { create } from 'zustand';
import type { Point, Conflict, HistoryRecord, SelfCheckResult, Workflow } from '@/types';
import {
  mockPoints,
  mockConflicts,
  mockHistory,
  mockSelfCheckResults,
  mockWorkflows,
} from '@/data/mockData';

interface AppState {
  points: Point[];
  conflicts: Conflict[];
  history: HistoryRecord[];
  selfCheckResults: SelfCheckResult[];
  workflows: Workflow[];
  currentUser: string;
  selectedPointId: string | null;
  setSelectedPointId: (id: string | null) => void;
  updatePoint: (id: string, updates: Partial<Point>) => void;
  addHistory: (record: Omit<HistoryRecord, 'id' | 'createdAt'>) => void;
  updateConflict: (id: string, updates: Partial<Conflict>) => void;
  runSelfCheck: () => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  advanceWorkflow: (workflowId: string, stepData: Record<string, unknown>) => void;
  approveReview: (pointId: string) => void;
  rejectReview: (pointId: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  points: mockPoints,
  conflicts: mockConflicts,
  history: mockHistory,
  selfCheckResults: mockSelfCheckResults,
  workflows: mockWorkflows,
  currentUser: '老马',
  selectedPointId: null,

  setSelectedPointId: (id) => set({ selectedPointId: id }),

  updatePoint: (id, updates) =>
    set((state) => ({
      points: state.points.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    })),

  addHistory: (record) =>
    set((state) => ({
      history: [
        {
          ...record,
          id: `h${Date.now()}`,
          createdAt: new Date().toISOString(),
        },
        ...state.history,
      ],
    })),

  updateConflict: (id, updates) =>
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === id
          ? { ...c, ...updates, handledAt: new Date().toISOString(), handler: get().currentUser }
          : c
      ),
    })),

  runSelfCheck: () => {
    const { points, currentUser } = get();
    const now = new Date().toISOString();

    const duplicateIssues: string[] = [];
    const pointNames = points.map((p) => p.name);
    const uniqueNames = new Set(pointNames);
    if (pointNames.length !== uniqueNames.size) {
      duplicateIssues.push('检测到可能重复的点位名称，请仔细核对');
    }

    const detourIssues: string[] = points
      .filter((p) => p.hasConstructionDetour && !p.mapSynced)
      .map((p) => `${p.name}：有施工改道但地图未同步`);

    const newResults: SelfCheckResult[] = [
      {
        id: `s${Date.now()}-1`,
        type: 'duplicate-import',
        typeName: '重复导入检测',
        status: duplicateIssues.length > 0 ? 'warning' : 'pass',
        issues: duplicateIssues.length > 0 ? duplicateIssues : [],
        checkedAt: now,
      },
      {
        id: `s${Date.now()}-2`,
        type: 'detour-sync',
        typeName: '施工改道同步检查',
        status: detourIssues.length > 0 ? 'error' : 'pass',
        issues: detourIssues,
        checkedAt: now,
      },
      {
        id: `s${Date.now()}-3`,
        type: 'recalculate',
        typeName: '补录后重算',
        status: 'pass',
        issues: [],
        checkedAt: now,
      },
      {
        id: `s${Date.now()}-4`,
        type: 'export-consistent',
        typeName: '导出一致性校验',
        status: 'pass',
        issues: [],
        checkedAt: now,
      },
    ];

    set({ selfCheckResults: newResults });

    set((state) => ({
      history: [
        {
          id: `h${Date.now()}`,
          pointId: '',
          pointName: '系统',
          action: 'update',
          operator: currentUser,
          beforeData: {},
          afterData: {},
          remark: '执行系统自检',
          createdAt: now,
        },
        ...state.history,
      ],
    }));
  },

  updateWorkflow: (id, updates) =>
    set((state) => ({
      workflows: state.workflows.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    })),

  advanceWorkflow: (workflowId, stepData) =>
    set((state) => {
      const workflow = state.workflows.find((w) => w.id === workflowId);
      if (!workflow) return state;

      const nextStep = (workflow.currentStep + 1) as 1 | 2 | 3;
      const stepKey = `step${workflow.currentStep}` as keyof typeof workflow.stepData;

      let newStatus = workflow.status;
      if (nextStep > 3) {
        const point = state.points.find((p) => p.id === workflow.pointId);
        if (point && point.hasConstructionDetour && !point.mapSynced) {
          newStatus = 'pending-review';
        } else {
          newStatus = 'completed';
        }
      }

      const newStepData = {
        ...workflow.stepData,
        [stepKey]: {
          ...stepData,
          [`${stepKey === 'step1' ? 'importedAt' : stepKey === 'step2' ? 'reviewedAt' : 'updatedAt'}`]:
            new Date().toISOString(),
        },
      };

      return {
        workflows: state.workflows.map((w) =>
          w.id === workflowId
            ? {
                ...w,
                currentStep: nextStep > 3 ? 3 : nextStep,
                status: newStatus,
                stepData: newStepData,
              }
            : w
        ),
      };
    }),

  approveReview: (pointId) => {
    const { currentUser, addHistory } = get();
    const point = get().points.find((p) => p.id === pointId);
    if (!point) return;

    set((state) => ({
      points: state.points.map((p) =>
        p.id === pointId
          ? { ...p, reviewStatus: 'approved', mapSynced: true, updatedAt: new Date().toISOString() }
          : p
      ),
      conflicts: state.conflicts.map((c) =>
        c.pointId === pointId && c.type === 'detour-not-synced'
          ? { ...c, status: 'confirmed', handledAt: new Date().toISOString(), handler: currentUser }
          : c
      ),
    }));

    addHistory({
      pointId,
      pointName: point.name,
      action: 'review',
      operator: '居民代表',
      beforeData: { reviewStatus: 'pending', mapSynced: false },
      afterData: { reviewStatus: 'approved', mapSynced: true },
      remark: '施工改道复核通过，地图已同步',
    });
  },

  rejectReview: (pointId) => {
    const { currentUser, addHistory } = get();
    const point = get().points.find((p) => p.id === pointId);
    if (!point) return;

    set((state) => ({
      points: state.points.map((p) =>
        p.id === pointId
          ? { ...p, reviewStatus: 'rejected', updatedAt: new Date().toISOString() }
          : p
      ),
      conflicts: state.conflicts.map((c) =>
        c.pointId === pointId && c.type === 'detour-not-synced'
          ? { ...c, status: 'rejected', handledAt: new Date().toISOString(), handler: currentUser }
          : c
      ),
    }));

    addHistory({
      pointId,
      pointName: point.name,
      action: 'review',
      operator: '居民代表',
      beforeData: { reviewStatus: 'pending' },
      afterData: { reviewStatus: 'rejected' },
      remark: '施工改道复核驳回，需要重新处理',
    });
  },
}));
