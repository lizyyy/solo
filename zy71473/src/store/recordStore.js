import { reactive } from 'vue';
import { validateParams, generateId } from '../utils/physics.js';

const STORAGE_KEY = 'ballistic_training_records';
const STORAGE_EXPORT_KEY = 'ballistic_export_stats';

function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveToStorage(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadExportStats() {
  try {
    const data = localStorage.getItem(STORAGE_EXPORT_KEY);
    return data ? JSON.parse(data) : { exportCount: 0, lastExport: null };
  } catch {
    return { exportCount: 0, lastExport: null };
  }
}

function saveExportStats(stats) {
  localStorage.setItem(STORAGE_EXPORT_KEY, JSON.stringify(stats));
}

export const recordStore = reactive({
  records: loadFromStorage(),
  pendingRecords: [],
  anomalyRecords: [],
  exportStats: loadExportStats(),

  addRecord(params, result, options = {}) {
    const validation = validateParams(params);
    const record = {
      id: generateId(),
      params: { ...params },
      result: { ...result },
      validation,
      status: options.status || 'normal',
      source: options.source || 'direct',
      notes: options.notes || '',
      originalId: options.originalId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };

    if (!validation.isValid || validation.warnings.length > 0 || validation.info.length > 0) {
      if (!validation.isValid) {
        record.status = 'anomaly';
        this.anomalyRecords.push(record);
      } else {
        record.status = 'pending';
        this.pendingRecords.push(record);
      }
    } else {
      const isDuplicate = this.records.some(r =>
        r.params.initialVelocity === params.initialVelocity &&
        r.params.bulletMass === params.bulletMass &&
        r.params.distance === params.distance &&
        r.params.windSpeed === params.windSpeed &&
        r.status === 'normal'
      );

      if (isDuplicate && !options.force) {
        record.status = 'duplicate';
        this.pendingRecords.push(record);
      } else {
        this.records.push(record);
      }
    }

    saveToStorage(this.records);
    return record;
  },

  supplementRecord(recordId,补充字段) {
    const idx = this.pendingRecords.findIndex(r => r.id === recordId);
    if (idx !== -1) {
      const record = this.pendingRecords[idx];
      record.params = { ...record.params, ...补充字段 };
      record.status = 'supplemented';
      record.updatedAt = new Date().toISOString();
      record.version += 1;

      const newValidation = validateParams(record.params);
      record.validation = newValidation;

      if (newValidation.isValid) {
        record.status = 'normal';
        this.records.push(record);
        this.pendingRecords.splice(idx, 1);
      }

      saveToStorage(this.records);
      return record;
    }
    return null;
  },

  withdrawRecord(recordId) {
    const idx = this.records.findIndex(r => r.id === recordId);
    if (idx !== -1) {
      const record = this.records[idx];
      record.status = 'withdrawn';
      record.updatedAt = new Date().toISOString();
      this.pendingRecords.push(record);
      this.records.splice(idx, 1);
      saveToStorage(this.records);
      return record;
    }
    return null;
  },

  approvePending(recordId) {
    const idx = this.pendingRecords.findIndex(r => r.id === recordId);
    if (idx !== -1) {
      const record = this.pendingRecords[idx];
      record.status = 'normal';
      this.records.push(record);
      this.pendingRecords.splice(idx, 1);
      saveToStorage(this.records);
      return record;
    }
    return null;
  },

  rejectAnomaly(recordId) {
    const idx = this.anomalyRecords.findIndex(r => r.id === recordId);
    if (idx !== -1) {
      this.anomalyRecords.splice(idx, 1);
      return true;
    }
    return false;
  },

  exportRecords() {
    const exportData = {
      records: this.records,
      pendingRecords: this.pendingRecords,
      anomalyRecords: this.anomalyRecords,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    this.exportStats.exportCount += 1;
    this.exportStats.lastExport = new Date().toISOString();
    saveExportStats(this.exportStats);

    return exportData;
  },

  importRecords(data) {
    if (data.records) {
      this.records = [...this.records, ...data.records];
    }
    if (data.pendingRecords) {
      this.pendingRecords = [...this.pendingRecords, ...data.pendingRecords];
    }
    if (data.anomalyRecords) {
      this.anomalyRecords = [...this.anomalyRecords, ...data.anomalyRecords];
    }
    saveToStorage(this.records);
  },

  getRecordStats() {
    return {
      totalNormal: this.records.filter(r => r.status === 'normal').length,
      totalSupplemented: this.records.filter(r => r.status === 'supplemented').length,
      totalPending: this.pendingRecords.length,
      totalAnomaly: this.anomalyRecords.length,
      totalWithdrawn: this.pendingRecords.filter(r => r.status === 'withdrawn').length,
      exportCount: this.exportStats.exportCount,
      lastExport: this.exportStats.lastExport
    };
  }
});
