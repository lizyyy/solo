import type { SamplePoint, FitResult, FitMode } from '@/types';
import {
  rootMeanSquaredError,
  calculateRSquared,
  calculateAdjustedRSquared,
  calculateConfidenceInterval,
} from '../statistics';
import { convertTimeToSeconds } from '../units';

interface FitOptions {
  mode: FitMode;
  maxIterations?: number;
  tolerance?: number;
  lambda?: number;
  timeUnit: string;
}

const predictVoltage = (
  t: number,
  params: { V0: number; Vs: number; tau: number },
  mode: FitMode
): number => {
  const { V0, Vs, tau } = params;
  if (mode === 'charge') {
    return Vs + (V0 - Vs) * Math.exp(-t / tau);
  } else {
    return V0 * Math.exp(-t / tau);
  }
};

const calculateJacobian = (
  t: number,
  params: { V0: number; Vs: number; tau: number },
  mode: FitMode
): number[] => {
  const { V0, Vs, tau } = params;
  const expTerm = Math.exp(-t / tau);

  if (mode === 'charge') {
    return [
      expTerm,
      1 - expTerm,
      ((V0 - Vs) * t * expTerm) / (tau * tau),
    ];
  } else {
    return [expTerm, 0, (V0 * t * expTerm) / (tau * tau)];
  }
};

const estimateInitialParams = (
  points: SamplePoint[],
  mode: FitMode,
  timeUnit: string
): { V0: number; Vs: number; tau: number } => {
  const times = points.map((p) =>
    convertTimeToSeconds(p.time, timeUnit as any)
  );
  const voltages = points.map((p) => p.voltage);

  const V0 = voltages[0];
  let Vs = mode === 'charge' ? voltages[voltages.length - 1] : 0;

  const validIndices = voltages
    .map((v, i) => ({ v, i }))
    .filter(
      ({ v }) =>
        (mode === 'charge' ? v > V0 && v < Vs : v < V0 && v > Vs) && v > 0
    )
    .map(({ i }) => i);

  if (validIndices.length < 2) {
    const avgTime = times[times.length - 1] / 3;
    return { V0, Vs, tau: avgTime };
  }

  const lnV: number[] = [];
  const tValues: number[] = [];

  for (const idx of validIndices) {
    const v = voltages[idx];
    const t = times[idx];
    if (mode === 'charge') {
      if (Vs - v > 0) {
        lnV.push(Math.log(Vs - v));
        tValues.push(t);
      }
    } else {
      if (v > 0) {
        lnV.push(Math.log(v));
        tValues.push(t);
      }
    }
  }

  if (lnV.length < 2) {
    const avgTime = times[times.length - 1] / 3;
    return { V0, Vs, tau: avgTime };
  }

  const meanT = tValues.reduce((a, b) => a + b, 0) / tValues.length;
  const meanLnV = lnV.reduce((a, b) => a + b, 0) / lnV.length;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < tValues.length; i++) {
    numerator += (tValues[i] - meanT) * (lnV[i] - meanLnV);
    denominator += (tValues[i] - meanT) ** 2;
  }

  if (denominator === 0) {
    const avgTime = times[times.length - 1] / 3;
    return { V0, Vs, tau: avgTime };
  }

  const slope = numerator / denominator;
  const tau = Math.abs(-1 / slope);

  return { V0, Vs, tau: Math.max(tau, 1e-6) };
};

