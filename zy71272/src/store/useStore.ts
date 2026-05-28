import { create } from 'zustand';
import {
  AppState,
  Musician,
  Microphone,
  MonitorPoint,
  RoomConfig,
  RehearsalPlan,
  SceneIssue,
  RehearsalReport,
  SoundPressureSample,
  Vector3,
  SelectedObjectType,
  CompletePlanData,
} from '../types';
import { generateId } from '../utils/helpers';
import {
  DEFAULT_ROOM_CONFIG,
  DEFAULT_MUSICIANS,
  DEFAULT_MONITOR_POINTS,
  INSTRUMENT_COLORS,
} from '../utils/constants';
import { runAllSceneValidations } from '../utils/sceneDetection';
import { generateHeatmapData, calculateVolumeBalanceScore, calculateCombinedSoundPressure } from '../utils/soundField';
import * as db from '../services/db';

const createDefaultPlan = (): { plan: RehearsalPlan; musicians: Musician[]; monitorPoints: MonitorPoint[]; roomConfig: RoomConfig } => {
  const planId = generateId();
  const now = new Date();

  const plan: RehearsalPlan = {
    id: planId,
    name: '新排练方案',
    description: '',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isSaved: false,
  };

  const musicians: Musician[] = DEFAULT_MUSICIANS.map(m => ({
    id: generateId(),
    planId,
    type: m.type as Musician['type'],
    name: m.name,
    position: { ...m.position },
    rotation: m.rotation,
    sourceLevel: m.sourceLevel,
    directivity: m.directivity,
    color: INSTRUMENT_COLORS[m.type],
  }));

  const monitorPoints: MonitorPoint[] = DEFAULT_MONITOR_POINTS.map(mp => ({
    id: generateId(),
    planId,
    name: mp.name,
    position: { ...mp.position },
  }));

  const roomConfig: RoomConfig = {
    id: generateId(),
    planId,
    ...DEFAULT_ROOM_CONFIG,
  };

  return { plan, musicians, monitorPoints, roomConfig };
};

const runValidations = (
  musicians: Musician[],
  monitorPoints: MonitorPoint[]
): SceneIssue[] => {
  return runAllSceneValidations(musicians, monitorPoints);
};

const regenerateHeatmap = (
  musicians: Musician[],
  roomConfig: RoomConfig
): SoundPressureSample[] => {
  return generateHeatmapData(musicians, roomConfig);
};

