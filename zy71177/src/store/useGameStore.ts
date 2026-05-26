import { create } from 'zustand';
import { GameState, Level, WaterQuality, GameAction, GameRecord } from '../types';
import {
  calculateOptimalDose,
  applyChemicalTreatment,
  applyStirringEffect,
  calculateRebound,
  applyIncomingWaterVariation,
  checkThresholds
} from '../utils/simulation';
import { calculateScore, generateRecordId, saveGameRecord } from '../utils/scoring';

interface GameStore extends GameState {
  selectedChemicalAmount: number;
  selectedStirringTime: number;
  isProcessing: boolean;
  currentGameId: string | null;
  
  startGame: (level: Level) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  setSelectedChemicalAmount: (amount: number) => void;
  setSelectedStirringTime: (time: number) => void;
  executeTreatment: () => void;
  nextRound: () => void;
  restartGame: () => void;
  endGame: (failReason?: string) => void;
  resetToMenu: () => void;
}

const initialState: Omit<GameStore, keyof ReturnType<typeof createGameActions>> = {
  currentLevel: null,
  phase: 'menu',
  round: 0,
  maxRounds: 0,
  score: 0,
  totalCost: 0,
  tankState: {
    volume: 1000,
    chemicalAmount: 0,
    stirringTime: 0,
    isStirring: false
  },
  waterQuality: {
    cod: 0,
    nh3n: 0,
    tp: 0,
    ph: 7,
    timestamp: 0
  },
  qualityHistory: [],
  actions: [],
  startTime: 0,
  endTime: null,
  failReason: null,
  insufficientStirringCount: 0,
  overdoseCount: 0,
  successCount: 0,
  selectedChemicalAmount: 50,
  selectedStirringTime: 5,
  isProcessing: false,
  currentGameId: null
};

