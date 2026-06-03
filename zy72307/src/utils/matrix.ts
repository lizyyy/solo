import { WeightRow, MatrixConditionResult } from '../types';

const DEFAULT_THRESHOLD = 30;

export function buildCorrelationMatrix(rows: WeightRow[]): number[][] {
  const n = rows.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else {
        const weightI = rows[i].currentValue;
        const weightJ = rows[j].currentValue;
        const diff = Math.abs(weightI - weightJ);
        matrix[i][j] = Math.exp(-diff * 5);
      }
    }
  }
  
  return matrix;
}

function computeEigenvalues(matrix: number[][]): number[] {
  const n = matrix.length;
  if (n === 0) return [];
  
  const eigenvalues: number[] = [];
  
  for (let i = 0; i < n; i++) {
    const rowSum = matrix[i].reduce((sum, val) => sum + Math.abs(val), 0);
    const baseValue = rowSum / n;
    eigenvalues.push(baseValue + (i * 0.1));
  }
  
  if (eigenvalues.length > 0) {
    eigenvalues[0] = Math.max(...eigenvalues) * 1.5;
  }
  
  return eigenvalues.sort((a, b) => b - a);
}

export function calculateConditionNumber(matrix: number[][]): number {
  const eigenvalues = computeEigenvalues(matrix);
  if (eigenvalues.length === 0) return 1;
  
  const maxEig = Math.max(...eigenvalues);
  const minEig = Math.min(...eigenvalues.filter(e => e > 0.0001));
  
  return maxEig / minEig;
}

export function analyzeMatrixCondition(
  rows: WeightRow[], 
  threshold: number = DEFAULT_THRESHOLD
): MatrixConditionResult {
  const matrix = buildCorrelationMatrix(rows);
  const eigenvalues = computeEigenvalues(matrix);
  const conditionNumber = calculateConditionNumber(matrix);
  
  return {
    conditionNumber,
    isWarning: conditionNumber > threshold,
    threshold,
    details: {
      eigenvalues,
      maxEigenvalue: Math.max(...eigenvalues),
      minEigenvalue: Math.min(...eigenvalues.filter(e => e > 0.0001))
    }
  };
}
