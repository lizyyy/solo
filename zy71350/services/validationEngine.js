const dayjs = require('dayjs');
const config = require('../config');
const artistDao = require('../dao/artistDao');
const logDao = require('../dao/logDao');
const authDao = require('../dao/authDao');

const RULES = {
  EXHIBITION_CROSS_MONTH: 'EXHIBITION_CROSS_MONTH',
  EXHIBITION_LONG_DURATION: 'EXHIBITION_LONG_DURATION',
  DISCOUNT_UNAUTHORIZED: 'DISCOUNT_UNAUTHORIZED',
  DISCOUNT_EXCEEDS_THRESHOLD: 'DISCOUNT_EXCEEDS_THRESHOLD',
  COMMISSION_RATE_MISMATCH: 'COMMISSION_RATE_MISMATCH',
  COMMISSION_RATE_INVALID: 'COMMISSION_RATE_INVALID',
  PRICE_NEGATIVE: 'PRICE_NEGATIVE',
  TRANSACTION_DATE_INVALID: 'TRANSACTION_DATE_INVALID',
  ARTIST_NOT_FOUND: 'ARTIST_NOT_FOUND',
  DATA_FORMAT_ERROR: 'DATA_FORMAT_ERROR'
};

const SEVERITY_WEIGHT = {
  [config.SEVERITY.CRITICAL]: 3,
  [config.SEVERITY.WARNING]: 2,
  [config.SEVERITY.INFO]: 1
};

function parseDate(dateStr) {
  if (!dateStr) return null;
  const formats = ['YYYY-MM-DD', 'YYYY/MM/DD', 'MM/DD/YYYY', 'DD-MM-YYYY'];
  for (const format of formats) {
    const d = dayjs(dateStr, format, true);
    if (d.isValid()) return d;
  }
  return null;
}

function getHighestSeverity(issues) {
  if (!issues || issues.length === 0) return null;
  let highest = null;
  let highestWeight = 0;
  for (const issue of issues) {
    const weight = SEVERITY_WEIGHT[issue.severity] || 0;
    if (weight > highestWeight) {
      highestWeight = weight;
      highest = issue.severity;
    }
  }
  return highest;
}

function validateExhibitionPeriod(item, batchSettlementMonth) {
  const issues = [];
  const logs = [];

  const startDate = parseDate(item.exhibition_start_date);
  const endDate = parseDate(item.exhibition_end_date);

  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'import',
    action: 'record_original',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `原始展期: ${item.exhibition_start_date} ~ ${item.exhibition_end_date}`,
    raw_value: `${item.exhibition_start_date}|${item.exhibition_end_date}`,
    is_original: 1,
    is_processed: 0
  });

  if (!startDate || !endDate) {
    issues.push({
      rule: RULES.DATA_FORMAT_ERROR,
      severity: config.SEVERITY.CRITICAL,
      message: '展期日期格式无效',
      raw_value: `${item.exhibition_start_date}|${item.exhibition_end_date}`
    });
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'validation',
      action: 'validate_exhibition',
      severity: config.SEVERITY.CRITICAL,
      rule_code: RULES.DATA_FORMAT_ERROR,
      message: '展期日期格式无效，无法解析',
      raw_value: `${item.exhibition_start_date}|${item.exhibition_end_date}`,
      is_original: 0,
      is_processed: 1
    });
    return { issues, logs, durationDays: null, crossMonth: false };
  }

  const durationDays = endDate.diff(startDate, 'day') + 1;
  
  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'validation',
    action: 'calculate_duration',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `展期计算: ${durationDays}天`,
    raw_value: durationDays.toString(),
    is_original: 0,
    is_processed: 1
  });

  const startMonth = startDate.format('YYYY-MM');
  const endMonth = endDate.format('YYYY-MM');
  const crossMonth = startMonth !== endMonth;

  if (crossMonth) {
    issues.push({
      rule: RULES.EXHIBITION_CROSS_MONTH,
      severity: config.SEVERITY.WARNING,
      message: `展期跨月: ${startMonth} → ${endMonth}`,
      raw_value: `${startMonth}|${endMonth}`
    });
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'validation',
      action: 'check_cross_month',
      severity: config.SEVERITY.WARNING,
      rule_code: RULES.EXHIBITION_CROSS_MONTH,
      message: `展期跨月，起始月${startMonth}，结束月${endMonth}`,
      raw_value: `${startMonth}|${endMonth}`,
      expected_value: batchSettlementMonth,
      is_original: 0,
      is_processed: 1
    });
  }

  if (durationDays > config.EXHIBITION_MONTH_THRESHOLD * 30) {
    issues.push({
      rule: RULES.EXHIBITION_LONG_DURATION,
      severity: config.SEVERITY.INFO,
      message: `展期超过${config.EXHIBITION_MONTH_THRESHOLD}个月，共${durationDays}天`,
      raw_value: durationDays.toString()
    });
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'validation',
      action: 'check_duration',
      severity: config.SEVERITY.INFO,
      rule_code: RULES.EXHIBITION_LONG_DURATION,
      message: `展期较长(${durationDays}天)，建议确认`,
      raw_value: durationDays.toString(),
      expected_value: `${config.EXHIBITION_MONTH_THRESHOLD * 30}`,
      is_original: 0,
      is_processed: 1
    });
  }

  return { issues, logs, durationDays, crossMonth };
}

