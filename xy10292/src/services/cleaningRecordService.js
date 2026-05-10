const { FILES, readJsonFile, writeJsonFile, recordHistory } = require('../models/store');

function listCleaningRecords(storeId = null) {
  const records = readJsonFile(FILES.cleaningRecords, []);
  if (storeId) {
    return records.filter(r => r.storeId === storeId);
  }
  return records;
}

function getLastCleaning(storeId) {
  const records = listCleaningRecords(storeId)
    .filter(r => r.status === 'completed')
    .sort((a, b) => new Date(b.cleanDate) - new Date(a.cleanDate));
  return records[0] || null;
}

function importCleaningRecords(newRecords, operator = 'system') {
  const existing = listCleaningRecords();
  const existingMap = new Map(existing.map(r => [r.id, r]));
  const result = { added: 0, updated: 0, deleted: 0 };
  const newRecordIds = new Set(newRecords.map(r => r.id));

  for (const record of newRecords) {
    if (!record.id || !record.storeId || !record.cleanDate) {
      throw new Error(`清洗记录缺少必填字段: id、storeId 或 cleanDate`);
    }
    
    const existingRecord = existingMap.get(record.id);
    if (existingRecord) {
      const hasChanges = JSON.stringify(existingRecord) !== JSON.stringify(record);
      if (hasChanges) {
        recordHistory('UPDATE', 'CLEANING_RECORD', record.id, existingRecord, record, operator);
        result.updated++;
      }
    } else {
      recordHistory('CREATE', 'CLEANING_RECORD', record.id, null, record, operator);
      result.added++;
    }
  }

  for (const record of existing) {
    if (!newRecordIds.has(record.id)) {
      recordHistory('DELETE', 'CLEANING_RECORD', record.id, record, null, operator);
      result.deleted++;
    }
  }

  writeJsonFile(FILES.cleaningRecords, newRecords);
  return result;
}

function addCleaningRecord(record, operator = 'system') {
  if (!record.id || !record.storeId || !record.cleanDate) {
    throw new Error(`清洗记录缺少必填字段: id、storeId 或 cleanDate`);
  }
  
  const records = listCleaningRecords();
  records.push(record);
  recordHistory('CREATE', 'CLEANING_RECORD', record.id, null, record, operator);
  writeJsonFile(FILES.cleaningRecords, records);
  return record;
}

function updateCleaningRecord(recordId, updates, operator = 'system') {
  const records = listCleaningRecords();
  const index = records.findIndex(r => r.id === recordId);
  if (index === -1) {
    throw new Error(`清洗记录不存在: ${recordId}`);
  }

  const before = { ...records[index] };
  const after = { ...records[index], ...updates };
  
  recordHistory('UPDATE', 'CLEANING_RECORD', recordId, before, after, operator);
  records[index] = after;
  writeJsonFile(FILES.cleaningRecords, records);
  return after;
}

module.exports = {
  listCleaningRecords,
  getLastCleaning,
  importCleaningRecords,
  addCleaningRecord,
  updateCleaningRecord
};