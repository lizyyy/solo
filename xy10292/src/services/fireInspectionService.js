const { FILES, readJsonFile, writeJsonFile, recordHistory } = require('../models/store');

const INSPECTION_RESULTS = {
  PASS: 'pass',
  FAIL: 'fail',
  CONDITIONAL: 'conditional'
};

function listFireInspections(storeId = null) {
  const inspections = readJsonFile(FILES.fireInspections, []);
  if (storeId) {
    return inspections.filter(i => i.storeId === storeId);
  }
  return inspections;
}

function getLatestInspection(storeId, asOfDate = new Date()) {
  const inspections = listFireInspections(storeId)
    .filter(i => new Date(i.inspectionDate) <= asOfDate)
    .sort((a, b) => new Date(b.inspectionDate) - new Date(a.inspectionDate));
  return inspections[0] || null;
}

function getNextRequiredInspection(storeId, asOfDate = new Date()) {
  const latest = getLatestInspection(storeId, asOfDate);
  if (!latest) {
    return null;
  }
  
  const latestDate = new Date(latest.inspectionDate);
  const cycleMonths = latest.result === INSPECTION_RESULTS.FAIL ? 3 : 6;
  const nextDate = new Date(latestDate);
  nextDate.setMonth(nextDate.getMonth() + cycleMonths);
  return nextDate;
}

function isInspectionOverdue(storeId, asOfDate = new Date()) {
  const nextDate = getNextRequiredInspection(storeId, asOfDate);
  if (!nextDate) {
    return { overdue: false, reason: '无检查记录' };
  }
  
  if (asOfDate > nextDate) {
    return { 
      overdue: true, 
      nextRequiredDate: nextDate,
      daysOverdue: Math.ceil((asOfDate - nextDate) / (1000 * 60 * 60 * 24))
    };
  }
  
  return { overdue: false, nextRequiredDate: nextDate };
}

function importFireInspections(newInspections, operator = 'system') {
  const existing = listFireInspections();
  const existingMap = new Map(existing.map(i => [i.id, i]));
  const result = { added: 0, updated: 0, deleted: 0 };
  const newIds = new Set(newInspections.map(i => i.id));

  for (const inspection of newInspections) {
    if (!inspection.id || !inspection.storeId || !inspection.inspectionDate || !inspection.result) {
      throw new Error(`消防检查记录缺少必填字段: id、storeId、inspectionDate 或 result`);
    }
    
    if (!Object.values(INSPECTION_RESULTS).includes(inspection.result)) {
      throw new Error(`无效的检查结果: ${inspection.result}，有效值: ${Object.values(INSPECTION_RESULTS).join(', ')}`);
    }
    
    const existingRecord = existingMap.get(inspection.id);
    if (existingRecord) {
      const hasChanges = JSON.stringify(existingRecord) !== JSON.stringify(inspection);
      if (hasChanges) {
        recordHistory('UPDATE', 'FIRE_INSPECTION', inspection.id, existingRecord, inspection, operator);
        result.updated++;
      }
    } else {
      recordHistory('CREATE', 'FIRE_INSPECTION', inspection.id, null, inspection, operator);
      result.added++;
    }
  }

  for (const record of existing) {
    if (!newIds.has(record.id)) {
      recordHistory('DELETE', 'FIRE_INSPECTION', record.id, record, null, operator);
      result.deleted++;
    }
  }

  writeJsonFile(FILES.fireInspections, newInspections);
  return result;
}

module.exports = {
  INSPECTION_RESULTS,
  listFireInspections,
  getLatestInspection,
  getNextRequiredInspection,
  isInspectionOverdue,
  importFireInspections
};