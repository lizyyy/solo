class BusinessError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details;
    this.userMessage = message;
  }

  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.userMessage,
      details: this.details
    };
  }
}

const ErrorMessages = {
  DUPLICATE_CREDIT: (accountName, sourceType, existingSource, handler) => ({
    message: `检测到重复授信记录`,
    code: 'DUPLICATE_CREDIT',
    details: {
      accountName,
      newSource: sourceType,
      existingSource: existingSource,
      handler: handler || '请联系客户经理确认',
      suggestion: `该账户"${accountName}"已有来自${existingSource}的授信记录。新记录来自${sourceType}，请确认是补充材料还是需要修改结论。如需修改请标注"修改结论"，如仅为补充材料请联系${handler || '客户经理'}。`
    }
  }),
  
  INVALID_AMOUNT: (field, value) => ({
    message: `金额输入有误`,
    code: 'INVALID_AMOUNT',
    details: {
      field,
      value,
      suggestion: `请检查${field}是否为有效的数字，当前输入"${value}"无法识别，请重新填写。`
    }
  }),
  
  MISSING_REQUIRED: (field, fieldLabel) => ({
    message: `${fieldLabel}不能为空`,
    code: 'MISSING_REQUIRED',
    details: {
      field,
      fieldLabel,
      suggestion: `请填写${fieldLabel}后再提交。`
    }
  }),
  
  ACCOUNT_NOT_FOUND: (accountId) => ({
    message: `找不到对应的账户信息`,
    code: 'ACCOUNT_NOT_FOUND',
    details: {
      accountId,
      suggestion: `请确认账户编号"${accountId}"是否正确，或先在账户管理中添加该账户。`
    }
  }),
  
  INVALID_SOURCE_TYPE: (sourceType) => ({
    message: `数据来源类型不正确`,
    code: 'INVALID_SOURCE_TYPE',
    details: {
      sourceType,
      suggestion: `请从下拉列表中选择正确的数据来源：补充邮件、复核日报或授信台账。`
    }
  }),
  
  RECORD_NOT_FOUND: (recordId) => ({
    message: `找不到该记录`,
    code: 'RECORD_NOT_FOUND',
    details: {
      recordId,
      suggestion: `该记录可能已被删除，请刷新页面后重试。`
    }
  }),
  
  INSUFFICIENT_CREDIT: (accountName, available, requested) => ({
    message: `可用额度不足`,
    code: 'INSUFFICIENT_CREDIT',
    details: {
      accountName,
      available,
      requested,
      suggestion: `账户"${accountName}"当前可用额度为${available}万元，本次申请使用${requested}万元，超出额度${(requested - available).toFixed(2)}万元，请与客户确认是否需要调整授信。`
    }
  })
};

module.exports = { BusinessError, ErrorMessages };
