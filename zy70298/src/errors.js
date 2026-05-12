const ERROR_CODES = {
  ELDER_NOT_FOUND: {
    code: 'ELDER_NOT_FOUND',
    http: 404,
    message: '老人档案不存在',
    issueType: 'elder_not_found',
    severity: 'error'
  },
  PRESCRIPTION_NOT_FOUND: {
    code: 'PRESCRIPTION_NOT_FOUND',
    http: 404,
    message: '医嘱不存在',
    issueType: 'prescription_not_found',
    severity: 'error'
  },
  PILL_BOX_NOT_FOUND: {
    code: 'PILL_BOX_NOT_FOUND',
    http: 404,
    message: '药盒不存在',
    issueType: 'pill_box_not_found',
    severity: 'error'
  },
  DISTRIBUTION_NOT_FOUND: {
    code: 'DISTRIBUTION_NOT_FOUND',
    http: 404,
    message: '分发记录不存在',
    issueType: 'distribution_not_found',
    severity: 'error'
  },
  RECEIPT_NOT_FOUND: {
    code: 'RECEIPT_NOT_FOUND',
    http: 404,
    message: '回执不存在',
    issueType: 'receipt_not_found',
    severity: 'error'
  },
  
  INVALID_ELDER_STATUS: {
    code: 'INVALID_ELDER_STATUS',
    http: 400,
    message: '老人状态不可用药',
    issueType: 'invalid_elder_status',
    severity: 'warning'
  },
  PRESCRIPTION_EXPIRED: {
    code: 'PRESCRIPTION_EXPIRED',
    http: 400,
    message: '医嘱已过期',
    issueType: 'prescription_expired',
    severity: 'error'
  },
  PRESCRIPTION_NOT_EFFECTIVE: {
    code: 'PRESCRIPTION_NOT_EFFECTIVE',
    http: 400,
    message: '医嘱尚未生效',
    issueType: 'prescription_not_effective',
    severity: 'warning'
  },
  PRESCRIPTION_INACTIVE: {
    code: 'PRESCRIPTION_INACTIVE',
    http: 400,
    message: '医嘱已停用',
    issueType: 'prescription_inactive',
    severity: 'error'
  },
  PILL_BOX_ELDER_MISMATCH: {
    code: 'PILL_BOX_ELDER_MISMATCH',
    http: 400,
    message: '药盒与老人不匹配',
    issueType: 'pill_box_elder_mismatch',
    severity: 'error'
  },
  PRESCRIPTION_ELDER_MISMATCH: {
    code: 'PRESCRIPTION_ELDER_MISMATCH',
    http: 400,
    message: '医嘱与老人不匹配',
    issueType: 'prescription_elder_mismatch',
    severity: 'error'
  },
  
  MEDICINE_MISMATCH: {
    code: 'MEDICINE_MISMATCH',
    http: 400,
    message: '药品与医嘱不匹配',
    issueType: 'medicine_mismatch',
    severity: 'error'
  },
  DOSAGE_MISMATCH: {
    code: 'DOSAGE_MISMATCH',
    http: 400,
    message: '剂量与医嘱不匹配',
    issueType: 'dosage_mismatch',
    severity: 'error'
  },
  QUANTITY_MISMATCH: {
    code: 'QUANTITY_MISMATCH',
    http: 400,
    message: '数量与医嘱不匹配',
    issueType: 'quantity_mismatch',
    severity: 'warning'
  },
  EXTRA_MEDICINE: {
    code: 'EXTRA_MEDICINE',
    http: 400,
    message: '药盒含未医嘱药品',
    issueType: 'extra_medicine',
    severity: 'error'
  },
  MISSING_MEDICINE: {
    code: 'MISSING_MEDICINE',
    http: 400,
    message: '药盒缺少医嘱药品',
    issueType: 'missing_medicine',
    severity: 'error'
  },
  
  RECEIPT_ELDER_MISMATCH: {
    code: 'RECEIPT_ELDER_MISMATCH',
    http: 400,
    message: '回执与分发老人不匹配',
    issueType: 'receipt_elder_mismatch',
    severity: 'error'
  },
  RECEIPT_MEDICINE_MISMATCH: {
    code: 'RECEIPT_MEDICINE_MISMATCH',
    http: 400,
    message: '回执药品与分发不匹配',
    issueType: 'receipt_medicine_mismatch',
    severity: 'error'
  },
  INVALID_DISTRIBUTION_STATUS: {
    code: 'INVALID_DISTRIBUTION_STATUS',
    http: 400,
    message: '分发状态不允许此操作',
    issueType: 'invalid_distribution_status',
    severity: 'warning'
  },
  INVALID_PILL_BOX_STATUS: {
    code: 'INVALID_PILL_BOX_STATUS',
    http: 400,
    message: '药盒状态不允许此操作',
    issueType: 'invalid_pill_box_status',
    severity: 'warning'
  },
  
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    http: 400,
    message: '输入参数校验失败',
    issueType: 'validation_error',
    severity: 'warning'
  }
};

class BusinessError extends Error {
  constructor(errorKey, details, sourceType, sourceId) {
    const error = ERROR_CODES[errorKey] || ERROR_CODES.VALIDATION_ERROR;
    super(error.message);
    this.name = 'BusinessError';
    this.code = error.code;
    this.http = error.http;
    this.issueType = error.issueType;
    this.severity = error.severity;
    this.details = details;
    this.sourceType = sourceType;
    this.sourceId = sourceId;
  }
  
  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      },
      issueRecorded: true
    };
  }
}

module.exports = {
  ERROR_CODES,
  BusinessError
};
