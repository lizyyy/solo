export const VALIDATION_RULES = {
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  SPLIT_REFUND: 'SPLIT_REFUND',
  TAG_EXPIRED: 'TAG_EXPIRED',
  BLACKLIST_REMOVED: 'BLACKLIST_REMOVED',
  DUPLICATE_RUN: 'DUPLICATE_RUN'
};

export function validateRefundRecords(records, processedRefunds = new Set()) {
  const results = [];
  const warnings = [];
  const needsReview = [];
  const continueProcessing = [];

  for (const record of records) {
    const validation = validateSingleRecord(record, processedRefunds);
    
    results.push({
      record,
      ...validation
    });

    if (validation.needsReview) {
      needsReview.push({
        record,
        reasons: validation.reasons
      });
    }

    if (validation.canContinue) {
      continueProcessing.push(record);
    }

    if (validation.warnings.length > 0) {
      warnings.push({
        refundNo: record.refundNo,
        rowNumber: record.rowNumber,
        warnings: validation.warnings
      });
    }
  }

  return {
    results,
    needsReview,
    continueProcessing,
    warnings,
    totalRecords: records.length,
    needsReviewCount: needsReview.length,
    warningCount: warnings.length
  };
}

function validateSingleRecord(record, processedRefunds) {
  const reasons = [];
  const warnings = [];
  let needsReview = false;
  let canContinue = true;

  if (processedRefunds.has(record.refundNo)) {
    warnings.push({
      type: VALIDATION_RULES.DUPLICATE_RUN,
      message: `该退款单 [${record.refundNo}] 已处理过，重复运行`
    });
    canContinue = true;
    needsReview = true;
    reasons.push('重复运行，需要确认是否重复处理');
  }

  if (record.splitRefundFlag === 'Y' || record.splitRefundFlag === '是') {
    warnings.push({
      type: VALIDATION_RULES.SPLIT_REFUND,
      message: `拆单退款，订单 [${record.orderNo}] 拆分多笔退款`
    });
    canContinue = true;
    reasons.push('拆单退款，需核对拆单金额总和');
  }

  if (record.tagExpireTime && record.tagExpireTime < new Date()) {
    warnings.push({
      type: VALIDATION_RULES.TAG_EXPIRED,
      message: `风控标签已过期，过期时间: ${formatDate(record.tagExpireTime)}`
    });
    canContinue = true;
    reasons.push('风控标签已过期，需重新评估风险');
  }

  if (record.blacklistStatus === '已解除' || record.blacklistStatus === 'REMOVED') {
    warnings.push({
      type: VALIDATION_RULES.BLACKLIST_REMOVED,
      message: `用户 [${record.userId}] 已从黑名单解除`
    });
    canContinue = true;
    reasons.push('用户已从黑名单解除，需重新评估是否放行');
  }

  if (!needsReview && reasons.length > 0) {
    needsReview = true;
  }

  needsReview = needsReview || needsManualReview(record);

  return {
    needsReview,
    canContinue,
    reasons,
    warnings
  };
}

function needsManualReview(record) {
  const riskKeywords = ['欺诈', '恶意', '盗刷', '套现', '虚假', '异常', '高风险'];
  const hasRiskTag = record.riskTags.some(tag => 
    riskKeywords.some(keyword => tag.includes(keyword))
  );

  const isHighAmount = record.refundAmount >= 5000;

  const isHighRiskReason = ['质量问题造假', '恶意退款', '虚假物流'].includes(record.refundReason);

  return hasRiskTag || isHighAmount || isHighRiskReason;
}

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
