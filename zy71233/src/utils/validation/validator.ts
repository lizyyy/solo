import {
  Circuit,
  CircuitGate,
  GateOrderError,
  Level,
  NoiseError,
  NoiseType,
  NormalizationError,
  ProbabilityMismatch,
  ProbabilityMismatchError,
  ValidationResult,
} from '@/types';
import { getNoiseInfo, simulateCircuit } from '../quantum/quantumEngine';

const NORMALIZATION_TOLERANCE = 0.001;
const PROBABILITY_TOLERANCE = 0.05;
const GATE_ORDER_PENALTY = 15;
const NORMALIZATION_PENALTY = 20;
const NOISE_PENALTY = 25;
const PROBABILITY_MISMATCH_PENALTY_UNIT = 10;

export const checkGateOrder = (
  circuitGates: CircuitGate[],
  targetSequence?: { qubit: number; slot: number; type: string }[]
): GateOrderError[] => {
  const errors: GateOrderError[] = [];

  if (!targetSequence || targetSequence.length === 0) {
    return errors;
  }

  const circuitGateMap = new Map<string, CircuitGate>();
  for (const gate of circuitGates) {
    const key = `${gate.position.qubit}-${gate.position.slot}`;
    circuitGateMap.set(key, gate);
  }

  for (const target of targetSequence) {
    const key = `${target.qubit}-${target.slot}`;
    const actualGate = circuitGateMap.get(key);

    if (!actualGate) {
      errors.push({
        type: 'missing_gate',
        position: { qubit: target.qubit, slot: target.slot },
        expected: target.type,
        actual: 'none',
        penalty: GATE_ORDER_PENALTY,
        message: `在量子位 ${target.qubit + 1} 的第 ${target.slot + 1} 位置缺少 ${target.type} 门`,
      });
    } else if (actualGate.type !== target.type) {
      errors.push({
        type: 'wrong_order',
        position: { qubit: target.qubit, slot: target.slot },
        expected: target.type,
        actual: actualGate.type,
        penalty: GATE_ORDER_PENALTY,
        message: `在量子位 ${target.qubit + 1} 的第 ${target.slot + 1} 位置应为 ${target.type} 门，但实际是 ${actualGate.type} 门`,
      });
    }
    circuitGateMap.delete(key);
  }

  for (const [, gate] of circuitGateMap) {
    errors.push({
      type: 'extra_gate',
      position: gate.position,
      expected: 'none',
      actual: gate.type,
      penalty: GATE_ORDER_PENALTY / 2,
      message: `在量子位 ${gate.position.qubit + 1} 的第 ${gate.position.slot + 1} 位置有多余的 ${gate.type} 门`,
    });
  }

  return errors;
};

export const checkNormalization = (probabilitySum: number): NormalizationError | null => {
  if (Math.abs(probabilitySum - 1) > NORMALIZATION_TOLERANCE) {
    return {
      actualSum: probabilitySum,
      tolerance: NORMALIZATION_TOLERANCE,
      penalty: NORMALIZATION_PENALTY,
      message: `概率未归一化：总和为 ${probabilitySum.toFixed(4)}，应接近 1（误差范围 ±${NORMALIZATION_TOLERANCE}）`,
    };
  }
  return null;
};

