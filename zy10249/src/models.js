const { v4: uuidv4 } = require('uuid');

const PACKAGE_STATES = {
  CREATED: '已建档',
  IN_USE: '使用中',
  RECYCLED: '已回收',
  CLEANING: '清洗中',
  CLEANED: '已清洗',
  DISINFECTING: '消毒中',
  DISINFECTED: '已消毒',
  STERILIZING: '灭菌中',
  STERILIZED: '已灭菌',
  STERILIZATION_FAILED: '灭菌失败',
  DISTRIBUTED: '已发放',
  EXPIRED: '已过期'
};

const STATE_TRANSITIONS = {
  [PACKAGE_STATES.CREATED]: [PACKAGE_STATES.IN_USE],
  [PACKAGE_STATES.IN_USE]: [PACKAGE_STATES.RECYCLED],
  [PACKAGE_STATES.RECYCLED]: [PACKAGE_STATES.CLEANING],
  [PACKAGE_STATES.CLEANING]: [PACKAGE_STATES.CLEANED],
  [PACKAGE_STATES.CLEANED]: [PACKAGE_STATES.DISINFECTING],
  [PACKAGE_STATES.DISINFECTING]: [PACKAGE_STATES.DISINFECTED],
  [PACKAGE_STATES.DISINFECTED]: [PACKAGE_STATES.STERILIZING],
  [PACKAGE_STATES.STERILIZING]: [PACKAGE_STATES.STERILIZED, PACKAGE_STATES.STERILIZATION_FAILED],
  [PACKAGE_STATES.STERILIZED]: [PACKAGE_STATES.DISTRIBUTED, PACKAGE_STATES.EXPIRED],
  [PACKAGE_STATES.STERILIZATION_FAILED]: [PACKAGE_STATES.CLEANING],
  [PACKAGE_STATES.DISTRIBUTED]: [PACKAGE_STATES.IN_USE],
  [PACKAGE_STATES.EXPIRED]: [PACKAGE_STATES.CLEANING]
};

class MedicalPackage {
  constructor(data) {
    this.packageId = data.packageId;
    this.name = data.name;
    this.items = data.items || [];
    this.status = PACKAGE_STATES.CREATED;
    this.currentBatchNo = null;
    this.sterilizationExpiry = null;
    this.createdAt = new Date();
    this.createdBy = data.operator;
    this.lastUpdatedAt = new Date();
    this.history = [];
    this.addHistory({
      action: '建档',
      operator: data.operator,
      details: { name: data.name, items: data.items }
    });
  }

  addHistory(entry) {
    this.history.push({
      id: uuidv4(),
      timestamp: new Date(),
      action: entry.action,
      operator: entry.operator,
      details: entry.details || {},
      statusBefore: entry.statusBefore || this.status,
      statusAfter: entry.statusAfter || this.status
    });
    this.lastUpdatedAt = new Date();
  }

  canTransitionTo(newStatus) {
    const allowedTransitions = STATE_TRANSITIONS[this.status] || [];
    return allowedTransitions.includes(newStatus);
  }

  transitionTo(newStatus, operator, action, details = {}) {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(`无法从 ${this.status} 转换到 ${newStatus}`);
    }
    const statusBefore = this.status;
    this.status = newStatus;
    this.addHistory({
      action,
      operator,
      details,
      statusBefore,
      statusAfter: newStatus
    });
    return true;
  }
}

class SterilizationBatch {
  constructor(batchNo, data) {
    this.batchNo = batchNo;
    this.method = data.method;
    this.temperature = data.temperature;
    this.duration = data.duration;
    this.pressure = data.pressure;
    this.operator = data.operator;
    this.packages = [];
    this.result = data.result;
    this.startTime = new Date();
    this.completedAt = new Date();
    this.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  addPackage(packageId) {
    if (this.packages.includes(packageId)) {
      throw new Error(`器械包 ${packageId} 已在本批次中`);
    }
    this.packages.push(packageId);
  }

  isExpired() {
    return new Date() > this.expiryDate;
  }
}

class IdempotencyManager {
  constructor() {
    this.requestCache = new Map();
  }

  generateKey(...args) {
    return args.join('|');
  }

  check(key) {
    if (this.requestCache.has(key)) {
      const data = this.requestCache.get(key);
      if (data.result.success) {
        return { exists: true, success: true, data };
      }
      this.requestCache.delete(key);
    }
    return { exists: false };
  }

  setSuccess(key, result) {
    this.requestCache.set(key, { result, timestamp: new Date() });
  }

  delete(key) {
    this.requestCache.delete(key);
  }

  get(key) {
    return this.requestCache.get(key);
  }
}

const packages = new Map();
const batches = new Map();
const idempotencyManager = new IdempotencyManager();

module.exports = {
  PACKAGE_STATES,
  STATE_TRANSITIONS,
  MedicalPackage,
  SterilizationBatch,
  IdempotencyManager,
  packages,
  batches,
  idempotencyManager
};
