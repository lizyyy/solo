const idempotencyDao = require('../dao/idempotencyDao');

class IdempotencyError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'IdempotencyError';
  }
}

const executeWithIdempotency = async (idempotencyKey, actionType, operationFn, ctx = {}) => {
  if (!idempotencyKey) {
    throw new IdempotencyError('幂等键不能为空', 'MISSING_IDEMPOTENCY_KEY');
  }

  const existingKey = idempotencyDao.getIdempotencyKey(idempotencyKey);
  
  if (existingKey) {
    if (existingKey.response_data) {
      return {
        isDuplicate: true,
        data: existingKey.response_data,
        message: '重复请求，返回首次执行结果'
      };
    }
    throw new IdempotencyError('请求正在处理中，请稍后重试', 'REQUEST_IN_PROGRESS');
  }

  const acquired = idempotencyDao.tryAcquireIdempotencyKey(idempotencyKey, actionType);
  
  if (!acquired) {
    const retryCheck = idempotencyDao.getIdempotencyKey(idempotencyKey);
    if (retryCheck && retryCheck.response_data) {
      return {
        isDuplicate: true,
        data: retryCheck.response_data,
        message: '重复请求，返回首次执行结果'
      };
    }
    throw new IdempotencyError('请求正在处理中，请稍后重试', 'REQUEST_IN_PROGRESS');
  }

  try {
    const result = await operationFn(ctx);
    idempotencyDao.updateIdempotencyResponse(idempotencyKey, result.resourceId || null, result);
    return {
      isDuplicate: false,
      data: result,
      message: '执行成功'
    };
  } catch (error) {
    throw error;
  }
};

const checkIdempotency = (idempotencyKey) => {
  const existingKey = idempotencyDao.getIdempotencyKey(idempotencyKey);
  return {
    exists: !!existingKey,
    isComplete: existingKey && existingKey.response_data,
    data: existingKey?.response_data
  };
};

module.exports = {
  executeWithIdempotency,
  checkIdempotency,
  IdempotencyError
};
