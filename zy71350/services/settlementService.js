const config = require('../config');
const itemDao = require('../dao/itemDao');
const logDao = require('../dao/logDao');
const authDao = require('../dao/authDao');
const batchDao = require('../dao/batchDao');
const validationEngine = require('./validationEngine');
const { Parser } = require('@json2csv/plainjs');
const fs = require('fs');
const path = require('path');
const exportDao = require('../dao/exportDao');

function calculateCommission(item, validationResult) {
  const logs = [];
  
  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'commission_calc',
    action: 'start_calculation',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: '开始佣金试算',
    is_original: 0,
    is_processed: 1
  });

  let commissionRate = validationResult.expectedCommissionRate || config.COMMISSION_RATES.DEFAULT;
  
  const commissionAuth = authDao.getActiveAuthorization(item.id, 'commission_rate');
  if (commissionAuth) {
    commissionRate = commissionAuth.authorized_value;
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'commission_calc',
      action: 'apply_auth_rate',
      severity: config.SEVERITY.INFO,
      rule_code: null,
      message: `使用授权佣金比例: ${(commissionRate * 100).toFixed(1)}%`,
      raw_value: validationResult.expectedCommissionRate.toString(),
      expected_value: commissionRate.toString(),
      is_original: 0,
      is_processed: 1
    });
  }

  let finalPrice = item.transaction_price;
  
  const discountAuth = authDao.getActiveAuthorization(item.id, 'discount_rate');
  if (discountAuth && item.discount_rate > config.DISCOUNT_AUTH_THRESHOLD) {
    logs.push({
      item_id: item.id,
      batch_id: item.batch_id,
      step: 'commission_calc',
      action: 'apply_discount_auth',
      severity: config.SEVERITY.INFO,
      rule_code: null,
      message: `折扣已授权，按成交价计算`,
      raw_value: item.discount_rate.toString(),
      is_original: 0,
      is_processed: 1
    });
  }

  const commissionAmount = finalPrice * commissionRate;
  const artistAmount = finalPrice - commissionAmount;

  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'commission_calc',
    action: 'calculate_amounts',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `佣金计算: 成交价${finalPrice}元 × ${(commissionRate * 100).toFixed(1)}% = ${commissionAmount.toFixed(2)}元`,
    raw_value: `${finalPrice}|${commissionRate}`,
    is_original: 0,
    is_processed: 1
  });

  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'commission_calc',
    action: 'calculate_artist_share',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `艺术家应得: ${finalPrice} - ${commissionAmount.toFixed(2)} = ${artistAmount.toFixed(2)}元`,
    raw_value: `${finalPrice}|${commissionAmount}`,
    is_original: 0,
    is_processed: 1
  });

  logs.push({
    item_id: item.id,
    batch_id: item.batch_id,
    step: 'commission_calc',
    action: 'complete_calculation',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `试算完成: 佣金${commissionAmount.toFixed(2)}元, 艺术家${artistAmount.toFixed(2)}元`,
    raw_value: `${commissionAmount.toFixed(2)}|${artistAmount.toFixed(2)}`,
    is_original: 0,
    is_processed: 1
  });

  return {
    commissionRate,
    commissionAmount,
    artistAmount,
    logs
  };
}

function processBatch(batchId) {
  const batch = batchDao.getBatchById(batchId);
  if (!batch) {
    throw new Error(`批次 ${batchId} 不存在`);
  }

  const items = itemDao.getItemsByBatch(batchId);
  const allLogs = [];
  const validationResults = new Map();
  let processingOrder = 1;

  for (const item of items) {
    const validationResult = validationEngine.validateItem(
      item,
      batch.settlement_month,
      processingOrder
    );
    
    validationResults.set(item.id, validationResult);
    allLogs.push(...validationResult.logs);

    itemDao.updateItemValidation(item.id, {
      validation_passed: validationResult.validationPassed,
      has_issues: validationResult.hasIssues,
      highest_severity: validationResult.highestSeverity,
      status: validationResult.validationPassed ? config.STATUS.PENDING_REVIEW : config.STATUS.PENDING_REVIEW,
      processing_order: processingOrder
    });

    processingOrder++;
  }

  logDao.batchCreateLogs(allLogs);

  batchDao.updateBatchStatus(batchId, 'validated', items.length);

  return {
    batch,
    totalItems: items.length,
    validationResults: Array.from(validationResults.values())
  };
}

