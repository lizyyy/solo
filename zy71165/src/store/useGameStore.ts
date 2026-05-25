import { create } from 'zustand';
import type {
  GameState,
  Level,
  Operation,
  GameStatus,
  SettlementResult,
  GameRecord,
} from '../engine/types';
import { updateGameState, cloneGameState } from '../engine/physics';
import { settleGame } from '../engine/validator';
import { getLevelById } from '../data/levels';

interface GameStore {
  currentLevel: Level | null;
  gameState: GameState | null;
  gameStatus: GameStatus;
  operations: Operation[];
  history: GameState[];
  settlementResult: SettlementResult | null;
  gameRecords: GameRecord[];
  unlockedLevels: string[];
  bestScores: Record<string, number>;
  highlightedNodeId: string | null;
  highlightedValveId: string | null;

  loadLevel: (levelId: string) => void;
  toggleValve: (valveId: string) => void;
  undo: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  settle: () => void;
  updateElapsedTime: (time: number) => void;
  setHighlightedNode: (nodeId: string | null) => void;
  setHighlightedValve: (valveId: string | null) => void;
  saveRecord: () => void;
  loadRecords: () => void;
  getRecordById: (recordId: string) => GameRecord | undefined;
  resetStore: () => void;
}

const STORAGE_KEYS = {
  RECORDS: 'pipe_valve_game_records',
  UNLOCKED: 'pipe_valve_game_unlocked',
  BEST_SCORES: 'pipe_valve_game_best_scores',
};

