import { create } from 'zustand';
import {
  GameState,
  VinylRecord,
  RepairStep,
  ErrorType,
  FilterOptions,
  Inventory,
  ErrorTracking,
  DataSource,
  CleanerType,
  ScratchSeverity,
  RepairReport,
  NoiseType,
  STEPS,
} from '../types';
import { getRandomRecord } from '../data/records';
import { RulesEngine, ValidationResult } from '../engine/rulesEngine';

interface GameActions {
  startGame: (playerName?: string) => void;
  endGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;

  analyzeNoise: (noiseId: string, type: NoiseType, note?: string) => void;
  judgeScratch: (scratchId: string, isScratch: boolean, severity: ScratchSeverity) => void;
  selectCleaner: (type: CleanerType) => void;
  setCleaningAmount: (amount: number) => void;
  applyCleaning: () => void;
  recordListening: (noiseTypes: NoiseType[], qualityScore: number) => void;
  skipListeningRecord: () => void;
  setManualNotes: (notes: string) => void;

  addRepairStep: (step: Omit<RepairStep, 'id' | 'timestamp'>) => void;
  recordError: (type: ErrorType, description: string, params: Record<string, any>) => void;
  updateQualityScore: (delta: number) => void;
  updateCustomerPatience: (delta: number) => void;
  useInventory: (item: keyof Inventory, amount: number) => void;

  setFilterOptions: (options: Partial<FilterOptions>) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPlaybackIndex: (index: number) => void;

  getFilteredSteps: () => RepairStep[];
  exportReport: () => RepairReport;
  loadFromLocalStorage: () => void;
}

const initialInventory: Inventory = {
  cleanerA: 20,
  cleanerB: 20,
  cleanerC: 20,
  stylusNormal: 10,
  stylusPrecision: 5,
};

const initialErrorTracking: ErrorTracking = {
  scratchMisjudgment: 0,
  overCleaning: 0,
  missingListeningRecord: 0,
  errors: [],
};

const initialFilterOptions: FilterOptions = {
  timeRange: null,
  errorTypes: [],
  dataSources: [],
  stepTypes: [],
};