interface AppActions {
  initNewPlan: () => void;
  loadPlan: (planId: string) => Promise<boolean>;
  saveCurrentPlan: () => Promise<boolean>;
  savePlanAs: (name: string) => Promise<boolean>;
  deletePlan: (planId: string) => Promise<boolean>;
  refreshSavedPlans: () => Promise<void>;
  updatePlanMeta: (updates: Partial<RehearsalPlan>) => void;
  updateMusician: (id: string, updates: Partial<Musician>) => void;
  addMusician: (type: Musician['type'], name: string) => void;
  removeMusician: (id: string) => void;
  updateMicrophone: (id: string, updates: Partial<Microphone>) => void;
  addMicrophone: (name: string) => void;
  removeMicrophone: (id: string) => void;
  updateMonitorPoint: (id: string, updates: Partial<MonitorPoint>) => void;
  addMonitorPoint: (name: string, position: Vector3) => void;
  removeMonitorPoint: (id: string) => void;
  updateRoomConfig: (updates: Partial<RoomConfig>) => void;
  selectObject: (id: string | null, type: SelectedObjectType) => void;
  setShowHeatmap: (show: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  setShowReportModal: (show: boolean) => void;
  setShowLoadModal: (show: boolean) => void;
  markAsUnsaved: () => void;
  generateReport: () => RehearsalReport;
  saveReport: (report: RehearsalReport) => void;
  focusOnIssue: (issue: SceneIssue) => void;
  autoBalanceVolumes: () => void;
}

const initialState: AppState = {
  currentPlanId: null,
  plan: null,
  musicians: [],
  microphones: [],
  monitorPoints: [],
  roomConfig: null,
  reports: [],
  sceneIssues: [],
  selectedObjectId: null,
  selectedObjectType: null,
  showHeatmap: true,
  heatmapData: [],
  savedPlans: [],
  uiState: {
    sidebarOpen: true,
    activeTab: 'musicians',
    showReportModal: false,
    showLoadModal: false,
  },
};

export const useStore = create<AppState & AppActions>((set, get) => {
  const triggerUpdates = () => {
    const state = get();
    if (!state.roomConfig || state.musicians.length === 0) return;

    const issues = runValidations(state.musicians, state.monitorPoints);
    const heatmapData = state.showHeatmap
      ? regenerateHeatmap(state.musicians, state.roomConfig)
      : state.heatmapData;

    set({ sceneIssues: issues, heatmapData });
  };

  return {
    ...initialState,

    initNewPlan: () => {
      const { plan, musicians, monitorPoints, roomConfig } = createDefaultPlan();
      const heatmapData = regenerateHeatmap(musicians, roomConfig);
      const issues = runValidations(musicians, monitorPoints);

      set({
        currentPlanId: plan.id,
        plan,
        musicians,
        microphones: [],
        monitorPoints,
        roomConfig,
        reports: [],
        sceneIssues: issues,
        heatmapData,
        selectedObjectId: null,
        selectedObjectType: null,
      });

      localStorage.setItem('lastPlanId', plan.id);
    },

    loadPlan: async (planId: string): Promise<boolean> => {
      let data = await db.loadFromBackend(planId);
      if (!data) {
        data = await db.loadPlan(planId);
      }

      if (!data || !data.roomConfig) return false;

      const issues = runValidations(data.musicians, data.monitorPoints);
      const heatmapData = regenerateHeatmap(data.musicians, data.roomConfig);

      set({
        currentPlanId: data.plan.id,
        plan: data.plan,
        musicians: data.musicians,
        microphones: data.microphones,
        monitorPoints: data.monitorPoints,
        roomConfig: data.roomConfig,
        reports: data.reports,
        sceneIssues: issues,
        heatmapData,
        selectedObjectId: null,
        selectedObjectType: null,
      });

      localStorage.setItem('lastPlanId', planId);
      return true;
    },

    saveCurrentPlan: async (): Promise<boolean> => {
      const state = get();
      if (!state.plan || !state.roomConfig) return false;

      const data: CompletePlanData = {
        plan: { ...state.plan, isSaved: true, updatedAt: new Date() },
        musicians: state.musicians,
        microphones: state.microphones,
        monitorPoints: state.monitorPoints,
        roomConfig: state.roomConfig,
        reports: state.reports,
      };

      await db.savePlan(data);
      await db.syncWithBackend(data);

      set({
        plan: data.plan,
      });

      await get().refreshSavedPlans();
      return true;
    },

    savePlanAs: async (name: string): Promise<boolean> => {
      const state = get();
      if (!state.roomConfig) return false;

      const newPlanId = generateId();
      const newPlan: RehearsalPlan = {
        id: newPlanId,
        name,
        description: state.plan?.description || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isSaved: true,
      };

      const data: CompletePlanData = {
        plan: newPlan,
        musicians: state.musicians.map(m => ({ ...m, id: generateId(), planId: newPlanId })),
        microphones: state.microphones.map(m => ({ ...m, id: generateId(), planId: newPlanId })),
        monitorPoints: state.monitorPoints.map(m => ({ ...m, id: generateId(), planId: newPlanId })),
        roomConfig: { ...state.roomConfig, id: generateId(), planId: newPlanId },
        reports: state.reports.map(r => ({ ...r, id: generateId(), planId: newPlanId })),
      };

      await db.savePlan(data);
      await db.syncWithBackend(data);

      set({
        currentPlanId: newPlanId,
        plan: newPlan,
        musicians: data.musicians,
        microphones: data.microphones,
        monitorPoints: data.monitorPoints,
        roomConfig: data.roomConfig,
      });

      localStorage.setItem('lastPlanId', newPlanId);
      await get().refreshSavedPlans();
      return true;
    },

    deletePlan: async (planId: string): Promise<boolean> => {
      await db.deletePlan(planId);
      await get().refreshSavedPlans();

      if (get().currentPlanId === planId) {
        get().initNewPlan();
      }
      return true;
    },

    refreshSavedPlans: async () => {
      let plans = await db.getAllPlansFromBackend();
      if (plans.length === 0) {
        plans = await db.getAllPlans();
      }
      set({ savedPlans: plans.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )});
    },

    updatePlanMeta: (updates) => {
      set(state => ({
        plan: state.plan ? { ...state.plan, ...updates } : null,
      }));
      get().markAsUnsaved();
    },

    updateMusician: (id, updates) => {
      set(state => ({
        musicians: state.musicians.map(m =>
          m.id === id ? { ...m, ...updates } : m
        ),
      }));
      triggerUpdates();
      get().markAsUnsaved();
    },

    addMusician: (type, name) => {
      const state = get();
      if (!state.currentPlanId || !state.roomConfig) return;

      const newMusician: Musician = {
        id: generateId(),
        planId: state.currentPlanId,
        type,
        name,
        position: { x: (Math.random() - 0.5) * 4, y: 0, z: (Math.random() - 0.5) * 4 },
        rotation: 0,
        sourceLevel: 90,
        directivity: 0.5,
        color: INSTRUMENT_COLORS[type],
      };

      set(state => ({ musicians: [...state.musicians, newMusician] }));
      triggerUpdates();
      get().markAsUnsaved();
    },

    removeMusician: (id) => {
      set(state => ({
        musicians: state.musicians.filter(m => m.id !== id),
        selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
      }));
      triggerUpdates();
      get().markAsUnsaved();
    },

    updateMicrophone: (id, updates) => {
      set(state => ({
        microphones: state.microphones.map(m =>
          m.id === id ? { ...m, ...updates } : m
        ),
      }));
      get().markAsUnsaved();
    },

    addMicrophone: (name) => {
      const state = get();
      if (!state.currentPlanId) return;

      const newMic: Microphone = {
        id: generateId(),
        planId: state.currentPlanId,
        name,
        type: 'dynamic',
        position: { x: 0, y: 1.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        gain: 0,
      };

      set(state => ({ microphones: [...state.microphones, newMic] }));
      get().markAsUnsaved();
    },

    removeMicrophone: (id) => {
      set(state => ({
        microphones: state.microphones.filter(m => m.id !== id),
        selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
      }));
      get().markAsUnsaved();
    },

    updateMonitorPoint: (id, updates) => {
      set(state => ({
        monitorPoints: state.monitorPoints.map(m =>
          m.id === id ? { ...m, ...updates } : m
        ),
      }));
      triggerUpdates();
      get().markAsUnsaved();
    },

    addMonitorPoint: (name, position) => {
      const state = get();
      if (!state.currentPlanId) return;

      const newPoint: MonitorPoint = {
        id: generateId(),
        planId: state.currentPlanId,
        name,
        position: { ...position },
      };

      set(state => ({ monitorPoints: [...state.monitorPoints, newPoint] }));
      triggerUpdates();
      get().markAsUnsaved();
    },

    removeMonitorPoint: (id) => {
      set(state => ({
        monitorPoints: state.monitorPoints.filter(m => m.id !== id),
        selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
      }));
      triggerUpdates();
      get().markAsUnsaved();
    },

    updateRoomConfig: (updates) => {
      set(state => ({
        roomConfig: state.roomConfig ? { ...state.roomConfig, ...updates } : null,
      }));
      triggerUpdates();
      get().markAsUnsaved();
    },

    selectObject: (id, type) => {
      set({
        selectedObjectId: id,
        selectedObjectType: type,
      });

      if (type === 'musician') {
        set({ uiState: { ...get().uiState, activeTab: 'musicians' } });
      } else if (type === 'microphone') {
        set({ uiState: { ...get().uiState, activeTab: 'microphones' } });
      } else if (type === 'monitor') {
        set({ uiState: { ...get().uiState, activeTab: 'monitors' } });
      }
    },

    setShowHeatmap: (show) => {
      const state = get();
      const heatmapData = show && state.roomConfig
        ? regenerateHeatmap(state.musicians, state.roomConfig)
        : [];
      set({ showHeatmap: show, heatmapData });
    },

    setSidebarOpen: (open) => {
      set(state => ({ uiState: { ...state.uiState, sidebarOpen: open } }));
    },

    setActiveTab: (tab) => {
      set(state => ({ uiState: { ...state.uiState, activeTab: tab } }));
    },

    setShowReportModal: (show) => {
      set(state => ({ uiState: { ...state.uiState, showReportModal: show } }));
    },

    setShowLoadModal: (show) => {
      set(state => ({ uiState: { ...state.uiState, showLoadModal: show } }));
    },

    markAsUnsaved: () => {
      set(state => ({
        plan: state.plan ? { ...state.plan, isSaved: false } : null,
      }));
    },

    generateReport: (): RehearsalReport => {
      const state = get();
      if (!state.plan || !state.roomConfig) {
        throw new Error('No plan loaded');
      }

      const monitorPositions = state.monitorPoints.map(mp => mp.position);
      const avgSoundPressure = state.monitorPoints.length > 0
        ? state.monitorPoints.reduce(
            (sum, mp) => sum + calculateCombinedSoundPressure(state.musicians, mp.position),
            0
          ) / state.monitorPoints.length
        : 0;

      const volumeBalanceScore = calculateVolumeBalanceScore(state.musicians, monitorPositions);

      const monitorReadings: Record<string, number> = {};
      state.monitorPoints.forEach(mp => {
        monitorReadings[mp.id] = calculateCombinedSoundPressure(state.musicians, mp.position);
      });

      const errorCount = state.sceneIssues.filter(i => i.severity === 'error').length;
      const warningCount = state.sceneIssues.filter(i => i.severity === 'warning').length;
      const issuePenalty = errorCount * 15 + warningCount * 5;
      const overallScore = Math.max(0, Math.min(100, Math.round(
        volumeBalanceScore * 0.6 + avgSoundPressure * 0.2 - issuePenalty + 20
      )));

      const suggestions: string[] = [];
      if (state.sceneIssues.length === 0) {
        suggestions.push('当前站位和声场配置良好，无明显问题。');
      } else {
        state.sceneIssues.forEach(issue => {
          if (issue.suggestion) {
            suggestions.push(issue.suggestion);
          } else if (issue.details.suggestion) {
            suggestions.push(issue.details.suggestion);
          }
        });
      }

      if (state.musicians.length < 3) {
        suggestions.push('建议添加更多乐器以获得更丰富的声场。');
      }

      const report: RehearsalReport = {
        id: generateId(),
        planId: state.plan.id,
        createdAt: new Date(),
        overallScore,
        volumeBalanceScore,
        monitorReadings,
        summary: {
          totalMusicians: state.musicians.length,
          totalMicrophones: state.microphones.length,
          totalMonitorPoints: state.monitorPoints.length,
          averageSoundPressure: Math.round(avgSoundPressure),
          volumeBalanceScore,
        },
        issues: state.sceneIssues,
        suggestions,
        heatmapData: state.heatmapData,
      };

      return report;
    },

    saveReport: (report: RehearsalReport) => {
      set(state => ({ reports: [...state.reports, report] }));
      db.saveReport(report);
      get().markAsUnsaved();
    },

    focusOnIssue: (issue) => {
      if (issue.relatedObjectIds.length > 0) {
        const musician = get().musicians.find(m => issue.relatedObjectIds.includes(m.id));
        const monitor = get().monitorPoints.find(m => issue.relatedObjectIds.includes(m.id));

        if (musician) {
          get().selectObject(musician.id, 'musician');
        } else if (monitor) {
          get().selectObject(monitor.id, 'monitor');
        }
      }
    },

    autoBalanceVolumes: () => {
      const state = get();
      if (state.monitorPoints.length === 0 || state.musicians.length < 2) return;

      const idealRatio = 1 / state.musicians.length;
      const targetLevel = 85;

      const adjustedMusicians = state.musicians.map(musician => {
        const avgRatio = state.monitorPoints.reduce((sum, mp) => {
          const levels = state.musicians.map(m => ({
            level: m.sourceLevel - 20 * Math.log10(Math.max(0.1,
              Math.sqrt(Math.pow(m.position.x - mp.position.x, 2) + Math.pow(m.position.z - mp.position.z, 2))
            )),
          }));
          const totalLinear = levels.reduce((s, l) => s + Math.pow(10, l.level / 20), 0);
          const dist = Math.sqrt(
            Math.pow(musician.position.x - mp.position.x, 2) +
            Math.pow(musician.position.z - mp.position.z, 2)
          );
          const myDb = musician.sourceLevel - 20 * Math.log10(Math.max(0.1, dist));
          const myLinear = Math.pow(10, myDb / 20);
          return sum + (totalLinear > 0 ? myLinear / totalLinear : 0);
        }, 0) / state.monitorPoints.length;

        const ratioFactor = idealRatio / Math.max(0.01, avgRatio);
        const newSourceLevel = Math.min(115, Math.max(75, musician.sourceLevel + 10 * Math.log10(ratioFactor)));

        return { ...musician, sourceLevel: Math.round(newSourceLevel) };
      });

      set({ musicians: adjustedMusicians });
      triggerUpdates();
      get().markAsUnsaved();
    },
  };
});

export const initApp = async () => {
  await useStore.getState().refreshSavedPlans();

  const lastPlanId = localStorage.getItem('lastPlanId');
  if (lastPlanId) {
    const loaded = await useStore.getState().loadPlan(lastPlanId);
    if (loaded) return;
  }

  useStore.getState().initNewPlan();
};
