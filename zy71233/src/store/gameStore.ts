import { create } from 'zustand';
import {
  Circuit,
  CircuitGate,
  GameSession,
  Level,
  MeasurementBasis,
  NoiseCard,
  NoiseType,
  OperationLog,
  ValidationResult,
} from '@/types';
import { getLevelById } from '@/data/levels';
import { validateCircuit } from '@/utils/validation/validator';

interface GameState {
  currentLevel: Level | null;
  currentCircuit: Circuit | null;
  currentSession: GameSession | null;
  validationResult: ValidationResult | null;
  completedLevels: string[];
  sessions: GameSession[];
  isSimulating: boolean;

  setCurrentLevel: (levelId: string) => void;
  initializeCircuit: (level: Level) => void;
  addGate: (gate: CircuitGate) => void;
  removeGate: (gateId: string) => void;
  moveGate: (gateId: string, newPosition: { qubit: number; slot: number }) => void;
  addNoiseCard: (noise: NoiseCard) => void;
  removeNoiseCard: (noiseId: string) => void;
  setMeasurementBasis: (qubit: number, basis: MeasurementBasis) => void;
  simulateCircuit: () => void;
  submitAnswer: () => void;
  startNewSession: (levelId: string) => void;
  endSession: () => void;
  exportReport: () => string;
  resetCircuit: () => void;
  clearValidationResult: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const createLog = (
  type: OperationLog['type'],
  payload: Record<string, unknown>
): OperationLog => ({
  id: generateId(),
  timestamp: new Date(),
  type,
  payload,
});

export const useGameStore = create<GameState>((set, get) => ({
  currentLevel: null,
  currentCircuit: null,
  currentSession: null,
  validationResult: null,
  completedLevels: [],
  sessions: [],
  isSimulating: false,

  setCurrentLevel: (levelId: string) => {
    const level = getLevelById(levelId);
    if (level) {
      set({ currentLevel: level });
      get().initializeCircuit(level);
    }
  },

  initializeCircuit: (level: Level) => {
    const circuit: Circuit = {
      id: generateId(),
      qubits: level.qubits,
      slots: level.slots,
      gates: [],
      noiseCards: level.requiredNoise
        ? [
            {
              id: generateId(),
              type: level.requiredNoise,
              position: { qubit: 0, slot: 1 },
              probability: 0.3,
            },
          ]
        : [],
      measurementBasis: new Array(level.qubits).fill('Z'),
    };

    const session: GameSession = {
      id: generateId(),
      levelId: level.id,
      startTime: new Date(),
      circuit,
      operations: [],
    };

    set({
      currentCircuit: circuit,
      currentSession: session,
      validationResult: null,
    });
  },

  addGate: (gate: CircuitGate) => {
    const { currentCircuit, currentSession } = get();
    if (!currentCircuit || !currentSession) return;

    const existingGateIndex = currentCircuit.gates.findIndex(
      (g) => g.position.qubit === gate.position.qubit && g.position.slot === gate.position.slot
    );

    let newGates = [...currentCircuit.gates];
    if (existingGateIndex >= 0) {
      newGates[existingGateIndex] = gate;
    } else {
      newGates.push(gate);
    }

    const log = createLog('add_gate', { gate });
    const newOperations = [...currentSession.operations, log];

    set({
      currentCircuit: { ...currentCircuit, gates: newGates },
      currentSession: { ...currentSession, operations: newOperations },
    });
  },

  removeGate: (gateId: string) => {
    const { currentCircuit, currentSession } = get();
    if (!currentCircuit || !currentSession) return;

    const gateToRemove = currentCircuit.gates.find((g) => g.id === gateId);
    const newGates = currentCircuit.gates.filter((g) => g.id !== gateId);

    const log = createLog('remove_gate', { gate: gateToRemove });
    const newOperations = [...currentSession.operations, log];

    set({
      currentCircuit: { ...currentCircuit, gates: newGates },
      currentSession: { ...currentSession, operations: newOperations },
    });
  },

  moveGate: (gateId: string, newPosition: { qubit: number; slot: number }) => {
    const { currentCircuit, currentSession } = get();
    if (!currentCircuit || !currentSession) return;

    const newGates = currentCircuit.gates.map((g) =>
      g.id === gateId ? { ...g, position: newPosition } : g
    );

    const log = createLog('move_gate', { gateId, newPosition });
    const newOperations = [...currentSession.operations, log];

    set({
      currentCircuit: { ...currentCircuit, gates: newGates },
      currentSession: { ...currentSession, operations: newOperations },
    });
  },

  addNoiseCard: (noise: NoiseCard) => {
    const { currentCircuit, currentSession } = get();
    if (!currentCircuit || !currentSession) return;

    const newNoiseCards = [...currentCircuit.noiseCards, noise];
    const log = createLog('add_noise', { noise });
    const newOperations = [...currentSession.operations, log];

    set({
      currentCircuit: { ...currentCircuit, noiseCards: newNoiseCards },
      currentSession: { ...currentSession, operations: newOperations },
    });
  },

  removeNoiseCard: (noiseId: string) => {
    const { currentCircuit, currentSession } = get();
    if (!currentCircuit || !currentSession) return;

    const noiseToRemove = currentCircuit.noiseCards.find((n) => n.id === noiseId);
    const newNoiseCards = currentCircuit.noiseCards.filter((n) => n.id !== noiseId);

    const log = createLog('remove_noise', { noise: noiseToRemove });
    const newOperations = [...currentSession.operations, log];

    set({
      currentCircuit: { ...currentCircuit, noiseCards: newNoiseCards },
      currentSession: { ...currentSession, operations: newOperations },
    });
  },

  setMeasurementBasis: (qubit: number, basis: MeasurementBasis) => {
    const { currentCircuit } = get();
    if (!currentCircuit) return;

    const newBasis = [...currentCircuit.measurementBasis];
    newBasis[qubit] = basis;

    set({
      currentCircuit: { ...currentCircuit, measurementBasis: newBasis },
    });
  },

  simulateCircuit: () => {
    set({ isSimulating: true });
    setTimeout(() => {
      const { currentCircuit, currentLevel, currentSession } = get();
      if (!currentCircuit || !currentLevel || !currentSession) {
        set({ isSimulating: false });
        return;
      }

      const log = createLog('measure', { basis: currentCircuit.measurementBasis });
      const newOperations = [...currentSession.operations, log];

      set({
        isSimulating: false,
        currentSession: { ...currentSession, operations: newOperations },
      });
    }, 500);
  },

  submitAnswer: () => {
    const { currentCircuit, currentLevel, currentSession } = get();
    if (!currentCircuit || !currentLevel || !currentSession) return;

    const result = validateCircuit(currentCircuit, currentLevel);

    const completedLevels = [...get().completedLevels];
    if (result.isValid && !completedLevels.includes(currentLevel.id)) {
      completedLevels.push(currentLevel.id);
    }

    const updatedSession = {
      ...currentSession,
      endTime: new Date(),
      circuit: currentCircuit,
      validationResult: result,
    };

    const sessions = [...get().sessions, updatedSession];

    set({
      validationResult: result,
      completedLevels,
      sessions,
      currentSession: updatedSession,
    });
  },

  startNewSession: (levelId: string) => {
    const level = getLevelById(levelId);
    if (level) {
      get().setCurrentLevel(levelId);
    }
  },

  endSession: () => {
    set({
      currentLevel: null,
      currentCircuit: null,
      currentSession: null,
      validationResult: null,
    });
  },

  exportReport: () => {
    const { currentSession, currentLevel } = get();
    if (!currentSession || !currentLevel) return '';

    const report = {
      sessionId: currentSession.id,
      levelId: currentLevel.id,
      levelName: currentLevel.name,
      startTime: currentSession.startTime,
      endTime: currentSession.endTime,
      circuit: currentSession.circuit,
      operations: currentSession.operations,
      validationResult: currentSession.validationResult,
    };

    return JSON.stringify(report, null, 2);
  },

  resetCircuit: () => {
    const { currentLevel } = get();
    if (currentLevel) {
      get().initializeCircuit(currentLevel);
    }
  },

  clearValidationResult: () => {
    set({ validationResult: null });
  },
}));
