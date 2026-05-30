import { DrugParams, DosingRegimen } from '../types/simulation';

export const calculateEliminationRate = (halfLife: number): number => {
  return Math.LN2 / halfLife;
};

export const calculateInitialConcentration = (
  dose: number,
  volumeOfDistribution: number
): number => {
  return dose / volumeOfDistribution;
};

export const calculateConcentrationAtTime = (
  initialConcentration: number,
  eliminationRate: number,
  time: number
): number => {
  return initialConcentration * Math.exp(-eliminationRate * time);
};

export const calculateSteadyStateConcentration = (
  dose: number,
  volumeOfDistribution: number,
  interval: number,
  eliminationRate: number
): number => {
  if (interval === 0) return dose / volumeOfDistribution;
  const fraction = 1 - Math.exp(-eliminationRate * interval);
  return (dose / volumeOfDistribution) / fraction;
};

export const calculateTimeToSteadyState = (halfLife: number): number => {
  return halfLife * 5;
};

export const calculatePeakConcentration = (
  dose: number,
  volumeOfDistribution: number,
  interval: number,
  eliminationRate: number,
  dosesCount: number
): number => {
  const tau = interval;
  const k = eliminationRate;
  const C0 = dose / volumeOfDistribution;
  
  if (tau === 0) return C0 * dosesCount;
  
  const accumulationFactor = (1 - Math.exp(-k * tau * dosesCount)) / (1 - Math.exp(-k * tau));
  return C0 * accumulationFactor;
};

export const calculateTroughConcentration = (
  peakConcentration: number,
  eliminationRate: number,
  interval: number
): number => {
  return peakConcentration * Math.exp(-eliminationRate * interval);
};

export const convertConcentration = (
  value: number,
  fromUnit: string,
  toUnit: string
): number => {
  const conversionFactors: Record<string, number> = {
    'mg/L': 1,
    'μg/mL': 1,
    'ng/mL': 1000,
  };
  
  const fromFactor = conversionFactors[fromUnit] || 1;
  const toFactor = conversionFactors[toUnit] || 1;
  
  return value * (fromFactor / toFactor);
};

export const checkDoseHalfLifeConsistency = (
  drug: DrugParams,
  dosing: DosingRegimen
): { consistent: boolean; evidence: string } => {
  const k = calculateEliminationRate(drug.halfLife);
  const expectedInterval = drug.halfLife;
  const actualInterval = dosing.interval;
  
  const ratio = actualInterval / expectedInterval;
  
  if (actualInterval === 0) {
    return {
      consistent: false,
      evidence: '给药间隔为0，药物持续输注或推注，可能导致浓度快速累积'
    };
  }
  
  if (ratio < 0.5 || ratio > 2) {
    return {
      consistent: false,
      evidence: `给药间隔(${actualInterval}h)与半衰期(${drug.halfLife}h)比值为${ratio.toFixed(2)}，偏离常规范围(0.5-2.0)`
    };
  }
  
  return {
    consistent: true,
    evidence: `给药间隔(${actualInterval}h)与半衰期(${drug.halfLife}h)匹配良好`
  };
};