function trialCalculate(batchId) {
  const batch = batchDao.getBatchById(batchId);
  if (!batch) {
    throw new Error(`批次 ${batchId} 不存在`);
  }

  const items = itemDao.getItemsByBatch(batchId);
  const allLogs = [];
  const results = [];

  for (const item of items) {
    const itemWithLogs = itemDao.getItemDetailWithLogs(item.id);
    
    let validationResult = null;
    if (item.validation_passed === null || item.processing_order === null) {
      validationResult = validationEngine.validateItem(item, batch.settlement_month, results.length + 1);
      allLogs.push(...validationResult.logs);
    } else {
      validationResult = {
        expectedCommissionRate: itemWithLogs.artist ? itemWithLogs.artist.commission_rate : config.COMMISSION_RATES.DEFAULT
      };
    }

    const calcResult = calculateCommission(item, validationResult);
    allLogs.push(...calcResult.logs);

    itemDao.updateItemCommission(
      item.id,
      calcResult.commissionRate,
      calcResult.commissionAmount,
      calcResult.artistAmount,
      item.status === config.STATUS.IMPORTED ? config.STATUS.PENDING_REVIEW : item.status
    );

    results.push({
      item_id: item.id,
      artwork_no: item.artwork_no,
      artist_code: item.artist_code,
      listed_price: item.listed_price,
      transaction_price: item.transaction_price,
      discount_rate: item.discount_rate,
      commission_rate: calcResult.commissionRate,
      commission_amount: calcResult.commissionAmount,
      artist_amount: calcResult.artistAmount,
      has_issues: item.has_issues,
      highest_severity: item.highest_severity,
      status: item.status
    });
  }

  if (allLogs.length > 0) {
    logDao.batchCreateLogs(allLogs);
  }

  const stats = batchDao.getBatchStats(batchId);

  return {
    batch,
    stats,
    items: results
  };
}

function authorizeItem(itemId, authType, authField, authorizedValue, reason, authorizedBy) {
  const item = itemDao.getItemById(itemId);
  if (!item) {
    throw new Error(`记录 ${itemId} 不存在`);
  }

  const originalValue = authField === 'discount_rate' ? item.discount_rate : item.declared_commission_rate;
  
  const authId = authDao.createAuthorization({
    item_id: itemId,
    auth_type: authType,
    auth_field: authField,
    original_value: originalValue,
    requested_value: originalValue,
    authorized_value: authorizedValue,
    reason: reason,
    authorized_by: authorizedBy
  });

  logDao.createLog({
    item_id: itemId,
    batch_id: item.batch_id,
    step: 'authorization',
    action: 'create_authorization',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `${authType}授权: ${authField} = ${authorizedValue}, 原因: ${reason}`,
    raw_value: originalValue.toString(),
    expected_value: authorizedValue.toString(),
    is_original: 0,
    is_processed: 1,
    operator: authorizedBy
  });

  itemDao.updateItemStatus(itemId, config.STATUS.AUTHORIZED);

  return authId;
}

function authorizeBatchItems(batchId, itemIds, authType, authField, authorizedValue, reason, authorizedBy) {
  const results = [];
  for (const itemId of itemIds) {
    try {
      const authId = authorizeItem(itemId, authType, authField, authorizedValue, reason, authorizedBy);
      results.push({ item_id: itemId, success: true, auth_id: authId });
    } catch (e) {
      results.push({ item_id: itemId, success: false, error: e.message });
    }
  }
  return results;
}

function settleItem(itemId) {
  const item = itemDao.getItemById(itemId);
  if (!item) {
    throw new Error(`记录 ${itemId} 不存在`);
  }

  if (item.final_commission_amount === null) {
    throw new Error(`请先完成佣金试算`);
  }

  if (item.highest_severity === config.SEVERITY.CRITICAL && item.status !== config.STATUS.AUTHORIZED) {
    throw new Error(`存在严重问题，需先授权才能结算`);
  }

  itemDao.updateItemStatus(itemId, config.STATUS.SETTLED);

  logDao.createLog({
    item_id: itemId,
    batch_id: item.batch_id,
    step: 'settlement',
    action: 'complete_settlement',
    severity: config.SEVERITY.INFO,
    rule_code: null,
    message: `已完成结算: 佣金${item.final_commission_amount.toFixed(2)}元, 艺术家${item.final_artist_amount.toFixed(2)}元`,
    raw_value: `${item.final_commission_amount}|${item.final_artist_amount}`,
    is_original: 0,
    is_processed: 1
  });

  return true;
}

function settleBatch(batchId) {
  const batch = batchDao.getBatchById(batchId);
  if (!batch) {
    throw new Error(`批次 ${batchId} 不存在`);
  }

  const items = itemDao.getItemsForSettlement(batchId);
  const results = [];

  for (const item of items) {
    try {
      if (item.highest_severity === config.SEVERITY.CRITICAL && item.status !== config.STATUS.AUTHORIZED) {
        results.push({ 
          item_id: item.id, 
          artwork_no: item.artwork_no, 
          success: false, 
          error: '存在严重问题，需先授权' 
        });
        continue;
      }

      if (item.final_commission_amount === null) {
        results.push({ 
          item_id: item.id, 
          artwork_no: item.artwork_no, 
          success: false, 
          error: '未完成试算' 
        });
        continue;
      }

      settleItem(item.id);
      results.push({ 
        item_id: item.id, 
        artwork_no: item.artwork_no, 
        success: true,
        commission: item.final_commission_amount,
        artist_amount: item.final_artist_amount
      });
    } catch (e) {
      results.push({ item_id: item.id, success: false, error: e.message });
    }
  }

  batchDao.updateBatchStatus(batchId, 'settled', results.length);

  return {
    batch,
    total_processed: results.length,
    success_count: results.filter(r => r.success).length,
    failed_count: results.filter(r => !r.success).length,
    results
  };
}

