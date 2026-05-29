import * as math from 'mathjs';
import type { DataPoint, FittingParams, FittingResult, ResidualPoint, CalculationStep, IndependentVariable } from '@/types';
import { convertThrust, inchToMeter } from './units';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const squaredDiffs = values.map(v => Math.pow(v - m, 2));
  return Math.sqrt(mean(squaredDiffs));
}

export function zScore(value: number, values: number[]): number {
  const m = mean(values);
  const sd = standardDeviation(values);
  if (sd === 0) return 0;
  return (value - m) / sd;
}

export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const ssResidual = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);

  const rSquared = 1 - (ssResidual / ssTotal);

  return { slope, intercept, rSquared };
}

export function polynomialRegression(x: number[], y: number[], degree: number): { coefficients: number[]; rSquared: number } {
  const n = x.length;
  const X = math.zeros(n, degree + 1) as math.Matrix;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= degree; j++) {
      X.set([i, j], Math.pow(x[i], j));
    }
  }

  const Y = math.matrix(y);
  const Xt = math.transpose(X);
  const XtX = math.multiply(Xt, X);
  const XtY = math.multiply(Xt, Y);
  const coefficientsArray = (math.multiply(math.inv(XtX), XtY) as math.Matrix).toArray() as number[];

  const yMean = mean(y);
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  let ssResidual = 0;

  for (let i = 0; i < n; i++) {
    let predicted = 0;
    for (let j = 0; j <= degree; j++) {
      predicted += coefficientsArray[j] * Math.pow(x[i], j);
    }
    ssResidual += Math.pow(y[i] - predicted, 2);
  }

  const rSquared = 1 - (ssResidual / ssTotal);

  return { coefficients: coefficientsArray, rSquared };
}

export function powerRegression(x: number[], y: number[]): { a: number; b: number; rSquared: number } {
  const logX = x.map(v => Math.log(v));
  const logY = y.map(v => Math.log(v));

  const result = linearRegression(logX, logY);
  const b = result.slope;
  const a = Math.exp(result.intercept);

  const yMean = mean(y);
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  let ssResidual = 0;

  for (let i = 0; i < x.length; i++) {
    const predicted = a * Math.pow(x[i], b);
    ssResidual += Math.pow(y[i] - predicted, 2);
  }

  const rSquared = 1 - (ssResidual / ssTotal);

  return { a, b, rSquared };
}

export function calculateAdjustedRSquared(rSquared: number, n: number, k: number): number {
  if (n - k - 1 <= 0) return rSquared;
  return 1 - ((1 - rSquared) * ((n - 1) / (n - k - 1)));
}

export function predictValue(x: number, coefficients: number[], fitType: string, powerA?: number, powerB?: number): number {
  if (fitType === 'power' && powerA !== undefined && powerB !== undefined) {
    return powerA * Math.pow(x, powerB);
  }

  let result = 0;
  for (let i = 0; i < coefficients.length; i++) {
    result += coefficients[i] * Math.pow(x, i);
  }
  return result;
}

export function buildFormulaString(coefficients: number[], fitType: string, powerA?: number, powerB?: number): string {
  if (fitType === 'power' && powerA !== undefined && powerB !== undefined) {
    return `T = ${powerA.toFixed(6)} × x^${powerB.toFixed(4)}`;
  }

  let formula = 'T = ';
  for (let i = coefficients.length - 1; i >= 0; i--) {
    const coef = coefficients[i];
    if (i === coefficients.length - 1 && coef === 0) continue;

    if (i > 0 && coef !== 0) {
      if (formula !== 'T = ') {
        formula += coef >= 0 ? ' + ' : ' - ';
      } else if (coef < 0) {
        formula += '-';
      }
      const absCoef = Math.abs(coef);
      if (i === 1) {
        formula += `${absCoef.toFixed(4)}x`;
      } else {
        formula += `${absCoef.toFixed(4)}x^${i}`;
      }
    } else if (i === 0 && coef !== 0) {
      if (formula !== 'T = ') {
        formula += coef >= 0 ? ' + ' : ' - ';
      } else if (coef < 0) {
        formula += '-';
      }
      formula += `${Math.abs(coef).toFixed(4)}`;
    }
  }
  return formula === 'T = ' ? 'T = 0' : formula;
}

