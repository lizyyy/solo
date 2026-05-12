const crypto = require('crypto');
const IdempotencyRecord = require('../models/IdempotencyRecord');

class IdempotencyService {
  generateRequestKey(operation, ...params) {
    const data = `${operation}:${params.join(':')}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  checkAndExecute(requestKey, operation, applicationId, executor) {
    const existing = IdempotencyRecord.findByRequestKey(requestKey);
    
    if (existing) {
      return {
        isDuplicate: true,
        data: existing.response_data ? JSON.parse(existing.response_data) : null,
        message: '幂等性检查通过，返回上次执行结果'
      };
    }

    const result = executor();

    IdempotencyRecord.create({
      request_key: requestKey,
      application_id: applicationId,
      operation,
      response_data: JSON.stringify(result)
    });

    return {
      isDuplicate: false,
      data: result,
      message: '首次执行成功'
    };
  }

  check(requestKey) {
    const existing = IdempotencyRecord.findByRequestKey(requestKey);
    return existing ? {
      isDuplicate: true,
      data: existing.response_data ? JSON.parse(existing.response_data) : null
    } : { isDuplicate: false };
  }

  record(requestKey, operation, applicationId, result) {
    const existing = IdempotencyRecord.findByRequestKey(requestKey);
    if (existing) {
      return existing;
    }

    return IdempotencyRecord.create({
      request_key: requestKey,
      application_id: applicationId,
      operation,
      response_data: JSON.stringify(result)
    });
  }
}

module.exports = new IdempotencyService();