function exportSettlement(batchId, exportType = 'csv') {
  const batch = batchDao.getBatchById(batchId);
  if (!batch) {
    throw new Error(`批次 ${batchId} 不存在`);
  }

  const items = itemDao.getItemsByBatch(batchId);
  
  const exportData = items.map(item => ({
    '行号': item.line_no,
    '处理顺序': item.processing_order || '-',
    '作品编号': item.artwork_no,
    '艺术家编码': item.artist_code,
    '艺术家名称': item.artist_name || '-',
    '展期开始': item.exhibition_start_date,
    '展期结束': item.exhibition_end_date,
    '交易日期': item.transaction_date,
    '标价(元)': item.listed_price,
    '成交价(元)': item.transaction_price,
    '折扣率': `${((item.discount_rate || 0) * 100).toFixed(1)}%`,
    '申报佣金率': item.declared_commission_rate ? `${(item.declared_commission_rate * 100).toFixed(1)}%` : '-',
    '最终佣金率': item.final_commission_rate ? `${(item.final_commission_rate * 100).toFixed(1)}%` : '-',
    '佣金金额(元)': item.final_commission_amount ? item.final_commission_amount.toFixed(2) : '-',
    '艺术家应得(元)': item.final_artist_amount ? item.final_artist_amount.toFixed(2) : '-',
    '状态': getStatusText(item.status),
    '是否有问题': item.has_issues ? '是' : '否',
    '最高问题级别': getSeverityText(item.highest_severity)
  }));

  const fileName = `结算明细_${batch.batch_no}_${new Date().toISOString().slice(0, 10)}.csv`;
  const filePath = path.join(config.EXPORT_DIR, fileName);

  if (!fs.existsSync(config.EXPORT_DIR)) {
    fs.mkdirSync(config.EXPORT_DIR, { recursive: true });
  }

  const parser = new Parser();
  const csv = parser.parse(exportData);
  fs.writeFileSync(filePath, '\uFEFF' + csv);

  const totalCommission = items
    .filter(i => i.final_commission_amount !== null)
    .reduce((sum, i) => sum + i.final_commission_amount, 0);
  
  const totalArtistAmount = items
    .filter(i => i.final_artist_amount !== null)
    .reduce((sum, i) => sum + i.final_artist_amount, 0);

  const exportId = exportDao.createExportRecord({
    batch_id: batchId,
    export_type: exportType,
    file_path: filePath,
    file_name: fileName,
    record_count: items.length,
    total_commission: totalCommission,
    total_artist_amount: totalArtistAmount
  });

  return {
    export_id: exportId,
    file_name: fileName,
    file_path: filePath,
    record_count: items.length,
    total_commission: totalCommission,
    total_artist_amount: totalArtistAmount
  };
}

function getStatusText(status) {
  const map = {
    [config.STATUS.IMPORTED]: '已导入',
    [config.STATUS.VALIDATING]: '校验中',
    [config.STATUS.PENDING_REVIEW]: '待审核',
    [config.STATUS.AUTHORIZED]: '已授权',
    [config.STATUS.SETTLED]: '已结算',
    [config.STATUS.REJECTED]: '已驳回'
  };
  return map[status] || status;
}

function getSeverityText(severity) {
  const map = {
    [config.SEVERITY.CRITICAL]: '严重',
    [config.SEVERITY.WARNING]: '警告',
    [config.SEVERITY.INFO]: '提示'
  };
  return map[severity] || '无';
}

function getItemTrace(itemId) {
  const detail = itemDao.getItemDetailWithLogs(itemId);
  if (!detail) {
    return null;
  }

  const rawData = JSON.parse(detail.raw_data || '{}');

  return {
    item: {
      id: detail.id,
      artwork_no: detail.artwork_no,
      artist_code: detail.artist_code,
      status: detail.status,
      status_text: getStatusText(detail.status),
      has_issues: detail.has_issues,
      highest_severity: detail.highest_severity,
      highest_severity_text: getSeverityText(detail.highest_severity),
      final_commission_rate: detail.final_commission_rate,
      final_commission_amount: detail.final_commission_amount,
      final_artist_amount: detail.final_artist_amount
    },
    original_data: rawData,
    artist: detail.artist,
    authorizations: detail.authorizations.map(a => ({
      ...a,
      created_at: a.authorized_at
    })),
    processing_trace: detail.logs.map(log => ({
      id: log.id,
      step: log.step,
      action: log.action,
      severity: log.severity,
      severity_text: getSeverityText(log.severity),
      rule_code: log.rule_code,
      message: log.message,
      raw_value: log.raw_value,
      expected_value: log.expected_value,
      is_original: log.is_original,
      is_processed: log.is_processed,
      operator: log.operator,
      created_at: log.created_at
    }))
  };
}

module.exports = {
  calculateCommission,
  processBatch,
  trialCalculate,
  authorizeItem,
  authorizeBatchItems,
  settleItem,
  settleBatch,
  exportSettlement,
  getItemTrace,
  getStatusText,
  getSeverityText
};
