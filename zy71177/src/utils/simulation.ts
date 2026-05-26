import { WaterQuality, Level, LevelParameters } from '../types';

export const calculateOptimalDose = (
  currentQuality: Omit<WaterQuality, 'timestamp'>,
  targetThresholds: Omit<WaterQuality, 'timestamp'>,
  params: LevelParameters
): number => {
  const codReduction = Math.max(0, currentQuality.cod - targetThresholds.cod);
  const nh3nReduction = Math.max(0, currentQuality.nh3n - targetThresholds.nh3n);
  const tpReduction = Math.max(0, currentQuality.tp - targetThresholds.tp);

  const codDose = codReduction * params.optimalDosePerUnit.cod;
  const nh3nDose = nh3nReduction * params.optimalDosePerUnit.nh3n;
  const tpDose = tpReduction * params.optimalDosePerUnit.tp;

  return Math.ceil(Math.max(codDose, nh3nDose, tpDose));
};

export const applyChemicalTreatment = (
  currentQuality: WaterQuality,
  chemicalAmount: number,
  optimalDose: number,
  params: LevelParameters
): WaterQuality => {
  const doseRatio = Math.min(chemicalAmount / Math.max(optimalDose, 1), 1.5);
  const efficiency = params.chemicalEfficiency * doseRatio;

  return {
    cod: currentQuality.cod * (1 - efficiency * 0.7),
    nh3n: currentQuality.nh3n * (1 - efficiency * 0.8),
    tp: currentQuality.tp * (1 - efficiency * 0.9),
    ph: currentQuality.ph + (Math.random() - 0.5) * 0.2,
    timestamp: Date.now()
  };
};

export const applyStirringEffect = (
  quality: WaterQuality,
  stirringTime: number,
  minStirringTime: number
): WaterQuality => {
  const stirringEffect = Math.min(stirringTime / minStirringTime, 1);
  
  return {
    cod: quality.cod * (1 - stirringEffect * 0.2),
    nh3n: quality.nh3n * (1 - stirringEffect * 0.15),
    tp: quality.tp * (1 - stirringEffect * 0.25),
    ph: quality.ph + (Math.random() - 0.5) * 0.1,
    timestamp: Date.now()
  };
};

export const calculateRebound = (
  quality: WaterQuality,
  chemicalAmount: number,
  optimalDose: number,
  params: LevelParameters
): WaterQuality => {
  if (params.reboundFactor === 0 || chemicalAmount <= optimalDose) {
    return { ...quality, timestamp: Date.now() };
  }

  const overdoseRatio = (chemicalAmount - optimalDose) / Math.max(optimalDose, 1);
  const reboundAmount = params.reboundFactor * Math.min(overdoseRatio, 1);

  return {
    cod: quality.cod * (1 + reboundAmount * 0.5),
    nh3n: quality.nh3n * (1 + reboundAmount * 0.6),
    tp: quality.tp * (1 + reboundAmount * 0.4),
    ph: quality.ph,
    timestamp: Date.now()
  };
};

export const applyIncomingWaterVariation = (
  quality: WaterQuality,
  params: LevelParameters
): WaterQuality => {
  const variation = params.incomingWaterVariation;
  
  return {
    cod: quality.cod * (1 + (Math.random() - 0.3) * variation),
    nh3n: quality.nh3n * (1 + (Math.random() - 0.3) * variation),
    tp: quality.tp * (1 + (Math.random() - 0.3) * variation),
    ph: quality.ph + (Math.random() - 0.5) * 0.3,
    timestamp: Date.now()
  };
};

export const checkThresholds = (
  quality: Omit<WaterQuality, 'timestamp'>,
  thresholds: Omit<WaterQuality, 'timestamp'>
): { passed: boolean; failedParams: string[] } => {
  const failedParams: string[] = [];

  if (quality.cod > thresholds.cod) failedParams.push('COD');
  if (quality.nh3n > thresholds.nh3n) failedParams.push('氨氮');
  if (quality.tp > thresholds.tp) failedParams.push('总磷');
  if (quality.ph < 6 || quality.ph > 9) failedParams.push('pH');

  return {
    passed: failedParams.length === 0,
    failedParams
  };
};

export const getWaterQualityColor = (
  quality: Omit<WaterQuality, 'timestamp'>,
  thresholds: Omit<WaterQuality, 'timestamp'>
): string => {
  const codRatio = quality.cod / thresholds.cod;
  const nh3nRatio = quality.nh3n / thresholds.nh3n;
  const tpRatio = quality.tp / thresholds.tp;
  const maxRatio = Math.max(codRatio, nh3nRatio, tpRatio);

  if (maxRatio <= 0.5) return '#4ade80';
  if (maxRatio <= 0.8) return '#22c55e';
  if (maxRatio <= 1) return '#fbbf24';
  if (maxRatio <= 1.5) return '#f97316';
  return '#ef4444';
};

export const formatNumber = (num: number, decimals: number = 1): string => {
  return num.toFixed(decimals);
};
