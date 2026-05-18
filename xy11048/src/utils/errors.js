class ApprovalError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ApprovalError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: this.details,
        timestamp: this.timestamp,
        resolution: this.getResolutionGuidance()
      }
    };
  }

  getResolutionGuidance() {
    const guidanceMap = {
      'INVALID_STATE_TRANSITION': '请检查当前审批状态，确保按正确流程操作。如不确定请联系系统管理员。',
      'STATE_TRANSITION_SKIPPED': '审批流程不允许跳级，必须按顺序通过所有审批节点。',
      'DUPLICATE_SUBMISSION': '该申请已在处理中，请不要重复提交。如需修改请先撤回再重新提交。',
      'HAZARDOUS_OVER_QUOTA': '危化试剂领用超过限额，请减少领用量或联系安全管理员申请特殊配额。',
      'SECOND_REVIEW_REQUIRED': '该试剂需要二审，请联系高级安全管理员完成二次审批。',
      'SECOND_REVIEW_MISSING': '高危险等级试剂必须经过二审才能通过，请先提交二审。',
      'AUDIT_INCONSISTENCY': '审计发现数据不一致，请核对领用记录与实际库存差异后重新提交。',
      'INVENTORY_INSUFFICIENT': '库存不足，请先申请采购或减少领用数量。',
      'VALIDATION_ERROR': '请检查必填字段是否完整，格式是否正确。',
      'NOT_FOUND': '记录不存在，请检查ID是否正确。',
      'ETAG_MISMATCH': '数据已被他人修改，请刷新后重新操作。',
      'PERMISSION_DENIED': '您没有权限执行此操作，请联系相应审批人员。',
      'SAFETY_CERT_EXPIRED': '安全培训证明已过期，请重新参加培训后再申请。'
    };
    return guidanceMap[this.code] || '请联系系统管理员获取帮助。';
  }
}

const ErrorCodes = {
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  STATE_TRANSITION_SKIPPED: 'STATE_TRANSITION_SKIPPED',
  DUPLICATE_SUBMISSION: 'DUPLICATE_SUBMISSION',
  HAZARDOUS_OVER_QUOTA: 'HAZARDOUS_OVER_QUOTA',
  SECOND_REVIEW_REQUIRED: 'SECOND_REVIEW_REQUIRED',
  SECOND_REVIEW_MISSING: 'SECOND_REVIEW_MISSING',
  AUDIT_INCONSISTENCY: 'AUDIT_INCONSISTENCY',
  INVENTORY_INSUFFICIENT: 'INVENTORY_INSUFFICIENT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  ETAG_MISMATCH: 'ETAG_MISMATCH',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SAFETY_CERT_EXPIRED: 'SAFETY_CERT_EXPIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

module.exports = { ApprovalError, ErrorCodes };
