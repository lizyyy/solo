import { create } from 'zustand';
import {
  SystemParams,
  TrajectoryPoint,
  EquilibriumPoint,
  findEquilibria,
  computeTrajectory,
  computeVectorField,
} from '@/utils/mathEngine';

export interface PendingItem {
  id: string;
  label: string;
  status: 'missing' | 'supplemented' | 'late';
  version: number;
  description: string;
  linkedConclusionId: string | null;
}

export interface ReportVersion {
  version: number;
  timestamp: number;
  params: SystemParams;
  equilibria: EquilibriumPoint[];
  trajectorySnapshot: TrajectoryPoint[];
  pendingItems: PendingItem[];
}

export interface VectorArrow {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface AppStore {
  params: SystemParams;
  initialCondition: { x0: number; y0: number };
  simConfig: { method: 'euler' | 'rk4'; dt: number; tMax: number };
  trajectories: TrajectoryPoint[];
  equilibria: EquilibriumPoint[];
  vectorField: VectorArrow[];
  playbackState: 'idle' | 'playing' | 'paused';
  playbackStep: number;
  playbackSpeed: number;
  divergenceWarning: boolean;
  pendingItems: PendingItem[];
  reportVersions: ReportVersion[];
  sidePanelOpen: boolean;
  reportModalOpen: boolean;

  setParam: (key: keyof SystemParams, value: number) => void;
  setInitialCondition: (x0: number, y0: number) => void;
  setSimConfig: (config: Partial<AppStore['simConfig']>) => void;
  setPlaybackState: (state: AppStore['playbackState']) => void;
  setPlaybackStep: (step: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleSidePanel: () => void;
  openReportModal: () => void;
  closeReportModal: () => void;
  exportReport: () => void;
  supplementPendingItem: (id: string, conclusionId: string) => void;
  addLateItem: (item: Omit<PendingItem, 'status' | 'version'>) => void;
  recalculate: () => void;
}

const DEFAULT_PARAMS: SystemParams = { a: -1, b: 0, c: 0, d: -2 };
const DEFAULT_IC = { x0: 2, y0: 2 };
const DEFAULT_SIM = { method: 'rk4' as const, dt: 0.05, tMax: 20 };

const SAMPLE_PENDING_ITEMS: PendingItem[] = [
  {
    id: 'P1',
    label: 'R3',
    status: 'missing',
    version: 1,
    description: '鞍点分界线走向需补充向量场截图',
    linkedConclusionId: null,
  },
  {
    id: 'P2',
    label: 'R1',
    status: 'supplemented',
    version: 1,
    description: '特征值计算已完成，结论已关联',
    linkedConclusionId: 'C1',
  },
];

function doRecalculate(params: SystemParams, ic: { x0: number; y0: number }, sim: AppStore['simConfig']) {
  const equilibria = findEquilibria(params);
  const { points, diverged } = computeTrajectory(params, ic.x0, ic.y0, sim.method, sim.dt, sim.tMax);
  const vectorField = computeVectorField(params, 5, 13);
  return { equilibria, trajectories: points, vectorField, divergenceWarning: diverged };
}

export const useStore = create<AppStore>((set, get) => ({
  params: DEFAULT_PARAMS,
  initialCondition: DEFAULT_IC,
  simConfig: DEFAULT_SIM,
  trajectories: [],
  equilibria: [],
  vectorField: [],
  playbackState: 'idle',
  playbackStep: 0,
  playbackSpeed: 1,
  divergenceWarning: false,
  pendingItems: SAMPLE_PENDING_ITEMS,
  reportVersions: [],
  sidePanelOpen: true,
  reportModalOpen: false,

  setParam: (key, value) => {
    set((s) => {
      const newParams = { ...s.params, [key]: value };
      const { equilibria, trajectories, vectorField, divergenceWarning } = doRecalculate(
        newParams,
        s.initialCondition,
        s.simConfig
      );
      return { params: newParams, equilibria, trajectories, vectorField, divergenceWarning, playbackStep: 0, playbackState: 'idle' };
    });
  },

  setInitialCondition: (x0, y0) => {
    set((s) => {
      const ic = { x0, y0 };
      const { trajectories, divergenceWarning } = doRecalculate(s.params, ic, s.simConfig);
      return { initialCondition: ic, trajectories, divergenceWarning, playbackStep: 0, playbackState: 'idle' };
    });
  },

  setSimConfig: (config) => {
    set((s) => {
      const newSim = { ...s.simConfig, ...config };
      const { trajectories, divergenceWarning } = doRecalculate(s.params, s.initialCondition, newSim);
      return { simConfig: newSim, trajectories, divergenceWarning, playbackStep: 0, playbackState: 'idle' };
    });
  },

  setPlaybackState: (state) => set({ playbackState: state }),
  setPlaybackStep: (step) => set({ playbackStep: step }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  toggleSidePanel: () => set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),
  openReportModal: () => set({ reportModalOpen: true }),
  closeReportModal: () => set({ reportModalOpen: false }),

  exportReport: () => {
    set((s) => {
      const newVersion = s.reportVersions.length + 1;
      const existing = s.reportVersions.find((r) => r.version === newVersion);
      const version = existing ? newVersion + 1 : newVersion;
      const report: ReportVersion = {
        version,
        timestamp: Date.now(),
        params: { ...s.params },
        equilibria: [...s.equilibria],
        trajectorySnapshot: [...s.trajectories],
        pendingItems: [...s.pendingItems],
      };
      return { reportVersions: [...s.reportVersions, report] };
    });
  },

  supplementPendingItem: (id, conclusionId) => {
    set((s) => ({
      pendingItems: s.pendingItems.map((item) =>
        item.id === id ? { ...item, status: 'supplemented' as const, linkedConclusionId: conclusionId } : item
      ),
    }));
  },

  addLateItem: (item) => {
    set((s) => {
      const existing = s.pendingItems.find((p) => p.label === item.label);
      const version = existing ? existing.version + 1 : 1;
      const label = existing ? `${item.label}-v${version}` : item.label;
      return {
        pendingItems: [...s.pendingItems, { ...item, label, status: 'late' as const, version }],
      };
    });
  },

  recalculate: () => {
    set((s) => {
      const { equilibria, trajectories, vectorField, divergenceWarning } = doRecalculate(
        s.params,
        s.initialCondition,
        s.simConfig
      );
      return { equilibria, trajectories, vectorField, divergenceWarning };
    });
  },
}));
