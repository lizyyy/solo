'use strict';

function daysBetween(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return null;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function maskPhone(phone, rule) {
  if (!phone) return '';
  if (rule === 'middle4Digits') {
    if (phone.includes('****')) return phone;
    const s = String(phone).replace(/\D/g, '');
    if (s.length < 7) return s;
    return s.slice(0, 3) + '****' + s.slice(-4);
  }
  return phone;
}

function maskName(name, rule) {
  if (!name) return '';
  if (rule === 'lastTwoChars') {
    if (name.includes('***')) return name;
    if (name.length <= 1) return name + '***';
    return name.slice(0, 1) + '***';
  }
  return name;
}

function buildDiscrepancies(purchase, customer, rules, today) {
  const issues = [];
  const customerConditions = customer.conditions || [];
  const customerAllergies = customer.allergies || [];

  // 1. 随访间隔提醒
  const interval = rules.followUpIntervalDays || 30;
  const tolerance = rules.intervalToleranceDays || 3;
  const daysSinceFollowUp = customer.lastFollowUp
    ? daysBetween(customer.lastFollowUp, today)
    : null;
  const daysToNext = customer.nextFollowUp
    ? daysBetween(today, customer.nextFollowUp)
    : null;

  if (customer.lastFollowUp && daysSinceFollowUp !== null) {
    if (daysSinceFollowUp > interval + tolerance) {
      issues.push({
        type: 'interval_reminder',
        severity: 'warning',
        message: `距上次随访已 ${daysSinceFollowUp} 天，超出 ${interval}±${tolerance} 天周期`,
        detail: { lastFollowUp: customer.lastFollowUp, interval, tolerance, daysSinceFollowUp }
      });
    }
  } else if (!customer.lastFollowUp) {
    issues.push({
      type: 'interval_reminder',
      severity: 'info',
      message: '无上次随访记录，建议建档跟进',
      detail: {}
    });
  }

  if (customer.nextFollowUp && daysToNext !== null && daysToNext <= 0) {
    issues.push({
      type: 'interval_reminder',
      severity: 'warning',
      message: `计划随访日 ${customer.nextFollowUp} 已逾期 ${Math.abs(daysToNext)} 天`,
      detail: { nextFollowUp: customer.nextFollowUp, daysOverdue: Math.abs(daysToNext) }
    });
  }

  // 2. 禁忌药 / 过敏药检查
  const medicine = purchase.medicine || '';
  const forbiddenMap = rules.forbiddenMedicines || {};
  for (const cond of customerConditions) {
    const list = forbiddenMap[cond] || [];
    for (const item of list) {
      if (medicine.includes(item)) {
        issues.push({
          type: 'forbidden_medicine',
          severity: 'danger',
          message: `顾客${cond}患者禁用：${medicine} 含禁忌成分 ${item}`,
          detail: { condition: cond, forbidden: item, medicine }
        });
      }
    }
  }

  const allergyKeywords = rules.allergyKeywords || [];
  for (const allergy of customerAllergies) {
    if (medicine.includes(allergy)) {
      issues.push({
        type: 'allergy_alert',
        severity: 'danger',
        message: `顾客过敏史（${allergy}）与本次购药 ${medicine} 存在风险`,
        detail: { allergy, medicine },
        requireManualReview: true
      });
    }
    for (const kw of allergyKeywords) {
      if (medicine.includes(kw) && allergy.includes(kw)) {
        issues.push({
          type: 'allergy_alert',
          severity: 'danger',
          message: `禁忌药类别匹配：${medicine} 含 ${kw}，与过敏史冲突`,
          detail: { keyword: kw, medicine, allergy },
          requireManualReview: true
        });
      }
    }
  }

  // 3. 隐私脱敏差异
  const maskRule = rules.maskingRules || {};
  const expectedName = maskName(customer.name, maskRule.name);
  const expectedPhone = maskPhone(customer.phone, maskRule.phone);
  if (purchase.customerName && purchase.customerName !== expectedName) {
    issues.push({
      type: 'privacy_mask',
      severity: 'info',
      message: `姓名脱敏不一致：期望 ${expectedName}，实际 ${purchase.customerName}`,
      detail: { expected: expectedName, actual: purchase.customerName }
    });
  }
  if (purchase.phone && purchase.phone !== expectedPhone) {
    issues.push({
      type: 'privacy_mask',
      severity: 'info',
      message: `手机号脱敏不一致：期望 ${expectedPhone}，实际 ${purchase.phone}`,
      detail: { expected: expectedPhone, actual: purchase.phone }
    });
  }

  // 4. 慢病标签缺失
  if (!customerConditions.length && customer.tags && customer.tags.length) {
    issues.push({
      type: 'missing_condition',
      severity: 'warning',
      message: `顾客标签 ${customer.tags.join(',')} 但 conditions 为空，需补录`,
      detail: { tags: customer.tags }
    });
  }

  return issues;
}

function decideAutoAction(issues) {
  const hasDanger = issues.some((i) => i.severity === 'danger');
  const hasWarning = issues.some((i) => i.severity === 'warning');
  const needManual = issues.some((i) => i.requireManualReview);
  if (needManual || hasDanger) return 'REVIEW_REQUIRED';
  if (hasWarning) return 'FLAGGED';
  return 'AUTO_APPROVED';
}

function runReconciliation(store, purchasesInput, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const { customers, rules } = store;
  const results = [];
  const summary = {
    total: 0,
    autoApproved: 0,
    flagged: 0,
    reviewRequired: 0,
    manuallyReviewed: 0,
    discrepanciesByType: {}
  };

  for (const purchase of purchasesInput) {
    const customer = customers.find((c) => c.id === purchase.customerId) || null;
    const issues = customer
      ? buildDiscrepancies(purchase, customer, rules, today)
      : [{
          type: 'customer_not_found',
          severity: 'danger',
          message: `顾客 ${purchase.customerId} 未在档案中找到`,
          detail: { customerId: purchase.customerId }
        }];
    const autoAction = decideAutoAction(issues);
    const record = {
      id: purchase.orderId || `rec-${Math.random().toString(36).slice(2, 9)}`,
      purchase,
      customer,
      discrepancies: issues,
      autoAction,
      finalAction: autoAction,
      reviewed: false,
      reviewerNote: null,
      reviewedAt: null
    };
    results.push(record);

    for (const iss of issues) {
      summary.discrepanciesByType[iss.type] = (summary.discrepanciesByType[iss.type] || 0) + 1;
    }
  }

  summary.total = results.length;
  summary.autoApproved = results.filter((r) => r.finalAction === 'AUTO_APPROVED').length;
  summary.flagged = results.filter((r) => r.finalAction === 'FLAGGED').length;
  summary.reviewRequired = results.filter((r) => r.finalAction === 'REVIEW_REQUIRED').length;
  summary.manuallyReviewed = results.filter((r) => r.reviewed).length;

  return { results, summary };
}

function recalcSummary(results) {
  const summary = {
    total: results.length,
    autoApproved: 0,
    flagged: 0,
    reviewRequired: 0,
    manuallyReviewed: 0,
    discrepanciesByType: {}
  };
  for (const r of results) {
    for (const iss of r.discrepancies) {
      summary.discrepanciesByType[iss.type] = (summary.discrepanciesByType[iss.type] || 0) + 1;
    }
    if (r.finalAction === 'AUTO_APPROVED') summary.autoApproved++;
    else if (r.finalAction === 'FLAGGED') summary.flagged++;
    else if (r.finalAction === 'REVIEW_REQUIRED') summary.reviewRequired++;
    if (r.reviewed) summary.manuallyReviewed++;
  }
  return summary;
}

module.exports = {
  runReconciliation,
  recalcSummary,
  buildDiscrepancies,
  decideAutoAction,
  daysBetween,
  maskName,
  maskPhone
};
