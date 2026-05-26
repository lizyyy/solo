import { create } from 'zustand';
import { CONFIG } from '../engine/config';
import { DrainageSimulator } from '../engine/simulator';
import { initializeGameData } from '../engine/levelData';
import type { GameState, HistoryRecord } from '../engine/types';

interface GameStore {
  state: GameState;
  simulator: DrainageSimulator | null;
  history: HistoryRecord[];
  initGame: () => void;
  resetGame: () => void;
  nextTurn: () => void;
  togglePause: () => void;
  setSpeed: (speed: 1 | 2 | 4) => void;
  selectCell: (x: number, y: number) => void;
  clearDrain: (drainId: string) => void;
  adjustPumpPower: (pumpId: string, power: number) => void;
  setLowlandWarningThreshold: (lowlandId: string, threshold: number) => void;
  activateTemporaryDrain: (lowlandId: string) => void;
  setReplayMode: (enabled: boolean) => void;
  setReplayTurn: (turn: number) => void;
}

const createInitialState = (): GameState => {
  const { grid, facilities, rainEvents } = initializeGameData();
  return {
    turn: 0,
    maxTurns: CONFIG.MAX_TURNS,
    isPaused: true,
    isGameOver: false,
    isVictory: false,
    score: 0,
    speed: 1,
    grid,
    facilities,
    rainEvents,
    currentRain: null,
    forecast: rainEvents.filter(r => r.startTurn <= 2),
    selectedCell: null,
    isReplayMode: false,
    replayTurn: 0,
  };
};

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(),
  simulator: null,
  history: [],

  initGame: () => {
    const initialState = createInitialState();
    const simulator = new DrainageSimulator(initialState);
    set({
      state: initialState,
      simulator,
      history: [{
        turn: 0,
        state: JSON.parse(JSON.stringify(initialState)),
        scoreDelta: 0,
        events: ['游戏开始'],
        timestamp: Date.now(),
      }],
    });
  },

  resetGame: () => {
    get().initGame();
  },

  nextTurn: () => {
    const { simulator, state, history } = get();
    if (!simulator || state.isGameOver || state.isPaused || state.isReplayMode) return;

    state.turn++;
    const { events, scoreDelta } = simulator.simulateTurn();
    state.score += scoreDelta;

    const newRecord: HistoryRecord = {
      turn: state.turn,
      state: JSON.parse(JSON.stringify(state)),
      scoreDelta,
      events,
      timestamp: Date.now(),
    };

    set({
      state: { ...state },
      history: [...history, newRecord],
    });
  },

  togglePause: () => {
    set(prev => ({
      state: { ...prev.state, isPaused: !prev.state.isPaused },
    }));
  },

  setSpeed: (speed: 1 | 2 | 4) => {
    set(prev => ({
      state: { ...prev.state, speed },
    }));
  },

  selectCell: (x: number, y: number) => {
    set(prev => ({
      state: { ...prev.state, selectedCell: { x, y } },
    }));
  },

  clearDrain: (drainId: string) => {
    const { simulator } = get();
    if (!simulator) return;
    simulator.clearDrainBlockage(drainId);
    set(prev => ({ state: { ...prev.state } }));
  },

  adjustPumpPower: (pumpId: string, power: number) => {
    const { simulator } = get();
    if (!simulator) return;
    simulator.adjustPumpPower(pumpId, power);
    set(prev => ({ state: { ...prev.state } }));
  },

  setLowlandWarningThreshold: (lowlandId: string, threshold: number) => {
    const { simulator } = get();
    if (!simulator) return;
    simulator.setLowlandWarningThreshold(lowlandId, threshold);
    set(prev => ({ state: { ...prev.state } }));
  },

  activateTemporaryDrain: (lowlandId: string) => {
    const { simulator } = get();
    if (!simulator) return;
    simulator.activateTemporaryDrain(lowlandId);
    set(prev => ({ state: { ...prev.state } }));
  },

  setReplayMode: (enabled: boolean) => {
    set(prev => ({
      state: {
        ...prev.state,
        isReplayMode: enabled,
        replayTurn: enabled ? 0 : prev.state.turn,
      },
    }));
  },

  setReplayTurn: (turn: number) => {
    const { history } = get();
    const record = history.find(h => h.turn === turn);
    if (record) {
      set(prev => ({
        state: {
          ...prev.state,
          replayTurn: turn,
          grid: JSON.parse(JSON.stringify(record.state.grid)),
          facilities: JSON.parse(JSON.stringify(record.state.facilities)),
          currentRain: record.state.currentRain,
          score: record.state.score,
        },
      }));
    }
  },
}));
