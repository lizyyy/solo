import { create } from 'zustand';
import type {
  Experiment,
  TrainingLog,
  ParamNote,
  Summary,
  Conflict,
  HistoryRecord,
  SelfCheckResult,
  ExperimentStatus,
} from '@/types';
import {
  mockExperiments,
  mockTrainingLogs,
  mockParamNotes,
  mockSummaries,
  mockConflicts,
  mockHistory,
} from '@/utils/mockData';
import { detectConflicts } from '@/utils/conflictDetector';
import { generateSummary } from '@/utils/summaryGenerator';
import { runSelfCheck } from '@/utils/selfChecker';

interface ExperimentState {
  experiments: Experiment[];
  trainingLogs: Record<string, TrainingLog>;
  paramNotes: Record<string, ParamNote>;
  summaries: Record<string, Summary[]>;
  conflicts: Record<string, Conflict[]>;
  history: Record<string, HistoryRecord[]>;
  selfCheckResults: Record<string, SelfCheckResult>;
  currentExperimentId: string | null;
  initialized: boolean;

  initMockData: () => void;
  setCurrentExperiment: (id: string | null) => void;
  createExperiment: (name: string) => string;

  importTrainingLog: (experimentId: string, log: Omit<TrainingLog, 'id' | 'experimentId' | 'importedAt'>) => void;
  saveParamNote: (experimentId: string, note: Omit<ParamNote, 'id' | 'experimentId' | 'recordedAt'>) => void;
  regenerateSummary: (experimentId: string) => void;

  resolveConflict: (experimentId: string, conflictId: string, status: 'confirmed' | 'rejected', operator: string) => void;
  runSelfCheckForExperiment: (experimentId: string) => void;

  getCurrentExperiment: () => Experiment | null;
  getCurrentTrainingLog: () => TrainingLog | null;
  getCurrentParamNote: () => ParamNote | null;
  getCurrentSummaries: () => Summary[];
  getCurrentConflicts: () => Conflict[];
  getCurrentHistory: () => HistoryRecord[];
  getCurrentSelfCheck: () => SelfCheckResult | null;

  addHistoryRecord: (experimentId: string, action: string, operator: string, details: Record<string, any>) => void;
  updateExperimentStatus: (experimentId: string, status: ExperimentStatus) => void;
}

const STORAGE_KEY = 'multi_objective_experiment_data';

const loadFromStorage = (): Partial<ExperimentState> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load from storage', e);
  }
  return null;
};

