const { table, generateId, now } = require('../utils/db');
const { logAction } = require('../utils/audit');
const { getSupplier, getApplicableRule, getRule } = require('./rebateRules');
const { getSalesSummary } = require('./salesSummary');
const { getReturnSummary } = require('./returnDeduction');
const { acquireLock, releaseLock } = require('../utils/lock');

const SUMMARY_STATUSES = ['calculating', 'pending_confirmation', 'confirmed', 'paid', 'cancelled'];
const CONFIRMATION_STATUSES = ['pending', 'sent', 'confirmed', 'rejected', 'cancelled'];

function calculateTier(rule, netQuantity) {
  if (!rule || !rule.tiers) return null;
  
  const sortedTiers = [...rule.tiers].sort((a, b) => a.tier_level - b.tier_level);
  
  for (let i = sortedTiers.length - 1; i >= 0; i--) {
    const tier = sortedTiers[i];
    if (netQuantity >= tier.min_quantity) {
      if (tier.max_quantity === null || netQuantity < tier.max_quantity) {
        return tier;
      }
    }
  }
  
  return null;
}

function calculateReconciliation(supplierId, period, operator = 'system') {
  const summaries = table('reconciliation_summaries');
  const lockResourceId = `${supplierId}_${period}`;
  const lockHolder = `reconciliation_${operator}_${Date.now()}`;
  
  const lockResult = acquireLock('reconciliation', lockResourceId, lockHolder);
  if (!lockResult.success) {
    throw new Error(`${lockResult.error}（当前由 ${lockResult.lockHolder} 持有锁）`);
  }
  
  try {
    const supplier = getSupplier(supplierId);
    if (!supplier) {
      throw new Error('供应商不存在');
    }
    
    const rule = getApplicableRule(supplierId, period);
    if (!rule) {
      throw new Error(`该期间(${period})没有适用的返利规则`);
    }
    
    const salesSummary = getSalesSummary(supplierId, period);
    const returnSummary = getReturnSummary(supplierId, period);
    
    const netQuantity = salesSummary.total_quantity - returnSummary.total_quantity;
    const netAmount = salesSummary.total_amount - returnSummary.total_amount;
    
    const tier = calculateTier(rule, netQuantity);
    
    let rebateRate = 0;
    let rebateAmount = 0;
    let tierLevel = null;
    
    if (tier) {
      tierLevel = tier.tier_level;
      rebateRate = tier.rebate_rate;
      rebateAmount = netAmount * rebateRate;
    }
    
    const existingSummary = summaries.findOne({
      supplier_id: supplierId,
      rule_id: rule.id,
      period: period
    });
    
    let summaryId;
    let action = 'calculate';
    let previousState = null;
    
    const createdAt = now();
    
    if (existingSummary) {
      if (['confirmed', 'paid'].includes(existingSummary.status)) {
        throw new Error('该核算已确认或已付款，不能重新计算');
      }
      
      summaryId = existingSummary.id;
      previousState = { ...existingSummary };
      action = 'recalculate';
      
      summaries.update(summaryId, {
        total_sales_quantity: salesSummary.total_quantity,
        total_sales_amount: salesSummary.total_amount,
        total_return_quantity: returnSummary.total_quantity,
        total_return_amount: returnSummary.total_amount,
        net_quantity: netQuantity,
        net_amount: netAmount,
        tier_level: tierLevel,
        rebate_rate: rebateRate,
        rebate_amount: rebateAmount,
        status: 'calculating',
        updated_at: createdAt
      });
    } else {
      summaryId = generateId();
      
      summaries.insert({
        id: summaryId,
        supplier_id: supplierId,
        rule_id: rule.id,
        period: period,
        total_sales_quantity: salesSummary.total_quantity,
        total_sales_amount: salesSummary.total_amount,
        total_return_quantity: returnSummary.total_quantity,
        total_return_amount: returnSummary.total_amount,
        net_quantity: netQuantity,
        net_amount: netAmount,
        tier_level: tierLevel,
        rebate_rate: rebateRate,
        rebate_amount: rebateAmount,
        status: 'calculating',
        created_at: createdAt,
        updated_at: createdAt
      });
    }
    
    const newSummary = getReconciliationSummary(summaryId);
    
    logAction(
      'reconciliation_summary',
      summaryId,
      action,
      previousState,
      newSummary,
      operator,
      `核算${action === 'recalculate' ? '重' : ''}计算完成，返利金额：${rebateAmount.toFixed(2)}元`
    );
    
    return newSummary;
  } finally {
    releaseLock('reconciliation', lockResourceId);
  }
}