export const checkNoiseCancellation = (
  circuit: Circuit,
  requiredNoise?: NoiseType,
  noiseOffsetGate?: string
): NoiseError | null => {
  if (!requiredNoise) {
    return null;
  }

  const noiseCards = circuit.noiseCards.filter((n) => n.type === requiredNoise);

  if (noiseCards.length === 0) {
    return null;
  }

  if (!noiseOffsetGate) {
    return {
      type: 'no_cancellation',
      noiseType: requiredNoise,
      expectedGate: getNoiseInfo(requiredNoise).cancelGate || 'unknown',
      actualGate: 'none',
      penalty: NOISE_PENALTY,
      message: `检测到 ${getNoiseInfo(requiredNoise).name} 噪声，但未添加抵消门`,
    };
  }

  const offsetGates = circuit.gates.filter((g) => g.type === noiseOffsetGate);

  if (offsetGates.length === 0) {
    return {
      type: 'no_cancellation',
      noiseType: requiredNoise,
      expectedGate: noiseOffsetGate,
      actualGate: 'none',
      penalty: NOISE_PENALTY,
      message: `检测到 ${getNoiseInfo(requiredNoise).name} 噪声，需要添加 ${noiseOffsetGate} 门进行抵消`,
    };
  }

  const noisePositions = noiseCards.map((n) => n.position);
  const offsetPositions = offsetGates.map((g) => g.position);

  let hasProperCancellation = false;
  for (const noisePos of noisePositions) {
    for (const offsetPos of offsetPositions) {
      if (noisePos.qubit === offsetPos.qubit && offsetPos.slot > noisePos.slot) {
        hasProperCancellation = true;
        break;
      }
    }
    if (hasProperCancellation) break;
  }

  if (!hasProperCancellation) {
    return {
      type: 'wrong_cancellation',
      noiseType: requiredNoise,
      expectedGate: noiseOffsetGate,
      actualGate: noiseOffsetGate,
      penalty: NOISE_PENALTY,
      message: `${noiseOffsetGate} 门位置不正确，应在噪声门之后的同一量子位上`,
    };
  }

  return null;
};

export const calculateGrade = (score: number, maxScore: number): ValidationResult['grade'] => {
  const percentage = score / maxScore;
  if (percentage >= 0.95) return 'S';
  if (percentage >= 0.85) return 'A';
  if (percentage >= 0.75) return 'B';
  if (percentage >= 0.6) return 'C';
  if (percentage >= 0.4) return 'D';
  return 'F';
};

export const checkProbabilityMatch = (
  actual: Record<string, number>,
  target: Record<string, number>
): ProbabilityMismatchError | null => {
  const mismatches: ProbabilityMismatch[] = [];
  const allKeys = new Set([...Object.keys(actual), ...Object.keys(target)]);

  for (const key of allKeys) {
    const a = actual[key] ?? 0;
    const t = target[key] ?? 0;
    const diff = Math.abs(a - t);
    if (diff > PROBABILITY_TOLERANCE) {
      mismatches.push({ state: key, actual: a, target: t, diff });
    }
  }

  if (mismatches.length === 0) {
    return null;
  }

  const maxDeviation = Math.max(...mismatches.map((m) => m.diff));
  const penalty = mismatches.length * PROBABILITY_MISMATCH_PENALTY_UNIT;

  const details = mismatches
    .map((m) => `|${m.state}⟩: 实际 ${(m.actual * 100).toFixed(1)}%, 目标 ${(m.target * 100).toFixed(1)}%, 偏差 ${(m.diff * 100).toFixed(1)}%`)
    .join('; ');

  return {
    mismatches,
    maxDeviation,
    penalty,
    message: `概率与目标不匹配（${mismatches.length} 项偏差超过 ${(PROBABILITY_TOLERANCE * 100).toFixed(0)}%）: ${details}`,
  };
};

