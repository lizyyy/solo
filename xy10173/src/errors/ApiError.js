class ApiError extends Error {
  constructor(code, message, httpStatus = 400, details = {}) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    this.name = 'ApiError';
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: Object.keys(this.details).length > 0 ? this.details : undefined
      }
    };
  }
}

class MemberNotFoundError extends ApiError {
  constructor(memberId) {
    super('MEMBER_NOT_FOUND', `会员不存在: ${memberId}`, 404, { memberId });
  }
}

class InsufficientBalanceError extends ApiError {
  constructor(available, required) {
    super('INSUFFICIENT_BALANCE', '可用余额不足', 400, { available, required });
  }
}

class IdempotentConflictError extends ApiError {
  constructor(requestId, action, existingResult) {
    super('IDEMPOTENT_CONFLICT', '请求已处理，结果与之前一致', 409, { requestId, action, existingResult });
    this.existingResult = existingResult;
  }
}

class FreezeRuleNotFoundError extends ApiError {
  constructor(code) {
    super('FREEZE_RULE_NOT_FOUND', `冻结规则不存在: ${code}`, 404, { code });
  }
}

class InvalidAmountError extends ApiError {
  constructor(amount, reason) {
    super('INVALID_AMOUNT', `无效金额: ${reason}`, 400, { amount, reason });
  }
}

class FreezeBucketNotFoundError extends ApiError {
  constructor(bucketId) {
    super('FREEZE_BUCKET_NOT_FOUND', `冻结桶不存在: ${bucketId}`, 404, { bucketId });
  }
}

class ValidationError extends ApiError {
  constructor(message, details) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

module.exports = {
  ApiError,
  MemberNotFoundError,
  InsufficientBalanceError,
  IdempotentConflictError,
  FreezeRuleNotFoundError,
  InvalidAmountError,
  FreezeBucketNotFoundError,
  ValidationError
};
