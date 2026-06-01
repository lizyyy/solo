import type { FittingResult, ProcessedData } from '../types';

export const calculateWeightClosure = (
  fittingPoints: { stress: number; life: number; predictedLife: number; residual: number }[]
): { value: number; status: 'normal' | 'warning' | 'error'; message: string } => {
  if (fittingPoints.length < 3) {
    return {
      value: 0,
      status: 'error',
      message: '数据点不足，无法计算权重闭合度',
    };
  }

  const maxStress = Math.max(...fittingPoints.map(p => p.stress));
  const minStress = Math.min(...fittingPoints.map(p => p.stress));

  const weights = fittingPoints.map(p => {
    const normalized = (p.stress - minStress) / (maxStress - minStress + 1e-10);
    return 0.5 + normalized * 0.5;
  });

  const weightedSum = fittingPoints.reduce((sum, p, i) => sum + weights[i] * p.residual * p.residual, 0);
  const plainSum = fittingPoints.reduce((sum, p) => sum + p.residual * p.residual, 0);

  const weightClosure = plainSum > 0 ? 1 - weightedSum / plainSum : 1;

  let status: 'normal' | 'warning' | 'error' = 'normal';
  let message = '';

  if (weightClosure >= 0.85) {
    status = 'normal';
    message = `权重闭合度${weightClosure.toFixed(3)}，拟合效果良好，高应力区残差控制得当`;
  } else if (weightClosure >= 0.7) {
    status = 'warning';
    message = `权重闭合度${weightClosure.toFixed(3)}，拟合效果一般，建议检查高应力区数据点是否存在异常`;
  } else {
    status = 'error';
    message = `权重闭合度${weightClosure.toFixed(3)}，拟合效果较差，高应力区权重未收敛，建议剔除异常值后重新拟合`;
  }

  return { value: weightClosure, status, message };
};

export const checkBoundaryThreshold = (
  data: ProcessedData[],
  fittingResult: FittingResult,
  config?: { yieldStrength?: number; tensileStrength?: number }
): { 
  minStress: number; 
  maxStress: number; 
  outOfBounds: string[];
  status: 'normal' | 'warning' | 'error';
  message: string;
} => {
  const yieldStrength = config?.yieldStrength || 980;
  const tensileStrength = config?.tensileStrength || 1100;
  
  const minStressBoundary = 0.1 * yieldStrength;
  const maxStressBoundary = 0.9 * tensileStrength;
  const minLifeBoundary = 1e3;
  const maxLifeBoundary = 1e7;

  const outOfBounds: string[] = [];

  data.forEach(item => {
    if (item.stressConverted !== null) {
      if (item.stressConverted < minStressBoundary) {
        outOfBounds.push(`${item.id}：应力${item.stressConverted}MPa低于下限${minStressBoundary}MPa(0.1σ_s)`);
      }
      if (item.stressConverted > maxStressBoundary) {
        outOfBounds.push(`${item.id}：应力${item.stressConverted}MPa高于上限${maxStressBoundary}MPa(0.9σ_b)`);
      }
    }
    if (item.lifeConverted !== null) {
      if (item.lifeConverted < minLifeBoundary) {
        outOfBounds.push(`${item.id}：寿命${item.lifeConverted}次低于下限${minLifeBoundary}次，属于低周疲劳区`);
      }
      if (item.lifeConverted > maxLifeBoundary) {
        outOfBounds.push(`${item.id}：寿命${item.lifeConverted.toExponential(2)}次高于上限${maxLifeBoundary.toExponential(2)}次，属于超长寿命区`);
      }
    }
  });

  const validPoints = fittingResult.points.filter(p => 
    p.stress >= minStressBoundary && p.stress <= maxStressBoundary
  );

  let status: 'normal' | 'warning' | 'error' = 'normal';
  let message = '';

  if (outOfBounds.length === 0) {
    status = 'normal';
    message = `所有数据点均在边界范围内，应力范围${minStressBoundary}-${maxStressBoundary}MPa，寿命范围${minLifeBoundary.toExponential(0)}-${maxLifeBoundary.toExponential(0)}次`;
  } else if (outOfBounds.length <= 2) {
    status = 'warning';
    message = `检测到${outOfBounds.length}条数据超出边界阈值，请确认是否保留这些数据用于拟合`;
  } else {
    status = 'error';
    message = `检测到${outOfBounds.length}条数据超出边界阈值，建议先处理边界问题后再进行拟合`;
  }

  return {
    minStress: minStressBoundary,
    maxStress: maxStressBoundary,
    outOfBounds,
    status,
    message,
  };
};

export const calculateConfidenceInterval = (
  fittingPoints: { stress: number; life: number; predictedLife: number }[],
  confidenceLevel: number = 0.95
): { lower: (stress: number) => number; upper: (stress: number) => number } => {
  const residuals = fittingPoints.map(p => Math.log10(p.life) - Math.log10(p.predictedLife));
  const meanResidual = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const stdResidual = Math.sqrt(
    residuals.reduce((sum, r) => sum + (r - meanResidual) ** 2, 0) / (residuals.length - 2)
  );

  const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.645;
  const margin = zScore * stdResidual;

  return {
    lower: (stress: number) => {
      const predicted = fittingPoints.find(p => Math.abs(p.stress - stress) < 1)?.predictedLife;
      if (!predicted) return 0;
      return Math.pow(10, Math.log10(predicted) - margin);
    },
    upper: (stress: number) => {
      const predicted = fittingPoints.find(p => Math.abs(p.stress - stress) < 1)?.predictedLife;
      if (!predicted) return 0;
      return Math.pow(10, Math.log10(predicted) + margin);
    },
  };
};

export const getWeightClosureStatus = (value: number): { color: string; label: string } => {
  if (value >= 0.85) {
    return { color: '#43a047', label: '正常' };
  } else if (value >= 0.7) {
    return { color: '#ff7043', label: '警告' };
  } else {
    return { color: '#e53935', label: '异常' };
  }
};

export const getBoundaryStatusColor = (status: 'normal' | 'warning' | 'error'): string => {
  const colors = {
    normal: '#43a047',
    warning: '#ff7043',
    error: '#e53935',
  };
  return colors[status];
};
