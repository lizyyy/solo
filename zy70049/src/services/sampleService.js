const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../models/database');
const HistoryService = require('./historyService');

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

class SampleService {
  static createSample(data) {
    const db = getDatabase();
    const {
      batch_no, product_name, quantity, unit, sample_date,
      retention_days, storage_location, operator = null
    } = data;
    
    const expiry_date = addDays(sample_date, retention_days);
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const newData = {
      id, batch_no, product_name, quantity, unit,
      sample_date, retention_days, expiry_date,
      storage_location, status: 'active',
      created_at: now, updated_at: now
    };
    
    db.addSample(newData);
    
    HistoryService.recordSampleHistory(id, 'create', null, newData, operator);
    HistoryService.recordAudit('create', 'sample', id, { batch_no, product_name }, operator);
    
    return this.getSample(id);
  }

  static getSample(id) {
    const db = getDatabase();
    return db.findSample(s => s.id === id);
  }

  static getSamples(filters = {}) {
    const db = getDatabase();
    let samples = db.filterSamples(() => true);
    
    if (filters.batch_no) {
      samples = samples.filter(s => s.batch_no.includes(filters.batch_no));
    }
    if (filters.status) {
      samples = samples.filter(s => s.status === filters.status);
    }
    if (filters.expiry_before) {
      samples = samples.filter(s => s.expiry_date <= filters.expiry_before);
    }
    if (filters.expiry_after) {
      samples = samples.filter(s => s.expiry_date >= filters.expiry_after);
    }
    
    return samples.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  static updateSample(id, updates, operator = null, reason = null) {
    const db = getDatabase();
    const oldSample = this.getSample(id);
    if (!oldSample) return null;
    
    const allowedFields = [
      'product_name', 'quantity', 'unit', 'sample_date',
      'retention_days', 'storage_location'
    ];
    
    const updateData = {};
    for (const field of allowedFields) {
      if (field in updates) {
        updateData[field] = updates[field];
      }
    }
    
    if ('sample_date' in updates || 'retention_days' in updates) {
      const sample_date = updates.sample_date || oldSample.sample_date;
      const retention_days = updates.retention_days || oldSample.retention_days;
      updateData.expiry_date = addDays(sample_date, retention_days);
    }
    
    updateData.updated_at = new Date().toISOString();
    
    db.updateSample(id, updateData);
    const newSample = this.getSample(id);
    
    HistoryService.recordSampleHistory(id, 'update', oldSample, newSample, operator, reason);
    HistoryService.recordAudit('update', 'sample', id, { reason }, operator);
    
    return newSample;
  }

  static supplementSample(id, data, operator = null, reason = null) {
    const oldSample = this.getSample(id);
    if (!oldSample) return null;
    
    const updated = this.updateSample(id, data, operator, reason);
    
    HistoryService.recordSampleHistory(id, 'supplement', oldSample, updated, operator, reason);
    HistoryService.recordAudit('supplement', 'sample', id, { reason }, operator);
    
    return updated;
  }

  static withdrawSample(id, operator = null, reason = null) {
    const db = getDatabase();
    const oldSample = this.getSample(id);
    if (!oldSample) return null;
    if (oldSample.status === 'withdrawn') {
      throw new Error('该留样已撤回');
    }
    
    db.updateSample(id, {
      status: 'withdrawn',
      updated_at: new Date().toISOString()
    });
    
    const newSample = this.getSample(id);
    
    HistoryService.recordSampleHistory(id, 'withdraw', oldSample, newSample, operator, reason);
    HistoryService.recordAudit('withdraw', 'sample', id, { reason }, operator);
    
    return newSample;
  }

  static activateSample(id, operator = null, reason = null) {
    const db = getDatabase();
    const oldSample = this.getSample(id);
    if (!oldSample) return null;
    if (oldSample.status !== 'withdrawn') {
      throw new Error('只有已撤回的留样才能恢复');
    }
    
    db.updateSample(id, {
      status: 'active',
      updated_at: new Date().toISOString()
    });
    
    const newSample = this.getSample(id);
    
    HistoryService.recordSampleHistory(id, 'activate', oldSample, newSample, operator, reason);
    HistoryService.recordAudit('activate', 'sample', id, { reason }, operator);
    
    return newSample;
  }

  static getHistory(id) {
    return HistoryService.getSampleHistory(id);
  }
}

module.exports = SampleService;
