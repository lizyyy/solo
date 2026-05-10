const { FILES, readJsonFile, writeJsonFile, recordHistory } = require('../models/store');

const INTENSITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  EXTREME: 'extreme'
};

const CYCLE_ADJUSTMENTS = {
  [INTENSITY_LEVELS.LOW]: 1.3,
  [INTENSITY_LEVELS.MEDIUM]: 1.0,
  [INTENSITY_LEVELS.HIGH]: 0.7,
  [INTENSITY_LEVELS.EXTREME]: 0.5
};

function listBusinessIntensity(storeId = null) {
  const intensities = readJsonFile(FILES.businessIntensity, []);
  if (storeId) {
    return intensities.filter(i => i.storeId === storeId);
  }
  return intensities;
}

function getCurrentIntensity(storeId, asOfDate = new Date()) {
  const intensities = listBusinessIntensity(storeId)
    .filter(i => new Date(i.effectiveDate) <= asOfDate)
    .sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate));
  return intensities[0] || { level: INTENSITY_LEVELS.MEDIUM, multiplier: 1.0 };
}

function getCycleMultiplier(level) {
  return CYCLE_ADJUSTMENTS[level] || 1.0;
}

function importBusinessIntensity(newIntensities, operator = 'system') {
  const existing = listBusinessIntensity();
  const existingMap = new Map(existing.map(i => [i.id, i]));
  const result = { added: 0, updated: 0, deleted: 0 };
  const newIds = new Set(newIntensities.map(i => i.id));

  for (const intensity of newIntensities) {
    if (!intensity.id || !intensity.storeId || !intensity.effectiveDate || !intensity.level) {
      throw new Error(`营业强度记录缺少必填字段: id、storeId、effectiveDate 或 level`);
    }
    
    if (!Object.values(INTENSITY_LEVELS).includes(intensity.level)) {
      throw new Error(`无效的营业强度等级: ${intensity.level}，有效值: ${Object.values(INTENSITY_LEVELS).join(', ')}`);
    }
    
    intensity.multiplier = getCycleMultiplier(intensity.level);
    
    const existingRecord = existingMap.get(intensity.id);
    if (existingRecord) {
      const hasChanges = JSON.stringify(existingRecord) !== JSON.stringify(intensity);
      if (hasChanges) {
        recordHistory('UPDATE', 'BUSINESS_INTENSITY', intensity.id, existingRecord, intensity, operator);
        result.updated++;
      }
    } else {
      recordHistory('CREATE', 'BUSINESS_INTENSITY', intensity.id, null, intensity, operator);
      result.added++;
    }
  }

  for (const record of existing) {
    if (!newIds.has(record.id)) {
      recordHistory('DELETE', 'BUSINESS_INTENSITY', record.id, record, null, operator);
      result.deleted++;
    }
  }

  writeJsonFile(FILES.businessIntensity, newIntensities);
  return result;
}

module.exports = {
  INTENSITY_LEVELS,
  CYCLE_ADJUSTMENTS,
  listBusinessIntensity,
  getCurrentIntensity,
  getCycleMultiplier,
  importBusinessIntensity
};