const saveToStorage = (state: Partial<ExperimentState>) => {
  try {
    const toSave = {
      experiments: state.experiments,
      trainingLogs: state.trainingLogs,
      paramNotes: state.paramNotes,
      summaries: state.summaries,
      conflicts: state.conflicts,
      history: state.history,
      selfCheckResults: state.selfCheckResults,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save to storage', e);
  }
};

export const useExperimentStore = create<ExperimentState>((set, get) => ({
  experiments: [],
  trainingLogs: {},
  paramNotes: {},
  summaries: {},
  conflicts: {},
  history: {},
  selfCheckResults: {},
  currentExperimentId: null,
  initialized: false,

  initMockData: () => {
    const stored = loadFromStorage();
    if (stored && stored.experiments && stored.experiments.length > 0) {
      set({
        experiments: stored.experiments,
        trainingLogs: stored.trainingLogs || {},
        paramNotes: stored.paramNotes || {},
        summaries: stored.summaries || {},
        conflicts: stored.conflicts || {},
        history: stored.history || {},
        selfCheckResults: stored.selfCheckResults || {},
        initialized: true,
      });
    } else {
      set({
        experiments: mockExperiments,
        trainingLogs: mockTrainingLogs,
        paramNotes: mockParamNotes,
        summaries: mockSummaries,
        conflicts: mockConflicts,
        history: mockHistory,
        selfCheckResults: {},
        initialized: true,
        currentExperimentId: 'exp-001',
      });
      saveToStorage(get());
    }
  },

  setCurrentExperiment: (id) => set({ currentExperimentId: id }),

  createExperiment: (name) => {
    const id = `exp-${Date.now()}`;
    const newExperiment: Experiment = {
      id,
      name,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => {
      const newExperiments = [...state.experiments, newExperiment];
      const newState = { ...state, experiments: newExperiments, currentExperimentId: id };
      saveToStorage(newState);
      return newState;
    });
    get().addHistoryRecord(id, '创建实验', '阿越', { experimentName: name });
    return id;
  },

  importTrainingLog: (experimentId, logData) => {
    const newLog: TrainingLog = {
      id: `log-${Date.now()}`,
      experimentId,
      ...logData,
      importedAt: new Date().toISOString(),
    };

    set((state) => {
      const newTrainingLogs = { ...state.trainingLogs, [experimentId]: newLog };
      const newState = { ...state, trainingLogs: newTrainingLogs };
      saveToStorage(newState);
      return newState;
    });

    get().addHistoryRecord(experimentId, '导入训练日志', '阿越', { logId: newLog.id, featuresCount: logData.features.length });
    get().updateExperimentStatus(experimentId, 'notes_pending');

    if (!get().summaries[experimentId] || get().summaries[experimentId].length === 0) {
      get().regenerateSummary(experimentId);
    }
  },

  saveParamNote: (experimentId, noteData) => {
    const newNote: ParamNote = {
      id: `note-${Date.now()}`,
      experimentId,
      ...noteData,
      recordedAt: new Date().toISOString(),
    };

    set((state) => {
      const newParamNotes = { ...state.paramNotes, [experimentId]: newNote };
      const newState = { ...state, paramNotes: newParamNotes };
      saveToStorage(newState);
      return newState;
    });

    const log = get().trainingLogs[experimentId];
    if (log) {
      const conflicts = detectConflicts(log, newNote);
      set((state) => {
        const newConflicts = { ...state.conflicts, [experimentId]: conflicts };
        const newState = { ...state, conflicts: newConflicts };
        saveToStorage(newState);
        return newState;
      });

      if (conflicts.length > 0) {
        get().updateExperimentStatus(experimentId, 'conflicts_found');
        get().addHistoryRecord(experimentId, '录入调参笔记并检测到冲突', '阿越', { noteId: newNote.id, conflictsCount: conflicts.length });
      } else {
        get().updateExperimentStatus(experimentId, 'ready');
        get().addHistoryRecord(experimentId, '录入调参笔记', '阿越', { noteId: newNote.id });
      }
    }

    get().regenerateSummary(experimentId);
  },

  regenerateSummary: (experimentId) => {
    const log = get().trainingLogs[experimentId];
    const note = get().paramNotes[experimentId] || null;
    const conflicts = get().conflicts[experimentId] || [];
    const existingSummaries = get().summaries[experimentId] || [];

    if (!log) return;

    const newSummary = generateSummary(log, note, conflicts, existingSummaries);

    set((state) => {
      const currentSummaries = state.summaries[experimentId] || [];
      const newSummaries = {
        ...state.summaries,
        [experimentId]: [...currentSummaries, newSummary],
      };
      const newState = { ...state, summaries: newSummaries };
      saveToStorage(newState);
      return newState;
    });

    const action = existingSummaries.length === 0 ? '生成可解释摘要' : '补录后重算摘要';
    get().addHistoryRecord(experimentId, action, '系统', { summaryId: newSummary.id, version: newSummary.version });
  },

  resolveConflict: (experimentId, conflictId, status, operator) => {
    set((state) => {
      const experimentConflicts = state.conflicts[experimentId] || [];
      const updatedConflicts = experimentConflicts.map((c) =>
        c.id === conflictId
          ? { ...c, status, resolvedBy: operator, resolvedAt: new Date().toISOString() }
          : c
      );
      const newConflicts = { ...state.conflicts, [experimentId]: updatedConflicts };
      
      const allResolved = updatedConflicts.every((c) => c.status !== 'pending');
      const newStatus: ExperimentStatus = allResolved ? 'ready' : state.experiments.find(e => e.id === experimentId)?.status || 'conflicts_found';
      
      const updatedExperiments = state.experiments.map((e) =>
        e.id === experimentId ? { ...e, status: newStatus, updatedAt: new Date().toISOString() } : e
      );
      
      const newState = { ...state, conflicts: newConflicts, experiments: updatedExperiments };
      saveToStorage(newState);
      return newState;
    });

    get().addHistoryRecord(experimentId, `冲突${status === 'confirmed' ? '确认' : '驳回'}`, operator, { conflictId });
  },

  runSelfCheckForExperiment: (experimentId) => {
    const log = get().trainingLogs[experimentId];
    const note = get().paramNotes[experimentId] || null;
    const summaries = get().summaries[experimentId] || [];
    const history = get().history[experimentId] || [];
    const allLogs = Object.values(get().trainingLogs);

    if (!log) return;

    const result = runSelfCheck(log, note, summaries, history, allLogs);

    set((state) => {
      const newSelfCheck = { ...state.selfCheckResults, [experimentId]: result };
      const newState = { ...state, selfCheckResults: newSelfCheck };
      saveToStorage(newState);
      return newState;
    });

    get().addHistoryRecord(experimentId, '执行自检', '系统', { allPassed: Object.values(result).every((r) => r.passed) });
    get().updateExperimentStatus(experimentId, 'completed');
  },

  getCurrentExperiment: () => {
    const state = get();
    return state.experiments.find((e) => e.id === state.currentExperimentId) || null;
  },

  getCurrentTrainingLog: () => {
    const state = get();
    return state.currentExperimentId ? state.trainingLogs[state.currentExperimentId] || null : null;
  },

  getCurrentParamNote: () => {
    const state = get();
    return state.currentExperimentId ? state.paramNotes[state.currentExperimentId] || null : null;
  },

  getCurrentSummaries: () => {
    const state = get();
    return state.currentExperimentId ? state.summaries[state.currentExperimentId] || [] : [];
  },

  getCurrentConflicts: () => {
    const state = get();
    return state.currentExperimentId ? state.conflicts[state.currentExperimentId] || [] : [];
  },

  getCurrentHistory: () => {
    const state = get();
    return state.currentExperimentId ? state.history[state.currentExperimentId] || [] : [];
  },

  getCurrentSelfCheck: () => {
    const state = get();
    return state.currentExperimentId ? state.selfCheckResults[state.currentExperimentId] || null : null;
  },

  addHistoryRecord: (experimentId, action, operator, details) => {
    const record: HistoryRecord = {
      id: `hist-${Date.now()}`,
      experimentId,
      action,
      operator,
      timestamp: new Date().toISOString(),
      details,
    };

    set((state) => {
      const currentHistory = state.history[experimentId] || [];
      const newHistory = { ...state.history, [experimentId]: [...currentHistory, record] };
      const newState = { ...state, history: newHistory };
      saveToStorage(newState);
      return newState;
    });
  },

  updateExperimentStatus: (experimentId, status) => {
    set((state) => {
      const updatedExperiments = state.experiments.map((e) =>
        e.id === experimentId ? { ...e, status, updatedAt: new Date().toISOString() } : e
      );
      const newState = { ...state, experiments: updatedExperiments };
      saveToStorage(newState);
      return newState;
    });
  },
}));
