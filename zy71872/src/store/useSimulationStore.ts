import { create } from 'zustand';
import type { SimulationState, SimulationConfig, Submission, Draft, AnomalyRecord, Team, Window, StateSnapshot } from '../types';
import { COACHES } from '../types';
import { loadFromStorage, saveToStorage, clearAllStorage } from '../utils/storage';
import { initializeWindows, processTick, addSubmissionToQueue, getQueueStats } from '../engine/simulationEngine';
import { createDraft } from '../services/draftService';
import { createSnapshot, validateSnapshotChain } from '../services/timelineService';

const DEFAULT_CONFIG: SimulationConfig = {
  windowCount: 3,
  processingTimeMs: 5000,
  autoDetectAnomalies: true,
  preserveHistory: true,
};

interface SimulationActions {
  setCurrentUser: (userId: string) => void;
  setConfig: (config: Partial<SimulationConfig>) => void;
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  stepSimulation: () => void;
  setSpeed: (speed: number) => void;
  addSubmission: (submission: Submission) => void;
  saveDraft: (teamId: string, content: string, changeSummary: string) => Draft;
  markAnomalyHandled: (anomalyId: string) => void;
  replaySnapshot: (snapshotId: string | null) => void;
  importData: (teams: Team[], submissions: Submission[], drafts: Draft[]) => void;
  clearAllData: () => void;
  tick: () => void;
  getStats: () => ReturnType<typeof getQueueStats>;
  validateIntegrity: () => boolean;
  getWindowCloseTime: () => number;
  loadState: () => void;
}

const getInitialState = (): SimulationState => ({
  config: loadFromStorage<SimulationConfig>('config', DEFAULT_CONFIG),
  windows: loadFromStorage<Window[]>('windows', initializeWindows(DEFAULT_CONFIG.windowCount)),
  teams: loadFromStorage<Team[]>('teams', []),
  submissions: loadFromStorage<Submission[]>('submissions', []),
  drafts: loadFromStorage<Draft[]>('drafts', []),
  anomalies: loadFromStorage<AnomalyRecord[]>('anomalies', []),
  snapshots: loadFromStorage<StateSnapshot[]>('snapshots', []),
  currentUser: loadFromStorage<string>('current_user', COACHES[0].id),
  simulationTime: 0,
  isRunning: false,
  isPaused: false,
  speed: 1,
  replaySnapshotId: null,
});