export function calculateImpactFactors(
  dataPoints: DataPoint[],
  params: FittingParams
): { rpm: number; voltage: number; propellerDiameter: number } {
  const validPoints = dataPoints.filter(d => !d.isExcluded);

  const thrusts = validPoints.map(d => convertThrust(d.thrust, d.thrustUnit, params.thrustUnit));

  const rpms = validPoints.map(d => d.rpm);
  const voltages = validPoints.map(d => d.voltage);
  const diameters = validPoints.map(d => d.propellerDiameter);

  const { rSquared: rpmR2 } = linearRegression(rpms, thrusts);
  const { rSquared: voltageR2 } = linearRegression(voltages, thrusts);
  const { rSquared: diameterR2 } = linearRegression(diameters, thrusts);

  const total = Math.abs(rpmR2) + Math.abs(voltageR2) + Math.abs(diameterR2);

  return {
    rpm: Math.abs(rpmR2) / total,
    voltage: Math.abs(voltageR2) / total,
    propellerDiameter: Math.abs(diameterR2) / total,
  };
}

export function performFitting(
  dataPoints: DataPoint[],
  params: FittingParams,
  independentVar: IndependentVariable
): FittingResult | null {
  const validPoints = dataPoints.filter(d => !d.isExcluded);

  if (validPoints.length < params.polynomialDegree + 2) {
    return null;
  }

  const x: number[] = [];
  const y: number[] = [];
  const calculationSteps: CalculationStep[] = [];

  validPoints.forEach((point, index) => {
    let xVal: number;
    switch (independentVar) {
      case 'rpm':
        xVal = point.rpm;
        break;
      case 'voltage':
        xVal = point.voltage;
        break;
      case 'propellerDiameter':
        xVal = point.propellerDiameter;
        break;
      default:
        xVal = point.rpm;
    }
    const thrustVal = convertThrust(point.thrust, point.thrustUnit, params.thrustUnit);
    x.push(xVal);
    y.push(thrustVal);

    calculationSteps.push({
      step: index + 1,
      description: `数据点 ${index + 1}: 转换推力单位`,
      formula: `T_${index + 1} = ${point.thrust} ${point.thrustUnit} → ${thrustVal.toFixed(6)} ${params.thrustUnit}`,
      variables: {
        originalValue: point.thrust,
        convertedValue: thrustVal,
      },
      result: thrustVal,
    });
  });

  calculationSteps.push({
    step: calculationSteps.length + 1,
    description: '构造设计矩阵 X',
    formula: 'X[i,j] = x[i]^j',
    variables: { degree: params.polynomialDegree, numPoints: x.length },
    result: x.length,
  });

  let coefficients: number[] = [];
  let rSquared = 0;
  let powerResult: { a: number; b: number } | null = null;

  if (params.fitType === 'power') {
    const pr = powerRegression(x, y);
    coefficients = [Math.log(pr.a), pr.b];
    rSquared = pr.rSquared;
    powerResult = pr;

    calculationSteps.push({
      step: calculationSteps.length + 1,
      description: '幂函数拟合求解',
      formula: 'y = a * x^b',
      variables: { a: pr.a, b: pr.b },
      result: pr.a,
    });
  } else if (params.fitType === 'linear') {
    const result = linearRegression(x, y);
    coefficients = [result.intercept, result.slope];
    rSquared = result.rSquared;

    calculationSteps.push({
      step: calculationSteps.length + 1,
      description: '线性拟合求解',
      formula: 'y = a + b*x',
      variables: { intercept: result.intercept, slope: result.slope },
      result: result.slope,
    });
  } else {
    const result = polynomialRegression(x, y, params.polynomialDegree);
    coefficients = result.coefficients;
    rSquared = result.rSquared;

    calculationSteps.push({
      step: calculationSteps.length + 1,
      description: '多项式拟合求解',
      formula: 'A = (XᵀX)⁻¹XᵀY',
      variables: { degree: params.polynomialDegree },
      result: coefficients[0],
    });
  }

  const adjustedRSquared = calculateAdjustedRSquared(rSquared, x.length, coefficients.length - 1);

  const ssTot = y.reduce((s, yi) => s + Math.pow(yi - mean(y), 2), 0);
  const ssRes = (1 - rSquared) * ssTot;

  calculationSteps.push({
    step: calculationSteps.length + 1,
    description: '计算决定系数 R²',
    formula: 'R² = 1 - SS_res / SS_tot',
    variables: { SS_res: ssRes, SS_tot: ssTot },
    result: rSquared,
  });

  calculationSteps.push({
    step: calculationSteps.length + 1,
    description: '计算调整后的 R²',
    formula: 'R²_adj = 1 - (1-R²)(n-1)/(n-k-1)',
    variables: { n: x.length, k: coefficients.length - 1 },
    result: adjustedRSquared,
  });

  const residuals: ResidualPoint[] = [];
  const residualValues: number[] = [];

  for (let i = 0; i < x.length; i++) {
    let predicted: number;
    if (params.fitType === 'power' && powerResult) {
      predicted = predictValue(x[i], coefficients, params.fitType, powerResult.a, powerResult.b);
    } else {
      predicted = predictValue(x[i], coefficients, params.fitType);
    }
    const residual = y[i] - predicted;
    residualValues.push(residual);
    residuals.push({
      x: x[i],
      observed: y[i],
      predicted,
      residual,
      standardizedResidual: 0,
    });
  }

  const residualStd = standardDeviation(residualValues);
  residuals.forEach(r => {
    r.standardizedResidual = residualStd > 0 ? r.residual / residualStd : 0;
  });

  const impactFactors = calculateImpactFactors(validPoints, params);

  const formula = buildFormulaString(
    coefficients,
    params.fitType,
    powerResult?.a,
    powerResult?.b
  );

  calculationSteps.push({
    step: calculationSteps.length + 1,
    description: '影响因子分析',
    formula: '影响因子 = R² / (R²_rpm + R²_voltage + R²_diameter)',
    variables: impactFactors,
    result: impactFactors.rpm,
  });

  return {
    formula,
    coefficients,
    rSquared,
    adjustedRSquared,
    residuals,
    confidenceInterval: 1.96 * residualStd,
    impactFactors,
    calculationSteps,
  };
}

