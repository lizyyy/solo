const { v4: uuidv4 } = require('uuid');

const BATCH_STATUS = {
  CREATED: 'created',
  DATA_COMPLETE: 'data_complete',
  PENDING_REVIEW: 'pending_review',
  REVIEWING: 'reviewing',
  REVIEW_REJECTED: 'review_rejected',
  APPROVED: 'approved',
  SETTLED: 'settled',
  ROLLBACK: 'rollback',
  CANCELLED: 'cancelled'
};

class Batch {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.batchNo = data.batchNo;
    this.grainType = data.grainType;
    
    this.inWeight = data.inWeight;
    this.inMoisture = data.inMoisture;
    this.inTemp = data.inTemp;
    this.inTime = data.inTime || new Date().toISOString();
    
    this.outWeight = data.outWeight;
    this.outMoisture = data.outMoisture;
    this.outTemp = data.outTemp;
    this.outTime = data.outTime;
    
    this.dryingTime = data.dryingTime;
    this.fuelUsed = data.fuelUsed;
    this.powerUsed = data.powerUsed;
    
    this.status = data.status || BATCH_STATUS.CREATED;
    this.version = data.version || 1;
    this.history = data.history || [];
    this.notes = data.notes;
    
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    
    this._calculateStatus();
  }
  
  _calculateStatus() {
    if (this.status === BATCH_STATUS.SETTLED || 
        this.status === BATCH_STATUS.ROLLBACK ||
        this.status === BATCH_STATUS.CANCELLED ||
        this.status === BATCH_STATUS.PENDING_REVIEW ||
        this.status === BATCH_STATUS.REVIEWING ||
        this.status === BATCH_STATUS.APPROVED ||
        this.status === BATCH_STATUS.REVIEW_REJECTED) {
      return;
    }
    
    const hasOutData = this.outWeight !== undefined && 
                       this.outWeight > 0 &&
                       this.outMoisture !== undefined;
    const hasEnergyData = this.dryingTime !== undefined ||
                          this.fuelUsed !== undefined ||
                          this.powerUsed !== undefined;
    
    if (hasOutData) {
      this.status = BATCH_STATUS.DATA_COMPLETE;
    }
  }
  
  update(data) {
    if (this.status === BATCH_STATUS.SETTLED || 
        this.status === BATCH_STATUS.CANCELLED) {
      throw new Error(`批次状态为 ${this.status}，无法更新`);
    }
    
    this.history.push({
      version: this.version,
      snapshot: JSON.parse(JSON.stringify(this)),
      changedAt: this.updatedAt
    });
    
    Object.assign(this, data);
    this.version += 1;
    this.updatedAt = new Date().toISOString();
    this._calculateStatus();
    
    return this;
  }
  
  canSubmitReview() {
    return this.status === BATCH_STATUS.DATA_COMPLETE ||
           this.status === BATCH_STATUS.REVIEW_REJECTED;
  }
  
  canSettle() {
    return this.status === BATCH_STATUS.APPROVED;
  }
  
  isEditable() {
    return this.status === BATCH_STATUS.CREATED ||
           this.status === BATCH_STATUS.DATA_COMPLETE ||
           this.status === BATCH_STATUS.REVIEW_REJECTED;
  }
  
  toJSON() {
    return {
      id: this.id,
      batchNo: this.batchNo,
      grainType: this.grainType,
      inWeight: this.inWeight,
      inMoisture: this.inMoisture,
      inTemp: this.inTemp,
      inTime: this.inTime,
      outWeight: this.outWeight,
      outMoisture: this.outMoisture,
      outTemp: this.outTemp,
      outTime: this.outTime,
      dryingTime: this.dryingTime,
      fuelUsed: this.fuelUsed,
      powerUsed: this.powerUsed,
      status: this.status,
      version: this.version,
      history: this.history,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

Batch.STATUS = BATCH_STATUS;

module.exports = Batch;
