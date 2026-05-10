const { idempotentOperations } = require('../models');

const OPERATION_TYPES = {
  CREATE_BOOKING: 'create_booking',
  RESCHEDULE_BOOKING: 'reschedule_booking',
  CANCEL_BOOKING: 'cancel_booking'
};

const checkAndRecordOperation = async (operationId, operationType, operationData) => {
  if (!operationId) {
    throw new Error('操作ID不能为空');
  }
  
  if (idempotentOperations.has(operationId)) {
    const existingOperation = idempotentOperations.get(operationId);
    
    if (existingOperation.type !== operationType) {
      throw new Error(`操作ID ${operationId} 已用于不同类型的操作`);
    }
    
    return {
      isDuplicate: true,
      operation: existingOperation
    };
  }
  
  const newOperation = {
    id: operationId,
    type: operationType,
    data: JSON.parse(JSON.stringify(operationData)),
    status: 'processing',
    createdAt: new Date().toISOString()
  };
  
  idempotentOperations.set(operationId, newOperation);
  
  return {
    isDuplicate: false,
    operation: newOperation
  };
};

const updateOperationResult = async (operationId, result, status = 'success') => {
  if (!idempotentOperations.has(operationId)) {
    throw new Error(`操作ID ${operationId} 不存在`);
  }
  
  const operation = idempotentOperations.get(operationId);
  operation.result = JSON.parse(JSON.stringify(result));
  operation.status = status;
  operation.completedAt = new Date().toISOString();
  
  return operation;
};

const markOperationFailed = async (operationId, error) => {
  if (!idempotentOperations.has(operationId)) {
    throw new Error(`操作ID ${operationId} 不存在`);
  }
  
  const operation = idempotentOperations.get(operationId);
  operation.error = error.message;
  operation.status = 'failed';
  operation.failedAt = new Date().toISOString();
  
  return operation;
};

const getOperation = (operationId) => {
  return idempotentOperations.get(operationId);
};

const isOperationSuccessful = (operationId) => {
  const operation = idempotentOperations.get(operationId);
  return operation && operation.status === 'success';
};

module.exports = {
  OPERATION_TYPES,
  checkAndRecordOperation,
  updateOperationResult,
  markOperationFailed,
  getOperation,
  isOperationSuccessful
};