function getReconciliationSummary(summaryId) {
  const summaries = table('reconciliation_summaries');
  const summary = summaries.findById(summaryId);
  
  if (!summary) return null;
  
  const rule = getRule(summary.rule_id);
  const supplier = getSupplier(summary.supplier_id);
  
  return {
    ...summary,
    supplier_name: supplier?.name,
    rule_name: rule?.name,
    rule_tiers: rule?.tiers || []
  };
}

function listReconciliationSummaries(supplierId = null, period = null, status = null) {
  const summaries = table('reconciliation_summaries');
  let list = [...summaries._data];
  
  if (supplierId) {
    list = list.filter(s => s.supplier_id === supplierId);
  }
  
  if (period) {
    list = list.filter(s => s.period === period);
  }
  
  if (status) {
    list = list.filter(s => s.status === status);
  }
  
  list.sort((a, b) => {
    if (a.period !== b.period) {
      return b.period.localeCompare(a.period);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  return list.map(summary => {
    const rule = getRule(summary.rule_id);
    const supplier = getSupplier(summary.supplier_id);
    return {
      ...summary,
      supplier_name: supplier?.name,
      rule_name: rule?.name
    };
  });
}

function submitForConfirmation(summaryId, operator = 'system') {
  const summaries = table('reconciliation_summaries');
  const summary = summaries.findById(summaryId);
  
  if (!summary) {
    throw new Error('核算汇总不存在');
  }
  
  if (summary.status !== 'calculating') {
    throw new Error(`只有计算状态的核算才能提交确认，当前状态：${summary.status}`);
  }
  
  const previousState = { ...summary };
  
  summaries.update(summaryId, {
    status: 'pending_confirmation',
    updated_at: now()
  });
  
  const updatedSummary = getReconciliationSummary(summaryId);
  
  logAction(
    'reconciliation_summary',
    summaryId,
    'submit_confirmation',
    previousState,
    updatedSummary,
    operator,
    '提交供应商确认'
  );
  
  return updatedSummary;
}

function createConfirmationLetter(summaryId, content, operator = 'system') {
  const letters = table('confirmation_letters');
  const summary = getReconciliationSummary(summaryId);
  
  if (!summary) {
    throw new Error('核算汇总不存在');
  }
  
  const letterId = generateId();
  const createdAt = now();
  
  const letterContent = content || generateDefaultLetterContent(summary);
  
  const letter = letters.insert({
    id: letterId,
    summary_id: summaryId,
    supplier_id: summary.supplier_id,
    content: letterContent,
    status: 'pending',
    created_at: createdAt
  });
  
  logAction(
    'confirmation_letter',
    letterId,
    'create',
    null,
    { id: letterId, summary_id: summaryId, content: letterContent },
    operator,
    '创建确认函'
  );
  
  return getConfirmationLetter(letterId);
}

function generateDefaultLetterContent(summary) {
  const tierInfo = summary.tier_level 
    ? `档位：第${summary.tier_level}档（返利比例：${(summary.rebate_rate * 100).toFixed(2)}%）`
    : '未达到任何档位返利要求';
  
  return `
返利确认函

致：${summary.supplier_name}

尊敬的供应商：

以下是贵司 ${summary.period} 期间的采购返利核算明细，请予以确认：

一、销售汇总
- 总销售数量：${summary.total_sales_quantity} 件
- 总销售金额：${summary.total_sales_amount.toFixed(2)} 元

二、退货扣减
- 总退货数量：${summary.total_return_quantity} 件
- 总退货金额：${summary.total_return_amount.toFixed(2)} 元

三、净销量
- 净销售数量：${summary.net_quantity} 件
- 净销售金额：${summary.net_amount.toFixed(2)} 元

四、返利计算
- ${tierInfo}
- 应返返利金额：${summary.rebate_amount.toFixed(2)} 元

请在收到本函后3个工作日内完成确认。如有异议，请及时联系。

谢谢合作！
  `.trim();
}

function getConfirmationLetter(letterId) {
  const letters = table('confirmation_letters');
  const letter = letters.findById(letterId);
  
  if (!letter) return null;
  
  const summary = getReconciliationSummary(letter.summary_id);
  const supplier = getSupplier(letter.supplier_id);
  
  return {
    ...letter,
    supplier_name: supplier?.name,
    summary: summary
  };
}

function listConfirmationLetters(supplierId = null, status = null) {
  const letters = table('confirmation_letters');
  let list = [...letters._data];
  
  if (supplierId) {
    list = list.filter(l => l.supplier_id === supplierId);
  }
  
  if (status) {
    list = list.filter(l => l.status === status);
  }
  
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return list;
}

function sendConfirmationLetter(letterId, operator = 'system') {
  const letters = table('confirmation_letters');
  const letter = letters.findById(letterId);
  
  if (!letter) {
    throw new Error('确认函不存在');
  }
  
  if (letter.status !== 'pending') {
    throw new Error(`只有待发送状态的确认函才能发送，当前状态：${letter.status}`);
  }
  
  const previousState = { ...letter };
  const sentAt = now();
  
  letters.update(letterId, {
    status: 'sent',
    sent_at: sentAt
  });
  
  const updatedLetter = getConfirmationLetter(letterId);
  
  logAction(
    'confirmation_letter',
    letterId,
    'send',
    previousState,
    updatedLetter,
    operator,
    '发送确认函'
  );
  
  return updatedLetter;
}

function confirmReconciliation(summaryId, letterId, confirmedBy, comments = '', operator = 'system') {
  const summaries = table('reconciliation_summaries');
  const letters = table('confirmation_letters');
  
  const summary = summaries.findById(summaryId);
  const letter = letters.findById(letterId);
  
  if (!summary) {
    throw new Error('核算汇总不存在');
  }
  
  if (!letter) {
    throw new Error('确认函不存在');
  }
  
  if (letter.summary_id !== summaryId) {
    throw new Error('确认函与核算汇总不匹配');
  }
  
  if (summary.status !== 'pending_confirmation') {
    throw new Error(`只有待确认状态的核算才能确认，当前状态：${summary.status}`);
  }
  
  if (!['sent', 'pending'].includes(letter.status)) {
    throw new Error(`确认函状态不正确，当前状态：${letter.status}`);
  }
  
  const confirmedAt = now();
  
  summaries.update(summaryId, {
    status: 'confirmed',
    updated_at: now()
  });
  
  letters.update(letterId, {
    status: 'confirmed',
    confirmed_at: confirmedAt,
    confirmed_by: confirmedBy,
    comments: comments
  });
  
  const updatedSummary = getReconciliationSummary(summaryId);
  const updatedLetter = getConfirmationLetter(letterId);
  
  logAction(
    'reconciliation_summary',
    summaryId,
    'confirm',
    { ...summary },
    updatedSummary,
    operator,
    `核算已由 ${confirmedBy} 确认${comments ? `，备注：${comments}` : ''}`
  );
  
  logAction(
    'confirmation_letter',
    letterId,
    'confirm',
    { ...letter },
    updatedLetter,
    operator,
    '确认函已确认'
  );
  
  return {
    summary: updatedSummary,
    letter: updatedLetter
  };
}

function rejectReconciliation(summaryId, letterId, comments, operator = 'system') {
  const summaries = table('reconciliation_summaries');
  const letters = table('confirmation_letters');
  
  const summary = summaries.findById(summaryId);
  const letter = letters.findById(letterId);
  
  if (!summary) {
    throw new Error('核算汇总不存在');
  }
  
  if (!letter) {
    throw new Error('确认函不存在');
  }
  
  if (summary.status !== 'pending_confirmation') {
    throw new Error(`只有待确认状态的核算才能拒绝，当前状态：${summary.status}`);
  }
  
  summaries.update(summaryId, {
    status: 'calculating',
    updated_at: now()
  });
  
  letters.update(letterId, {
    status: 'rejected',
    comments: comments
  });
  
  const updatedSummary = getReconciliationSummary(summaryId);
  
  logAction(
    'reconciliation_summary',
    summaryId,
    'reject',
    { ...summary },
    updatedSummary,
    operator,
    `核算被拒绝，原因：${comments}`
  );
  
  return updatedSummary;
}

function exportReconciliationData(supplierId = null, period = null) {
  const summaries = listReconciliationSummaries(supplierId, period);
  
  return summaries.map(summary => {
    const letters = listConfirmationLetters(summary.supplier_id, null)
      .filter(l => l.summary_id === summary.id);
    
    return {
      供应商: summary.supplier_name,
      规则名称: summary.rule_name,
      期间: summary.period,
      状态: translateStatus(summary.status),
      总销量: summary.total_sales_quantity,
      总销售额: summary.total_sales_amount.toFixed(2),
      总退货量: summary.total_return_quantity,
      总退货额: summary.total_return_amount.toFixed(2),
      净销量: summary.net_quantity,
      净销售额: summary.net_amount.toFixed(2),
      档位: summary.tier_level || '-',
      返利比例: summary.tier_level ? `${(summary.rebate_rate * 100).toFixed(2)}%` : '-',
      返利金额: summary.rebate_amount.toFixed(2),
      创建时间: summary.created_at,
      更新时间: summary.updated_at,
      确认函状态: letters.length > 0 ? translateLetterStatus(letters[0].status) : '未创建'
    };
  });
}

function translateStatus(status) {
  const map = {
    'calculating': '计算中',
    'pending_confirmation': '待确认',
    'confirmed': '已确认',
    'paid': '已付款',
    'cancelled': '已取消'
  };
  return map[status] || status;
}

function translateLetterStatus(status) {
  const map = {
    'pending': '待发送',
    'sent': '已发送',
    'confirmed': '已确认',
    'rejected': '已拒绝',
    'cancelled': '已取消'
  };
  return map[status] || status;
}

function getOverallStatistics(period = null) {
  const summaries = listReconciliationSummaries(null, period);
  
  const stats = {
    total_suppliers: new Set(summaries.map(s => s.supplier_id)).size,
    total_summaries: summaries.length,
    total_sales_amount: 0,
    total_return_amount: 0,
    total_rebate_amount: 0,
    by_status: {}
  };
  
  SUMMARY_STATUSES.forEach(status => {
    stats.by_status[translateStatus(status)] = 0;
  });
  
  summaries.forEach(summary => {
    stats.total_sales_amount += summary.total_sales_amount;
    stats.total_return_amount += summary.total_return_amount;
    stats.total_rebate_amount += summary.rebate_amount;
    const statusLabel = translateStatus(summary.status);
    stats.by_status[statusLabel] = (stats.by_status[statusLabel] || 0) + 1;
  });
  
  return stats;
}

module.exports = {
  calculateReconciliation,
  getReconciliationSummary,
  listReconciliationSummaries,
  submitForConfirmation,
  createConfirmationLetter,
  getConfirmationLetter,
  listConfirmationLetters,
  sendConfirmationLetter,
  confirmReconciliation,
  rejectReconciliation,
  exportReconciliationData,
  getOverallStatistics,
  SUMMARY_STATUSES,
  CONFIRMATION_STATUSES
};
