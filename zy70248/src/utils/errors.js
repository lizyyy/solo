class BusinessError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'BusinessError';
  }
}

const ErrorCodes = {
  SHIP_NOT_FOUND: 'SHIP_NOT_FOUND',
  BERTHING_NOT_FOUND: 'BERTHING_NOT_FOUND',
  CONTRACT_NOT_FOUND: 'CONTRACT_NOT_FOUND',
  CONTRACT_EXPIRED: 'CONTRACT_EXPIRED',
  CONTRACT_INACTIVE: 'CONTRACT_INACTIVE',
  BERTHING_STATE_INVALID: 'BERTHING_STATE_INVALID',
  METER_READING_INVALID: 'METER_READING_INVALID',
  READING_SEQUENCE_ERROR: 'READING_SEQUENCE_ERROR',
  READING_DECREASED: 'READING_DECREASED',
  INTERRUPTION_OVERLAP: 'INTERRUPTION_OVERLAP',
  INTERRUPTION_NOT_FOUND: 'INTERRUPTION_NOT_FOUND',
  SETTLEMENT_NOT_FOUND: 'SETTLEMENT_NOT_FOUND',
  SETTLEMENT_ALREADY_REVIEWED: 'SETTLEMENT_ALREADY_REVIEWED',
  SETTLEMENT_REJECTED: 'SETTLEMENT_REJECTED',
  NO_ACTIVE_CONTRACT: 'NO_ACTIVE_CONTRACT',
  NO_METER_READINGS: 'NO_METER_READINGS',
  BERTHING_NOT_COMPLETED: 'BERTHING_NOT_COMPLETED',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  READING_EXCEEDS_EXPECTED: 'READING_EXCEEDS_EXPECTED',
  DURATION_DISCREPANCY: 'DURATION_DISCREPANCY',
  INTERRUPTION_DURATION_EXCEEDS: 'INTERRUPTION_DURATION_EXCEEDS'
};

const ErrorMessages = {
  [ErrorCodes.SHIP_NOT_FOUND]: '船舶不存在',
  [ErrorCodes.BERTHING_NOT_FOUND]: '靠泊记录不存在',
  [ErrorCodes.CONTRACT_NOT_FOUND]: '合同不存在',
  [ErrorCodes.CONTRACT_EXPIRED]: '合同已过期',
  [ErrorCodes.CONTRACT_INACTIVE]: '合同未激活',
  [ErrorCodes.BERTHING_STATE_INVALID]: '靠泊状态无效',
  [ErrorCodes.METER_READING_INVALID]: '岸电读数无效',
  [ErrorCodes.READING_SEQUENCE_ERROR]: '读数时间顺序错误',
  [ErrorCodes.READING_DECREASED]: '岸电读数不能递减',
  [ErrorCodes.INTERRUPTION_OVERLAP]: '中断事件时间重叠',
  [ErrorCodes.INTERRUPTION_NOT_FOUND]: '中断事件不存在',
  [ErrorCodes.SETTLEMENT_NOT_FOUND]: '结算记录不存在',
  [ErrorCodes.SETTLEMENT_ALREADY_REVIEWED]: '结算已复核，无法修改',
  [ErrorCodes.SETTLEMENT_REJECTED]: '结算已被驳回',
  [ErrorCodes.NO_ACTIVE_CONTRACT]: '该船舶没有有效的合同',
  [ErrorCodes.NO_METER_READINGS]: '没有可用的岸电读数',
  [ErrorCodes.BERTHING_NOT_COMPLETED]: '靠泊尚未完成，无法结算',
  [ErrorCodes.INVALID_PARAMETERS]: '参数无效',
  [ErrorCodes.READING_EXCEEDS_EXPECTED]: '岸电读数超出预期范围，需要复核',
  [ErrorCodes.DURATION_DISCREPANCY]: '用电时长与靠泊时段存在差异，需要复核',
  [ErrorCodes.INTERRUPTION_DURATION_EXCEEDS]: '中断时长超过预期，需要复核'
};

function createError(code, details = {}) {
  return new BusinessError(code, ErrorMessages[code] || '未知错误', details);
}

function handleError(res, error) {
  if (error instanceof BusinessError) {
    return res.status(400).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
  }

  console.error('Unexpected error:', error);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      details: {}
    }
  });
}

module.exports = {
  BusinessError,
  ErrorCodes,
  createError,
  handleError
};
