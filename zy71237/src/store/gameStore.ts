import { create } from 'zustand';
import {
  GameState,
  GameAction,
  RestorationAction,
  Artwork,
  DataGap,
  StateSnapshot,
  HistoryEntry,
} from '../types';
import {
  calculateActionResult,
  calculateFinalScore,
  createHistoryEntry,
  shouldEndGame,
  getEndReason,
} from '../engine/gameEngine';

const initialState: GameState = {
  currentPhase: 'intro',
  selectedArtwork: null,
  currentStain: 0,
  currentPaintLayer: 0,
  currentStructure: 0,
  remainingTime: 0,
  history: [],
  dataGaps: [],
  selectedAction: null,
  finalScore: null,
  usedMaterials: [],
  riskEvents: [],
  showRiskPreview: false,
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const { artwork, dataGaps } = action.payload;
      return {
        ...initialState,
        currentPhase: 'playing',
        selectedArtwork: artwork,
        currentStain: artwork.initialStain,
        currentPaintLayer: artwork.initialPaintLayer,
        currentStructure: artwork.initialStructure,
        remainingTime: artwork.timeBudget,
        dataGaps: dataGaps.map(g => ({ ...g, resolved: false })),
      };
    }

    case 'SELECT_ACTION': {
      return {
        ...state,
        selectedAction: action.payload,
        showRiskPreview: action.payload !== null,
      };
    }

    case 'TOGGLE_RISK_PREVIEW': {
      return {
        ...state,
        showRiskPreview: action.payload,
      };
    }

    case 'EXECUTE_ACTION': {
      const { action: executedAction, result } = action.payload;
      const stateBefore: StateSnapshot = {
        stain: state.currentStain,
        paintLayer: state.currentPaintLayer,
        structure: state.currentStructure,
        remainingTime: state.remainingTime,
      };

      const newStain = result.newState.currentStain ?? state.currentStain;
      const newPaint = result.newState.currentPaintLayer ?? state.currentPaintLayer;
      const newStructure = result.newState.currentStructure ?? state.currentStructure;
      const newTime = result.newState.remainingTime ?? state.remainingTime;

      const stateAfter: StateSnapshot = {
        stain: newStain,
        paintLayer: newPaint,
        structure: newStructure,
        remainingTime: newTime,
      };

      const historyEntry: HistoryEntry = createHistoryEntry(
        executedAction,
        stateBefore,
        stateAfter,
        result.feedback,
        result.consequences
      );

      const newUsedMaterials = [...state.usedMaterials, ...executedAction.materialRequirements];
      const newRiskEvents = result.riskOccurred
        ? [...state.riskEvents, ...result.consequences]
        : state.riskEvents;

      const newState: GameState = {
        ...state,
        currentStain: newStain,
        currentPaintLayer: newPaint,
        currentStructure: newStructure,
        remainingTime: newTime,
        history: [...state.history, historyEntry],
        selectedAction: null,
        showRiskPreview: false,
        usedMaterials: newUsedMaterials,
        riskEvents: newRiskEvents,
      };

      if (shouldEndGame(newState)) {
        const finalScore = calculateFinalScore(newState);
        return {
          ...newState,
          currentPhase: 'result',
          finalScore,
        };
      }

      return newState;
    }

    case 'DETECT_GAP': {
      const { gapId, cost } = action.payload;
      const newTime = state.remainingTime - cost;
      const updatedGaps = state.dataGaps.map(g =>
        g.id === gapId ? { ...g, resolved: true } : g
      );

      const detectEntry: HistoryEntry = {
        id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        actionType: 'cleaning',
        actionName: '数据检测',
        riskLevel: 'low',
        stateBefore: {
          stain: state.currentStain,
          paintLayer: state.currentPaintLayer,
          structure: state.currentStructure,
          remainingTime: state.remainingTime,
        },
        stateAfter: {
          stain: state.currentStain,
          paintLayer: state.currentPaintLayer,
          structure: state.currentStructure,
          remainingTime: newTime,
        },
        feedback: `已完成数据检测，获取了缺失的信息。`,
        consequences: [],
        materialsUsed: ['检测设备'],
      };

      const newState: GameState = {
        ...state,
        remainingTime: newTime,
        dataGaps: updatedGaps,
        history: [...state.history, detectEntry],
        usedMaterials: [...state.usedMaterials, '检测设备'],
      };

      if (shouldEndGame(newState)) {
        const finalScore = calculateFinalScore(newState);
        return {
          ...newState,
          currentPhase: 'result',
          finalScore,
        };
      }

      return newState;
    }

    case 'FINISH_GAME': {
      return {
        ...state,
        currentPhase: 'result',
        finalScore: action.payload,
      };
    }

    case 'RESET_GAME': {
      return initialState;
    }

    default:
      return state;
  }
}

interface GameStore extends GameState {
  dispatch: (action: GameAction) => void;
  startGame: (artwork: Artwork, dataGaps: DataGap[]) => void;
  selectAction: (action: RestorationAction | null) => void;
  executeAction: (action: RestorationAction) => void;
  detectGap: (gapId: string, cost: number) => void;
  finishGame: () => void;
  resetGame: () => void;
  getEndReason: () => string;
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  dispatch: (action: GameAction) => {
    set(state => gameReducer(state, action));
  },

  startGame: (artwork: Artwork, dataGaps: DataGap[]) => {
    set(state => gameReducer(state, { type: 'START_GAME', payload: { artwork, dataGaps } }));
  },

  selectAction: (action: RestorationAction | null) => {
    set(state => gameReducer(state, { type: 'SELECT_ACTION', payload: action }));
  },

  executeAction: (action: RestorationAction) => {
    const state = get();
    const result = calculateActionResult(action, state, state.dataGaps);
    set(s => gameReducer(s, { type: 'EXECUTE_ACTION', payload: { action, result } }));
  },

  detectGap: (gapId: string, cost: number) => {
    set(state => gameReducer(state, { type: 'DETECT_GAP', payload: { gapId, cost } }));
  },

  finishGame: () => {
    const state = get();
    const finalScore = calculateFinalScore(state);
    set(s => gameReducer(s, { type: 'FINISH_GAME', payload: finalScore }));
  },

  resetGame: () => {
    set(state => gameReducer(state, { type: 'RESET_GAME' }));
  },

  getEndReason: () => {
    return getEndReason(get());
  },
}));