export const exponentialFit = (
  points: SamplePoint[],
  options: FitOptions
): FitResult => {
  const {
    mode,
    maxIterations = 200,
    tolerance = 1e-10,
    lambda = 0.01,
    timeUnit,
  } = options;

  const times = points.map((p) => convertTimeToSeconds(p.time, timeUnit as any));
  const voltages = points.map((p) => p.voltage);

  let params = estimateInitialParams(points, mode, timeUnit);

  if (times.length < 3) {
    const predicted = times.map((t) => predictVoltage(t, params, mode));
    const residuals = voltages.map((v, i) => v - predicted[i]);
    const rmse = rootMeanSquaredError(voltages, predicted);
    const ci = calculateConfidenceInterval(predicted, residuals);

    return {
      id: `fit-${Date.now()}`,
      batchId: points[0]?.batchId || '',
      tau: params.tau,
      tauStdErr: rmse,
      rSquared: calculateRSquared(voltages, predicted),
      adjustedRSquared: calculateAdjustedRSquared(voltages, predicted, 3),
      rootMeanSquaredError: rmse,
      fittedParams: params,
      confidenceInterval: ci,
      algorithm: 'Levenberg-Marquardt (insufficient data)',
      computedAt: new Date().toISOString(),
      dataVersion: 0,
    };
  }

  let currentLambda = lambda;
  let prevError = Infinity;
  let iteration = 0;

  while (iteration < maxIterations) {
    const predicted = times.map((t) => predictVoltage(t, params, mode));
    const residuals = voltages.map((v, i) => v - predicted[i]);
    const error = residuals.reduce((sum, r) => sum + r * r, 0);

    if (Math.abs(prevError - error) < tolerance * (prevError + 1)) {
      break;
    }

    let JTJ = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    let JTr = [0, 0, 0];

    for (let i = 0; i < times.length; i++) {
      const J = calculateJacobian(times[i], params, mode);
      const r = residuals[i];

      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          JTJ[j][k] += J[j] * J[k];
        }
        JTr[j] += J[j] * r;
      }
    }

    for (let j = 0; j < 3; j++) {
      JTJ[j][j] *= 1 + currentLambda;
    }

    const det =
      JTJ[0][0] * (JTJ[1][1] * JTJ[2][2] - JTJ[1][2] * JTJ[2][1]) -
      JTJ[0][1] * (JTJ[1][0] * JTJ[2][2] - JTJ[1][2] * JTJ[2][0]) +
      JTJ[0][2] * (JTJ[1][0] * JTJ[2][1] - JTJ[1][1] * JTJ[2][0]);

    if (Math.abs(det) < 1e-15) {
      currentLambda *= 10;
      iteration++;
      continue;
    }

    const invJTJ = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    invJTJ[0][0] = (JTJ[1][1] * JTJ[2][2] - JTJ[1][2] * JTJ[2][1]) / det;
    invJTJ[0][1] = -(JTJ[0][1] * JTJ[2][2] - JTJ[0][2] * JTJ[2][1]) / det;
    invJTJ[0][2] = (JTJ[0][1] * JTJ[1][2] - JTJ[0][2] * JTJ[1][1]) / det;
    invJTJ[1][0] = -(JTJ[1][0] * JTJ[2][2] - JTJ[1][2] * JTJ[2][0]) / det;
    invJTJ[1][1] = (JTJ[0][0] * JTJ[2][2] - JTJ[0][2] * JTJ[2][0]) / det;
    invJTJ[1][2] = -(JTJ[0][0] * JTJ[1][2] - JTJ[0][2] * JTJ[1][0]) / det;
    invJTJ[2][0] = (JTJ[1][0] * JTJ[2][1] - JTJ[1][1] * JTJ[2][0]) / det;
    invJTJ[2][1] = -(JTJ[0][0] * JTJ[2][1] - JTJ[0][1] * JTJ[2][0]) / det;
    invJTJ[2][2] = (JTJ[0][0] * JTJ[1][1] - JTJ[0][1] * JTJ[1][0]) / det;

    const delta = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        delta[j] += invJTJ[j][k] * JTr[k];
      }
    }

    const newParams = {
      V0: params.V0 + delta[0],
      Vs: params.Vs + delta[1],
      tau: Math.max(params.tau + delta[2], 1e-9),
    };

    const newPredicted = times.map((t) => predictVoltage(t, newParams, mode));
    const newError = newPredicted.reduce(
      (sum, p, i) => sum + (voltages[i] - p) ** 2,
      0
    );

    if (newError < error) {
      params = newParams;
      prevError = error;
      currentLambda /= 10;
    } else {
      currentLambda *= 10;
    }

    iteration++;
  }

  const finalPredicted = times.map((t) => predictVoltage(t, params, mode));
  const finalResiduals = voltages.map((v, i) => v - finalPredicted[i]);
  const rmse = rootMeanSquaredError(voltages, finalPredicted);
  const rSquared = calculateRSquared(voltages, finalPredicted);
  const adjustedRSquared = calculateAdjustedRSquared(
    voltages,
    finalPredicted,
    3
  );
  const ci = calculateConfidenceInterval(finalPredicted, finalResiduals);

  let JTJ = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < times.length; i++) {
    const J = calculateJacobian(times[i], params, mode);
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        JTJ[j][k] += J[j] * J[k];
      }
    }
  }

  const det =
    JTJ[0][0] * (JTJ[1][1] * JTJ[2][2] - JTJ[1][2] * JTJ[2][1]) -
    JTJ[0][1] * (JTJ[1][0] * JTJ[2][2] - JTJ[1][2] * JTJ[2][0]) +
    JTJ[0][2] * (JTJ[1][0] * JTJ[2][1] - JTJ[1][1] * JTJ[2][0]);

  let tauStdErr = rmse;
  if (Math.abs(det) > 1e-15) {
    const invJTJ22 =
      (JTJ[0][0] * JTJ[1][1] - JTJ[0][1] * JTJ[1][0]) / det;
    tauStdErr = rmse * Math.sqrt(Math.abs(invJTJ22));
  }

  return {
    id: `fit-${Date.now()}`,
    batchId: points[0]?.batchId || '',
    tau: params.tau,
    tauStdErr,
    rSquared,
    adjustedRSquared,
    rootMeanSquaredError: rmse,
    fittedParams: params,
    confidenceInterval: ci,
    algorithm: `Levenberg-Marquardt (${iteration} iterations)`,
    computedAt: new Date().toISOString(),
    dataVersion: 0,
  };
};