export const useSimulationStore = create<SimulationState & SimulationActions>((set, get) => ({
  ...getInitialState(),

  loadState: () => {
    set({
      ...getInitialState(),
    });
  },

  setCurrentUser: (userId: string) => {
    set({ currentUser: userId });
    saveToStorage('current_user', userId);
  },

  setConfig: (config: Partial<SimulationConfig>) => {
    const newConfig = { ...get().config, ...config };
    set({ config: newConfig });
    saveToStorage('config', newConfig);

    if (config.windowCount && config.windowCount !== get().config.windowCount) {
      const newWindows = initializeWindows(config.windowCount);
      set({ windows: newWindows });
      saveToStorage('windows', newWindows);
    }
  },

  startSimulation: () => {
    const state = get();
    if (state.submissions.length === 0) {
      return;
    }
    set({ isRunning: true, isPaused: false });
  },

  pauseSimulation: () => {
    set({ isPaused: true });
  },

  resetSimulation: () => {
    const state = get();
    const config = state.config;
    const windows = initializeWindows(config.windowCount);
    const resetSubmissions = state.submissions.map((s) => ({
      ...s,
      status: 'queued' as const,
      windowId: null,
      startTime: 0,
      endTime: undefined,
      anomalies: [],
    }));

    set({
      windows,
      submissions: resetSubmissions,
      anomalies: [],
      simulationTime: 0,
      isRunning: false,
      isPaused: false,
      replaySnapshotId: null,
    });

    saveToStorage('windows', windows);
    saveToStorage('submissions', resetSubmissions);
    saveToStorage('anomalies', []);
  },

  stepSimulation: () => {
    get().tick();
  },

  setSpeed: (speed: number) => {
    set({ speed });
  },

  addSubmission: (submission: Submission) => {
    const state = get();
    const result = addSubmissionToQueue(
      submission,
      state.windows,
      state.submissions,
      state.teams,
      state.config.preserveHistory
    );

    set({
      windows: result.windows,
      submissions: result.submissions,
    });

    saveToStorage('windows', result.windows);
    saveToStorage('submissions', result.submissions);
    saveToStorage('teams', state.teams);
  },

  saveDraft: (teamId: string, content: string, changeSummary: string): Draft => {
    const state = get();
    const teamDrafts = state.drafts.filter((d) => d.teamId === teamId);
    const latestVersion = teamDrafts.length > 0 ? Math.max(...teamDrafts.map((d) => d.version)) : 0;

    const draft = createDraft(
      teamId,
      content,
      state.currentUser,
      changeSummary,
      latestVersion > 0 ? latestVersion : undefined
    );

    const newDrafts = [...state.drafts, draft];
    set({ drafts: newDrafts });
    saveToStorage('drafts', newDrafts);

    return draft;
  },

  markAnomalyHandled: (anomalyId: string) => {
    const state = get();
    const updatedAnomalies = state.anomalies.map((a) =>
      a.id === anomalyId ? { ...a, handled: true } : a
    );
    set({ anomalies: updatedAnomalies });
    saveToStorage('anomalies', updatedAnomalies);

    const updatedSubmissions = state.submissions.map((s) => ({
      ...s,
      anomalies: s.anomalies.map((a) =>
        a.id === anomalyId ? { ...a, handled: true } : a
      ),
    }));
    set({ submissions: updatedSubmissions });
    saveToStorage('submissions', updatedSubmissions);
  },

  replaySnapshot: (snapshotId: string | null) => {
    if (snapshotId === null) {
      set({ replaySnapshotId: null });
      return;
    }

    const snapshot = get().snapshots.find((s) => s.id === snapshotId);
    if (snapshot) {
      set({
        replaySnapshotId: snapshotId,
        windows: snapshot.windows,
        submissions: snapshot.submissions,
        drafts: snapshot.drafts,
        anomalies: snapshot.anomalies,
        simulationTime: snapshot.simulationTime,
      });
    }
  },

  importData: (teams: Team[], submissions: Submission[], drafts: Draft[]) => {
    const state = get();
    const config = state.config;
    const windows = initializeWindows(config.windowCount);

    let updatedWindows = windows;
    let updatedSubmissions = [...submissions];

    submissions.forEach((sub) => {
      const result = addSubmissionToQueue(
        sub,
        updatedWindows,
        updatedSubmissions.filter((s) => s.id !== sub.id),
        teams,
        config.preserveHistory
      );
      updatedWindows = result.windows;
      const idx = updatedSubmissions.findIndex((s) => s.id === sub.id);
      if (idx >= 0) {
        updatedSubmissions[idx] = result.submissions[result.submissions.length - 1];
      }
    });

    const initialSnapshot = createSnapshot(
      0,
      updatedWindows,
      updatedSubmissions,
      drafts,
      [],
      ''
    );

    set({
      teams,
      windows: updatedWindows,
      submissions: updatedSubmissions,
      drafts,
      anomalies: [],
      snapshots: [initialSnapshot],
      simulationTime: 0,
      isRunning: false,
      isPaused: false,
      replaySnapshotId: null,
    });

    saveToStorage('teams', teams);
    saveToStorage('windows', updatedWindows);
    saveToStorage('submissions', updatedSubmissions);
    saveToStorage('drafts', drafts);
    saveToStorage('anomalies', []);
    saveToStorage('snapshots', [initialSnapshot]);
  },

  clearAllData: () => {
    clearAllStorage();
    set({
      ...getInitialState(),
      windows: initializeWindows(DEFAULT_CONFIG.windowCount),
    });
  },

  tick: () => {
    const state = get();
    if (state.replaySnapshotId) return;

    const newSimulationTime = state.simulationTime + 1000 * state.speed;
    const windowCloseTime = state.getWindowCloseTime();

    const result = processTick(
      state.windows,
      state.submissions,
      state.teams,
      state.config,
      newSimulationTime,
      windowCloseTime
    );

    const newAnomalies = [...state.anomalies, ...result.newAnomalies];

    let newSnapshots = state.snapshots;
    if (result.shouldCreateSnapshot || newSimulationTime % 5000 === 0) {
      const lastHash = state.snapshots.length > 0
        ? state.snapshots[state.snapshots.length - 1].hash
        : '';
      const snapshot = createSnapshot(
        newSimulationTime,
        result.updatedWindows,
        result.updatedSubmissions,
        state.drafts,
        newAnomalies,
        lastHash
      );
      newSnapshots = [...state.snapshots, snapshot];
    }

    const allDone = result.updatedSubmissions.every(
      (s) => s.status === 'success' || s.status === 'failed'
    );

    set({
      simulationTime: newSimulationTime,
      windows: result.updatedWindows,
      submissions: result.updatedSubmissions,
      anomalies: newAnomalies,
      snapshots: newSnapshots,
      isRunning: allDone ? false : state.isRunning,
    });

    saveToStorage('windows', result.updatedWindows);
    saveToStorage('submissions', result.updatedSubmissions);
    saveToStorage('anomalies', newAnomalies);
    saveToStorage('snapshots', newSnapshots);
  },

  getStats: () => {
    const state = get();
    return getQueueStats(state.windows, state.submissions);
  },

  validateIntegrity: () => {
    const state = get();
    return validateSnapshotChain(state.snapshots);
  },

  getWindowCloseTime: () => {
    const state = get();
    const maxExpectedTime = state.submissions.length * state.config.processingTimeMs / state.config.windowCount;
    return maxExpectedTime + 60000;
  },
}));
