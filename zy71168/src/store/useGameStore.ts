import { create } from 'zustand';
import {
  GameState,
  GridCell,
  Violation,
  Operation,
  GRID_ROWS,
  GRID_COLS,
  ZoneType
} from '../types';
import { getLevelById } from '../data/levels';
import { getChemicalById } from '../data/chemicals';
import { validatePlacement, generateId, checkAllViolations } from '../engine/rulesEngine';
import { PENALTIES } from '../data/rules';

const createInitialGrid = (zones: { row: number; col: number; type: ZoneType }[]): GridCell[][] => {
  const grid: GridCell[][] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const rowCells: GridCell[] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      const zoneConfig = zones.find(z => z.row === row && z.col === col);
      rowCells.push({
        row,
        col,
        chemicalId: null,
        zoneType: zoneConfig?.type || 'normal',
        isHighlighted: false,
        highlightType: null
      });
    }
    grid.push(rowCells);
  }
  return grid;
};

const initialState: GameState = {
  levelId: null,
  status: 'idle',
  score: 0,
  timeRemaining: 0,
  grid: [],
  temperature: 25,
  humidity: 50,
  placedChemicals: [],
  pendingChemicals: [],
  violations: [],
  operationHistory: [],
  isPaused: false,
  failureReason: null,
  replayIndex: 0,
  isReplaying: false,
  draggingChemicalId: null
};

interface GameActions {
  startLevel: (levelId: number) => void;
  placeChemical: (chemicalId: string, row: number, col: number) => boolean;
  removeChemical: (row: number, col: number) => void;
  updateTimer: () => void;
  updateTemperature: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartLevel: () => void;
  endGame: (force?: boolean) => void;
  clearHighlights: () => void;
  highlightCell: (row: number, col: number, type: 'valid' | 'invalid' | 'isolation') => void;
  startReplay: () => void;
  stopReplay: () => void;
  replayStep: (index: number) => void;
  replayNext: () => void;
  replayPrev: () => void;
  reset: () => void;
  setDraggingChemical: (chemicalId: string | null) => void;
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...initialState,

  startLevel: (levelId: number) => {
    const level = getLevelById(levelId);
    if (!level) return;

    const grid = createInitialGrid(level.zones);
    
    set({
      levelId,
      status: 'playing',
      score: level.baseScore,
      timeRemaining: level.timeLimit,
      grid,
      temperature: level.environment.initialTemperature,
      humidity: level.environment.initialHumidity,
      placedChemicals: [],
      pendingChemicals: [...level.chemicalIds],
      violations: [],
      operationHistory: [],
      isPaused: false,
      failureReason: null,
      replayIndex: 0,
      isReplaying: false
    });
  },

  placeChemical: (chemicalId: string, row: number, col: number) => {
    const state = get();
    if (state.status !== 'playing' || state.isPaused) return false;

    const chemical = getChemicalById(chemicalId);
    if (!chemical) return false;

    const targetCell = { row, col };
    const validation = validatePlacement(state.grid, chemical, targetCell);

    const hasSevereViolation = validation.violations.some(v => v.type === 'severe');
    if (hasSevereViolation) {
      const severeViolation = validation.violations.find(v => v.type === 'severe');
      set({
        status: 'failed',
        failureReason: severeViolation?.description || '发生严重安全事故',
        violations: [...state.violations, ...validation.violations]
      });
      return false;
    }

    let scoreDelta = PENALTIES.PLACEMENT_CORRECT;
    for (const violation of validation.violations) {
      scoreDelta -= violation.penalty;
    }

    const newGrid = state.grid.map(r => r.map(c => ({ ...c })));
    newGrid[row][col].chemicalId = chemicalId;
    newGrid[row][col].isHighlighted = false;
    newGrid[row][col].highlightType = null;

    const operation: Operation = {
      id: generateId(),
      type: 'place',
      data: {
        chemicalId,
        to: { row, col }
      },
      timestamp: Date.now(),
      scoreDelta,
      violations: validation.violations
    };

    const newPlacedChemicals = [...state.placedChemicals, chemicalId];
    const newPendingChemicals = state.pendingChemicals.filter(id => id !== chemicalId);

    set({
      grid: newGrid,
      score: Math.max(0, state.score + scoreDelta),
      placedChemicals: newPlacedChemicals,
      pendingChemicals: newPendingChemicals,
      violations: [...state.violations, ...validation.violations],
      operationHistory: [...state.operationHistory, operation]
    });

    if (newPendingChemicals.length === 0) {
      setTimeout(() => get().endGame(), 500);
    }

    return true;
  },

  removeChemical: (row: number, col: number) => {
    const state = get();
    if (state.status !== 'playing' || state.isPaused) return;

    const cell = state.grid[row][col];
    if (!cell.chemicalId) return;

    const chemicalId = cell.chemicalId;
    const newGrid = state.grid.map(r => r.map(c => ({ ...c })));
    newGrid[row][col].chemicalId = null;

    const operation: Operation = {
      id: generateId(),
      type: 'remove',
      data: {
        chemicalId,
        from: { row, col }
      },
      timestamp: Date.now(),
      scoreDelta: -PENALTIES.PLACEMENT_CORRECT / 2,
      violations: []
    };

    set({
      grid: newGrid,
      score: Math.max(0, state.score - PENALTIES.PLACEMENT_CORRECT / 2),
      placedChemicals: state.placedChemicals.filter(id => id !== chemicalId),
      pendingChemicals: [...state.pendingChemicals, chemicalId],
      operationHistory: [...state.operationHistory, operation]
    });
  },

