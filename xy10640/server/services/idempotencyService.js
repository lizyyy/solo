const { get, run } = require('../database/db');

class IdempotencyService {
  static async checkAndSet(key, operationType, resultData) {
    const existing = await get(
      'SELECT * FROM idempotency_records WHERE idempotency_key = ?',
      [key]
    );
    
    if (existing) {
      return {
        isDuplicate: true,
        result: JSON.parse(existing.result_data)
      };
    }

    await run(
      'INSERT INTO idempotency_records (idempotency_key, operation_type, result_data) VALUES (?, ?, ?)',
      [key, operationType, JSON.stringify(resultData)]
    );

    return { isDuplicate: false, result: resultData };
  }

  static async getResult(key) {
    const record = await get(
      'SELECT * FROM idempotency_records WHERE idempotency_key = ?',
      [key]
    );
    return record ? JSON.parse(record.result_data) : null;
  }
}

module.exports = IdempotencyService;