const { v4: uuidv4 } = require('uuid');

class FieldDeprecation {
  constructor() {
    this.records = new Map();
  }

  createRecord(data) {
    const id = uuidv4();
    const record = {
      id,
      tableName: data.tableName,
      fieldName: data.fieldName,
      downstreamTask: data.downstreamTask,
      notifier: data.notifier,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confirmedAt: null,
      confirmedBy: null,
      notes: data.notes || '',
      reason: data.reason || ''
    };
    this.records.set(id, record);
    return record;
  }

  batchImport(records) {
    const results = [];
    for (const data of records) {
      const existing = this.findByTableFieldTask(data.tableName, data.fieldName, data.downstreamTask);
      if (existing) {
        results.push({
          success: false,
          error: 'DUPLICATE_RECORD',
          message: `记录已存在: ${data.tableName}.${data.fieldName} -> ${data.downstreamTask}`,
          data
        });
      } else {
        const record = this.createRecord(data);
        results.push({
          success: true,
          data: record
        });
      }
    }
    return results;
  }

  findByTableFieldTask(tableName, fieldName, downstreamTask) {
    for (const record of this.records.values()) {
      if (record.tableName === tableName &&
          record.fieldName === fieldName &&
          record.downstreamTask === downstreamTask &&
          record.status !== 'revoked') {
        return record;
      }
    }
    return null;
  }

  getById(id) {
    return this.records.get(id) || null;
  }

  confirm(id, confirmedBy, notes = '') {
    const record = this.records.get(id);
    if (!record) {
      throw new Error('RECORD_NOT_FOUND');
    }
    if (record.status === 'revoked') {
      throw new Error('RECORD_REVOKED');
    }
    record.status = 'confirmed';
    record.confirmedAt = new Date().toISOString();
    record.confirmedBy = confirmedBy;
    record.notes = notes;
    record.updatedAt = new Date().toISOString();
    return record;
  }

  revoke(id, reason = '') {
    const record = this.records.get(id);
    if (!record) {
      throw new Error('RECORD_NOT_FOUND');
    }
    record.status = 'revoked';
    record.reason = reason;
    record.updatedAt = new Date().toISOString();
    return record;
  }

  validatePublish(tableName, fieldName) {
    const unconfirmed = [];
    for (const record of this.records.values()) {
      if (record.tableName === tableName &&
          record.fieldName === fieldName &&
          record.status === 'pending') {
        unconfirmed.push(record);
      }
    }
    return {
      canPublish: unconfirmed.length === 0,
      unconfirmedRecords: unconfirmed
    };
  }

  getAll(filters = {}) {
    let results = Array.from(this.records.values());
    
    if (filters.tableName) {
      results = results.filter(r => r.tableName === filters.tableName);
    }
    if (filters.fieldName) {
      results = results.filter(r => r.fieldName === filters.fieldName);
    }
    if (filters.status) {
      results = results.filter(r => r.status === filters.status);
    }
    if (filters.downstreamTask) {
      results = results.filter(r => r.downstreamTask === filters.downstreamTask);
    }
    
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  exportToCSV(filters = {}) {
    const records = this.getAll(filters);
    return records.map(r => ({
      id: r.id,
      tableName: r.tableName,
      fieldName: r.fieldName,
      downstreamTask: r.downstreamTask,
      notifier: r.notifier,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      confirmedAt: r.confirmedAt || '',
      confirmedBy: r.confirmedBy || '',
      notes: r.notes,
      reason: r.reason
    }));
  }

  getStatistics() {
    const stats = {
      total: this.records.size,
      pending: 0,
      confirmed: 0,
      revoked: 0,
      byTable: {},
      byTask: {}
    };
    
    for (const record of this.records.values()) {
      stats[record.status]++;
      
      if (!stats.byTable[record.tableName]) {
        stats.byTable[record.tableName] = { total: 0, pending: 0, confirmed: 0, revoked: 0 };
      }
      stats.byTable[record.tableName].total++;
      stats.byTable[record.tableName][record.status]++;
      
      if (!stats.byTask[record.downstreamTask]) {
        stats.byTask[record.downstreamTask] = { total: 0, pending: 0, confirmed: 0, revoked: 0 };
      }
      stats.byTask[record.downstreamTask].total++;
      stats.byTask[record.downstreamTask][record.status]++;
    }
    
    return stats;
  }
}

module.exports = new FieldDeprecation();