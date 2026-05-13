const db = require('../database/init');
const OperationLogService = require('./OperationLogService');

class BucketValidationService {
  static validateBucketCode(bucketCode) {
    const pattern = /^BT\d{6}$/;
    if (!pattern.test(bucketCode)) {
      return {
        valid: false,
        reason: '桶编号格式不正确，应为 BT 加 6 位数字'
      };
    }
    return { valid: true };
  }

  static checkBucketAvailability(bucketCode) {
    const bucket = db.prepare('SELECT * FROM buckets WHERE bucket_code = ?').get(bucketCode);
    
    if (!bucket) {
      return {
        available: false,
        reason: '桶不存在'
      };
    }

    if (bucket.status !== 'available') {
      const statusMap = {
        'in_use': '正在使用中',
        'damaged': '已损坏',
        'lost': '已丢失',
        'seized': '已扣押'
      };
      return {
        available: false,
        reason: `当前状态: ${statusMap[bucket.status] || bucket.status}`
      };
    }

    return { available: true, bucket };
  }

  static async validateBucketsForDelivery(bucketCodes, operator, operatorName) {
    const results = [];
    let allValid = true;

    for (const code of bucketCodes) {
      const formatValidation = this.validateBucketCode(code);
      if (!formatValidation.valid) {
        results.push({ bucketCode: code, ...formatValidation });
        allValid = false;
        continue;
      }

      const availability = this.checkBucketAvailability(code);
      if (!availability.available) {
        results.push({ bucketCode: code, ...availability });
        allValid = false;
        continue;
      }

      results.push({ bucketCode: code, valid: true, available: true });
    }

    return { allValid, results };
  }

  static async validateBucketsForReturn(bucketCodes, deliveryNo) {
    const results = [];
    let allValid = true;

    const delivery = db.prepare('SELECT * FROM delivery_signoffs WHERE delivery_no = ?').get(deliveryNo);
    if (!delivery) {
      return { allValid: false, results: [{ reason: '配送单不存在' }] };
    }

    const deliveredBuckets = delivery.bucket_codes.split(',');

    for (const code of bucketCodes) {
      const formatValidation = this.validateBucketCode(code);
      if (!formatValidation.valid) {
        results.push({ bucketCode: code, ...formatValidation });
        allValid = false;
        continue;
      }

      if (!deliveredBuckets.includes(code)) {
        results.push({ bucketCode: code, valid: false, reason: '该桶不在本次配送范围内' });
        allValid = false;
        continue;
      }

      const bucket = db.prepare('SELECT * FROM buckets WHERE bucket_code = ?').get(code);
      if (bucket && bucket.status !== 'in_use') {
        results.push({ bucketCode: code, valid: false, reason: '该桶状态不是使用中' });
        allValid = false;
        continue;
      }

      results.push({ bucketCode: code, valid: true });
    }

    return { allValid, results };
  }

  static checkReturnInterceptionRules(returnData) {
    const rules = [];

    if (returnData.bucket_count > 20) {
      rules.push({
        rule: 'LARGE_RETURN_REVIEW',
        block: true,
        reason: '单次退桶超过20个，需要人工复核',
        level: 'warning'
      });
    }

    const customer = db.prepare('SELECT * FROM customer_addresses WHERE id = ?').get(returnData.customer_address_id);
    if (customer && customer.bucket_capacity > 0) {
      const balance = db.prepare('SELECT * FROM bucket_balances WHERE customer_address_id = ?').get(returnData.customer_address_id);
      if (balance) {
        const afterReturn = balance.outstanding_balance - returnData.bucket_count;
        if (afterReturn < -5) {
          rules.push({
            rule: 'NEGATIVE_BALANCE',
            block: true,
            reason: '退桶后欠桶数将超过限额，需要人工复核',
            level: 'error'
          });
        }
      }
    }

    const hasBlockRule = rules.some(r => r.block);
    return {
      shouldBlock: hasBlockRule,
      rules,
      suggestion: hasBlockRule ? 'review' : 'accept'
    };
  }
}

module.exports = BucketValidationService;
