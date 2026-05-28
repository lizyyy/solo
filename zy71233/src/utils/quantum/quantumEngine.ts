import { GateType, MeasurementBasis, NoiseType } from '@/types';

type Complex = { re: number; im: number };

const c = (re: number, im: number = 0): Complex => ({ re, im });

const add = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
});

const multiply = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

const magnitudeSquared = (a: Complex): number => a.re * a.re + a.im * a.im;

const ket0: Complex[] = [c(1), c(0)];
const ket1: Complex[] = [c(0), c(1)];

const SQRT2_INV = 1 / Math.sqrt(2);

const gateMatrices: Record<GateType, Complex[][]> = {
  H: [
    [c(SQRT2_INV), c(SQRT2_INV)],
    [c(SQRT2_INV), c(-SQRT2_INV)],
  ],
  X: [
    [c(0), c(1)],
    [c(1), c(0)],
  ],
  Y: [
    [c(0), c(0, -1)],
    [c(0, 1), c(0)],
  ],
  Z: [
    [c(1), c(0)],
    [c(0), c(-1)],
  ],
  T: [
    [c(1), c(0)],
    [c(0), c(SQRT2_INV, SQRT2_INV)],
  ],
  S: [
    [c(1), c(0)],
    [c(0), c(0, 1)],
  ],
  CNOT: [
    [c(1), c(0), c(0), c(0)],
    [c(0), c(1), c(0), c(0)],
    [c(0), c(0), c(0), c(1)],
    [c(0), c(0), c(1), c(0)],
  ],
  Measure: [
    [c(1), c(0)],
    [c(0), c(1)],
  ],
};

const noiseMatrices: Record<NoiseType, (p: number) => Complex[][]> = {
  'bit-flip': (p: number) => [
    [c(1 - p), c(0)],
    [c(0), c(p)],
  ],
  'phase-flip': (p: number) => [
    [c(1), c(0)],
    [c(0), c(1 - 2 * p)],
  ],
  depolarizing: (p: number) => [
    [c(1 - p * 0.75), c(0)],
    [c(0), c(1 - p * 0.75)],
  ],
};

const basisChangeMatrices: Record<MeasurementBasis, Complex[][]> = {
  X: gateMatrices.H,
  Y: [
    [c(SQRT2_INV), c(0, -SQRT2_INV)],
    [c(SQRT2_INV), c(0, SQRT2_INV)],
  ],
  Z: [
    [c(1), c(0)],
    [c(0), c(1)],
  ],
};

export const initializeState = (numQubits: number): Complex[] => {
  const size = 2 ** numQubits;
  const state: Complex[] = new Array(size).fill(c(0));
  state[0] = c(1);
  return state;
};

export const tensorProduct = (a: Complex[], b: Complex[]): Complex[] => {
  const result: Complex[] = [];
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result.push(multiply(a[i], b[j]));
    }
  }
  return result;
};

export const applySingleQubitGate = (
  state: Complex[],
  qubit: number,
  gate: Complex[][],
  numQubits: number
): Complex[] => {
  const size = 2 ** numQubits;
  const result: Complex[] = new Array(size).fill(c(0));

  for (let i = 0; i < size; i++) {
    const qubitValue = (i >> (numQubits - 1 - qubit)) & 1;
    const otherBits = i & ~(1 << (numQubits - 1 - qubit));

    for (let k = 0; k < 2; k++) {
      const targetIndex = otherBits | (k << (numQubits - 1 - qubit));
      result[targetIndex] = add(result[targetIndex], multiply(gate[k][qubitValue], state[i]));
    }
  }

  return result;
};

export const applyCNOT = (
  state: Complex[],
  controlQubit: number,
  targetQubit: number,
  numQubits: number
): Complex[] => {
  const size = 2 ** numQubits;
  const result: Complex[] = [...state];

  for (let i = 0; i < size; i++) {
    const controlValue = (i >> (numQubits - 1 - controlQubit)) & 1;
    if (controlValue === 1) {
      const targetBit = 1 << (numQubits - 1 - targetQubit);
      const swappedIndex = i ^ targetBit;
      if (i < swappedIndex) {
        const temp = result[i];
        result[i] = result[swappedIndex];
        result[swappedIndex] = temp;
      }
    }
  }

  return result;
};

export const applyGate = (
  state: Complex[],
  gateType: GateType,
  targetQubit: number,
  numQubits: number,
  controlQubit?: number
): Complex[] => {
  if (gateType === 'CNOT' && controlQubit !== undefined) {
    return applyCNOT(state, controlQubit, targetQubit, numQubits);
  }
  return applySingleQubitGate(state, targetQubit, gateMatrices[gateType], numQubits);
};

