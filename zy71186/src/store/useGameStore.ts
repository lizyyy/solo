import { create } from 'zustand';
import type { GameState, GameStatus, Level, GameRecord } from '../engine/types';
import { createInitialState, simulateStep } from '../engine/physics';
import { calculateScore, checkFailure } from '../engine/scoring';
import { getLevelById } from '../engine/levels';
import { GAME_CONFIG } from '../engine/constants';

interface GameStore {
  gameStatus: GameStatus;
  currentLevel: Level | null;
  currentState: GameState | null;
  history: GameState[];
  gameRecord: GameRecord | null;
  replayIndex: number;
  gameSpeed: number;
  gateChanges: { time: number; opening: number }[];
  lastGateOpening: number;
  
  selectLevel: (level: Level) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  setGateOpening: (opening: number) => void;
  setGameSpeed: (speed: number) => void;
  gameTick: () => void;
  endGame: (reason?: string) => void;
  startReplay: (record: GameRecord) => void;
  setReplayIndex: (index: number) => void;
  stopReplay: () => void;
  exportReport: () => string;
  resetAll: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameStatus: 'idle',
  currentLevel: null,
  currentState: null,
  history: [],
  gameRecord: null,
  replayIndex: 0,
  gameSpeed: 1,
  gateChanges: [],
  lastGateOpening: 0,

  selectLevel: (level: Level) => {
    set({
      currentLevel: level,
    });
  },

  startGame: () => {
    const { currentLevel } = get();
    if (!currentLevel) return;

    const initialState = createInitialState(currentLevel);
    set({
      gameStatus: 'playing',
      currentState: initialState,
      history: [initialState],
      gateChanges: [],
      lastGateOpening: 0,
      gameRecord: null,
    });
  },

  pauseGame: () => {
    const { gameStatus } = get();
    if (gameStatus === 'playing') {
      set({ gameStatus: 'paused' });
    }
  },

  resumeGame: () => {
    const { gameStatus } = get();
    if (gameStatus === 'paused') {
      set({ gameStatus: 'playing' });
    }
  },

  restartGame: () => {
    const { currentLevel } = get();
    if (!currentLevel) return;

    const initialState = createInitialState(currentLevel);
    set({
      gameStatus: 'playing',
      currentState: initialState,
      history: [initialState],
      gateChanges: [],
      lastGateOpening: 0,
      gameRecord: null,
      replayIndex: 0,
    });
  },

  setGateOpening: (opening: number) => {
    const { gameStatus, currentState, lastGateOpening, gateChanges } = get();
    if (gameStatus !== 'playing' || !currentState) return;

    const clampedOpening = Math.max(0, Math.min(100, opening));
    
    if (Math.abs(clampedOpening - lastGateOpening) > 0.1) {
      set({
        currentState: { ...currentState, gateOpening: clampedOpening },
        gateChanges: [...gateChanges, { time: currentState.time, opening: clampedOpening }],
        lastGateOpening: clampedOpening,
      });
    }
  },

  setGameSpeed: (speed: number) => {
    set({ gameSpeed: speed });
  },

  gameTick: () => {
    const { gameStatus, currentState, currentLevel, history } = get();
    if (gameStatus !== 'playing' || !currentState || !currentLevel) return;

    const deltaHours = GAME_CONFIG.hoursPerTick;
    const newState = simulateStep(currentState, currentLevel, deltaHours);

    const failure = checkFailure(newState, currentLevel);
    if (failure.failed) {
      get().endGame(failure.reason);
      return;
    }

    if (newState.time >= currentLevel.duration) {
      get().endGame();
      return;
    }

    set({
      currentState: newState,
      history: [...history, newState],
    });
  },

  endGame: (reason?: string) => {
    const { currentLevel, history, gateChanges } = get();
    if (!currentLevel) return;

    const finalScore = calculateScore(history, currentLevel, gateChanges);
    const isWin = !reason;

    const record: GameRecord = {
      levelId: currentLevel.id,
      levelName: currentLevel.name,
      startTime: new Date(Date.now() - history.length * GAME_CONFIG.tickRate).toISOString(),
      endTime: new Date().toISOString(),
      states: history,
      gateChanges,
      finalScore,
      isWin,
      failureReason: reason,
    };

    set({
      gameStatus: 'ended',
      gameRecord: record,
    });
  },

  startReplay: (record: GameRecord) => {
    const level = getLevelById(record.levelId);
    set({
      gameStatus: 'replaying',
      gameRecord: record,
      currentLevel: level || null,
      currentState: record.states[0],
      replayIndex: 0,
      history: record.states,
    });
  },

  setReplayIndex: (index: number) => {
    const { history, gameStatus } = get();
    if (gameStatus !== 'replaying') return;
    
    const clampedIndex = Math.max(0, Math.min(history.length - 1, index));
    set({
      replayIndex: clampedIndex,
      currentState: history[clampedIndex],
    });
  },

  stopReplay: () => {
    set({
      gameStatus: 'idle',
      replayIndex: 0,
    });
  },

  exportReport: () => {
    const { gameRecord } = get();
    if (!gameRecord) return '';

    const report = {
      title: '水库调度报告',
      generatedAt: new Date().toISOString(),
      level: gameRecord.levelName,
      startTime: gameRecord.startTime,
      endTime: gameRecord.endTime,
      isWin: gameRecord.isWin,
      failureReason: gameRecord.failureReason,
      score: gameRecord.finalScore,
      summary: {
        totalHours: gameRecord.states.length,
        gateOperations: gameRecord.gateChanges.length,
        maxDischarge: Math.max(...gameRecord.states.map(s => s.outflow)),
        finalStorage: gameRecord.states[gameRecord.states.length - 1].reservoirStorage,
      },
      gateChanges: gameRecord.gateChanges,
      hourlyData: gameRecord.states.map(s => ({
        time: s.time,
        storage: s.reservoirStorage,
        inflow: s.inflow,
        outflow: s.outflow,
        gateOpening: s.gateOpening,
      })),
    };

    return JSON.stringify(report, null, 2);
  },

  resetAll: () => {
    set({
      gameStatus: 'idle',
      currentLevel: null,
      currentState: null,
      history: [],
      gameRecord: null,
      replayIndex: 0,
      gameSpeed: 1,
      gateChanges: [],
      lastGateOpening: 0,
    });
  },
}));
