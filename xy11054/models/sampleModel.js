const { v4: uuidv4 } = require('uuid');

const SAMPLE_STATUS = {
  CREATED: 'created',
  IN_STORAGE: 'in_storage',
  INSPECTED: 'inspected',
  DESTROYED: 'destroyed',
  EXPIRED: 'expired'
};

const STATUS_TRANSITIONS = {
  [SAMPLE_STATUS.CREATED]: {
    allowed: [SAMPLE_STATUS.IN_STORAGE, SAMPLE_STATUS.DESTROYED],
    actions: {
      [SAMPLE_STATUS.IN_STORAGE]: '入库存储',
      [SAMPLE_STATUS.DESTROYED]: '直接销毁'
    }
  },
  [SAMPLE_STATUS.IN_STORAGE]: {
    allowed: [SAMPLE_STATUS.INSPECTED, SAMPLE_STATUS.EXPIRED, SAMPLE_STATUS.DESTROYED],
    actions: {
      [SAMPLE_STATUS.INSPECTED]: '送检',
      [SAMPLE_STATUS.EXPIRED]: '过期',
      [SAMPLE_STATUS.DESTROYED]: '销毁'
    }
  },
  [SAMPLE_STATUS.INSPECTED]: {
    allowed: [SAMPLE_STATUS.DESTROYED],
    actions: {
      [SAMPLE_STATUS.DESTROYED]: '检验后销毁'
    }
  },
  [SAMPLE_STATUS.DESTROYED]: {
    allowed: [],
    actions: {}
  },
  [SAMPLE_STATUS.EXPIRED]: {
    allowed: [SAMPLE_STATUS.DESTROYED],
    actions: {
      [SAMPLE_STATUS.DESTROYED]: '过期后销毁'
    }
  }
};

function canTransition(currentStatus, newStatus) {
  const transitions = STATUS_TRANSITIONS[currentStatus];
  if (!transitions) return false;
  return transitions.allowed.includes(newStatus);
}

function getAllowedActions(currentStatus) {
  const transitions = STATUS_TRANSITIONS[currentStatus];
  if (!transitions) return [];
  return transitions.allowed.map(status => ({
    status,
    action: transitions.actions[status]
  }));
}

function createSample(data) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    sampleBoxCode: data.sampleBoxCode,
    pastryName: data.pastryName,
    pastryType: data.pastryType,
    productionBatch: data.productionBatch,
    productionLine: data.productionLine,
    productionTime: data.productionTime,
    productionQuantity: data.productionQuantity,
    sampler: data.sampler,
    sampleQuantity: data.sampleQuantity,
    storageLocation: data.storageLocation,
    storageTemperature: data.storageTemperature,
    retentionPeriod: data.retentionPeriod || 48,
    status: SAMPLE_STATUS.CREATED,
    statusHistory: [{
      status: SAMPLE_STATUS.CREATED,
      timestamp: now,
      operator: data.operator || data.sampler,
      source: data.source || 'manual',
      remark: '留样创建'
    }],
    inspectionResult: null,
    inspectionTime: null,
    inspector: null,
    destroyTime: null,
    destroyer: null,
    createdAt: now,
    updatedAt: now
  };
}

function validateSampleData(data) {
  const errors = [];
  
  if (!data.sampleBoxCode || data.sampleBoxCode.trim() === '') {
    errors.push('留样盒编号不能为空');
  }
  
  if (!data.pastryName || data.pastryName.trim() === '') {
    errors.push('糕点名称不能为空');
  }
  
  if (!data.productionBatch || data.productionBatch.trim() === '') {
    errors.push('生产批次不能为空');
  }
  
  if (!data.sampler || data.sampler.trim() === '') {
    errors.push('取样人不能为空');
  }
  
  return errors;
}

module.exports = {
  SAMPLE_STATUS,
  STATUS_TRANSITIONS,
  canTransition,
  getAllowedActions,
  createSample,
  validateSampleData
};
