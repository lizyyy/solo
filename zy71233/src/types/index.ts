export type GateType = 'H' | 'X' | 'Y' | 'Z' | 'CNOT' | 'T' | 'S' | 'Measure';

export type NoiseType = 'bit-flip' | 'phase-flip' | 'depolarizing';

export type MeasurementBasis = 'X' | 'Y' | 'Z';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuantumGate {
  type: GateType;
  name: string;
  symbol: string;
  matrix: complex[][];
  targetQubits: number;
  description: string;
}

export type complex = number | [number, number];

export interface CircuitGate {
  id: string;
  type: GateType;
  position: { qubit: number; slot: number };
  controlQubit?: number;
}

export interface NoiseCard {
  id: string;
  type: NoiseType;
  position: { qubit: number; slot: number };
  probability: number;
}

export interface Circuit {
  id: string;
  qubits: number;
  slots: number;
  gates: CircuitGate[];
  noiseCards: NoiseCard[];
  measurementBasis: MeasurementBasis[];
}

export interface Level {
  id: string;
  name: string;
  difficulty: Difficulty;
  description: string;
  qubits: number;
  slots: number;
  availableGates: GateType[];
  targetProbabilities: Record<string, number>;
  targetGateSequence?: { qubit: number; slot: number; type: GateType }[];
  requiredNoise?: NoiseType;
  noiseOffsetGate?: GateType;
  hints: string[];
  maxScore: number;
}

export interface GateOrderError {
  type: 'wrong_order' | 'missing_gate' | 'extra_gate';
  position: { qubit: number; slot: number };
  expected: string;
  actual: string;
  penalty: number;
  message: string;
}

export interface NormalizationError {
  actualSum: number;
  tolerance: number;
  penalty: number;
  message: string;
}

export interface NoiseError {
  type: 'no_cancellation' | 'wrong_cancellation';
  noiseType: NoiseType;
  expectedGate: string;
  actualGate: string;
  penalty: number;
  message: string;
}

export interface ProbabilityMismatch {
  state: string;
  actual: number;
  target: number;
  diff: number;
}

export interface ProbabilityMismatchError {
  mismatches: ProbabilityMismatch[];
  maxDeviation: number;
  penalty: number;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  gateOrderErrors: GateOrderError[];
  normalizationError: NormalizationError | null;
  noiseError: NoiseError | null;
  probabilityMismatchError: ProbabilityMismatchError | null;
  score: number;
  maxScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  actualProbabilities: Record<string, number>;
  targetProbabilities: Record<string, number>;
  suggestions: string[];
}

export interface GameSession {
  id: string;
  levelId: string;
  startTime: Date;
  endTime?: Date;
  circuit: Circuit;
  operations: OperationLog[];
  validationResult?: ValidationResult;
}

export interface OperationLog {
  id: string;
  timestamp: Date;
  type: 'add_gate' | 'remove_gate' | 'move_gate' | 'add_noise' | 'remove_noise' | 'measure';
  payload: Record<string, unknown>;
}

export interface ReplayData {
  sessionId: string;
  levelId: string;
  operations: OperationLog[];
  finalCircuit: Circuit;
  validationResult: ValidationResult;
}