function validateDiscount(item) {
  const issues = [];
  const logs = [];

  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'import',
    action: 'record_original',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `原始折扣: ${(item.discount_rate * 100).toFixed(1)}%`,
    raw_value: item.discount_rate.toString(),
    is_original: 1,
    is_processed: 0
  });

  const calculatedDiscount = 1 - (item.transaction_price / item.listed_price);
  const actualDiscount = Math.max(0, calculatedDiscount);

  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'validation',
    action: 'calculate_actual_discount',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `反算实际折扣: ${(actualDiscount * 100).toFixed(1)}%`,
    raw_value: `${item.listed_price}|${item.transaction_price}`,
    is_original: 0,
    is_processed: 1
  });

  const declaredDiscount = item.discount_rate || 0;
  if (Math.abs(declaredDiscount - actualDiscount) > 0.001) {
    issues.push({
      rule: RULES.DISCOUNT_UNAUTHORIZED,
      severity: config.SEVERITY.WARNING,
      message: `申报折扣${(declaredDiscount * 100).toFixed(1)}%与实际${(actualDiscount * 100).toFixed(1)}%不符`,
      raw_value: `${declaredDiscount}|${actualDiscount}`
    });
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'validation',
      action: 'validate_discount_match',
      severity: config.SEVERITY.WARNING,
      rule_code: RULES.DISCOUNT_UNAUTHORIZED,
      message: '申报折扣与成交价反算结果不符',
      raw_value: declaredDiscount.toString(),
      expected_value: actualDiscount.toFixed(4),
      is_original: 0,
      is_processed: 1
    });
  }

  const effectiveDiscount = Math.max(declaredDiscount, actualDiscount);

  if (effectiveDiscount > config.DISCOUNT_AUTH_THRESHOLD) {
    const activeAuth = authDao.getActiveAuthorization(item.id, 'discount_rate');
    
    if (!activeAuth) {
      issues.push({
        rule: RULES.DISCOUNT_EXCEEDS_THRESHOLD,
        severity: config.SEVERITY.CRITICAL,
        message: `折扣${(effectiveDiscount * 100).toFixed(1)}%超过阈值${(config.DISCOUNT_AUTH_THRESHOLD * 100)}%，未授权`,
        raw_value: effectiveDiscount.toString()
      });
      logs.push({
        item_id: item.id,
        batch_id: item.batch_id,
        step: 'validation',
        action: 'check_discount_auth',
        severity: config.SEVERITY.CRITICAL,
        rule_code: RULES.DISCOUNT_EXCEEDS_THRESHOLD,
        message: `折扣超阈值，需要特别授权`,
        raw_value: effectiveDiscount.toString(),
        expected_value: config.DISCOUNT_AUTH_THRESHOLD.toString(),
        is_original: 0,
        is_processed: 1
      });
    } else {
      logs.push({
        item_id: item.id,
        batch_id: item.batch_id,
        step: 'validation',
        action: 'check_discount_auth',
        severity: config.SEVERITY.INFO,
        rule_code: null,
        message: `折扣已授权，授权人: ${activeAuth.authorized_by}`,
        raw_value: effectiveDiscount.toString(),
        expected_value: activeAuth.authorized_value.toString(),
        is_original: 0,
        is_processed: 1
      });
    }
  }

  return { issues, logs, effectiveDiscount };
}

