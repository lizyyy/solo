import { SurveyRawRow, BoundaryNote } from '../types';

export interface MutualInfoInput {
  answerValues: number[];
  targetLabels: number[];
}

export function calculateMutualInformation(input: MutualInfoInput): number {
  const { answerValues, targetLabels } = input;

  if (answerValues.length === 0 || targetLabels.length === 0) {
    return 0;
  }

  if (answerValues.length !== targetLabels.length) {
    throw new Error('answerValues and targetLabels must have the same length');
  }

  const n = answerValues.length;

  const valueCounts = new Map<number, number>();
  const labelCounts = new Map<number, number>();
  const jointCounts = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const v = answerValues[i];
    const l = targetLabels[i];

    valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
    labelCounts.set(l, (labelCounts.get(l) || 0) + 1);

    const key = `${v},${l}`;
    jointCounts.set(key, (jointCounts.get(key) || 0) + 1);
  }

  let mi = 0;

  for (const [key, jointCount] of jointCounts.entries()) {
    const [vStr, lStr] = key.split(',');
    const v = parseFloat(vStr);
    const l = parseFloat(lStr);

    const pJoint = jointCount / n;
    const pValue = (valueCounts.get(v) || 0) / n;
    const pLabel = (labelCounts.get(l) || 0) / n;

    if (pValue > 0 && pLabel > 0 && pJoint > 0) {
      mi += pJoint * Math.log2(pJoint / (pValue * pLabel));
    }
  }

  const maxMI = calculateMaxMI(valueCounts, labelCounts, n);
  if (maxMI === 0) return 0;

  return Math.max(0, Math.min(1, mi / maxMI));
}

function calculateMaxMI(
  valueCounts: Map<number, number>,
  labelCounts: Map<number, number>,
  n: number
): number {
  let maxMI = 0;

  for (const count of valueCounts.values()) {
    const p = count / n;
    if (p > 0) {
      maxMI -= p * Math.log2(p);
    }
  }

  for (const count of labelCounts.values()) {
    const p = count / n;
    if (p > 0) {
      maxMI -= p * Math.log2(p);
    }
  }

  return maxMI;
}

export function calculateMutualInfoForRow(
  row: SurveyRawRow,
  allRows: SurveyRawRow[],
  boundaryNotes: BoundaryNote[]
): { score: number; threshold: number; isAtThreshold: boolean } {
  const sameQuestionRows = allRows.filter(r => r.questionId === row.questionId);

  if (sameQuestionRows.length < 2) {
    return { score: 0.5, threshold: 0.5, isAtThreshold: true };
  }

  const answerValues = sameQuestionRows.map(r => r.answerValue);
  const median = calculateMedian(answerValues);
  const targetLabels = sameQuestionRows.map(r => (r.answerValue > median ? 1 : 0));

  const rowIndex = sameQuestionRows.findIndex(r => r.id === row.id);
  if (rowIndex === -1) {
    return { score: 0.5, threshold: 0.5, isAtThreshold: true };
  }

  const input: MutualInfoInput = {
    answerValues: answerValues.map((v, i) =>
      i === rowIndex ? v : v > median ? 1 : 0
    ),
    targetLabels,
  };

  let score = calculateMutualInformation(input);

  if (score === 0) {
    score = 0.1;
  }

  const relevantNotes = boundaryNotes.filter(
    n => n.questionId === row.questionId &&
      (!n.respondentId || n.respondentId === row.respondentId)
  );

  let threshold = 0.5;
  if (relevantNotes.length > 0) {
    const noteThresholds = relevantNotes.map(n => n.threshold);
    threshold = Math.min(...noteThresholds);
  }

  const isAtThreshold = Math.abs(score - threshold) < 0.001;

  return { score, threshold, isAtThreshold };
}

function calculateMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function evaluateBoundaryCondition(
  answerValue: number,
  note: BoundaryNote
): boolean {
  switch (note.operator) {
    case '>':
      return answerValue > note.threshold;
    case '<':
      return answerValue < note.threshold;
    case '>=':
      return answerValue >= note.threshold;
    case '<=':
      return answerValue <= note.threshold;
    case '==':
      return Math.abs(answerValue - note.threshold) < 0.001;
    default:
      return false;
  }
}

export function calculateCorrelationScore(
  row: SurveyRawRow,
  notes: BoundaryNote[]
): number {
  const relevantNotes = notes.filter(
    n => n.questionId === row.questionId &&
      (!n.respondentId || n.respondentId === row.respondentId)
  );

  if (relevantNotes.length === 0) {
    return 0.5;
  }

  let matchCount = 0;
  for (const note of relevantNotes) {
    if (evaluateBoundaryCondition(row.answerValue, note)) {
      matchCount++;
    }
  }

  return matchCount / relevantNotes.length;
}