export function calculateEfficiency(
  dataPoints: DataPoint[],
  airDensity: number,
  targetThrustUnit: string
) {
  const validPoints = dataPoints.filter(d => !d.isExcluded);
  const calculationSteps: CalculationStep[] = [];

  const firstDiameter = validPoints[0]?.propellerDiameter || 0;
  const firstDiameterM = inchToMeter(firstDiameter);
  const firstArea = Math.PI * Math.pow(firstDiameterM / 2, 2);

  calculationSteps.push({
    step: 1,
    description: '计算桨盘面积',
    formula: 'A = π * (D/2)²',
    variables: { diameter_inch: firstDiameter, diameter_m: firstDiameterM, area: firstArea },
    result: firstArea,
  });

  const efficiencyCurve = validPoints.map((point, index) => {
    const diameterM = inchToMeter(point.propellerDiameter);
    const area = Math.PI * Math.pow(diameterM / 2, 2);

    const powerIn = point.voltage * point.current;
    const thrustN = convertThrust(point.thrust, point.thrustUnit, 'N');

    const inducedVelocity = Math.sqrt((2 * thrustN) / (airDensity * area));
    const thrustPower = thrustN * inducedVelocity;
    const efficiency = powerIn > 0 ? (thrustPower / powerIn) * 100 : 0;

    if (index === 0) {
      calculationSteps.push({
        step: 2,
        description: '计算诱导速度',
        formula: 'v = √(2T/(ρA))',
        variables: { T: thrustN, rho: airDensity, A: area },
        result: inducedVelocity,
      });

      calculationSteps.push({
        step: 3,
        description: '计算推进效率',
        formula: 'η = (T * v / (V * I)) * 100%',
        variables: { T: thrustN, v: inducedVelocity, V: point.voltage, I: point.current, P_in: powerIn, P_thrust: thrustPower },
        result: efficiency,
      });
    }

    return {
      rpm: point.rpm,
      power: powerIn,
      thrust: convertThrust(point.thrust, point.thrustUnit, targetThrustUnit as any),
      efficiency,
      thrustPower,
    };
  });

  const sortedByEfficiency = [...efficiencyCurve].sort((a, b) => b.efficiency - a.efficiency);
  const optimalPoint = sortedByEfficiency[0] || { rpm: 0, thrust: 0, efficiency: 0, power: 0, thrustPower: 0 };

  const maxEfficiency = optimalPoint.efficiency;
  const minEfficiencyThreshold = maxEfficiency * 0.8;

  const efficientPoints = efficiencyCurve.filter(p => p.efficiency >= minEfficiencyThreshold);
  const rpmValues = efficientPoints.map(p => p.rpm);

  const efficientRange = {
    minRpm: rpmValues.length > 0 ? Math.min(...rpmValues) : 0,
    maxRpm: rpmValues.length > 0 ? Math.max(...rpmValues) : 0,
    minEfficiency: minEfficiencyThreshold,
  };

  return {
    efficiencyCurve,
    optimalOperatingPoint: {
      rpm: optimalPoint.rpm,
      thrust: optimalPoint.thrust,
      efficiency: optimalPoint.efficiency,
      power: optimalPoint.power,
    },
    efficientRange,
    calculationSteps,
  };
}
