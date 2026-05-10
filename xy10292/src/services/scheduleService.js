const { listStores, getStoreById } = require('./storeService');
const { getLastCleaning } = require('./cleaningRecordService');
const { getCurrentIntensity, INTENSITY_LEVELS } = require('./businessIntensityService');
const { isInspectionOverdue, getLatestInspection, INSPECTION_RESULTS } = require('./fireInspectionService');
const { FILES, readJsonFile, writeJsonFile } = require('../models/store');

const DEFAULT_BASE_CYCLE_DAYS = 90;
const WARNING_THRESHOLD_DAYS = 7;

function calculateAdjustedCycle(store, asOfDate = new Date()) {
  const baseCycle = store.baseCycleDays || DEFAULT_BASE_CYCLE_DAYS;
  const intensity = getCurrentIntensity(store.id, asOfDate);
  const adjustedCycle = Math.round(baseCycle * intensity.multiplier);
  
  const latestInspection = getLatestInspection(store.id, asOfDate);
  let inspectionAdjusted = adjustedCycle;
  let notes = [];
  
  if (latestInspection) {
    if (latestInspection.result === INSPECTION_RESULTS.FAIL) {
      inspectionAdjusted = Math.round(adjustedCycle * 0.6);
      notes.push('消防检查不合格，清洗周期缩短40%');
    } else if (latestInspection.result === INSPECTION_RESULTS.CONDITIONAL) {
      inspectionAdjusted = Math.round(adjustedCycle * 0.8);
      notes.push('消防检查条件通过，清洗周期缩短20%');
    }
  }
  
  return {
    baseCycle,
    intensityLevel: intensity.level,
    intensityMultiplier: intensity.multiplier,
    intensityAdjustedCycle: adjustedCycle,
    inspectionAdjustedCycle: inspectionAdjusted,
    finalCycleDays: inspectionAdjusted,
    notes
  };
}

function calculateNextCleaning(store, asOfDate = new Date()) {
  const lastCleaning = getLastCleaning(store.id);
  const cycleInfo = calculateAdjustedCycle(store, asOfDate);
  
  let lastCleanDate;
  if (lastCleaning) {
    lastCleanDate = new Date(lastCleaning.cleanDate);
  } else {
    lastCleanDate = store.openedDate ? new Date(store.openedDate) : new Date(asOfDate);
  }
  
  const nextCleanDate = new Date(lastCleanDate);
  nextCleanDate.setDate(nextCleanDate.getDate() + cycleInfo.finalCycleDays);
  
  const daysSinceLast = Math.ceil((asOfDate - lastCleanDate) / (1000 * 60 * 60 * 24));
  const daysUntilNext = Math.ceil((nextCleanDate - asOfDate) / (1000 * 60 * 60 * 24));
  const daysRemaining = daysUntilNext;
  
  return {
    storeId: store.id,
    storeName: store.name,
    lastCleanDate: lastCleaning ? lastCleaning.cleanDate : (store.openedDate || '无记录'),
    nextCleanDate: nextCleanDate.toISOString().split('T')[0],
    cycleInfo,
    daysSinceLast,
    daysRemaining,
    isOverdue: daysRemaining < 0,
    isWarning: daysRemaining >= 0 && daysRemaining <= WARNING_THRESHOLD_DAYS,
    hasNeverCleaned: !lastCleaning && !store.openedDate
  };
}

function detectAnomalies(asOfDate = new Date()) {
  const stores = listStores();
  const anomalies = [];
  
  for (const store of stores) {
    const schedule = calculateNextCleaning(store, asOfDate);
    const inspectionStatus = isInspectionOverdue(store.id, asOfDate);
    const latestInspection = getLatestInspection(store.id, asOfDate);
    
    const storeAnomalies = [];
    
    if (schedule.isOverdue) {
      storeAnomalies.push({
        type: 'CLEANING_OVERDUE',
        severity: 'critical',
        message: `清洗逾期 ${Math.abs(schedule.daysRemaining)} 天`,
        details: {
          lastCleanDate: schedule.lastCleanDate,
          scheduledNextDate: schedule.nextCleanDate,
          cycleInfo: schedule.cycleInfo
        }
      });
    }
    
    if (schedule.isWarning) {
      storeAnomalies.push({
        type: 'CLEANING_WARNING',
        severity: 'warning',
        message: `即将到达清洗期限，剩余 ${schedule.daysRemaining} 天`,
        details: {
          nextCleanDate: schedule.nextCleanDate
        }
      });
    }
    
    if (schedule.hasNeverCleaned) {
      storeAnomalies.push({
        type: 'NO_CLEANING_HISTORY',
        severity: 'warning',
        message: '无清洗历史记录，请确认开业日期',
        details: {}
      });
    }
    
    if (inspectionStatus.overdue) {
      storeAnomalies.push({
        type: 'INSPECTION_OVERDUE',
        severity: 'critical',
        message: `消防检查逾期 ${inspectionStatus.daysOverdue} 天`,
        details: {
          nextRequiredDate: inspectionStatus.nextRequiredDate
        }
      });
    }
    
    if (latestInspection && latestInspection.result === INSPECTION_RESULTS.FAIL) {
      storeAnomalies.push({
        type: 'INSPECTION_FAILED',
        severity: 'critical',
        message: `最近消防检查不合格（${latestInspection.inspectionDate}），需立即整改并缩短清洗周期`,
        details: {
          inspectionDate: latestInspection.inspectionDate,
          inspector: latestInspection.inspector,
          notes: latestInspection.notes
        }
      });
    }
    
    if (storeAnomalies.length > 0) {
      anomalies.push({
        storeId: store.id,
        storeName: store.name,
        location: store.location,
        manager: store.manager,
        phone: store.phone,
        nextCleanDate: schedule.nextCleanDate,
        anomalies: storeAnomalies
      });
    }
  }
  
  return anomalies;
}

function runCheck(asOfDate = new Date()) {
  const stores = listStores();
  const results = {
    timestamp: asOfDate.toISOString(),
    totalStores: stores.length,
    schedules: [],
    anomalies: detectAnomalies(asOfDate),
    summary: {
      overdue: 0,
      warning: 0,
      normal: 0,
      inspectionOverdue: 0
    }
  };
  
  for (const store of stores) {
    const schedule = calculateNextCleaning(store, asOfDate);
    results.schedules.push(schedule);
    
    if (schedule.isOverdue) {
      results.summary.overdue++;
    } else if (schedule.isWarning) {
      results.summary.warning++;
    } else {
      results.summary.normal++;
    }
  }
  
  for (const anomaly of results.anomalies) {
    for (const a of anomaly.anomalies) {
      if (a.type === 'INSPECTION_OVERDUE') {
        results.summary.inspectionOverdue++;
        break;
      }
    }
  }
  
  const allResults = readJsonFile(FILES.checkResults, []);
  allResults.unshift(results);
  if (allResults.length > 50) {
    allResults.length = 50;
  }
  writeJsonFile(FILES.checkResults, allResults);
  
  return results;
}

function getLatestCheckResult() {
  const results = readJsonFile(FILES.checkResults, []);
  return results[0] || null;
}

function listCheckHistory(limit = 10) {
  const results = readJsonFile(FILES.checkResults, []);
  return results.slice(0, limit);
}

module.exports = {
  DEFAULT_BASE_CYCLE_DAYS,
  WARNING_THRESHOLD_DAYS,
  calculateAdjustedCycle,
  calculateNextCleaning,
  detectAnomalies,
  runCheck,
  getLatestCheckResult,
  listCheckHistory
};