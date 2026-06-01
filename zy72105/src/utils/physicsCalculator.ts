import type {
  CalculationNode,
  DataPoint,
  NoisePredictionResult,
  ThresholdConfig,
  Unit,
} from '../types';
import { convertUnit } from './unitConverter';

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const P_REF = 20e-6;
const RHO_AIR = 1.225;
const C_AIR = 343;

export const calculateTipFrequency = (
  rotorSpeed: number,
  bladeCount: number = 2,
  batchId: string
): CalculationNode => {
  const step = 1;
  const rpmHz = rotorSpeed / 60;
  const tipFreq = bladeCount * rpmHz;

  return {
    id: generateId(),
    batchId,
    timestamp: Date.now(),
    step,
    operation: '桨叶通过频率计算',
    input: { rotorSpeed, bladeCount },
    output: { tipFrequency: tipFreq },
    formula: 'f_tip = (N × Ω) / 60',
    operator: '老岑',
    note: `N=${bladeCount}桨叶, Ω=${rotorSpeed}RPM`,
  };
};

export const calculateThicknessNoise = (
  tipSpeed: number,
  rotorRadius: number,
  bladeCount: number,
  chord: number,
  distance: number = 10,
  batchId: string
): CalculationNode => {
  const step = 2;
  const machNumber = tipSpeed / C_AIR;
  const thicknessNoiseSPL =
    20 * Math.log10((machNumber * machNumber * rotorRadius * chord * bladeCount) / (distance * distance)) + 120;

  return {
    id: generateId(),
    batchId,
    timestamp: Date.now(),
    step,
    operation: '厚度噪声计算',
    input: { tipSpeed, rotorRadius, bladeCount, chord, distance },
    output: { thicknessNoise: thicknessNoiseSPL, machNumber },
    formula: 'SPL_thickness ∝ 20·log₁₀(M²·R·c·N / r²)',
    operator: '老岑',
    note: `M=${machNumber.toFixed(3)}马赫`,
  };
};

export const calculateLoadingNoise = (
  thrust: number,
  rotorRadius: number,
  tipSpeed: number,
  distance: number = 10,
  batchId: string
): CalculationNode => {
  const step = 3;
  const discArea = Math.PI * rotorRadius * rotorRadius;
  const pressureRms = thrust / discArea / Math.sqrt(2);
  const loadingNoiseSPL = 20 * Math.log10(pressureRms / P_REF) - 3;

  return {
    id: generateId(),
    batchId,
    timestamp: Date.now(),
    step,
    operation: '载荷噪声计算',
    input: { thrust, rotorRadius, tipSpeed, distance },
    output: { loadingNoise: loadingNoiseSPL, pressureRms },
    formula: 'SPL_loading = 10·log₁₀(p_rms² / p_ref²)',
    operator: '老岑',
    note: `p_ref=20μPa, 推力${thrust}N`,
  };
};

export const calculateBroadbandNoise = (
  tipSpeed: number,
  chord: number,
  batchId: string
): CalculationNode => {
  const step = 4;
  const machNumber = tipSpeed / C_AIR;
  const K = 50;
  const broadbandSPL = K + 50 * Math.log10(machNumber) + 20 * Math.log10(chord);

  return {
    id: generateId(),
    batchId,
    timestamp: Date.now(),
    step,
    operation: '宽带噪声计算',
    input: { tipSpeed, chord },
    output: { broadbandNoise: broadbandSPL, machNumber },
    formula: 'SPL_BB = K + 50·log₁₀(M) + 20·log₁₀(c)',
    operator: '老岑',
    note: `经验常数K=50dB`,
  };
};

const sumSoundLevels = (levels: number[]): number => {
  const sum = levels.reduce((acc, lvl) => acc + Math.pow(10, lvl / 10), 0);
  return 10 * Math.log10(sum);
};

export const calculateOverallNoise = (
  thicknessNode: CalculationNode,
  loadingNode: CalculationNode,
  broadbandNode: CalculationNode,
  batchId: string
): CalculationNode => {
  const step = 5;
  const thicknessNoise = thicknessNode.output.thicknessNoise as number;
  const loadingNoise = loadingNode.output.loadingNoise as number;
  const broadbandNoise = broadbandNode.output.broadbandNoise as number;

  const components = [thicknessNoise, loadingNoise, broadbandNoise];
  const overallSPL = sumSoundLevels(components);

  return {
    id: generateId(),
    batchId,
    timestamp: Date.now(),
    step,
    operation: '总噪声级合成',
    input: { thicknessNoise, loadingNoise, broadbandNoise },
    output: { overallSPL, components },
    formula: 'SPL_total = 10·log₁₀(Σ10^(SPL_i/10))',
    operator: '老岑',
    note: '对数叠加法则',
  };
};

export const calculateHarmonicComponents = (
  fundamental: number,
  harmonicCount: number = 5,
  batchId: string
): CalculationNode => {
  const step = 6;
  const harmonics: number[] = [];
  for (let i = 1; i <= harmonicCount; i++) {
    const decay = 20 * Math.log10(i) + 3;
    harmonics.push(fundamental - decay);
  }

  return {
    id: generateId(),
    batchId,
    timestamp: Date.now(),
    step,
    operation: '谐波分量计算',
    input: { fundamental, harmonicCount },
    output: { harmonics },
    formula: 'SPL_n = SPL_fundamental - 20·log₁₀(n) - 3dB',
    operator: '老岑',
    note: `${harmonicCount}次谐波衰减`,
  };
};