export const generateTheoryCurve = (
  fitResult: FitResult,
  mode: FitMode,
  timeRange: { min: number; max: number },
  numPoints: number = 100
): { time: number; voltage: number }[] => {
  const points: { time: number; voltage: number }[] = [];
  const step = (timeRange.max - timeRange.min) / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const t = timeRange.min + i * step;
    const v = predictVoltage(t, fitResult.fittedParams, mode);
    points.push({ time: t, voltage: v });
  }

  return points;
};

export const calculateResiduals = (
  points: SamplePoint[],
  fitResult: FitResult,
  mode: FitMode,
  timeUnit: string
): (SamplePoint & { residual: number })[] => {
  return points.map((point) => {
    const t = convertTimeToSeconds(point.time, timeUnit as any);
    const predicted = predictVoltage(t, fitResult.fittedParams, mode);
    const residual = point.voltage - predicted;
    const isOutlier =
      Math.abs(residual) > 2 * fitResult.rootMeanSquaredError;

    return {
      ...point,
      residual,
      isOutlier,
      outlierReason: isOutlier
        ? `残差 ${residual.toFixed(4)}V 超过2σ (±${(2 * fitResult.rootMeanSquaredError).toFixed(4)}V)`
        : null,
    };
  });
};

export const calculateParameterImpact = (
  fitResult: FitResult,
  observedVoltages: number[]
): { name: string; label: string; impact: number; unit: string }[] => {
  const { V0, Vs, tau } = fitResult.fittedParams;
  const meanV = observedVoltages.reduce((a, b) => a + b, 0) / observedVoltages.length;

  const impactV0 = Math.abs(V0 - meanV) / meanV;
  const impactVs = Vs > 0 ? Math.abs(Vs - meanV) / meanV : 0;
  const impactTau = fitResult.tauStdErr / tau;

  return [
    { name: 'V0', label: '初始电压 V₀', impact: Math.min(impactV0, 1), unit: 'V' },
    { name: 'Vs', label: '电源电压 Vₛ', impact: Math.min(impactVs, 1), unit: 'V' },
    { name: 'tau', label: '时间常数 τ', impact: Math.min(impactTau, 1), unit: 's' },
  ];
};
