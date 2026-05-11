const { pondTypes } = require('../store');

const SPECIES_WATER_TEMP_LIMITS = {
  CARP: {
    min: 16,
    max: 28,
    optimal: 22,
    hatchingMin: 20,
    hatchingMax: 26
  },
  CATFISH: {
    min: 20,
    max: 32,
    optimal: 26,
    hatchingMin: 24,
    hatchingMax: 30
  },
  TILAPIA: {
    min: 24,
    max: 34,
    optimal: 28,
    hatchingMin: 26,
    hatchingMax: 32
  },
  SHRIMP: {
    min: 22,
    max: 30,
    optimal: 26,
    hatchingMin: 24,
    hatchingMax: 28
  }
};

const POND_DENSITY_LIMITS = {
  HATCHERY: {
    CARP: { min: 50000, max: 200000, unit: 'tail/m³' },
    CATFISH: { min: 30000, max: 150000, unit: 'tail/m³' },
    TILAPIA: { min: 40000, max: 180000, unit: 'tail/m³' },
    SHRIMP: { min: 100000, max: 500000, unit: 'tail/m³' }
  },
  NURSERY: {
    CARP: { min: 5000, max: 30000, unit: 'tail/m³' },
    CATFISH: { min: 3000, max: 20000, unit: 'tail/m³' },
    TILAPIA: { min: 4000, max: 25000, unit: 'tail/m³' },
    SHRIMP: { min: 20000, max: 100000, unit: 'tail/m³' }
  },
  GROWOUT: {
    CARP: { min: 500, max: 3000, unit: 'tail/m³' },
    CATFISH: { min: 300, max: 2000, unit: 'tail/m³' },
    TILAPIA: { min: 400, max: 2500, unit: 'tail/m³' },
    SHRIMP: { min: 2000, max: 10000, unit: 'tail/m³' }
  }
};

function getWaterTempLimit(species) {
  return SPECIES_WATER_TEMP_LIMITS[species] || null;
}

function getDensityLimit(pondType, species) {
  const pondLimits = POND_DENSITY_LIMITS[pondType];
  if (!pondLimits) return null;
  return pondLimits[species] || null;
}

function validateWaterTemp(species, waterTemp, pondType) {
  const limits = getWaterTempLimit(species);
  if (!limits) {
    return { valid: true, reason: 'UNKNOWN_SPECIES' };
  }

  let min, max;
  if (pondType === pondTypes.HATCHERY) {
    min = limits.hatchingMin;
    max = limits.hatchingMax;
  } else {
    min = limits.min;
    max = limits.max;
  }

  if (waterTemp < min) {
    return { 
      valid: false, 
      reason: 'TEMP_TOO_LOW', 
      message: `水温 ${waterTemp}°C 低于最低限制 ${min}°C` 
    };
  }

  if (waterTemp > max) {
    return { 
      valid: false, 
      reason: 'TEMP_TOO_HIGH', 
      message: `水温 ${waterTemp}°C 高于最高限制 ${max}°C` 
    };
  }

  return { valid: true };
}

function calculateDensity(count, pondVolume) {
  if (pondVolume <= 0) return null;
  return count / pondVolume;
}

function validateDensity(species, pondType, count, pondVolume) {
  const densityLimit = getDensityLimit(pondType, species);
  if (!densityLimit) {
    return { valid: true, reason: 'UNKNOWN_CONFIG' };
  }

  const density = calculateDensity(count, pondVolume);
  if (density === null) {
    return { valid: false, reason: 'INVALID_VOLUME', message: '池塘体积无效' };
  }

  if (density < densityLimit.min) {
    return {
      valid: false,
      reason: 'DENSITY_TOO_LOW',
      message: `分池密度 ${density.toFixed(0)} ${densityLimit.unit} 低于最低限制 ${densityLimit.min}`,
      density,
      limits: densityLimit
    };
  }

  if (density > densityLimit.max) {
    return {
      valid: false,
      reason: 'DENSITY_TOO_HIGH',
      message: `分池密度 ${density.toFixed(0)} ${densityLimit.unit} 高于最高限制 ${densityLimit.max}`,
      density,
      limits: densityLimit
    };
  }

  return { valid: true, density, limits: densityLimit };
}

function calculateSurvivalRate(species, waterTemp, density, pondType) {
  const tempLimits = getWaterTempLimit(species);
  const densityLimits = getDensityLimit(pondType, species);

  if (!tempLimits || !densityLimits) {
    return { baseRate: 0.85, adjustedRate: 0.85, factors: [] };
  }

  let baseRate = 0.90;
  const factors = [];

  const tempOptimal = tempLimits.optimal;
  const tempDiff = Math.abs(waterTemp - tempOptimal);
  if (tempDiff > 0) {
    const tempPenalty = tempDiff * 0.015;
    baseRate -= tempPenalty;
    factors.push({
      type: 'temperature',
      value: waterTemp,
      optimal: tempOptimal,
      penalty: tempPenalty,
      impact: `水温偏离最优值 ${tempDiff}°C，成活率降低 ${(tempPenalty * 100).toFixed(1)}%`
    });
  }

  const densityOptimal = (densityLimits.min + densityLimits.max) / 2;
  const densityDiff = Math.abs(density - densityOptimal);
  const densityRange = densityLimits.max - densityLimits.min;
  if (densityDiff > 0 && densityRange > 0) {
    const densityRatio = densityDiff / densityRange;
    const densityPenalty = densityRatio * 0.05;
    baseRate -= densityPenalty;
    factors.push({
      type: 'density',
      value: density,
      optimal: densityOptimal,
      penalty: densityPenalty,
      impact: `密度偏离最优值 ${densityDiff.toFixed(0)}，成活率降低 ${(densityPenalty * 100).toFixed(1)}%`
    });
  }

  baseRate = Math.max(0.50, Math.min(0.98, baseRate));

  return {
    baseRate: 0.90,
    adjustedRate: parseFloat(baseRate.toFixed(4)),
    factors
  };
}

function calculateActualSurvived(initialCount, survivalRate) {
  return Math.round(initialCount * survivalRate);
}

function validateTransferFlow(sourcePondType, targetPondType, batchStatus) {
  const validTransitions = {
    HATCHING: ['READY_FOR_TRANSFER'],
    READY_FOR_TRANSFER: ['IN_TRANSFER'],
    IN_TRANSFER: ['TRANSFERRED'],
    TRANSFERRED: ['GROWING'],
    GROWING: ['HARVESTED']
  };

  const validPondTransitions = {
    HATCHERY: ['NURSERY'],
    NURSERY: ['GROWOUT'],
    GROWOUT: []
  };

  if (!validPondTransitions[sourcePondType]) {
    return { valid: false, reason: 'INVALID_SOURCE_POND_TYPE', message: '无效的来源池塘类型' };
  }

  const allowedTargets = validPondTransitions[sourcePondType];
  if (!allowedTargets.includes(targetPondType)) {
    return { 
      valid: false, 
      reason: 'ILLEGAL_TRANSFER_FLOW', 
      message: `非法流转: 不允许从 ${sourcePondType} 转移到 ${targetPondType}。允许的目标: ${allowedTargets.join(', ')}` 
    };
  }

  return { valid: true };
}

module.exports = {
  SPECIES_WATER_TEMP_LIMITS,
  POND_DENSITY_LIMITS,
  getWaterTempLimit,
  getDensityLimit,
  validateWaterTemp,
  calculateDensity,
  validateDensity,
  calculateSurvivalRate,
  calculateActualSurvived,
  validateTransferFlow
};