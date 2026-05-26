import { Violation, ScoreDetail, Operation, Chemical, GridCell } from '../types';
import { PENALTIES } from '../data/rules';
import { getChemicalById } from '../data/chemicals';
import { checkAllViolations } from './rulesEngine';

export const calculateScoreDetail = (
  baseScore: number,
  operations: Operation[],
  timeRemaining: number,
  timeLimit: number,
  grid: GridCell[][],
  placedChemicals: string[],
  finalTemperature: number
): ScoreDetail => {
  let placementScore = 0;
  let isolationBonus = 0;
  let temperatureBonus = 0;
  let adjacencyPenalty = 0;
  let temperaturePenalty = 0;
  let isolationPenalty = 0;
  let zonePenalty = 0;
  let timePenalty = 0;

  for (const op of operations) {
    if (op.type === 'place' && op.scoreDelta > 0) {
      placementScore += op.scoreDelta;
    }
  }

  const placeOperations = operations.filter(op => op.type === 'place');
  for (const op of placeOperations) {
    for (const violation of op.violations) {
      switch (violation.type) {
        case 'adjacency':
          adjacencyPenalty += violation.penalty;
          break;
        case 'temperature':
          temperaturePenalty += violation.penalty;
          break;
        case 'isolation':
          isolationPenalty += violation.penalty;
          break;
        case 'zone':
          zonePenalty += violation.penalty;
          break;
      }
    }
  }

  const continuousViolations = operations.filter(op => op.type === 'end');
  if (continuousViolations.length > 0) {
    const lastOp = continuousViolations[continuousViolations.length - 1];
    for (const violation of lastOp.violations) {
      if (violation.isContinuous) {
        switch (violation.type) {
          case 'adjacency':
            adjacencyPenalty += PENALTIES.ADJACENCY_PER_SECOND * 10;
            break;
          case 'temperature':
            temperaturePenalty += PENALTIES.TEMPERATURE_PER_SECOND * 10;
            break;
        }
      }
    }
  }

  const finalViolations = checkAllViolations(grid, placedChemicals, finalTemperature);
  const hasTemperatureViolation = finalViolations.some(v => v.type === 'temperature');
  if (!hasTemperatureViolation && placedChemicals.length > 0) {
    temperatureBonus = PENALTIES.TEMPERATURE_BONUS;
  }

  const perfectIsolationCount = placeOperations.filter(op => {
    if (!op.data.chemicalId) return false;
    const chemical = getChemicalById(op.data.chemicalId);
    if (!chemical || chemical.storageRequirements.isolationDistance <= 0) return false;
    return !op.violations.some(v => v.type === 'isolation');
  }).length;
  isolationBonus = perfectIsolationCount * PENALTIES.ISOLATION_BONUS;

  if (timeRemaining < 0) {
    timePenalty = Math.abs(timeRemaining) * PENALTIES.TIME_OVER_PER_SECOND;
  }

  const timeBonus = timeRemaining > 0 ? timeRemaining * PENALTIES.TIME_BONUS_PER_SECOND : 0;

  const totalScore =
    baseScore +
    placementScore +
    isolationBonus +
    temperatureBonus +
    timeBonus -
    adjacencyPenalty -
    temperaturePenalty -
    isolationPenalty -
    zonePenalty -
    timePenalty;

  return {
    baseScore,
    placementScore,
    isolationBonus,
    temperatureBonus,
    timeBonus,
    adjacencyPenalty,
    temperaturePenalty,
    isolationPenalty,
    zonePenalty,
    timePenalty,
    totalScore: Math.max(0, totalScore)
  };
};

export const getScoreRating = (score: number, targetScore: number): string => {
  const ratio = score / targetScore;
  if (ratio >= 1.2) return 'S';
  if (ratio >= 1.0) return 'A';
  if (ratio >= 0.8) return 'B';
  if (ratio >= 0.6) return 'C';
  return 'D';
};

export const getRatingColor = (rating: string): string => {
  switch (rating) {
    case 'S':
      return 'text-yellow-400';
    case 'A':
      return 'text-green-400';
    case 'B':
      return 'text-blue-400';
    case 'C':
      return 'text-orange-400';
    default:
      return 'text-red-400';
  }
};

export const formatScoreDelta = (delta: number): string => {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return '0';
};

export const getViolationTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    adjacency: '禁忌相邻',
    temperature: '温度超限',
    isolation: '隔离不足',
    zone: '区域错误',
    severe: '严重事故'
  };
  return labels[type] || type;
};