const getInitialState = (): GameState => ({
  sessionId: `session-${Date.now()}`,
  playerName: '店员',
  currentRecord: null,
  currentStepIndex: 0,
  qualityScore: 70,
  customerPatience: 100,
  inventory: { ...initialInventory },
  errorTracking: { ...initialErrorTracking, errors: [] },
  repairSteps: [],
  status: 'idle',
  playbackSpeed: 1,
  playbackIndex: -1,
  filterOptions: { ...initialFilterOptions },
  selectedScratchId: null,
  selectedCleanerType: null,
  cleaningAmount: 5,
  listeningRecorded: false,
  manualNotes: '',
});

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...getInitialState(),

  startGame: (playerName = '店员') => {
    const record = getRandomRecord();
    const newState: GameState = {
      ...getInitialState(),
      sessionId: `session-${Date.now()}`,
      playerName,
      currentRecord: record,
      status: 'playing',
      qualityScore: 70,
      customerPatience: 100,
      inventory: { ...initialInventory },
      errorTracking: { ...initialErrorTracking, errors: [] },
    };
    set(newState);
    localStorage.setItem('vinylGameState', JSON.stringify(newState));
  },

  endGame: () => {
    const state = get();
    const finalScore = RulesEngine.calculateFinalScore(
      state.qualityScore,
      state.errorTracking,
      state.repairSteps.length
    );
    set({ status: 'completed', qualityScore: finalScore });
    localStorage.removeItem('vinylGameState');
  },

  pauseGame: () => set({ status: 'paused' }),
  resumeGame: () => set({ status: 'playing' }),

  resetGame: () => {
    set(getInitialState());
    localStorage.removeItem('vinylGameState');
  },

  nextStep: () => {
    const state = get();
    if (state.currentStepIndex < STEPS.length - 1) {
      set({ currentStepIndex: state.currentStepIndex + 1 });
    }
  },

  prevStep: () => {
    const state = get();
    if (state.currentStepIndex > 0) {
      set({ currentStepIndex: state.currentStepIndex - 1 });
    }
  },

  goToStep: (index: number) => {
    if (index >= 0 && index < STEPS.length) {
      set({ currentStepIndex: index });
    }
  },

  analyzeNoise: (noiseId: string, type: NoiseType, note?: string) => {
    const state = get();
    if (!state.currentRecord) return;

    const noise = state.currentRecord.noises.find(n => n.id === noiseId);
    if (!noise) return;

    const result = RulesEngine.validateNoiseAnalysis(noise, { type, note });

    const updatedNoises = state.currentRecord.noises.map(n =>
      n.id === noiseId ? { ...n, analyzed: true, note, type } : n
    );

    const updatedRecord = { ...state.currentRecord, noises: updatedNoises };

    set({
      currentRecord: updatedRecord,
      qualityScore: Math.max(0, Math.min(100, state.qualityScore + result.scoreDelta)),
      customerPatience: Math.max(0, Math.min(100, state.customerPatience + result.patienceDelta)),
    });

    get().addRepairStep({
      type: 'noise_analysis',
      isCorrect: result.isCorrect,
      params: { noiseId, type, note, result },
      snapshot: {
        qualityScore: get().qualityScore,
        customerPatience: get().customerPatience,
        currentRecord: updatedRecord,
      },
      dataSource: note ? 'manual' : 'system',
    });

    if (note) {
      get().setManualNotes(`${state.manualNotes}\n噪声 ${noiseId}: ${note}`);
    }
  },

  judgeScratch: (scratchId: string, isScratch: boolean, severity: ScratchSeverity) => {
    const state = get();
    if (!state.currentRecord) return;

    const scratch = state.currentRecord.scratches.find(s => s.id === scratchId);
    if (!scratch) return;

    const result = RulesEngine.validateScratchJudgment(scratch, { isScratch, severity });

    if (result.errorType) {
      get().recordError(result.errorType, result.errorDescription || '', {
        scratchId,
        isScratch,
        severity,
        actualIsScratch: !scratch.isFalsePositive,
        actualSeverity: scratch.severity,
      });
    }

    const updatedScratches = state.currentRecord.scratches.map(s =>
      s.id === scratchId ? { ...s, detected: isScratch } : s
    );

    const updatedRecord = { ...state.currentRecord, scratches: updatedScratches };

    set({
      currentRecord: updatedRecord,
      selectedScratchId: scratchId,
      qualityScore: Math.max(0, Math.min(100, state.qualityScore + result.scoreDelta)),
      customerPatience: Math.max(0, Math.min(100, state.customerPatience + result.patienceDelta)),
    });

    get().addRepairStep({
      type: 'scratch_detection',
      isCorrect: result.isCorrect,
      params: { scratchId, isScratch, severity, result },
      snapshot: {
        qualityScore: get().qualityScore,
        customerPatience: get().customerPatience,
        selectedScratchId: scratchId,
      },
      dataSource: 'manual',
    });
  },

  selectCleaner: (type: CleanerType) => {
    set({ selectedCleanerType: type });
  },

  setCleaningAmount: (amount: number) => {
    set({ cleaningAmount: Math.max(1, Math.min(20, amount)) });
  },

  applyCleaning: () => {
    const state = get();
    if (!state.currentRecord || !state.selectedCleanerType || !state.selectedScratchId) return;

    const scratch = state.currentRecord.scratches.find(s => s.id === state.selectedScratchId);
    if (!scratch) return;

    const inventoryKey = state.selectedCleanerType.replace('type', 'cleaner') as keyof Inventory;
    const inventoryCount = state.inventory[inventoryKey];

    const result = RulesEngine.validateCleaning(
      state.selectedCleanerType,
      state.cleaningAmount,
      scratch,
      inventoryCount
    );

    if (result.errorType) {
      get().recordError(result.errorType, result.errorDescription || '', {
        cleanerType: state.selectedCleanerType,
        amount: state.cleaningAmount,
        scratchId: state.selectedScratchId,
        scratchSeverity: scratch.severity,
      });
    }

    if (result.inventoryDelta) {
      const item = result.inventoryDelta.item.replace('type', 'cleaner') as keyof Inventory;
      get().useInventory(item, Math.abs(result.inventoryDelta.amount));
    }

    const updatedScratches = state.currentRecord.scratches.map(s =>
      s.id === state.selectedScratchId ? { ...s, repaired: result.isCorrect } : s
    );

    const updatedRecord = { ...state.currentRecord, scratches: updatedScratches };

    set({
      currentRecord: updatedRecord,
      qualityScore: Math.max(0, Math.min(100, state.qualityScore + result.scoreDelta)),
      customerPatience: Math.max(0, Math.min(100, state.customerPatience + result.patienceDelta)),
    });

    get().addRepairStep({
      type: 'cleaning',
      isCorrect: result.isCorrect,
      params: {
        cleanerType: state.selectedCleanerType,
        amount: state.cleaningAmount,
        scratchId: state.selectedScratchId,
        result,
      },
      snapshot: {
        qualityScore: get().qualityScore,
        customerPatience: get().customerPatience,
        inventory: get().inventory,
        selectedCleanerType: state.selectedCleanerType,
        cleaningAmount: state.cleaningAmount,
      },
      dataSource: 'manual',
    });
  },

  recordListening: (noiseTypes: NoiseType[], qualityScore: number) => {
    const state = get();
    if (!state.currentRecord) return;

    const result = RulesEngine.validateListeningRecord(true, state.currentRecord.noises, {
      noiseTypes,
      qualityScore,
    });

    set({
      listeningRecorded: true,
      qualityScore: Math.max(0, Math.min(100, state.qualityScore + result.scoreDelta)),
      customerPatience: Math.max(0, Math.min(100, state.customerPatience + result.patienceDelta)),
    });

    get().addRepairStep({
      type: 'listening',
      isCorrect: result.isCorrect,
      params: { noiseTypes, qualityScore, result },
      snapshot: {
        qualityScore: get().qualityScore,
        customerPatience: get().customerPatience,
        listeningRecorded: true,
      },
      dataSource: 'manual',
    });
  },

  skipListeningRecord: () => {
    const state = get();
    if (!state.currentRecord) return;

    const result = RulesEngine.validateListeningRecord(false, state.currentRecord.noises, {
      noiseTypes: [],
      qualityScore: 0,
    });

    if (result.errorType) {
      get().recordError(result.errorType, result.errorDescription || '', {});
    }

    set({
      listeningRecorded: false,
      qualityScore: Math.max(0, Math.min(100, state.qualityScore + result.scoreDelta)),
      customerPatience: Math.max(0, Math.min(100, state.customerPatience + result.patienceDelta)),
    });

    get().addRepairStep({
      type: 'listening',
      isCorrect: false,
      params: { skipped: true, result },
      snapshot: {
        qualityScore: get().qualityScore,
        customerPatience: get().customerPatience,
        listeningRecorded: false,
      },
      dataSource: 'system',
    });
  },

  setManualNotes: (notes: string) => {
    set({ manualNotes: notes });
  },

  addRepairStep: (step: Omit<RepairStep, 'id' | 'timestamp'>) => {
    const state = get();
    const newStep: RepairStep = {
      ...step,
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    const updatedSteps = [...state.repairSteps, newStep];
    set({ repairSteps: updatedSteps });

    const currentState = get();
    localStorage.setItem('vinylGameState', JSON.stringify(currentState));
  },

  recordError: (type: ErrorType, description: string, params: Record<string, any>) => {
    const state = get();
    const errorEntry = {
      type,
      timestamp: Date.now(),
      stepId: state.repairSteps.length > 0 ? state.repairSteps[state.repairSteps.length - 1].id : '',
      description,
      params,
    };

    const errorKey = type === 'scratch_misjudgment'
      ? 'scratchMisjudgment'
      : type === 'over_cleaning'
        ? 'overCleaning'
        : 'missingListeningRecord';

    set({
      errorTracking: {
        ...state.errorTracking,
        [errorKey]: state.errorTracking[errorKey] + 1,
        errors: [...state.errorTracking.errors, errorEntry],
      },
    });
  },

  updateQualityScore: (delta: number) => {
    const state = get();
    set({ qualityScore: Math.max(0, Math.min(100, state.qualityScore + delta)) });
  },

  updateCustomerPatience: (delta: number) => {
    const state = get();
    set({ customerPatience: Math.max(0, Math.min(100, state.customerPatience + delta)) });
  },

  useInventory: (item: keyof Inventory, amount: number) => {
    const state = get();
    set({
      inventory: {
        ...state.inventory,
        [item]: Math.max(0, state.inventory[item] - amount),
      },
    });
  },

  setFilterOptions: (options: Partial<FilterOptions>) => {
    const state = get();
    set({
      filterOptions: {
        ...state.filterOptions,
        ...options,
      },
    });
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
  },

  setPlaybackIndex: (index: number) => {
    set({ playbackIndex: index });
  },

  getFilteredSteps: (): RepairStep[] => {
    const state = get();
    const { filterOptions, repairSteps } = state;

    return repairSteps.filter(step => {
      if (filterOptions.timeRange) {
        const [start, end] = filterOptions.timeRange;
        if (step.timestamp < start || step.timestamp > end) return false;
      }

      if (filterOptions.errorTypes.length > 0) {
        const hasMatchingError = state.errorTracking.errors.some(
          e => e.stepId === step.id && filterOptions.errorTypes.includes(e.type)
        );
        if (!hasMatchingError && !step.isCorrect) return false;
      }

      if (filterOptions.dataSources.length > 0) {
        if (!filterOptions.dataSources.includes(step.dataSource)) return false;
      }

      if (filterOptions.stepTypes.length > 0) {
        if (!filterOptions.stepTypes.includes(step.type)) return false;
      }

      return true;
    });
  },

  exportReport: (): RepairReport => {
    const state = get();
    if (!state.currentRecord) throw new Error('No current record');

    const filteredSteps = state.getFilteredSteps();
    const dataSourceMarks = filteredSteps.map(step => ({
      stepId: step.id,
      dataSource: step.dataSource,
      content: `${STEPS.find(s => s.type === step.type)?.name}: ${step.isCorrect ? '正确' : '错误'}`,
    }));

    const report: RepairReport = {
      sessionId: state.sessionId,
      exportTime: Date.now(),
      filterOptions: state.filterOptions,
      recordInfo: state.currentRecord,
      qualityScore: state.qualityScore,
      errorSummary: state.errorTracking,
      steps: filteredSteps,
      dataSourceMarks,
    };

    localStorage.setItem(`vinylReport-${state.sessionId}`, JSON.stringify(report));
    return report;
  },

  loadFromLocalStorage: () => {
    const saved = localStorage.getItem('vinylGameState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        set(parsed);
      } catch (e) {
        console.error('Failed to load saved state:', e);
      }
    }
  },
}));