export const calculateDirectionalityIndex = (
  azimuth: number,
  elevation: number,
  batchId: string
): CalculationNode => {
  const step = 7;
  const azimuthRad = (azimuth * Math.PI) / 180;
  const elevationRad = (elevation * Math.PI) / 180;

  const directivity =
    Math.abs(Math.cos(azimuthRad)) *
    (1 + 0.5 * Math.abs(Math.cos(elevationRad)));
  const di = 10 * Math.log10(directivity + 0.1);

  return {
    id: generateId(),
    batchId,
    timestamp: Date.now(),
    step,
    operation: '指向性指数计算',
    input: { azimuth, elevation },
    output: { directionalityIndex: di, directivity },
    formula: 'DI = 10·log₁₀(|cos(θ)| · (1 + 0.5|cos(φ)|) + 0.1)',
    operator: '老岑',
    note: `方位角${azimuth}°, 仰角${elevation}°`,
  };
};

export const assessNoiseLevel = (
  noiseLevel: number,
  config: ThresholdConfig,
  batchId: string
): CalculationNode => {
  const step = 8;
  let assessment: 'normal' | 'warning' | 'critical' = 'normal';
  let recommendations: string[] = [];

  if (noiseLevel >= config.noiseCritical) {
    assessment = 'critical';
    recommendations = [
      '噪声超过临界阈值，建议立即停飞检查',
      '检查旋翼平衡状态，必要时进行动平衡校正',
      '检查桨叶安装扭矩是否符合规范',
      '考虑更换磨损严重的轴承',
    ];
  } else if (noiseLevel >= config.noiseWarning) {
    assessment = 'warning';
    recommendations = [
      '噪声接近警告阈值，建议增加检查频率',
      '检查旋翼表面是否有损伤',
      '确认桨叶角度是否一致',
    ];
  } else {
    assessment = 'normal';
    recommendations = ['噪声水平正常，按常规维护计划检查即可'];
  }

  return {
    id: generateId(),
    batchId,
    timestamp: Date.now(),
    step,
    operation: '噪声等级评估',
    input: { noiseLevel, warningThreshold: config.noiseWarning, criticalThreshold: config.noiseCritical },
    output: { assessment, recommendations },
    formula: `临界: ${config.noiseCritical}dB, 警告: ${config.noiseWarning}dB`,
    operator: '老岑',
    note: `评估结果: ${assessment === 'normal' ? '正常' : assessment === 'warning' ? '警告' : '严重'}`,
  };
};

export interface CalculationInput {
  batchId: string;
  dataPoints: DataPoint[];
  rotorSpeed: number;
  thrust: number;
  rotorRadius: number;
  bladeCount: number;
  chord: number;
  azimuth?: number;
  elevation?: number;
  config: ThresholdConfig;
}

export const performFullCalculation = (
  input: CalculationInput
): {
  chain: CalculationNode[];
  result: NoisePredictionResult;
} => {
  const { batchId, rotorSpeed, thrust, rotorRadius, bladeCount, chord, azimuth = 0, elevation = 0, config } = input;

  const tipSpeed = (rotorSpeed * 2 * Math.PI * rotorRadius) / 60;
  const tipFreqNode = calculateTipFrequency(rotorSpeed, bladeCount, batchId);
  const thicknessNode = calculateThicknessNoise(tipSpeed, rotorRadius, bladeCount, chord, 10, batchId);
  const loadingNode = calculateLoadingNoise(thrust, rotorRadius, tipSpeed, 10, batchId);
  const broadbandNode = calculateBroadbandNoise(tipSpeed, chord, batchId);
  const overallNode = calculateOverallNoise(thicknessNode, loadingNode, broadbandNode, batchId);
  const harmonicsNode = calculateHarmonicComponents(overallNode.output.overallSPL as number, 5, batchId);
  const directivityNode = calculateDirectionalityIndex(azimuth, elevation, batchId);
  const assessmentNode = assessNoiseLevel(overallNode.output.overallSPL as number, config, batchId);

  const chain = [
    tipFreqNode,
    thicknessNode,
    loadingNode,
    broadbandNode,
    overallNode,
    harmonicsNode,
    directivityNode,
    assessmentNode,
  ];

  const avgConfidence = input.dataPoints.reduce((sum, dp) => sum + dp.confidence, 0) / input.dataPoints.length;

  const result: NoisePredictionResult = {
    overallNoiseLevel: overallNode.output.overallSPL as number,
    unit: 'dB' as Unit,
    dominantFrequency: tipFreqNode.output.tipFrequency as number,
    harmonicComponents: harmonicsNode.output.harmonics as number[],
    directionalityIndex: directivityNode.output.directionalityIndex as number,
    confidenceLevel: avgConfidence,
    assessment: assessmentNode.output.assessment as 'normal' | 'warning' | 'critical',
    recommendations: assessmentNode.output.recommendations as string[],
  };

  return { chain, result };
};

export const normalizeDataPointsToDB = (dataPoints: DataPoint[]): { points: DataPoint[]; conversions: unknown[] } => {
  const conversions: unknown[] = [];
  const points = dataPoints.map((dp) => {
    if (dp.unit === 'dB') return dp;
    if (dp.unit === 'dBA' || dp.unit === 'dBm') {
      const conversion = convertUnit(dp.value, dp.unit, 'dB');
      conversions.push(conversion);
      return { ...dp, value: conversion.toValue, unit: 'dB' as Unit };
    }
    return dp;
  });
  return { points, conversions };
};
