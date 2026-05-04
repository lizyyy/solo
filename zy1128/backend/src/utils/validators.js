import { parseDate, isValidDate } from './dateUtils.js';

export const ValidationError = class ValidationError extends Error {
  constructor(message, field, value, rowNumber) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.rowNumber = rowNumber;
  }
  
  toJSON() {
    return {
      error: this.message,
      field: this.field,
      value: this.value,
      rowNumber: this.rowNumber
    };
  }
};

export const validateProduct = (data, rowNumber = null) => {
  const errors = [];
  
  if (!data.product_code || String(data.product_code).trim() === '') {
    errors.push(new ValidationError('产品代码不能为空', 'product_code', data.product_code, rowNumber));
  }
  
  if (!data.product_name || String(data.product_name).trim() === '') {
    errors.push(new ValidationError('产品名称不能为空', 'product_name', data.product_name, rowNumber));
  }
  
  const validTypes = ['bank_wealth', 'money_market', 'broker_cash'];
  if (!data.product_type || !validTypes.includes(data.product_type)) {
    errors.push(new ValidationError(`产品类型必须是: ${validTypes.join(', ')}`, 'product_type', data.product_type, rowNumber));
  }
  
  if (!data.platform || String(data.platform).trim() === '') {
    errors.push(new ValidationError('平台不能为空', 'platform', data.platform, rowNumber));
  }
  
  const rate = parseFloat(data.expected_annual_rate);
  if (isNaN(rate) || rate < 0 || rate > 100) {
    errors.push(new ValidationError('预期年化收益率必须是0-100之间的数字', 'expected_annual_rate', data.expected_annual_rate, rowNumber));
  }
  
  if (data.management_fee_rate !== undefined && data.management_fee_rate !== null && data.management_fee_rate !== '') {
    const mFee = parseFloat(data.management_fee_rate);
    if (isNaN(mFee) || mFee < 0 || mFee > 100) {
      errors.push(new ValidationError('管理费率必须是0-100之间的数字', 'management_fee_rate', data.management_fee_rate, rowNumber));
    }
  }
  
  if (data.redemption_fee_rate !== undefined && data.redemption_fee_rate !== null && data.redemption_fee_rate !== '') {
    const rFee = parseFloat(data.redemption_fee_rate);
    if (isNaN(rFee) || rFee < 0 || rFee > 100) {
      errors.push(new ValidationError('赎回费率必须是0-100之间的数字', 'redemption_fee_rate', data.redemption_fee_rate, rowNumber));
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    cleanedData: {
      product_code: String(data.product_code).trim(),
      product_name: String(data.product_name).trim(),
      product_type: data.product_type,
      platform: String(data.platform).trim(),
      expected_annual_rate: rate,
      management_fee_rate: data.management_fee_rate ? parseFloat(data.management_fee_rate) : 0,
      redemption_fee_rate: data.redemption_fee_rate ? parseFloat(data.redemption_fee_rate) : 0
    }
  };
};

export const validateTransaction = (data, rowNumber = null) => {
  const errors = [];
  
  if (!data.transaction_date || !isValidDate(data.transaction_date)) {
    errors.push(new ValidationError('交易日期无效或格式不正确', 'transaction_date', data.transaction_date, rowNumber));
  }
  
  const amount = parseFloat(data.transaction_amount);
  if (isNaN(amount)) {
    errors.push(new ValidationError('交易金额必须是数字', 'transaction_amount', data.transaction_amount, rowNumber));
  }
  
  const validTypes = ['income', 'expense', 'transfer', 'principal_return', 'interest', 'fee'];
  if (!data.transaction_type || !validTypes.includes(data.transaction_type)) {
    errors.push(new ValidationError(`交易类型必须是: ${validTypes.join(', ')}`, 'transaction_type', data.transaction_type, rowNumber));
  }
  
  if (!data.account_name && !data.account_id) {
    errors.push(new ValidationError('账户名称或账户ID不能为空', 'account_name', data.account_name, rowNumber));
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    cleanedData: {
      transaction_date: parseDate(data.transaction_date),
      transaction_amount: amount,
      transaction_type: data.transaction_type,
      account_name: data.account_name ? String(data.account_name).trim() : null,
      account_id: data.account_id ? parseInt(data.account_id) : null,
      description: data.description ? String(data.description).trim() : null,
      reference_number: data.reference_number ? String(data.reference_number).trim() : null
    }
  };
};

export const validateSubscription = (data, rowNumber = null) => {
  const errors = [];
  
  if (!data.product_code && !data.product_id) {
    errors.push(new ValidationError('产品代码或产品ID不能为空', 'product_code', data.product_code, rowNumber));
  }
  
  if (!data.holder_name && !data.holder_id) {
    errors.push(new ValidationError('持有人名称或持有人ID不能为空', 'holder_name', data.holder_name, rowNumber));
  }
  
  if (!data.account_name && !data.account_id) {
    errors.push(new ValidationError('账户名称或账户ID不能为空', 'account_name', data.account_name, rowNumber));
  }
  
  const principal = parseFloat(data.principal);
  if (isNaN(principal) || principal <= 0) {
    errors.push(new ValidationError('本金必须是大于0的数字', 'principal', data.principal, rowNumber));
  }
  
  if (data.share_ratio !== undefined && data.share_ratio !== null && data.share_ratio !== '') {
    const ratio = parseFloat(data.share_ratio);
    if (isNaN(ratio) || ratio < 0 || ratio > 1) {
      errors.push(new ValidationError('份额比例必须是0-1之间的数字', 'share_ratio', data.share_ratio, rowNumber));
    }
  }
  
  if (!data.subscription_date || !isValidDate(data.subscription_date)) {
    errors.push(new ValidationError('认购日期无效或格式不正确', 'subscription_date', data.subscription_date, rowNumber));
  }
  
  if (!data.value_date || !isValidDate(data.value_date)) {
    errors.push(new ValidationError('起息日无效或格式不正确', 'value_date', data.value_date, rowNumber));
  }
  
  if (data.maturity_date && !isValidDate(data.maturity_date)) {
    errors.push(new ValidationError('到期日格式不正确', 'maturity_date', data.maturity_date, rowNumber));
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    cleanedData: {
      product_code: data.product_code ? String(data.product_code).trim() : null,
      product_id: data.product_id ? parseInt(data.product_id) : null,
      holder_name: data.holder_name ? String(data.holder_name).trim() : null,
      holder_id: data.holder_id ? parseInt(data.holder_id) : null,
      account_name: data.account_name ? String(data.account_name).trim() : null,
      account_id: data.account_id ? parseInt(data.account_id) : null,
      principal: principal,
      share_ratio: data.share_ratio !== undefined && data.share_ratio !== null && data.share_ratio !== '' ? parseFloat(data.share_ratio) : 1,
      subscription_date: parseDate(data.subscription_date),
      value_date: parseDate(data.value_date),
      maturity_date: data.maturity_date ? parseDate(data.maturity_date) : null,
      actual_days: data.actual_days ? parseInt(data.actual_days) : null,
      status: data.status || 'active'
    }
  };
};

export const validateShareRatios = (subscriptions) => {
  const errors = [];
  
  const groupedByProduct = {};
  subscriptions.forEach((sub, index) => {
    const key = sub.product_code || sub.product_id;
    if (!groupedByProduct[key]) {
      groupedByProduct[key] = [];
    }
    groupedByProduct[key].push({ ...sub, index: index + 2 });
  });
  
  for (const [productKey, subs] of Object.entries(groupedByProduct)) {
    const totalRatio = subs.reduce((sum, sub) => sum + (sub.share_ratio || 0), 0);
    if (Math.abs(totalRatio - 1) > 0.0001) {
      errors.push({
        error: `产品 ${productKey} 的份额比例合计为 ${(totalRatio * 100).toFixed(2)}%，不是100%`,
        productKey,
        totalRatio,
        rows: subs.map(s => s.index)
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validatePayoutRule = (data, rowNumber = null) => {
  const errors = [];
  
  if (!data.product_code && !data.product_id) {
    errors.push(new ValidationError('产品代码或产品ID不能为空', 'product_code', data.product_code, rowNumber));
  }
  
  if (data.rule_type) {
    const validRules = ['actual/360', 'actual/365', '30/360'];
    if (!validRules.includes(data.rule_type)) {
      errors.push(new ValidationError(`计息规则必须是: ${validRules.join(', ')}`, 'rule_type', data.rule_type, rowNumber));
    }
  }
  
  if (data.management_fee_calculation) {
    const validMethods = ['daily_accrual', 'maturity_deduction', 'upfront'];
    if (!validMethods.includes(data.management_fee_calculation)) {
      errors.push(new ValidationError(`管理费计算方式必须是: ${validMethods.join(', ')}`, 'management_fee_calculation', data.management_fee_calculation, rowNumber));
    }
  }
  
  if (data.redemption_fee_calculation) {
    const validMethods = ['fixed', 'tiered'];
    if (!validMethods.includes(data.redemption_fee_calculation)) {
      errors.push(new ValidationError(`赎回费计算方式必须是: ${validMethods.join(', ')}`, 'redemption_fee_calculation', data.redemption_fee_calculation, rowNumber));
    }
  }
  
  if (data.payout_frequency) {
    const validFrequencies = ['daily', 'monthly', 'quarterly', 'maturity'];
    if (!validFrequencies.includes(data.payout_frequency)) {
      errors.push(new ValidationError(`付息频率必须是: ${validFrequencies.join(', ')}`, 'payout_frequency', data.payout_frequency, rowNumber));
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    cleanedData: {
      product_code: data.product_code ? String(data.product_code).trim() : null,
      product_id: data.product_id ? parseInt(data.product_id) : null,
      rule_type: data.rule_type || 'actual/365',
      management_fee_calculation: data.management_fee_calculation || 'daily_accrual',
      redemption_fee_calculation: data.redemption_fee_calculation || 'fixed',
      payout_frequency: data.payout_frequency || 'maturity'
    }
  };
};
