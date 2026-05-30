import { create } from 'zustand';
import { GameState, GameActions, OscillatorConfig, OperationLog, Evidence, SimilarityBreakdown } from '../types';
import { getDefaultOscillators } from '../data/levels';

const initialSimilarityBreakdown: SimilarityBreakdown = {
  waveformMatch: 0,
  frequencyMatch: 0,
  harmonicMatch: 0,
  total: 0,
};

const initialState: GameState = {
  currentLevel: null,
  oscillators: getDefaultOscillators(4),
  operationLogs: [],
  evidences: [],
  isPlaying: false,
  isTargetPlaying: false,
  currentScore: 0,
  similarityBreakdown: initialSimilarityBreakdown,
  startTime: null,
  sequenceCounter: 0,
  phaseCancellationDetected: false,
  volumePeakDetected: false,
};

type GameStore = GameState & GameActions;

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setCurrentLevel: (level) => set({ currentLevel: level }),

  setOscillators: (oscillators) => set({ oscillators }),

  updateOscillator: (id, updates) => set((state) => {
    const oscillator = state.oscillators.find(o => o.id === id);
    if (!oscillator) return state;

    const newOscillators = state.oscillators.map(o =>
      o.id === id ? { ...o, ...updates } as OscillatorConfig : o
    );

    Object.entries(updates).forEach(([param, value]) => {
      if (param !== 'enabled') {
        const sequence = state.sequenceCounter + 1;
        const log: Omit<OperationLog, 'id' | 'sequence'> = {
          type: 'parameter_change',
          oscillatorId: id,
          parameter: param,
          oldValue: oscillator[param as keyof OscillatorConfig] as number | boolean,
          newValue: value as number | boolean,
          timestamp: Date.now(),
        };
        get().addOperationLog(log);
      }
    });

    return {
      oscillators: newOscillators,
      sequenceCounter: state.sequenceCounter + Object.keys(updates).length,
    };
  }),

  toggleOscillator: (id) => set((state) => {
    const oscillator = state.oscillators.find(o => o.id === id);
    if (!oscillator) return state;

    const newEnabled = !oscillator.enabled;
    const log: Omit<OperationLog, 'id' | 'sequence'> = {
      type: 'oscillator_toggle',
      oscillatorId: id,
      oldValue: oscillator.enabled,
      newValue: newEnabled,
      timestamp: Date.now(),
    };
    get().addOperationLog(log);

    return {
      oscillators: state.oscillators.map(o =>
        o.id === id ? { ...o, enabled: newEnabled } : o
      ),
      sequenceCounter: state.sequenceCounter + 1,
    };
  }),

  addOperationLog: (log) => set((state) => ({
    operationLogs: [
      ...state.operationLogs,
      {
        ...log,
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sequence: state.sequenceCounter + 1,
      } as OperationLog,
    ],
    sequenceCounter: state.sequenceCounter + 1,
  })),

  addEvidence: (evidence) => set((state) => ({
    evidences: [
      ...state.evidences,
      {
        ...evidence,
        id: `evidence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      } as Evidence,
    ],
  })),

  setPlaying: (playing) => set({ isPlaying: playing }),

  setTargetPlaying: (playing) => set({ isTargetPlaying: playing }),

  setCurrentScore: (score) => set({ currentScore: score }),

  setSimilarityBreakdown: (breakdown) => set({ similarityBreakdown: breakdown }),

  startGame: () => set({
    startTime: Date.now(),
    operationLogs: [],
    evidences: [],
    sequenceCounter: 0,
    phaseCancellationDetected: false,
    volumePeakDetected: false,
  }),

  resetGame: () => set({
    ...initialState,
    oscillators: getDefaultOscillators(4),
  }),

  setPhaseCancellationDetected: (detected) => set({ phaseCancellationDetected: detected }),

  setVolumePeakDetected: (detected) => set({ volumePeakDetected: detected }),
}));