export const useGameStore = create<GameStore>((set, get) => ({
  currentLevel: null,
  gameState: null,
  gameStatus: 'idle',
  operations: [],
  history: [],
  settlementResult: null,
  gameRecords: [],
  unlockedLevels: ['level-1'],
  bestScores: {},
  highlightedNodeId: null,
  highlightedValveId: null,

  loadLevel: (levelId: string) => {
    const level = getLevelById(levelId);
    if (!level) return;

    const initialState = updateGameState(
      level.nodes.map((n) => ({ ...n })),
      level.pipes.map((p) => ({ ...p })),
      level.valves.map((v) => ({ ...v, position: { ...v.position } })),
      level.leaks.map((l) => ({ ...l })),
      level.userAreas.map((u) => ({ ...u })),
      0,
      0
    );

    set({
      currentLevel: level,
      gameState: initialState,
      gameStatus: 'playing',
      operations: [],
      history: [cloneGameState(initialState)],
      settlementResult: null,
      highlightedNodeId: null,
      highlightedValveId: null,
    });
  },

  toggleValve: (valveId: string) => {
    const { gameState, currentLevel, operations, history, gameStatus } = get();
    if (!gameState || !currentLevel || gameStatus !== 'playing') return;

    const valveIndex = gameState.valves.findIndex((v) => v.id === valveId);
    if (valveIndex === -1) return;

    const newValves = gameState.valves.map((v) =>
      v.id === valveId ? { ...v, isOpen: !v.isOpen } : v
    );

    const newState = updateGameState(
      gameState.nodes,
      gameState.pipes,
      newValves,
      gameState.leaks,
      gameState.userAreas,
      gameState.stepCount + 1,
      gameState.elapsedTime
    );

    const operation: Operation = {
      timestamp: Date.now(),
      type: 'valve_toggle',
      valveId,
      fromState: gameState.valves[valveIndex].isOpen,
      toState: newValves[valveIndex].isOpen,
      gameStateSnapshot: cloneGameState(newState),
    };

    set({
      gameState: newState,
      operations: [...operations, operation],
      history: [...history, cloneGameState(newState)],
    });
  },

  undo: () => {
    const { history, operations, gameStatus } = get();
    if (history.length <= 1 || gameStatus !== 'playing') return;

    const newHistory = history.slice(0, -1);
    const newOperations = operations.slice(0, -1);
    const previousState = newHistory[newHistory.length - 1];

    set({
      gameState: cloneGameState(previousState),
      operations: newOperations,
      history: newHistory,
    });
  },

  pause: () => {
    const { gameStatus } = get();
    if (gameStatus === 'playing') {
      set({ gameStatus: 'paused' });
    }
  },

  resume: () => {
    const { gameStatus } = get();
    if (gameStatus === 'paused') {
      set({ gameStatus: 'playing' });
    }
  },

  restart: () => {
    const { currentLevel } = get();
    if (!currentLevel) return;
    get().loadLevel(currentLevel.id);
  },

  settle: () => {
    const { gameState, currentLevel, operations, gameStatus } = get();
    if (!gameState || !currentLevel || gameStatus !== 'playing') return;

    const result = settleGame(gameState, currentLevel, operations);

    set({
      gameStatus: 'settled',
      settlementResult: result,
    });

    if (result.success) {
      const { unlockedLevels, bestScores } = get();
      const currentLevelIndex = currentLevel.id;
      const levelNum = parseInt(currentLevelIndex.split('-')[1]);
      const nextLevelId = `level-${levelNum + 1}`;
      const nextLevel = getLevelById(nextLevelId);

      const newUnlocked = new Set(unlockedLevels);
      if (nextLevel) {
        newUnlocked.add(nextLevelId);
      }

      const newBestScores = { ...bestScores };
      if (!newBestScores[currentLevel.id] || result.score > newBestScores[currentLevel.id]) {
        newBestScores[currentLevel.id] = result.score;
      }

      set({
        unlockedLevels: Array.from(newUnlocked),
        bestScores: newBestScores,
      });

      localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify(Array.from(newUnlocked)));
      localStorage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(newBestScores));
    }

    get().saveRecord();
  },

  updateElapsedTime: (time: number) => {
    const { gameState, gameStatus } = get();
    if (!gameState || gameStatus !== 'playing') return;

    set({
      gameState: {
        ...gameState,
        elapsedTime: time,
      },
    });
  },

  setHighlightedNode: (nodeId: string | null) => {
    set({ highlightedNodeId: nodeId });
  },

  setHighlightedValve: (valveId: string | null) => {
    set({ highlightedValveId: valveId });
  },

  saveRecord: () => {
    const { currentLevel, gameState, operations, settlementResult, gameRecords } = get();
    if (!currentLevel || !gameState || !settlementResult) return;

    const record: GameRecord = {
      id: `record-${Date.now()}`,
      levelId: currentLevel.id,
      levelName: currentLevel.name,
      timestamp: Date.now(),
      success: settlementResult.success,
      score: settlementResult.score,
      operations: [...operations],
      settlementResult,
    };

    const newRecords = [record, ...gameRecords].slice(0, 50);
    set({ gameRecords: newRecords });
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(newRecords));
  },

  loadRecords: () => {
    try {
      const recordsStr = localStorage.getItem(STORAGE_KEYS.RECORDS);
      const unlockedStr = localStorage.getItem(STORAGE_KEYS.UNLOCKED);
      const scoresStr = localStorage.getItem(STORAGE_KEYS.BEST_SCORES);

      if (recordsStr) {
        set({ gameRecords: JSON.parse(recordsStr) });
      }
      if (unlockedStr) {
        set({ unlockedLevels: JSON.parse(unlockedStr) });
      }
      if (scoresStr) {
        set({ bestScores: JSON.parse(scoresStr) });
      }
    } catch (e) {
      console.error('Failed to load records:', e);
    }
  },

  getRecordById: (recordId: string) => {
    return get().gameRecords.find((r) => r.id === recordId);
  },

  resetStore: () => {
    set({
      currentLevel: null,
      gameState: null,
      gameStatus: 'idle',
      operations: [],
      history: [],
      settlementResult: null,
      highlightedNodeId: null,
      highlightedValveId: null,
    });
  },
}));