function validateCommissionRate(item) {
  const issues = [];
  const logs = [];

  const artistInfo = artistDao.getArtistCommissionRate(item.artist_code);

  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'import',
    action: 'record_original',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `申报佣金比例: ${item.declared_commission_rate ? (item.declared_commission_rate * 100).toFixed(1) + '%' : '未填写'}`,
    raw_value: item.declared_commission_rate ? item.declared_commission_rate.toString() : 'null',
    is_original: 1,
    is_processed: 0
  });

  if (!artistInfo) {
    issues.push({
      rule: RULES.ARTIST_NOT_FOUND,
      severity: config.SEVERITY.CRITICAL,
      message: `艺术家编码 ${item.artist_code} 未在系统中登记`,
      raw_value: item.artist_code
    });
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'validation',
      action: 'lookup_artist',
      severity: config.SEVERITY.CRITICAL,
      rule_code: RULES.ARTIST_NOT_FOUND,
      message: '艺术家未登记，无法确定佣金比例',
      raw_value: item.artist_code,
      is_original: 0,
      is_processed: 1
    });
    return { issues, logs, expectedRate: config.COMMISSION_RATES.DEFAULT, artistInfo: null };
  }

  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'validation',
    action: 'lookup_artist',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `艺术家等级: ${artistInfo.artist_level}, 系统佣金比例: ${(artistInfo.commission_rate * 100).toFixed(1)}%`,
    raw_value: `${artistInfo.artist_level}|${artistInfo.commission_rate}`,
    is_original: 0,
    is_processed: 1
  });

  const expectedRate = artistInfo.commission_rate;
  const declaredRate = item.declared_commission_rate;

  if (declaredRate === null || declaredRate === undefined || isNaN(declaredRate)) {
    issues.push({
      rule: RULES.COMMISSION_RATE_INVALID,
      severity: config.SEVERITY.WARNING,
      message: '佣金比例未填写，将使用系统默认值',
      raw_value: declaredRate
    });
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'validation',
      action: 'validate_commission',
      severity: config.SEVERITY.WARNING,
      rule_code: RULES.COMMISSION_RATE_INVALID,
      message: `未填写佣金比例，使用系统设定的${(expectedRate * 100).toFixed(1)}%`,
      raw_value: declaredRate ? declaredRate.toString() : 'null',
      expected_value: expectedRate.toString(),
      is_original: 0,
      is_processed: 1
    });
  } else if (Math.abs(declaredRate - expectedRate) > 0.001) {
    const activeAuth = authDao.getActiveAuthorization(item.id, 'commission_rate');
    
    if (!activeAuth) {
      issues.push({
        rule: RULES.COMMISSION_RATE_MISMATCH,
        severity: config.SEVERITY.CRITICAL,
        message: `佣金比例不符: 申报${(declaredRate * 100).toFixed(1)}% vs 系统${(expectedRate * 100).toFixed(1)}%`,
        raw_value: `${declaredRate}|${expectedRate}`
      });
      logs.push({
        item_id: item.id,
        batch_id: item.batch_id,
        step: 'validation',
        action: 'validate_commission',
        severity: config.SEVERITY.CRITICAL,
        rule_code: RULES.COMMISSION_RATE_MISMATCH,
        message: '申报佣金比例与艺术家等级不符，需要授权',
        raw_value: declaredRate.toString(),
        expected_value: expectedRate.toString(),
        is_original: 0,
        is_processed: 1
      });
    } else {
      logs.push({
        item_id: item.id,
        batch_id: item.batch_id,
        step: 'validation',
        action: 'validate_commission',
        severity: config.SEVERITY.INFO,
        rule_code: null,
        message: `佣金比例已授权，授权值: ${(activeAuth.authorized_value * 100).toFixed(1)}%`,
        raw_value: declaredRate.toString(),
        expected_value: activeAuth.authorized_value.toString(),
        is_original: 0,
        is_processed: 1
      });
    }
  }

  return { issues, logs, expectedRate, artistInfo };
}

function validatePrices(item) {
  const issues = [];
  const logs = [];

  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'import',
    action: 'record_original',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `原始价格: 标价${item.listed_price}元, 成交价${item.transaction_price}元`,
    raw_value: `${item.listed_price}|${item.transaction_price}`,
    is_original: 1,
    is_processed: 0
  });

  if (item.listed_price <= 0) {
    issues.push({
      rule: RULES.PRICE_NEGATIVE,
      severity: config.SEVERITY.CRITICAL,
      message: `标价 ${item.listed_price} 无效(必须>0)`,
      raw_value: item.listed_price.toString()
    });
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'validation',
      action: 'validate_prices',
      severity: config.SEVERITY.CRITICAL,
      rule_code: RULES.PRICE_NEGATIVE,
      message: '标价无效，无法计算',
      raw_value: item.listed_price.toString(),
      expected_value: '> 0',
      is_original: 0,
      is_processed: 1
    });
  }

  if (item.transaction_price <= 0) {
    issues.push({
      rule: RULES.PRICE_NEGATIVE,
      severity: config.SEVERITY.CRITICAL,
      message: `成交价 ${item.transaction_price} 无效(必须>0)`,
      raw_value: item.transaction_price.toString()
    });
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'validation',
      action: 'validate_prices',
      severity: config.SEVERITY.CRITICAL,
      rule_code: RULES.PRICE_NEGATIVE,
      message: '成交价无效，无法计算',
      raw_value: item.transaction_price.toString(),
      expected_value: '> 0',
      is_original: 0,
      is_processed: 1
    });
  }

  return { issues, logs };
}

