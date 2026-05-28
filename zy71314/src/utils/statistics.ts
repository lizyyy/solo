export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function variance(values: number[], sample = true): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const squaredDiffs = values.map(v => Math.pow(v - m, 2));
  const divisor = sample ? values.length - 1 : values.length;
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / divisor;
}

export function stdDev(values: number[], sample = true): number {
  return Math.sqrt(variance(values, sample));
}

export function quartiles(values: number[]): { q1: number; q2: number; q3: number; iqr: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  const q2 = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  
  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(Math.ceil(n / 2));
  
  const q1 = lowerHalf.length % 2 === 0
    ? (lowerHalf[lowerHalf.length / 2 - 1] + lowerHalf[lowerHalf.length / 2]) / 2
    : lowerHalf[Math.floor(lowerHalf.length / 2)];
  
  const q3 = upperHalf.length % 2 === 0
    ? (upperHalf[upperHalf.length / 2 - 1] + upperHalf[upperHalf.length / 2]) / 2
    : upperHalf[Math.floor(upperHalf.length / 2)];
  
  return { q1, q2, q3, iqr: q3 - q1 };
}

export function detectOutliersIQR(values: number[]): number[] {
  if (values.length < 4) return [];
  const { q1, q3, iqr } = quartiles(values);
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return values
    .map((v, i) => (v < lowerBound || v > upperBound ? i : -1))
    .filter(i => i >= 0);
}

export function detectOutliersZScore(values: number[], threshold = 3): number[] {
  if (values.length < 3) return [];
  const m = mean(values);
  const sd = stdDev(values, false);
  if (sd === 0) return [];
  
  return values
    .map((v, i) => (Math.abs((v - m) / sd) > threshold ? i : -1))
    .filter(i => i >= 0);
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  slopeStdErr: number;
  interceptStdErr: number;
}

export function linearRegression(x: number[], y: number[]): LinearRegressionResult {
  if (x.length !== y.length || x.length < 2) {
    return { slope: 0, intercept: 0, rSquared: 0, slopeStdErr: 0, interceptStdErr: 0 };
  }
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  const yMean = sumY / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const ssResidual = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
  const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;
  
  const residualVariance = ssResidual / (n - 2);
  const xMean = sumX / n;
  const ssXX = x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0);
  
  const slopeStdErr = Math.sqrt(residualVariance / ssXX);
  const interceptStdErr = Math.sqrt(residualVariance * (1 / n + xMean * xMean / ssXX));
  
  return { slope, intercept, rSquared, slopeStdErr, interceptStdErr };
}

export function residuals(x: number[], y: number[], slope: number, intercept: number): number[] {
  return y.map((yi, i) => yi - (slope * x[i] + intercept));
}

export function formatNumber(value: number, decimals = 4): string {
  return value.toFixed(decimals);
}

export function formatScientific(value: number, decimals = 2): string {
  return value.toExponential(decimals);
}
