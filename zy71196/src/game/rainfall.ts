import type { RoofMap, LeakPoint, LowArea, Drain } from './types';
import { GAME_CONSTANTS } from './config';

const generateId = (): string => Math.random().toString(36).substring(2, 9);

export const calculateWaterIncrease = (rainfallIntensity: number): number => {
  const baseIncrease = (rainfallIntensity / 100) * GAME_CONSTANTS.WATER_LEVEL_PER_RAIN;
  const randomFactor = 0.8 + Math.random() * 0.4;
  return Math.floor(baseIncrease * randomFactor);
};

export const getEffectiveFlowRate = (drain: Drain): number => {
  if (!drain.isBlocked) {
    return drain.flowRate;
  }
  const blockageFactor = 1 - (drain.blockageSeverity / 100) * GAME_CONSTANTS.BLOCKED_FLOW_PENALTY;
  return drain.flowRate * blockageFactor;
};

export const calculateDrainDrainage = (drain: Drain, rainfallIntensity: number): number => {
  const effectiveFlow = getEffectiveFlowRate(drain);
  const rainFactor = rainfallIntensity / 100;
  return Math.floor(effectiveFlow * rainFactor);
};

export const simulateRainfall = (
  roofMap: RoofMap,
  rainfallIntensity: number,
  currentRound: number
): {
  updatedRoofMap: RoofMap;
  newLeaks: LeakPoint[];
  totalWaterIncreased: number;
} => {
  const waterIncrease = calculateWaterIncrease(rainfallIntensity);
  let totalWaterIncreased = 0;
  const newLeaks: LeakPoint[] = [];

  const updatedLowAreas = roofMap.lowAreas.map((lowArea) => {
    const nearbyDrains = roofMap.drains.filter((drain) => {
      const dx = drain.position.x - lowArea.position.x;
      const dy = drain.position.y - lowArea.position.y;
      return Math.sqrt(dx * dx + dy * dy) < 3;
    });

    let totalDrainage = 0;
    nearbyDrains.forEach((drain) => {
      totalDrainage += calculateDrainDrainage(drain, rainfallIntensity);
    });

    const netWaterIncrease = Math.max(0, waterIncrease - totalDrainage);
    const newWaterLevel = Math.min(
      GAME_CONSTANTS.MAX_WATER_LEVEL,
      lowArea.waterLevel + netWaterIncrease
    );

    totalWaterIncreased += netWaterIncrease;

    if (newWaterLevel >= GAME_CONSTANTS.LEAK_THRESHOLD && lowArea.waterLevel < GAME_CONSTANTS.LEAK_THRESHOLD) {
      newLeaks.push({
        id: generateId(),
        position: { ...lowArea.position },
        severity: newWaterLevel - GAME_CONSTANTS.LEAK_THRESHOLD,
        cause: 'overflow_lowarea',
        sourceId: lowArea.id,
        roundDetected: currentRound,
      });
    }

    return {
      ...lowArea,
      waterLevel: newWaterLevel,
      pumped: false,
    };
  });

  roofMap.drains.forEach((drain) => {
    if (drain.isBlocked && drain.blockageSeverity >= 80) {
      const nearbyLowArea = roofMap.lowAreas.find((la) => {
        const dx = drain.position.x - la.position.x;
        const dy = drain.position.y - la.position.y;
        return Math.sqrt(dx * dx + dy * dy) < 2;
      });

      if (!nearbyLowArea && Math.random() < 0.3) {
        const existingLeak = newLeaks.find(
          (l) => l.sourceId === drain.id
        );
        if (!existingLeak) {
          newLeaks.push({
            id: generateId(),
            position: { ...drain.position },
            severity: drain.blockageSeverity - 80,
            cause: 'blocked_drain',
            sourceId: drain.id,
            roundDetected: currentRound,
          });
        }
      }
    }
  });

  return {
    updatedRoofMap: {
      ...roofMap,
      lowAreas: updatedLowAreas,
    },
    newLeaks,
    totalWaterIncreased,
  };
};

export const predictWaterLevel = (
  lowArea: LowArea,
  drains: Drain[],
  rainfallIntensity: number,
  rounds: number = 1
): number => {
  let predictedLevel = lowArea.waterLevel;

  for (let i = 0; i < rounds; i++) {
    const waterIncrease = calculateWaterIncrease(rainfallIntensity);
    
    const nearbyDrains = drains.filter((drain) => {
      const dx = drain.position.x - lowArea.position.x;
      const dy = drain.position.y - lowArea.position.y;
      return Math.sqrt(dx * dx + dy * dy) < 3;
    });

    let totalDrainage = 0;
    nearbyDrains.forEach((drain) => {
      totalDrainage += calculateDrainDrainage(drain, rainfallIntensity);
    });

    const netIncrease = Math.max(0, waterIncrease - totalDrainage);
    predictedLevel = Math.min(GAME_CONSTANTS.MAX_WATER_LEVEL, predictedLevel + netIncrease);
  }

  return predictedLevel;
};

export const getLowAreaRiskLevel = (
  lowArea: LowArea,
  drains: Drain[],
  rainfallIntensity: number
): 'low' | 'medium' | 'high' | 'critical' => {
  const predictedLevel = predictWaterLevel(lowArea, drains, rainfallIntensity, 2);
  
  if (predictedLevel >= GAME_CONSTANTS.LEAK_THRESHOLD) return 'critical';
  if (predictedLevel >= 70) return 'high';
  if (predictedLevel >= 40) return 'medium';
  return 'low';
};
