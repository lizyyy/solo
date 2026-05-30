export const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

export const variance = (values: number[]): number => {
  if (values.length === 0) return 0;
  const m = mean(values);
  return values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / values.length;
};

export const standardDeviation = (values: number[]): number => {
  return Math.sqrt(variance(values));
};

export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const covariance = (x: number[], y: number[]): number => {
  if (x.length !== y.length || x.length === 0) return 0;
  const meanX = mean(x);
  const meanY = mean(y);
  return x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) / x.length;
};

export const correlationCoefficient = (x: number[], y: number[]): number => {
  const cov = covariance(x, y);
  const stdX = standardDeviation(x);
  const stdY = standardDeviation(y);
  if (stdX === 0 || stdY === 0) return 0;
  return cov / (stdX * stdY);
};

export const rootMeanSquaredError = (
  observed: number[],
  predicted: number[]
): number => {
  if (observed.length !== predicted.length || observed.length === 0) return 0;
  const sumSquaredErrors = observed.reduce(
    (sum, obs, i) => sum + Math.pow(obs - predicted[i], 2),
    0
  );
  return Math.sqrt(sumSquaredErrors / observed.length);
};

export const calculateRSquared = (
  observed: number[],
  predicted: number[]
): number => {
  if (observed.length !== predicted.length || observed.length === 0) return 0;
  const meanObs = mean(observed);
  const totalSumSquares = observed.reduce(
    (sum, obs) => sum + Math.pow(obs - meanObs, 2),
    0
  );
  const residualSumSquares = observed.reduce(
    (sum, obs, i) => sum + Math.pow(obs - predicted[i], 2),
    0
  );
  if (totalSumSquares === 0) return 1;
  return 1 - residualSumSquares / totalSumSquares;
};

export const calculateAdjustedRSquared = (
  observed: number[],
  predicted: number[],
  numParameters: number
): number => {
  const n = observed.length;
  if (n <= numParameters + 1) return 0;
  const rSquared = calculateRSquared(observed, predicted);
  return 1 - ((1 - rSquared) * (n - 1)) / (n - numParameters - 1);
};

export const calculateConfidenceInterval = (
  predicted: number[],
  residuals: number[],
  confidenceLevel: number = 0.95
): { lower: number[]; upper: number[] } => {
  const stdErr = standardDeviation(residuals);
  const zScore = confidenceLevel === 0.95 ? 1.96 : 1.645;
  const margin = zScore * stdErr;

  return {
    lower: predicted.map((p) => p - margin),
    upper: predicted.map((p) => p + margin),
  };
};

export const detectOutliers = (
  values: number[],
  threshold: number = 2
): boolean[] => {
  const std = standardDeviation(values);
  const m = mean(values);
  return values.map((v) => Math.abs(v - m) > threshold * std);
};

export const calculateVoltageNoise = (voltages: number[]): number[] => {
  if (voltages.length < 2) return new Array(voltages.length).fill(0);
  const noise: number[] = [0];
  for (let i = 1; i < voltages.length; i++) {
    noise.push(Math.abs(voltages[i] - voltages[i - 1]));
  }
  return noise;
};
