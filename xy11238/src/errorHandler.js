const storage = require('./storage');

class ErrorHandler {
  constructor() {
    this.errors = [];
  }

  recordError(options) {
    const {
      source,
      rowNumber,
      originalData,
      errorType,
      errorMessage,
      suggestion
    } = options;

    const error = {
      source,
      rowNumber,
      originalData,
      errorType,
      errorMessage,
      suggestion,
      resolved: false
    };

    this.errors.push(error);
    storage.addErrorRecord(error);
    return error;
  }

  validateApplication(row, rowNumber) {
    const errors = [];

    if (!row.reagentName || row.reagentName.trim() === '') {
      errors.push(this.recordError({
        source: 'application',
        rowNumber,
        originalData: row,
        errorType: 'missing_field',
        errorMessage: '试剂名称不能为空',
        suggestion: '请填写有效的试剂名称'
      }));
    }

    if (!row.applicant || row.applicant.trim() === '') {
      errors.push(this.recordError({
        source: 'application',
        rowNumber,
        originalData: row,
        errorType: 'missing_field',
        errorMessage: '申请人不能为空',
        suggestion: '请填写申请人姓名'
      }));
    }

    if (!row.quantity || isNaN(parseFloat(row.quantity)) || parseFloat(row.quantity) <= 0) {
      errors.push(this.recordError({
        source: 'application',
        rowNumber,
        originalData: row,
        errorType: 'invalid_quantity',
        errorMessage: '数量必须是大于0的数字',
        suggestion: '请修正数量为有效的正数'
      }));
    }

    if (!row.applicationDate) {
      errors.push(this.recordError({
        source: 'application',
        rowNumber,
        originalData: row,
        errorType: 'missing_field',
        errorMessage: '申请日期不能为空',
        suggestion: '请填写申请日期，格式建议：YYYY-MM-DD'
      }));
    }

    return errors;
  }

  validateInventory(item, index) {
    const errors = [];

    if (!item.reagentName || item.reagentName.trim() === '') {
      errors.push(this.recordError({
        source: 'inventory',
        rowNumber: index + 1,
        originalData: item,
        errorType: 'missing_field',
        errorMessage: '试剂名称不能为空',
        suggestion: '请填写有效的试剂名称'
      }));
    }

    if (item.quantity === undefined || isNaN(parseFloat(item.quantity)) || parseFloat(item.quantity) < 0) {
      errors.push(this.recordError({
        source: 'inventory',
        rowNumber: index + 1,
        originalData: item,
        errorType: 'invalid_quantity',
        errorMessage: '库存数量必须是非负数字',
        suggestion: '请修正数量为有效的非负数'
      }));
    }

    return errors;
  }

  validateHazardRule(rule, index) {
    const errors = [];

    if (!rule.reagentName || rule.reagentName.trim() === '') {
      errors.push(this.recordError({
        source: 'hazardRule',
        rowNumber: index + 1,
        originalData: rule,
        errorType: 'missing_field',
        errorMessage: '试剂名称不能为空',
        suggestion: '请填写有效的试剂名称'
      }));
    }

    if (!rule.hazardLevel || !['低', '中', '高', '极高'].includes(rule.hazardLevel)) {
      errors.push(this.recordError({
        source: 'hazardRule',
        rowNumber: index + 1,
        originalData: rule,
        errorType: 'invalid_hazard_level',
        errorMessage: '危险等级必须是：低、中、高、极高',
        suggestion: '请从：低、中、高、极高 中选择一个等级'
      }));
    }

    if (rule.requiresApproval !== undefined && typeof rule.requiresApproval !== 'boolean') {
      errors.push(this.recordError({
        source: 'hazardRule',
        rowNumber: index + 1,
        originalData: rule,
        errorType: 'invalid_type',
        errorMessage: 'requiresApproval 必须是布尔值',
        suggestion: '请设置为 true 或 false'
      }));
    }

    return errors;
  }

  getErrors() {
    return this.errors;
  }

  getErrorsBySource(source) {
    return storage.getErrorRecords().filter(e => e.source === source);
  }

  getAllErrors() {
    return storage.getErrorRecords();
  }

  clearErrors() {
    this.errors = [];
  }
}

module.exports = new ErrorHandler();
