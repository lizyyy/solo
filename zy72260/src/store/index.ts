import { create } from 'zustand';
import {
  PointCloudLog,
  SafetyRadiusTable,
  Route,
  ConflictRecord,
  ExportRecord,
  SelfCheckItem,
  WorkflowState,
  WorkflowStep,
  HistoryCompareResult,
} from '@/types';
import { db } from '@/db';

interface AppState {
  workflow: WorkflowState;
  pointCloudLog: PointCloudLog | null;
  safetyRadiusTable: SafetyRadiusTable | null;
  routes: Route[];
  conflicts: ConflictRecord[];
  selfChecks: SelfCheckItem[];
  exports: ExportRecord[];
  lastCompareResult: HistoryCompareResult | null;
  isLoading: boolean;
  operator: string;

  setOperator: (name: string) => void;
  setCurrentStep: (step: WorkflowStep) => void;
  completeStep: (step: WorkflowStep) => void;
  setPointCloudLog: (log: PointCloudLog | null) => void;
  setSafetyRadiusTable: (table: SafetyRadiusTable | null) => void;
  setRoutes: (routes: Route[]) => void;
  addRoute: (route: Route) => void;
  updateRoute: (id: string, updates: Partial<Route>) => void;
  setConflicts: (conflicts: ConflictRecord[]) => void;
  updateConflict: (id: string, updates: Partial<ConflictRecord>) => void;
  setSelfChecks: (checks: SelfCheckItem[]) => void;
  updateSelfCheck: (id: string, updates: Partial<SelfCheckItem>) => void;
  setExports: (exports: ExportRecord[]) => void;
  addExport: (record: ExportRecord) => void;
  setLastCompareResult: (result: HistoryCompareResult | null) => void;
  setIsLoading: (loading: boolean) => void;
  setWorkflow: (workflow: Partial<WorkflowState>) => void;
  loadFromDatabase: () => Promise<void>;
  resetAll: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  workflow: {
    currentStep: 'import_point_cloud',
    stepCompleted: {
      import_point_cloud: false,
      import_safety_radius: false,
      export: false,
    },
  },
  pointCloudLog: null,
  safetyRadiusTable: null,
  routes: [],
  conflicts: [],
  selfChecks: [],
  exports: [],
  lastCompareResult: null,
  isLoading: false,
  operator: '航测内业小魏',

  setOperator: (name) => set({ operator: name }),

  setCurrentStep: (step) => set((state) => ({
    workflow: { ...state.workflow, currentStep: step },
  })),

  completeStep: (step) => set((state) => ({
    workflow: {
      ...state.workflow,
      stepCompleted: {
        ...state.workflow.stepCompleted,
        [step]: true,
      },
    },
  })),

  setPointCloudLog: (log) => set({ pointCloudLog: log }),
  setSafetyRadiusTable: (table) => set({ safetyRadiusTable: table }),
  setRoutes: (routes) => set({ routes }),
  
  addRoute: (route) => set((state) => ({
    routes: [...state.routes, route],
  })),

  updateRoute: (id, updates) => set((state) => ({
    routes: state.routes.map((r) =>
      r.id === id ? { ...r, ...updates } : r
    ),
  })),

  setConflicts: (conflicts) => set({ conflicts }),
  
  updateConflict: (id, updates) => set((state) => ({
    conflicts: state.conflicts.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    ),
  })),

  setSelfChecks: (checks) => set({ selfChecks: checks }),
  
  updateSelfCheck: (id, updates) => set((state) => ({
    selfChecks: state.selfChecks.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    ),
  })),

  setExports: (exports) => set({ exports }),
  
  addExport: (record) => set((state) => ({
    exports: [record, ...state.exports],
  })),

  setLastCompareResult: (result) => set({ lastCompareResult: result }),
  setIsLoading: (isLoading) => set({ isLoading }),

  setWorkflow: (workflow) => set((state) => ({
    workflow: { ...state.workflow, ...workflow },
  })),

  loadFromDatabase: async () => {
    set({ isLoading: true });
    try {
      const [pointCloudLogs, safetyRadiusTables, routes, conflicts, exports] = await Promise.all([
        db.pointCloudLogs.orderBy('importTime').reverse().limit(1).toArray(),
        db.safetyRadiusTables.orderBy('importTime').reverse().limit(1).toArray(),
        db.routes.toArray(),
        db.conflicts.toArray(),
        db.exports.orderBy('exportTime').reverse().toArray(),
      ]);

      set({
        pointCloudLog: pointCloudLogs[0] || null,
        safetyRadiusTable: safetyRadiusTables[0] || null,
        routes,
        conflicts,
        exports,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load from database:', error);
      set({ isLoading: false });
    }
  },

  resetAll: () => {
    set({
      pointCloudLog: null,
      safetyRadiusTable: null,
      routes: [],
      conflicts: [],
      selfChecks: [],
      lastCompareResult: null,
      workflow: {
        currentStep: 'import_point_cloud',
        stepCompleted: {
          import_point_cloud: false,
          import_safety_radius: false,
          export: false,
        },
      },
    });
  },
}));