  updateTimer: () => {
    const state = get();
    if (state.status !== 'playing' || state.isPaused) return;

    const newTime = state.timeRemaining - 1;
    
    if (newTime <= 0) {
      set({
        timeRemaining: 0
      });
      get().endGame(true);
      return;
    }

    if (newTime <= 30 && newTime % 5 === 0) {
      const currentViolations = checkAllViolations(
        state.grid,
        state.placedChemicals,
        state.temperature
      );
      const continuousPenalty = currentViolations
        .filter(v => v.isContinuous)
        .reduce((sum, v) => {
          if (v.type === 'temperature') return sum + PENALTIES.TEMPERATURE_PER_SECOND * 5;
          if (v.type === 'adjacency') return sum + PENALTIES.ADJACENCY_PER_SECOND * 5;
          return sum;
        }, 0);

      if (continuousPenalty > 0) {
        set({
          timeRemaining: newTime,
          score: Math.max(0, state.score - continuousPenalty)
        });
        return;
      }
    }

    set({ timeRemaining: newTime });
  },

  updateTemperature: () => {
    const state = get();
    if (state.status !== 'playing' || state.isPaused) return;

    const level = state.levelId ? getLevelById(state.levelId) : null;
    if (!level?.environment.temperatureFluctuation) return;

    const fluctuation = (Math.random() - 0.5) * 2;
    const newTemp = Math.max(5, Math.min(40, state.temperature + fluctuation));

    set({ temperature: Math.round(newTemp * 10) / 10 });
  },

  pauseGame: () => {
    const state = get();
    if (state.status !== 'playing') return;

    const operation: Operation = {
      id: generateId(),
      type: 'pause',
      data: {},
      timestamp: Date.now(),
      scoreDelta: 0,
      violations: []
    };

    set({
      isPaused: true,
      operationHistory: [...state.operationHistory, operation]
    });
  },

  resumeGame: () => {
    const state = get();
    if (!state.isPaused) return;

    const operation: Operation = {
      id: generateId(),
      type: 'resume',
      data: {},
      timestamp: Date.now(),
      scoreDelta: 0,
      violations: []
    };

    set({
      isPaused: false,
      operationHistory: [...state.operationHistory, operation]
    });
  },

  restartLevel: () => {
    const state = get();
    if (state.levelId) {
      get().startLevel(state.levelId);
    }
  },

  endGame: (force = false) => {
    const state = get();
    if (state.status === 'completed' || state.status === 'failed') return;

    const finalViolations = checkAllViolations(
      state.grid,
      state.placedChemicals,
      state.temperature
    );

    const operation: Operation = {
      id: generateId(),
      type: 'end',
      data: {},
      timestamp: Date.now(),
      scoreDelta: 0,
      violations: finalViolations
    };

    if (force && state.pendingChemicals.length > 0) {
      set({
        status: 'failed',
        failureReason: '时间耗尽，未完成所有化学品摆放',
        operationHistory: [...state.operationHistory, operation]
      });
    } else {
      set({
        status: 'completed',
        operationHistory: [...state.operationHistory, operation],
        violations: [...state.violations, ...finalViolations]
      });
    }
  },

  clearHighlights: () => {
    const state = get();
    const newGrid = state.grid.map(row =>
      row.map(cell => ({
        ...cell,
        isHighlighted: false,
        highlightType: null
      }))
    );
    set({ grid: newGrid });
  },

  highlightCell: (row: number, col: number, type: 'valid' | 'invalid' | 'isolation') => {
    const state = get();
    const newGrid = state.grid.map(r => r.map(c => ({ ...c })));
    newGrid[row][col].isHighlighted = true;
    newGrid[row][col].highlightType = type;
    set({ grid: newGrid });
  },

  startReplay: () => {
    const state = get();
    if (!state.levelId) return;

    const level = getLevelById(state.levelId);
    if (!level) return;

    const grid = createInitialGrid(level.zones);
    
    set({
      grid,
      placedChemicals: [],
      pendingChemicals: [...level.chemicalIds],
      score: level.baseScore,
      replayIndex: 0,
      isReplaying: true
    });
  },

  stopReplay: () => {
    set({ isReplaying: false });
  },

  replayStep: (index: number) => {
    const state = get();
    if (!state.isReplaying || index < 0 || index >= state.operationHistory.length) return;

    const level = state.levelId ? getLevelById(state.levelId) : null;
    if (!level) return;

    const grid = createInitialGrid(level.zones);
    const placed: string[] = [];
    const pending = [...level.chemicalIds];
    let score = level.baseScore;

    for (let i = 0; i <= index; i++) {
      const op = state.operationHistory[i];
      if (op.type === 'place' && op.data.chemicalId && op.data.to) {
        grid[op.data.to.row][op.data.to.col].chemicalId = op.data.chemicalId;
        const idx = pending.indexOf(op.data.chemicalId);
        if (idx > -1) pending.splice(idx, 1);
        placed.push(op.data.chemicalId);
      } else if (op.type === 'remove' && op.data.chemicalId && op.data.from) {
        grid[op.data.from.row][op.data.from.col].chemicalId = null;
        const idx = placed.indexOf(op.data.chemicalId);
        if (idx > -1) placed.splice(idx, 1);
        pending.push(op.data.chemicalId);
      }
      score += op.scoreDelta;
    }

    set({
      grid,
      placedChemicals: placed,
      pendingChemicals: pending,
      score: Math.max(0, score),
      replayIndex: index
    });
  },

  replayNext: () => {
    const state = get();
    if (state.replayIndex < state.operationHistory.length - 1) {
      get().replayStep(state.replayIndex + 1);
    }
  },

  replayPrev: () => {
    const state = get();
    if (state.replayIndex > 0) {
      get().replayStep(state.replayIndex - 1);
    }
  },

  reset: () => {
    set(initialState);
  },

  setDraggingChemical: (chemicalId: string | null) => {
    set({ draggingChemicalId: chemicalId });
  }
}));
