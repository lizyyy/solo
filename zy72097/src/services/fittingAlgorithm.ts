import type { ProcessedData, FittingResult, FittingPoint, FittingModel } from '../types';

const leastSquares = (x: number[], y: number[]): { a: number; b: number; r2: number } => {
  const n = x.length;
  if (n < 2) return { a: 0, b: 0, r2: 0 };

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-10) return { a: 0, b: 0, r2: 0 };

  const b = (n * sumXY - sumX * sumY) / denominator;
  const a = (sumY - b * sumX) / n;

  const yMean = sumY / n;
  const ssTotal = sumY2 - n * yMean * yMean;
  const ssResidual = sumY2 - a * sumY - b * sumXY;
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { a, b, r2 };
};

export const fitPowerLaw = (data: ProcessedData[]): Omit<FittingResult, 'weightClosure' | 'boundaryCheck'> => {
  const validData = data.filter(d => 
    d.stressConverted !== null && 
    d.lifeConverted !== null && 
    d.lifeConverted > 0 &&
    !d.isAnomaly
  );

  if (validData.length < 3) {
    return {
      model: 'power',
      formula: '数据不足，无法拟合',
      parameters: { a: 0, b: 0, r2: 0 },
      points: [],
    };
  }

  const x = validData.map(d => Math.log10(d.stressConverted!));
  const y = validData.map(d => Math.log10(d.lifeConverted!));

  const { a, b, r2 } = leastSquares(x, y);

  const C = Math.pow(10, a);
  const m = -b;

  const points: FittingPoint[] = validData.map(d => {
    const predictedLife = C * Math.pow(d.stressConverted!, -m);
    return {
      stress: d.stressConverted!,
      life: d.lifeConverted!,
      predictedLife,
      residual: d.lifeConverted! - predictedLife,
      dataId: d.id,
    };
  });

  return {
    model: 'power',
    formula: `N = ${C.toExponential(3)} × σ^(${-m.toFixed(3)})`,
    parameters: { a: C, b: m, r2 },
    points,
  };
};

export const fitExponential = (data: ProcessedData[]): Omit<FittingResult, 'weightClosure' | 'boundaryCheck'> => {
  const validData = data.filter(d => 
    d.stressConverted !== null && 
    d.lifeConverted !== null && 
    d.lifeConverted > 0 &&
    !d.isAnomaly
  );

  if (validData.length < 3) {
    return {
      model: 'exponential',
      formula: '数据不足，无法拟合',
      parameters: { a: 0, b: 0, r2: 0 },
      points: [],
    };
  }

  const x = validData.map(d => d.stressConverted!);
  const y = validData.map(d => Math.log(d.lifeConverted!));

  const { a, b, r2 } = leastSquares(x, y);

  const A = Math.exp(a);
  const B = b;

  const points: FittingPoint[] = validData.map(d => {
    const predictedLife = A * Math.exp(B * d.stressConverted!);
    return {
      stress: d.stressConverted!,
      life: d.lifeConverted!,
      predictedLife,
      residual: d.lifeConverted! - predictedLife,
      dataId: d.id,
    };
  });

  return {
    model: 'exponential',
    formula: `N = ${A.toExponential(3)} × exp(${B.toExponential(3)} × σ)`,
    parameters: { a: A, b: B, r2 },
    points,
  };
};

export const fitBasquin = (data: ProcessedData[]): Omit<FittingResult, 'weightClosure' | 'boundaryCheck'> => {
  const validData = data.filter(d => 
    d.stressConverted !== null && 
    d.lifeConverted !== null && 
    d.lifeConverted > 0 &&
    !d.isAnomaly
  );

  if (validData.length < 3) {
    return {
      model: 'basquin',
      formula: '数据不足，无法拟合',
      parameters: { a: 0, b: 0, r2: 0 },
      points: [],
    };
  }

  const x = validData.map(d => Math.log10(2 * d.lifeConverted!));
  const y = validData.map(d => Math.log10(d.stressConverted!));

  const { a, b, r2 } = leastSquares(x, y);

  const sigmaF = Math.pow(10, a);
  const bVal = b;

  const points: FittingPoint[] = validData.map(d => {
    const predictedLife = Math.pow(10, (Math.log10(d.stressConverted!) - a) / b) / 2;
    return {
      stress: d.stressConverted!,
      life: d.lifeConverted!,
      predictedLife,
      residual: d.lifeConverted! - predictedLife,
      dataId: d.id,
    };
  });

  return {
    model: 'basquin',
    formula: `σ_a = ${sigmaF.toFixed(1)} × (2N_f)^(${bVal.toFixed(3)})`,
    parameters: { a: sigmaF, b: bVal, r2 },
    points,
  };
};

export const fitModel = (data: ProcessedData[], model: FittingModel): Omit<FittingResult, 'weightClosure' | 'boundaryCheck'> => {
  switch (model) {
    case 'power':
      return fitPowerLaw(data);
    case 'exponential':
      return fitExponential(data);
    case 'basquin':
      return fitBasquin(data);
    default:
      return fitPowerLaw(data);
  }
};

export const getModelDescription = (model: FittingModel): { name: string; description: string; formula: string } => {
  const descriptions = {
    power: {
      name: '幂函数模型',
      description: '最常用的S-N曲线模型，适用于多数金属材料的高周疲劳，形式为σ^m × N = C',
      formula: 'σ^m · N = C',
    },
    exponential: {
      name: '指数函数模型',
      description: '适用于应力范围较窄的情况，形式为N = A × exp(B×σ)',
      formula: 'N = A · e^(B·σ)',
    },
    basquin: {
      name: 'Basquin模型',
      description: '基于应变疲劳理论，适用于高周疲劳，形式为σ_a = σ\'_f × (2N_f)^b',
      formula: 'σ_a = σ\'_f · (2N_f)^b',
    },
  };
  return descriptions[model];
};

export const suggestBestModel = (data: ProcessedData[]): { model: FittingModel; reason: string } => {
  const powerResult = fitPowerLaw(data);
  const expResult = fitExponential(data);
  const basquinResult = fitBasquin(data);

  const results = [
    { model: 'power' as FittingModel, r2: powerResult.parameters.r2 },
    { model: 'exponential' as FittingModel, r2: expResult.parameters.r2 },
    { model: 'basquin' as FittingModel, r2: basquinResult.parameters.r2 },
  ];

  const best = results.reduce((a, b) => a.r2 > b.r2 ? a : b);

  const modelNames: Record<FittingModel, string> = {
    power: '幂函数模型',
    exponential: '指数函数模型',
    basquin: 'Basquin模型',
  };

  return {
    model: best.model,
    reason: `根据R²决定系数，${modelNames[best.model]}的拟合优度最高(R²=${best.r2.toFixed(4)})，建议使用该模型进行疲劳寿命预测。`,
  };
};

export const predictLife = (
  stress: number,
  model: FittingModel,
  parameters: { a: number; b: number }
): number => {
  switch (model) {
    case 'power':
      return parameters.a * Math.pow(stress, -parameters.b);
    case 'exponential':
      return parameters.a * Math.exp(parameters.b * stress);
    case 'basquin':
      return Math.pow(10, (Math.log10(stress) - Math.log10(parameters.a)) / parameters.b) / 2;
    default:
      return 0;
  }
};