export const generateSuggestions = (
  gateOrderErrors: GateOrderError[],
  normalizationError: NormalizationError | null,
  noiseError: NoiseError | null,
  probabilityMismatchError: ProbabilityMismatchError | null
): string[] => {
  const suggestions: string[] = [];

  if (gateOrderErrors.length > 0) {
    const missingCount = gateOrderErrors.filter((e) => e.type === 'missing_gate').length;
    const wrongCount = gateOrderErrors.filter((e) => e.type === 'wrong_order').length;
    const extraCount = gateOrderErrors.filter((e) => e.type === 'extra_gate').length;

    if (missingCount > 0) {
      suggestions.push(`检查是否遗漏了 ${missingCount} 个关键量子门`);
    }
    if (wrongCount > 0) {
      suggestions.push(`有 ${wrongCount} 个门的顺序或类型不正确，请参考目标序列`);
    }
    if (extraCount > 0) {
      suggestions.push(`移除 ${extraCount} 个多余的量子门`);
    }
  }

  if (normalizationError) {
    suggestions.push('检查是否重复添加了测量门或其他导致概率溢出的操作');
    suggestions.push('确保量子态演化过程中保持幺正性');
  }

  if (noiseError) {
    suggestions.push(`添加正确的噪声抵消门：${noiseError.expectedGate}`);
    suggestions.push('确保抵消门在噪声门之后的同一量子位上');
  }

  if (probabilityMismatchError) {
    suggestions.push(
      `有 ${probabilityMismatchError.mismatches.length} 个态的概率与目标偏差过大，检查门的类型和顺序`
    );
    const worst = probabilityMismatchError.mismatches.reduce((a, b) =>
      a.diff > b.diff ? a : b
    );
    suggestions.push(
      `最大偏差在 |${worst.state}⟩: 实际 ${(worst.actual * 100).toFixed(1)}%, 目标 ${(worst.target * 100).toFixed(1)}%`
    );
  }

  if (suggestions.length === 0) {
    suggestions.push('电路构建正确！可以尝试优化门的数量');
  }

  return suggestions;
};

export const validateCircuit = (circuit: Circuit, level: Level): ValidationResult => {
  const gateErrors = checkGateOrder(circuit.gates, level.targetGateSequence);

  const gatePenalty = gateErrors.reduce((sum, e) => sum + e.penalty, 0);

  const gatesForSimulation = circuit.gates.map((g) => ({
    type: g.type,
    qubit: g.position.qubit,
    slot: g.position.slot,
    controlQubit: g.controlQubit,
  }));

  const noiseForSimulation = circuit.noiseCards.map((n) => ({
    type: n.type,
    qubit: n.position.qubit,
    slot: n.position.slot,
    probability: n.probability,
  }));

  const simulationResult = simulateCircuit(
    circuit.qubits,
    gatesForSimulation,
    noiseForSimulation,
    circuit.measurementBasis
  );

  const normalizationError = checkNormalization(simulationResult.probabilitySum);
  const normPenalty = normalizationError?.penalty || 0;

  const noiseError = checkNoiseCancellation(circuit, level.requiredNoise, level.noiseOffsetGate);
  const noisePenalty = noiseError?.penalty || 0;

  const probabilityMismatchError = checkProbabilityMatch(
    simulationResult.probabilities,
    level.targetProbabilities
  );
  const probPenalty = probabilityMismatchError?.penalty || 0;

  const totalPenalty = gatePenalty + normPenalty + noisePenalty + probPenalty;
  const score = Math.max(0, level.maxScore - totalPenalty);

  const grade = calculateGrade(score, level.maxScore);
  const suggestions = generateSuggestions(
    gateErrors,
    normalizationError,
    noiseError,
    probabilityMismatchError
  );

  const isValid =
    gateErrors.length === 0 &&
    !normalizationError &&
    !noiseError &&
    !probabilityMismatchError;

  return {
    isValid,
    gateOrderErrors: gateErrors,
    normalizationError,
    noiseError,
    probabilityMismatchError,
    score,
    maxScore: level.maxScore,
    grade,
    actualProbabilities: simulationResult.probabilities,
    targetProbabilities: level.targetProbabilities,
    suggestions,
  };
};

export const formatProbability = (prob: number): string => {
  return (prob * 100).toFixed(2) + '%';
};

export const calculateProbabilityAccuracy = (
  actual: Record<string, number>,
  target: Record<string, number>
): number => {
  let totalDiff = 0;
  const keys = new Set([...Object.keys(actual), ...Object.keys(target)]);

  for (const key of keys) {
    const a = actual[key] || 0;
    const t = target[key] || 0;
    totalDiff += Math.abs(a - t);
  }

  return Math.max(0, 100 - totalDiff * 50);
};