const createGameActions = (set: any, get: any) => ({
  startGame: (level: Level) => {
    const initialQuality: WaterQuality = {
      ...level.initialWaterQuality,
      timestamp: Date.now()
    };

    set({
      currentLevel: level,
      phase: 'playing',
      round: 1,
      maxRounds: level.maxRounds,
      score: 0,
      totalCost: 0,
      tankState: {
        volume: 1000,
        chemicalAmount: 0,
        stirringTime: 0,
        isStirring: false
      },
      waterQuality: initialQuality,
      qualityHistory: [initialQuality],
      actions: [],
      startTime: Date.now(),
      endTime: null,
      failReason: null,
      insufficientStirringCount: 0,
      overdoseCount: 0,
      successCount: 0,
      selectedChemicalAmount: Math.min(50, level.parameters.maxChemicalDose / 2),
      selectedStirringTime: level.parameters.minStirringTime,
      isProcessing: false,
      currentGameId: generateRecordId()
    });
  },

  pauseGame: () => {
    set({ phase: 'paused' });
  },

  resumeGame: () => {
    set({ phase: 'playing' });
  },

  setSelectedChemicalAmount: (amount: number) => {
    const state = get();
    if (state.currentLevel) {
      set({ selectedChemicalAmount: Math.min(Math.max(0, amount), state.currentLevel.parameters.maxChemicalDose) });
    }
  },

  setSelectedStirringTime: (time: number) => {
    set({ selectedStirringTime: Math.max(0, time) });
  },

  executeTreatment: () => {
    const state = get();
    if (!state.currentLevel || state.isProcessing) return;

    set({ isProcessing: true });

    const level = state.currentLevel;
    const chemicalAmount = state.selectedChemicalAmount;
    const stirringTime = state.selectedStirringTime;
    const beforeQuality = state.waterQuality;

    const optimalDose = calculateOptimalDose(
      beforeQuality,
      level.targetThresholds,
      level.parameters
    );

    const afterChemical = applyChemicalTreatment(
      beforeQuality,
      chemicalAmount,
      optimalDose,
      level.parameters
    );

    const afterStirring = applyStirringEffect(
      afterChemical,
      stirringTime,
      level.parameters.minStirringTime
    );

    const chemicalCost = chemicalAmount * level.chemicalCost;
    const stirringCost = stirringTime * level.stirringCostPerSecond;
    const totalCost = chemicalCost + stirringCost;

    const isInsufficientStirring = stirringTime < level.parameters.minStirringTime;
    const isOverdose = chemicalAmount > optimalDose * 1.5;

    const thresholdCheck = checkThresholds(afterStirring, level.targetThresholds);
    const isSuccess = thresholdCheck.passed;

    const action: GameAction = {
      round: state.round,
      type: 'dose',
      chemicalAmount,
      stirringTime,
      beforeQuality,
      afterQuality: afterStirring,
      cost: totalCost,
      timestamp: Date.now()
    };

    setTimeout(() => {
      set((s: any) => ({
        waterQuality: afterStirring,
        qualityHistory: [...s.qualityHistory, afterStirring],
        actions: [...s.actions, action],
        totalCost: s.totalCost + totalCost,
        successCount: isSuccess ? s.successCount + 1 : s.successCount,
        insufficientStirringCount: isInsufficientStirring ? s.insufficientStirringCount + 1 : s.insufficientStirringCount,
        overdoseCount: isOverdose ? s.overdoseCount + 1 : s.overdoseCount,
        isProcessing: false
      }));

      if (isOverdose && level.parameters.reboundFactor > 0) {
        setTimeout(() => {
          const currentState = get();
          const reboundQuality = calculateRebound(
            currentState.waterQuality,
            chemicalAmount,
            optimalDose,
            level.parameters
          );
          set((s: any) => ({
            waterQuality: reboundQuality,
            qualityHistory: [...s.qualityHistory, reboundQuality]
          }));

          const reboundCheck = checkThresholds(reboundQuality, level.targetThresholds);
          if (!reboundCheck.passed && currentState.round >= level.maxRounds - 1) {
            get().endGame('rebound');
          }
        }, 1500);
      }
    }, 1000);
  },

  nextRound: () => {
    const state = get();
    if (!state.currentLevel || state.isProcessing) return;

    const level = state.currentLevel;
    
    if (state.round >= level.maxRounds) {
      const finalCheck = checkThresholds(state.waterQuality, level.targetThresholds);
      if (finalCheck.passed) {
        get().endGame();
      } else {
        get().endGame('threshold_exceeded');
      }
      return;
    }

    const newQuality = applyIncomingWaterVariation(state.waterQuality, level.parameters);

    set((s: any) => ({
      round: s.round + 1,
      waterQuality: newQuality,
      qualityHistory: [...s.qualityHistory, newQuality]
    }));

    const newCheck = checkThresholds(newQuality, level.targetThresholds);
    if (!newCheck.passed && state.round + 1 >= level.maxRounds) {
      setTimeout(() => get().endGame('threshold_exceeded'), 500);
    }
  },

  restartGame: () => {
    const state = get();
    if (state.currentLevel) {
      get().startGame(state.currentLevel);
    }
  },

  endGame: (failReason?: string) => {
    const state = get();
    if (!state.currentLevel) return;

    const level = state.currentLevel;
    const endTime = Date.now();
    const optimalCost = 500;

    const scoreBreakdown = calculateScore(
      state.successCount,
      level.maxRounds,
      state.totalCost,
      optimalCost,
      state.insufficientStirringCount,
      state.overdoseCount
    );

    const record: GameRecord = {
      id: state.currentGameId || generateRecordId(),
      levelId: level.id,
      levelName: level.name,
      score: scoreBreakdown.finalScore,
      totalCost: state.totalCost,
      roundsCompleted: state.round,
      maxRounds: level.maxRounds,
      success: !failReason,
      failReason: failReason || null,
      startTime: state.startTime,
      endTime,
      actions: state.actions,
      qualityHistory: state.qualityHistory,
      insufficientStirringCount: state.insufficientStirringCount,
      overdoseCount: state.overdoseCount,
      successCount: state.successCount
    };

    saveGameRecord(record);

    set({
      phase: 'ended',
      endTime,
      failReason: failReason || null,
      score: scoreBreakdown.finalScore,
      isProcessing: false
    });
  },

  resetToMenu: () => {
    set(initialState);
  }
});

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  ...createGameActions(set, get)
}));
