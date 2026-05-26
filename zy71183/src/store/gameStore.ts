import { create } from 'zustand';
import type { GameState, ScoreDetail, OperationRecord, ActiveAnomaly } from '../types';

interface GameStore extends GameState {
  initializeGame: (levelId: string, timeLimit: number) => void;
  startGame: () => void;
  completeStep: (pointId: string, isCorrectOrder: boolean, isDuplicate: boolean) => void;
  addWrongStep: (pointId: string) => void;
  addSkippedStep: (pointId: string) => void;
  addScoreDetail: (detail: ScoreDetail) => void;
  setCurrentStep: (step: number) => void;
  triggerAnomaly: (anomaly: ActiveAnomaly) => void;
  handleAnomaly: (configId: string) => void;
  upgradeAnomaly: (configId: string) => void;
  addOperation: (operation: OperationRecord) => void;
  setTimeRemaining: (time: number) => void;
  setPaused: (paused: boolean) => void;
  completeGame: () => void;
  setReportGenerated: (generated: boolean) => void;
  resetGame: () => void;
}

const initialState: GameState = {
  levelId: '',
  currentStep: 0,
  completedSteps: [],
  skippedSteps: [],
  duplicateSteps: [],
  wrongSteps: [],
  activeAnomalies: [],
  score: 0,
  scoreDetails: [],
  timeRemaining: 0,
  isPaused: false,
  isCompleted: false,
  isStarted: false,
  operationHistory: [],
  reportGenerated: false,
  startTime: 0,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  initializeGame: (levelId, timeLimit) => set({
    ...initialState,
    levelId,
    timeRemaining: timeLimit,
  }),

  startGame: () => set({
    isStarted: true,
    startTime: Date.now(),
  }),

  completeStep: (pointId, isCorrectOrder, isDuplicate) => {
    const state = get();
    
    if (isDuplicate) {
      set({
        duplicateSteps: [...state.duplicateSteps, pointId],
      });
      return;
    }

    if (!isCorrectOrder) {
      set({
        wrongSteps: [...state.wrongSteps, pointId],
      });
      return;
    }

    set({
      completedSteps: [...state.completedSteps, pointId],
      currentStep: state.currentStep + 1,
    });
  },

  addWrongStep: (pointId) => {
    const state = get();
    if (!state.wrongSteps.includes(pointId)) {
      set({
        wrongSteps: [...state.wrongSteps, pointId],
      });
    }
  },

  addSkippedStep: (pointId) => {
    const state = get();
    if (!state.skippedSteps.includes(pointId)) {
      set({
        skippedSteps: [...state.skippedSteps, pointId],
      });
    }
  },

  addScoreDetail: (detail) => {
    const state = get();
    set({
      score: state.score + detail.points,
      scoreDetails: [...state.scoreDetails, detail],
    });
  },

  setCurrentStep: (step) => set({ currentStep: step }),

  triggerAnomaly: (anomaly) => {
    const state = get();
    if (!state.activeAnomalies.find(a => a.configId === anomaly.configId)) {
      set({
        activeAnomalies: [...state.activeAnomalies, anomaly],
      });
    }
  },

  handleAnomaly: (configId) => {
    const state = get();
    set({
      activeAnomalies: state.activeAnomalies.map(a => 
        a.configId === configId ? { ...a, isHandled: true } : a
      ),
    });
  },

  upgradeAnomaly: (configId) => {
    const state = get();
    set({
      activeAnomalies: state.activeAnomalies.map(a => 
        a.configId === configId ? { ...a, isUpgraded: true } : a
      ),
    });
  },

  addOperation: (operation) => {
    const state = get();
    set({
      operationHistory: [...state.operationHistory, operation],
    });
  },

  setTimeRemaining: (time) => set({ timeRemaining: time }),

  setPaused: (paused) => set({ isPaused: paused }),

  completeGame: () => set({ 
    isCompleted: true,
    isPaused: true,
  }),

  setReportGenerated: (generated) => set({ reportGenerated: generated }),

  resetGame: () => set(initialState),
}));