function validateTransactionDate(item, settlementMonth) {
  const issues = [];
  const logs = [];

  const transDate = parseDate(item.transaction_date);

  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'import',
    action: 'record_original',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `原始交易日期: ${item.transaction_date}`,
    raw_value: item.transaction_date,
    is_original: 1,
    is_processed: 0
  });

  if (!transDate) {
    issues.push({
      rule: RULES.TRANSACTION_DATE_INVALID,
      severity: config.SEVERITY.CRITICAL,
      message: `交易日期格式无效: ${item.transaction_date}`,
      raw_value: item.transaction_date
    });
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'validation',
      action: 'validate_trans_date',
      severity: config.SEVERITY.CRITICAL,
      rule_code: RULES.TRANSACTION_DATE_INVALID,
      message: '交易日期格式无法解析',
      raw_value: item.transaction_date,
      is_original: 0,
      is_processed: 1
    });
  } else {
    const transMonth = transDate.format('YYYY-MM');
    if (transMonth !== settlementMonth) {
      issues.push({
        rule: RULES.TRANSACTION_DATE_INVALID,
        severity: config.SEVERITY.WARNING,
        message: `交易月份 ${transMonth} 与结算月份 ${settlementMonth} 不符`,
        raw_value: `${transMonth}|${settlementMonth}`
      });
      logs.push({
        item_id: item.id,
        batch_id: item.batch_id,
        step: 'validation',
        action: 'validate_trans_date',
        severity: config.SEVERITY.WARNING,
        rule_code: RULES.TRANSACTION_DATE_INVALID,
        message: '交易月份不在本结算周期内',
        raw_value: transMonth,
        expected_value: settlementMonth,
        is_original: 0,
        is_processed: 1
      });
    }
  }

  return { issues, logs };
}

function validateItem(item, settlementMonth, processingOrder) {
  const allIssues = [];
  const allLogs = [];

  allLogs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'validation_start',
    action: 'start_validation',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `开始校验，处理顺序: ${processingOrder}`,
    raw_value: processingOrder.toString(),
    is_original: 0,
    is_processed: 1
  });

  const priceResult = validatePrices(item);
  allIssues.push(...priceResult.issues);
  allLogs.push(...priceResult.logs);

  const transDateResult = validateTransactionDate(item, settlementMonth);
  allIssues.push(...transDateResult.issues);
  allLogs.push(...transDateResult.logs);

  const exhibitionResult = validateExhibitionPeriod(item, settlementMonth);
  allIssues.push(...exhibitionResult.issues);
  allLogs.push(...exhibitionResult.logs);

  const discountResult = validateDiscount(item);
  allIssues.push(...discountResult.issues);
  allLogs.push(...discountResult.logs);

  const commissionResult = validateCommissionRate(item);
  allIssues.push(...commissionResult.issues);
  allLogs.push(...commissionResult.logs);

  const highestSeverity = getHighestSeverity(allIssues);
  const hasIssues = allIssues.length > 0;
  const validationPassed = !allIssues.some(i => i.severity === config.SEVERITY.CRITICAL);

  allLogs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'validation_end',
    action: 'complete_validation',
    severity: validationPassed ? config.SEVERITY.INFO : config.SEVERITY.WARNING,
    rule_code: null,
    message: `校验完成: ${validationPassed ? '通过' : '未通过'}, 问题${allIssues.length}个, 最高级别: ${highestSeverity || '无'}`,
    raw_value: `${allIssues.length}|${highestSeverity}`,
    is_original: 0,
    is_processed: 1
  });

  return {
    issues: allIssues,
    logs: allLogs,
    highestSeverity,
    hasIssues,
    validationPassed,
    processingOrder,
    effectiveDiscount: discountResult.effectiveDiscount,
    expectedCommissionRate: commissionResult.expectedRate,
    durationDays: exhibitionResult.durationDays,
    crossMonth: exhibitionResult.crossMonth,
    artistInfo: commissionResult.artistInfo
  };
}

module.exports = {
  RULES,
  validateItem,
  validateExhibitionPeriod,
  validateDiscount,
  validateCommissionRate,
  validatePrices,
  validateTransactionDate,
  getHighestSeverity,
  parseDate
};
