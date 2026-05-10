const Batch = require('../models/Batch');
const dataStore = require('../utils/dataStore');
const moistureCalculator = require('../utils/moistureCalculator');
const { v4: uuidv4 } = require('uuid');

class BatchService {
  
  createBatch(data) {
    const existing = dataStore.getBatchByNo(data.batchNo);
    if (existing) {
      throw new Error(`批次编号 ${data.batchNo} 已存在`);
    }
    
    const batch = new Batch(data);
    return dataStore.saveBatch(batch.toJSON());
  }
  
  getBatchByNo(batchNo) {
    const data = dataStore.getBatchByNo(batchNo);
    return data ? new Batch(data) : null;
  }
  
  getBatchById(id) {
    const data = dataStore.getBatchById(id);
    return data ? new Batch(data) : null;
  }
  
  listBatches(status = null) {
    let batches = dataStore.getBatches();
    if (status) {
      batches = batches.filter(b => b.status === status);
    }
    return batches.map(b => new Batch(b));
  }
  
  updateBatch(batchNo, updateData) {
    const batch = this.getBatchByNo(batchNo);
    if (!batch) {
      throw new Error(`未找到批次: ${batchNo}`);
    }
    
    if (updateData.outWeight !== undefined && updateData.outMoisture !== undefined) {
      const config = dataStore.getConfig();
      const validation = moistureCalculator.validateMoistureReduction(
        batch.inMoisture,
        updateData.outMoisture,
        config.validation.maxMoistureLoss
      );
      if (!validation.valid) {
        throw new Error(validation.reason);
      }
      
      const weightCheck = moistureCalculator.checkWeightAnomaly(
        batch.inWeight,
        updateData.outWeight,
        batch.inMoisture,
        updateData.outMoisture,
        config.validation.weightLossTolerance
      );
      
      if (weightCheck.isAnomaly) {
        this._recordAnomaly(batchNo, 'weight', weightCheck.message, weightCheck);
      }
      
      updateData.outTime = new Date().toISOString();
    }
    
    batch.update(updateData);
    return dataStore.saveBatch(batch.toJSON());
  }
  
  deleteBatch(batchNo, force = false) {
    const batch = this.getBatchByNo(batchNo);
    if (!batch) {
      throw new Error(`未找到批次: ${batchNo}`);
    }
    
    if (!force && (batch.status === Batch.STATUS.SETTLED || batch.status === Batch.STATUS.APPROVED)) {
      throw new Error(`批次状态为 ${batch.status}，请先撤销结算/审核`);
    }
    
    dataStore.deleteBatch(batch.id);
    return true;
  }
  
  updateBatchStatus(batchNo, newStatus) {
    const batch = this.getBatchByNo(batchNo);
    if (!batch) {
      throw new Error(`未找到批次: ${batchNo}`);
    }
    
    batch.update({ status: newStatus });
    return dataStore.saveBatch(batch.toJSON());
  }
  
  simulateConflict(batchNo) {
    const batch = this.getBatchByNo(batchNo);
    if (!batch) {
      throw new Error(`未找到批次: ${batchNo}`);
    }
    
    const conflictFields = ['outWeight', 'outMoisture', 'fuelUsed', 'powerUsed'];
    const field = conflictFields[Math.floor(Math.random() * conflictFields.length)];
    
    const originalValue = batch[field] || 0;
    const newValue = field === 'outMoisture' 
      ? originalValue + 2
      : originalValue * 1.1;
    
    const conflict = {
      id: uuidv4(),
      batchNo,
      field,
      originalValue,
      newValue,
      status: 'detected',
      detectedAt: new Date().toISOString(),
      resolvedAt: null
    };
    
    dataStore.saveConflict(conflict);
    
    return conflict;
  }
  
  resolveConflict(conflictId, mode = 'reject') {
    const conflict = dataStore.getConflicts().find(c => c.id === conflictId);
    if (!conflict) {
      throw new Error(`未找到冲突: ${conflictId}`);
    }
    
    if (mode === 'merge') {
      const batch = this.getBatchByNo(conflict.batchNo);
      if (batch) {
        batch.update({ [conflict.field]: conflict.newValue });
        dataStore.saveBatch(batch.toJSON());
      }
    }
    
    conflict.status = mode === 'merge' ? 'merged' : 'rejected';
    conflict.resolvedAt = new Date().toISOString();
    dataStore.saveConflict(conflict);
    
    return conflict;
  }
  
  _recordAnomaly(batchNo, type, message, details = {}) {
    dataStore.saveAnomaly({
      id: uuidv4(),
      batchNo,
      type,
      message,
      details,
      detectedAt: new Date().toISOString(),
      status: 'open'
    });
  }
}

module.exports = BatchService;
