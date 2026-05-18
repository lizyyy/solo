class PriceComparator {
  constructor(config) {
    this.config = config;
    this.fields = config.fields || {};
    this.rules = config.rules || {};
  }

  getField(record, fieldName) {
    const key = this.fields[fieldName] || fieldName;
    return record[key];
  }

  isMidnightEffective(snapshotTime) {
    if (!this.rules.midnightEffective?.enabled) return false;
    
    const time = new Date(snapshotTime);
    const hours = time.getHours();
    const minutes = time.getMinutes();
    
    const { start, end, toleranceMinutes } = this.rules.midnightEffective.timeRange;
    const [startHour] = start.split(':').map(Number);
    const [endHour] = end.split(':').map(Number);
    
    return hours >= startHour && hours < endHour;
  }

  isStoreClosed(record) {
    if (!this.rules.storeClosed?.enabled) return false;
    
    const statusField = this.rules.storeClosed.statusField;
    const closedValue = this.rules.storeClosed.closedValue;
    return record[statusField] === closedValue;
  }

  isOldOrder(record) {
    if (!this.rules.oldOrder?.enabled) return false;
    
    const orderDateField = this.rules.oldOrder.orderDateField;
    const versionDateField = this.rules.oldOrder.versionDateField;
    const gracePeriodDays = this.rules.oldOrder.gracePeriodDays;
    
    const orderDate = new Date(record[orderDateField]);
    const versionDate = new Date(record[versionDateField]);
    const diffDays = (versionDate - orderDate) / (1000 * 60 * 60 * 24);
    
    return diffDays > gracePeriodDays;
  }

  pricesMatch(actual, expected) {
    const tolerance = this.rules.priceMatch?.tolerance || 0.01;
    return Math.abs(actual - expected) < tolerance;
  }

  compareRecord(record, index) {
    const result = {
      recordIndex: index,
      storeId: this.getField(record, 'storeId'),
      storeName: this.getField(record, 'storeName'),
      itemId: this.getField(record, 'itemId'),
      itemName: this.getField(record, 'itemName'),
      actualPrice: this.getField(record, 'actualPrice'),
      expectedPrice: this.getField(record, 'expectedPrice'),
      effectiveDate: this.getField(record, 'effectiveDate'),
      snapshotTime: this.getField(record, 'snapshotTime'),
      priceVersion: this.getField(record, 'priceVersion'),
      orderId: this.getField(record, 'orderId'),
      matched: false,
      mismatchType: null,
      appliedRules: [],
      details: {}
    };

    try {
      if (this.isStoreClosed(record)) {
        result.appliedRules.push('门店停业');
        result.details.门店停业 = '门店停业期间价格不校验';
        result.matched = true;
        return result;
      }

      if (this.isOldOrder(record)) {
        result.appliedRules.push('旧订单');
        result.details.旧订单 = '历史订单使用下单时价格版本';
      }

      if (this.isMidnightEffective(result.snapshotTime)) {
        result.appliedRules.push('半夜生效');
        result.details.半夜生效 = '00:00-06:00生效价格特殊处理';
      }

      const actual = parseFloat(result.actualPrice);
      const expected = parseFloat(result.expectedPrice);

      if (isNaN(actual) || isNaN(expected)) {
        result.mismatchType = '价格格式错误';
        result.details.价格格式错误 = `实际价格:${result.actualPrice}, 期望价格:${result.expectedPrice}`;
        return result;
      }

      result.matched = this.pricesMatch(actual, expected);
      
      if (!result.matched) {
        result.mismatchType = '价格不匹配';
        result.details.价格差异 = (actual - expected).toFixed(4);
      }

      return result;

    } catch (error) {
      result.mismatchType = '处理异常';
      result.details.异常信息 = error.message;
      return result;
    }
  }

  compare(data) {
    const records = Array.isArray(data) ? data : (data.records || data);
    const results = [];
    const errors = [];

    records.forEach((record, index) => {
      try {
        const result = this.compareRecord(record, index);
        results.push(result);
      } catch (error) {
        errors.push({
          recordIndex: index,
          error: error.message,
          record: JSON.stringify(record).substring(0, 200)
        });
      }
    });

    const matched = results.filter(r => r.matched).length;
    const mismatched = results.filter(r => !r.matched).length;

    return {
      totalRecords: records.length,
      processed: results.length,
      matched: matched,
      mismatched: mismatched,
      errors: errors.length,
      matchRate: records.length > 0 ? (matched / records.length * 100) : 0,
      results: results,
      errors: errors
    };
  }

  generateSummary(allResults) {
    let totalRecords = 0;
    let matched = 0;
    let mismatched = 0;
    let errors = 0;
    const breakdown = {};

    allResults.forEach(fileResult => {
      totalRecords += fileResult.totalRecords || 0;
      matched += fileResult.matched || 0;
      mismatched += fileResult.mismatched || 0;
      errors += fileResult.errors || 0;

      if (fileResult.results) {
        fileResult.results.forEach(r => {
          r.appliedRules?.forEach(rule => {
            breakdown[rule] = (breakdown[rule] || 0) + 1;
          });
          if (r.mismatchType) {
            breakdown[r.mismatchType] = (breakdown[r.mismatchType] || 0) + 1;
          }
        });
      }
    });

    return {
      totalRecords,
      matched,
      mismatched,
      errors,
      matchRate: totalRecords > 0 ? (matched / totalRecords * 100) : 0,
      breakdown
    };
  }
}

module.exports = PriceComparator;
