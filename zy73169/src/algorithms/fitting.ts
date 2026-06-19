import type { Sample, FittingMethod, FittingResult } from '../models/types';
import { createFittingParams } from '../models/factories';

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function linearRegression(xs: number[], ys: number[]): { coefficients: number[]; rSquared: number } {
  const n = xs.length;
  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const sumY2 = ys.reduce((s, y) => s + y * y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const yMean = mean(ys);
  const ssTotal = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
  const ssResidual = xs.reduce((s, x, i) => s + Math.pow(ys[i] - (slope * x + intercept), 2), 0);
  const rSquared = 1 - ssResidual / ssTotal;

  return { coefficients: [intercept, slope], rSquared };
}

function polynomialRegression(xs: number[], ys: number[], degree: number): { coefficients: number[]; rSquared: number } {
  const n = xs.length;
  const m = degree + 1;

  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      row.push(Math.pow(xs[i], j));
    }
    X.push(row);
  }

  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const XtY = multiply(Xt, ys.map(y => [y]));

  const coefficients = solveLinearSystem(XtX, XtY.map(row => row[0]));

  const yMean = mean(ys);
  const ssTotal = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
  const ssResidual = xs.reduce((s, x, i) => {
    const predicted = coefficients.reduce((sum, c, idx) => sum + c * Math.pow(x, idx), 0);
    return s + Math.pow(ys[i] - predicted, 2);
  }, 0);
  const rSquared = 1 - ssResidual / ssTotal;

  return { coefficients, rSquared };
}

function exponentialRegression(xs: number[], ys: number[]): { coefficients: number[]; rSquared: number } {
  const logYs = ys.map(y => Math.log(y));
  const result = linearRegression(xs, logYs);
  const a = Math.exp(result.coefficients[0]);
  const b = result.coefficients[1];

  const yMean = mean(ys);
  const ssTotal = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
  const ssResidual = xs.reduce((s, x, i) => {
    const predicted = a * Math.exp(b * x);
    return s + Math.pow(ys[i] - predicted, 2);
  }, 0);
  const rSquared = 1 - ssResidual / ssTotal;

  return { coefficients: [a, b], rSquared };
}

function logarithmicRegression(xs: number[], ys: number[]): { coefficients: number[]; rSquared: number } {
  const logXs = xs.map(x => Math.log(x));
  const result = linearRegression(logXs, ys);

  const yMean = mean(ys);
  const ssTotal = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
  const ssResidual = xs.reduce((s, x, i) => {
    const predicted = result.coefficients[0] + result.coefficients[1] * Math.log(x);
    return s + Math.pow(ys[i] - predicted, 2);
  }, 0);
  const rSquared = 1 - ssResidual / ssTotal;

  return { coefficients: result.coefficients, rSquared };
}

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, colIdx) => matrix.map(row => row[colIdx]));
}

function multiply(a: number[][], b: number[][]): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    result[i] = [];
    for (let j = 0; j < b[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < a[0].length; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  const x: number[] = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n] / augmented[i][i];
    for (let k = i - 1; k >= 0; k--) {
      augmented[k][n] -= augmented[k][i] * x[i];
    }
  }
  return x;
}

export function calculateFitting(
  samples: Sample[],
  method: FittingMethod,
  calculatedBy: string,
  excludeAnomalies: boolean = true,
  degree?: number
): FittingResult {
  const validSamples = samples.filter(s => {
    if (s.status === 'withdrawn') return false;
    if (excludeAnomalies && s.anomalies.some(a => !a.resolved && a.severity === 'high')) return false;
    return true;
  });

  const excludedSamples = samples.filter(s => !validSamples.includes(s));
  const xs = validSamples.map(s => s.x);
  const ys = validSamples.map(s => s.y);

  if (validSamples.length < 2) {
    throw new Error('至少需要2个有效样本才能进行曲线拟合');
  }

  let result: { coefficients: number[]; rSquared: number };
  switch (method) {
    case 'linear':
      result = linearRegression(xs, ys);
      break;
    case 'polynomial':
      if (!degree || degree < 1) {
        throw new Error('多项式拟合需要指定阶数');
      }
      result = polynomialRegression(xs, ys, degree);
      break;
    case 'exponential':
      if (ys.some(y => y <= 0)) {
        throw new Error('指数拟合要求所有Y值必须大于0');
      }
      result = exponentialRegression(xs, ys);
      break;
    case 'logarithmic':
      if (xs.some(x => x <= 0)) {
        throw new Error('对数拟合要求所有X值必须大于0');
      }
      result = logarithmicRegression(xs, ys);
      break;
    default:
      throw new Error(`不支持的拟合方法: ${method}`);
  }

  const params = createFittingParams(
    method,
    result.coefficients,
    result.rSquared,
    validSamples.map(s => s.id),
    excludedSamples.map(s => s.id),
    calculatedBy,
    degree
  );

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const step = (maxX - minX) / 100;
  const predictedValues: Array<{ x: number; y: number }> = [];
  for (let x = minX; x <= maxX + step / 2; x += step) {
    predictedValues.push({ x, y: predict(x, params.coefficients, method) });
  }

  const residuals = validSamples.map(s => ({
    sampleId: s.id,
    residual: s.y - predict(s.x, params.coefficients, method),
  }));

  return { params, predictedValues, residuals };
}

export function predict(x: number, coefficients: number[], method: FittingMethod): number {
  switch (method) {
    case 'linear':
    case 'polynomial':
      return coefficients.reduce((sum, c, idx) => sum + c * Math.pow(x, idx), 0);
    case 'exponential':
      return coefficients[0] * Math.exp(coefficients[1] * x);
    case 'logarithmic':
      return coefficients[0] + coefficients[1] * Math.log(x);
    default:
      throw new Error(`不支持的拟合方法: ${method}`);
  }
}

export function formatEquation(coefficients: number[], method: FittingMethod, degree?: number): string {
  switch (method) {
    case 'linear':
      return `y = ${coefficients[1].toFixed(4)}x + ${coefficients[0].toFixed(4)}`;
    case 'polynomial':
      return coefficients
        .map((c, idx) => {
          if (idx === 0) return c.toFixed(4);
          if (idx === 1) return `${c.toFixed(4)}x`;
          return `${c.toFixed(4)}x^${idx}`;
        })
        .reverse()
        .join(' + ')
        .replace(/\+ -/g, '- ');
    case 'exponential':
      return `y = ${coefficients[0].toFixed(4)} * e^(${coefficients[1].toFixed(4)}x)`;
    case 'logarithmic':
      return `y = ${coefficients[0].toFixed(4)} + ${coefficients[1].toFixed(4)} * ln(x)`;
    default:
      return '';
  }
}
