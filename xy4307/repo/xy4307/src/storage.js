import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_STORAGE_DIR = join(__dirname, '..', 'data');
const HISTORY_FILE = 'history.json';
const INDEXES_FILE = 'indexes.json';

export class JSONStorage {
  constructor(storageDir = DEFAULT_STORAGE_DIR) {
    this.storageDir = storageDir;
    this.ensureStorageDir();
  }

  ensureStorageDir() {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  getHistory() {
    const historyPath = join(this.storageDir, HISTORY_FILE);
    if (!existsSync(historyPath)) {
      return [];
    }
    const content = readFileSync(historyPath, 'utf-8');
    return JSON.parse(content);
  }

  saveHistory(history) {
    const historyPath = join(this.storageDir, HISTORY_FILE);
    writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  }

  getIndexes() {
    const indexesPath = join(this.storageDir, INDEXES_FILE);
    if (!existsSync(indexesPath)) {
      return {
        byBoxId: {},
        byBatchId: {},
        byDate: {}
      };
    }
    const content = readFileSync(indexesPath, 'utf-8');
    return JSON.parse(content);
  }

  saveIndexes(indexes) {
    const indexesPath = join(this.storageDir, INDEXES_FILE);
    writeFileSync(indexesPath, JSON.stringify(indexes, null, 2), 'utf-8');
  }

  saveProcessingResult(result) {
    const history = this.getHistory();
    const indexes = this.getIndexes();

    const record = {
      id: this.generateId(),
      processedAt: new Date().toISOString(),
      deviceFiles: result.deviceFiles || [],
      batchFiles: result.batchFiles || [],
      totalDeviceRecords: result.totalDeviceRecords || 0,
      totalBatchRecords: result.totalBatchRecords || 0,
      anomalySummary: result.anomalySummary || {},
      anomalies: result.anomalies || [],
      mergedRecordsCount: result.mergedRecordsCount || 0,
      reportOutputs: result.reportOutputs || {},
      boxIds: result.boxIds || [],
      batchIds: result.batchIds || []
    };

    history.push(record);
    this.saveHistory(history);

    this.updateIndexes(indexes, record);
    this.saveIndexes(indexes);

    return record.id;
  }

  updateIndexes(indexes, record) {
    for (const boxId of record.boxIds || []) {
      if (!indexes.byBoxId[boxId]) {
        indexes.byBoxId[boxId] = [];
      }
      if (!indexes.byBoxId[boxId].includes(record.id)) {
        indexes.byBoxId[boxId].push(record.id);
      }
    }

    for (const batchId of record.batchIds || []) {
      if (!indexes.byBatchId[batchId]) {
        indexes.byBatchId[batchId] = [];
      }
      if (!indexes.byBatchId[batchId].includes(record.id)) {
        indexes.byBatchId[batchId].push(record.id);
      }
    }

    const dateStr = new Date(record.processedAt).toISOString().split('T')[0];
    if (!indexes.byDate[dateStr]) {
      indexes.byDate[dateStr] = [];
    }
    if (!indexes.byDate[dateStr].includes(record.id)) {
      indexes.byDate[dateStr].push(record.id);
    }
  }

  getRecordById(id) {
    const history = this.getHistory();
    return history.find(r => r.id === id) || null;
  }

  getRecordsByBoxId(boxId) {
    const indexes = this.getIndexes();
    const history = this.getHistory();
    const recordIds = indexes.byBoxId[boxId] || [];
    return history.filter(r => recordIds.includes(r.id));
  }

  getRecordsByBatchId(batchId) {
    const indexes = this.getIndexes();
    const history = this.getHistory();
    const recordIds = indexes.byBatchId[batchId] || [];
    return history.filter(r => recordIds.includes(r.id));
  }

  getRecordsByDate(dateStr) {
    const indexes = this.getIndexes();
    const history = this.getHistory();
    const recordIds = indexes.byDate[dateStr] || [];
    return history.filter(r => recordIds.includes(r.id));
  }

  getRecordsByDateRange(startDate, endDate) {
    const indexes = this.getIndexes();
    const history = this.getHistory();
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return history.filter(r => {
      const recordDate = new Date(r.processedAt);
      return recordDate >= start && recordDate <= end;
    });
  }

  listAllBoxIds() {
    const indexes = this.getIndexes();
    return Object.keys(indexes.byBoxId).sort();
  }

  listAllBatchIds() {
    const indexes = this.getIndexes();
    return Object.keys(indexes.byBatchId).sort();
  }

  listAllDates() {
    const indexes = this.getIndexes();
    return Object.keys(indexes.byDate).sort();
  }

  deleteRecord(id) {
    const history = this.getHistory();
    const indexes = this.getIndexes();
    const recordIndex = history.findIndex(r => r.id === id);
    
    if (recordIndex === -1) {
      return false;
    }

    const record = history[recordIndex];
    history.splice(recordIndex, 1);

    for (const boxId of record.boxIds || []) {
      if (indexes.byBoxId[boxId]) {
        indexes.byBoxId[boxId] = indexes.byBoxId[boxId].filter(rId => rId !== id);
        if (indexes.byBoxId[boxId].length === 0) {
          delete indexes.byBoxId[boxId];
        }
      }
    }

    for (const batchId of record.batchIds || []) {
      if (indexes.byBatchId[batchId]) {
        indexes.byBatchId[batchId] = indexes.byBatchId[batchId].filter(rId => rId !== id);
        if (indexes.byBatchId[batchId].length === 0) {
          delete indexes.byBatchId[batchId];
        }
      }
    }

    const dateStr = new Date(record.processedAt).toISOString().split('T')[0];
    if (indexes.byDate[dateStr]) {
      indexes.byDate[dateStr] = indexes.byDate[dateStr].filter(rId => rId !== id);
      if (indexes.byDate[dateStr].length === 0) {
        delete indexes.byDate[dateStr];
      }
    }

    this.saveHistory(history);
    this.saveIndexes(indexes);

    return true;
  }

  clearAll() {
    this.saveHistory([]);
    this.saveIndexes({
      byBoxId: {},
      byBatchId: {},
      byDate: {}
    });
  }

  generateId() {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const storage = new JSONStorage();
