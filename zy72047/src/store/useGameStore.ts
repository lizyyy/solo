import { create } from 'zustand';
import type { GameState, GameRound, Operation, LevelConfig } from '@/types/game';
import { GameEngine } from '@/engine/GameEngine';
import { storage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/types/storage';

interface GameStore extends GameState {
  engine: GameEngine | null;
  error: string | null;
  lastOperation: Operation | null;
  initEngine: (level: LevelConfig) => void;
  startRound: (playerName: string, source?: string) => GameRound | null;
  pauseRound: () => void;
  resumeRound: () => void;
  endRound: () => GameRound | null;
  processDrag: (
    elementId: string,
    elementLabel: string,
    position: { x: number; y: number },
    note?: string,
    source?: Operation['source']
  ) => Operation | null;
  processClick: (
    elementId: string,
    elementLabel: string,
    note?: string,
    source?: Operation['source']
  ) => Operation | null;
  applyJudgementCall: (operationId: string, revert: boolean, reason: string) => Operation | null;
  resetGame: () => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentRound: null,
  resources: 0,
  score: 0,
  risk: 0,
  operations: [],
  isPaused: false,
  currentLevel: null,
  engine: null,
  error: null,
  lastOperation: null,

  initEngine: (level: LevelConfig) => {
    const engine = new GameEngine(level);
    const state = engine.getState();
    set({
      engine,
      currentLevel: level,
      resources: state.resources,
      score: state.score,
      risk: state.risk,
      operations: [],
      currentRound: null,
      isPaused: false,
      error: null,
    });
  },

  startRound: (playerName: string, source = '黑胶节拍修复赛') => {
    const { engine } = get();
    if (!engine) {
      set({ error: '请先选择关卡并初始化游戏引擎' });
      return null;
    }

    try {
      const round = engine.startRound(playerName, source);
      const state = engine.getState();
      
      const rounds = storage.get(STORAGE_KEYS.ROUNDS, [] as GameRound[]);
      rounds.push(round);
      storage.set(STORAGE_KEYS.ROUNDS, rounds);

      set({
        currentRound: round,
        resources: state.resources,
        score: state.score,
        risk: state.risk,
        operations: [],
        isPaused: false,
        error: null,
      });

      return round;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '开始比赛失败' });
      return null;
    }
  },

  pauseRound: () => {
    const { engine, currentRound } = get();
    if (!engine || !currentRound) return;

    engine.pauseRound();
    const updatedRound = engine.getState().currentRound;
    
    if (updatedRound) {
      const rounds = storage.get(STORAGE_KEYS.ROUNDS, [] as GameRound[]);
      const index = rounds.findIndex(r => r.id === updatedRound.id);
      if (index !== -1) {
        rounds[index] = updatedRound;
        storage.set(STORAGE_KEYS.ROUNDS, rounds);
      }
    }

    set({
      isPaused: true,
      currentRound: updatedRound,
    });
  },

  resumeRound: () => {
    const { engine, currentRound } = get();
    if (!engine || !currentRound) return;

    engine.resumeRound();
    const updatedRound = engine.getState().currentRound;
    
    if (updatedRound) {
      const rounds = storage.get(STORAGE_KEYS.ROUNDS, [] as GameRound[]);
      const index = rounds.findIndex(r => r.id === updatedRound.id);
      if (index !== -1) {
        rounds[index] = updatedRound;
        storage.set(STORAGE_KEYS.ROUNDS, rounds);
      }
    }

    set({
      isPaused: false,
      currentRound: updatedRound,
    });
  },

  endRound: () => {
    const { engine, currentRound } = get();
    if (!engine || !currentRound) {
      set({ error: '没有进行中的比赛' });
      return null;
    }

    try {
      const round = engine.endRound();
      const state = engine.getState();

      const rounds = storage.get(STORAGE_KEYS.ROUNDS, [] as GameRound[]);
      const index = rounds.findIndex(r => r.id === round.id);
      if (index !== -1) {
        rounds[index] = round;
        storage.set(STORAGE_KEYS.ROUNDS, rounds);
      }

      const allOperations = storage.get(STORAGE_KEYS.OPERATIONS, [] as Operation[]);
      const roundOperations = state.operations;
      storage.set(STORAGE_KEYS.OPERATIONS, [...allOperations, ...roundOperations]);

      set({
        currentRound: round,
        resources: state.resources,
        score: state.score,
        risk: state.risk,
        operations: state.operations,
        isPaused: false,
        error: null,
      });

      return round;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '结束比赛失败' });
      return null;
    }
  },

  processDrag: (elementId, elementLabel, position, note = '', source = '黑胶节拍修复赛') => {
    const { engine } = get();
    if (!engine) {
      set({ error: '请先初始化游戏' });
      return null;
    }

    const validation = engine.validateOperation('drag', elementId);
    if (!validation.allowed) {
      set({ error: validation.reason });
      return null;
    }

    const operation = engine.processDrag(elementId, elementLabel, position, note, source);
    if (!operation) {
      set({ error: '操作处理失败' });
      return null;
    }

    const state = engine.getState();
    set({
      resources: state.resources,
      score: state.score,
      risk: state.risk,
      operations: state.operations,
      lastOperation: operation,
      error: validation.warning || null,
    });

    return operation;
  },

  processClick: (elementId, elementLabel, note = '', source = '黑胶节拍修复赛') => {
    const { engine } = get();
    if (!engine) {
      set({ error: '请先初始化游戏' });
      return null;
    }

    const validation = engine.validateOperation('click', elementId);
    if (!validation.allowed) {
      set({ error: validation.reason });
      return null;
    }

    const operation = engine.processClick(elementId, elementLabel, note, source);
    if (!operation) {
      set({ error: '操作处理失败' });
      return null;
    }

    const state = engine.getState();
    set({
      resources: state.resources,
      score: state.score,
      risk: state.risk,
      operations: state.operations,
      lastOperation: operation,
      error: validation.warning || null,
    });

    return operation;
  },

  applyJudgementCall: (operationId, revert, reason) => {
    const { engine } = get();
    if (!engine) return null;

    const operation = engine.applyJudgementCall(operationId, revert, reason);
    if (!operation) return null;

    const state = engine.getState();
    
    const allOperations = storage.get(STORAGE_KEYS.OPERATIONS, [] as Operation[]);
    const index = allOperations.findIndex(o => o.id === operationId);
    if (index !== -1) {
      allOperations[index] = operation;
      storage.set(STORAGE_KEYS.OPERATIONS, allOperations);
    }

    if (state.currentRound) {
      const rounds = storage.get(STORAGE_KEYS.ROUNDS, [] as GameRound[]);
      const roundIndex = rounds.findIndex(r => r.id === state.currentRound!.id);
      if (roundIndex !== -1) {
        rounds[roundIndex] = state.currentRound;
        storage.set(STORAGE_KEYS.ROUNDS, rounds);
      }
    }

    set({
      resources: state.resources,
      score: state.score,
      risk: state.risk,
      operations: state.operations,
    });

    return operation;
  },

  resetGame: () => {
    set({
      currentRound: null,
      resources: 0,
      score: 0,
      risk: 0,
      operations: [],
      isPaused: false,
      currentLevel: null,
      engine: null,
      error: null,
      lastOperation: null,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