export const applyNoise = (
  state: Complex[],
  noiseType: NoiseType,
  targetQubit: number,
  probability: number,
  numQubits: number
): Complex[] => {
  const noiseMatrix = noiseMatrices[noiseType](probability);
  return applySingleQubitGate(state, targetQubit, noiseMatrix, numQubits);
};

export const changeBasis = (
  state: Complex[],
  qubit: number,
  basis: MeasurementBasis,
  numQubits: number
): Complex[] => {
  const basisMatrix = basisChangeMatrices[basis];
  return applySingleQubitGate(state, qubit, basisMatrix, numQubits);
};

export const calculateProbabilities = (
  state: Complex[],
  numQubits: number,
  measurementBases: MeasurementBasis[]
): Record<string, number> => {
  let transformedState = [...state];

  for (let qubit = 0; qubit < numQubits; qubit++) {
    transformedState = changeBasis(transformedState, qubit, measurementBases[qubit] || 'Z', numQubits);
  }

  const probabilities: Record<string, number> = {};
  const size = 2 ** numQubits;

  for (let i = 0; i < size; i++) {
    const binary = i.toString(2).padStart(numQubits, '0');
    probabilities[binary] = magnitudeSquared(transformedState[i]);
  }

  return probabilities;
};

export const simulateCircuit = (
  numQubits: number,
  gates: { type: GateType; qubit: number; controlQubit?: number }[],
  noiseCards: { type: NoiseType; qubit: number; probability: number }[],
  measurementBases: MeasurementBasis[]
): {
  finalState: Complex[];
  probabilities: Record<string, number>;
  probabilitySum: number;
} => {
  let state = initializeState(numQubits);

  const allOperations = [
    ...gates.map((g) => ({ ...g, isNoise: false })),
    ...noiseCards.map((n) => ({ ...n, isNoise: true })),
  ].sort((a, b) => {
    if ('slot' in a && 'slot' in b) {
      return (a as { slot: number }).slot - (b as { slot: number }).slot;
    }
    return 0;
  });

  for (const op of allOperations) {
    if (op.isNoise) {
      const noiseOp = op as { type: NoiseType; qubit: number; probability: number };
      state = applyNoise(state, noiseOp.type, noiseOp.qubit, noiseOp.probability, numQubits);
    } else {
      const gateOp = op as { type: GateType; qubit: number; controlQubit?: number };
      state = applyGate(state, gateOp.type, gateOp.qubit, numQubits, gateOp.controlQubit);
    }
  }

  const probabilities = calculateProbabilities(state, numQubits, measurementBases);
  const probabilitySum = Object.values(probabilities).reduce((sum, p) => sum + p, 0);

  return {
    finalState: state,
    probabilities,
    probabilitySum,
  };
};

export const getGateInfo = (type: GateType) => {
  const gateInfo: Record<GateType, { name: string; symbol: string; description: string }> = {
    H: { name: 'Hadamard', symbol: 'H', description: '创建叠加态，将|0⟩变为(|0⟩+|1⟩)/√2' },
    X: { name: 'Pauli-X', symbol: 'X', description: '量子NOT门，翻转量子比特状态' },
    Y: { name: 'Pauli-Y', symbol: 'Y', description: '绕Y轴旋转π角' },
    Z: { name: 'Pauli-Z', symbol: 'Z', description: '绕Z轴旋转π角（相位翻转）' },
    T: { name: 'T', symbol: 'T', description: '绕Z轴旋转π/4角' },
    S: { name: 'S', symbol: 'S', description: '绕Z轴旋转π/2角' },
    CNOT: { name: 'CNOT', symbol: '⊕', description: '受控NOT门，控制比特为1时翻转目标比特' },
    Measure: { name: 'Measure', symbol: 'M', description: '测量量子比特' },
  };
  return gateInfo[type];
};

export const getNoiseInfo = (type: NoiseType) => {
  const noiseInfo: Record<NoiseType, { name: string; description: string; cancelGate: GateType | null }> =
    {
      'bit-flip': { name: '比特翻转', description: '以一定概率翻转量子比特状态', cancelGate: 'X' },
      'phase-flip': { name: '相位翻转', description: '以一定概率翻转量子比特相位', cancelGate: 'Z' },
      depolarizing: { name: '退相干', description: '量子态与环境相互作用导致的噪声', cancelGate: null },
    };
  return noiseInfo[type];
};
