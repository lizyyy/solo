export function summarizeRefunds(parseResult, validationResult, fileName) {
  const summary = {
    fileInfo: {
      fileName,
      processTime: new Date(),
      totalRows: parseResult.totalRows,
      validRows: parseResult.validRows,
      invalidRows: parseResult.invalidRows
    },
    validation: {
      totalRecords: validationResult.totalRecords,
      needsReviewCount: validationResult.needsReviewCount,
      warningCount: validationResult.warningCount,
      passRate: calculatePassRate(validationResult)
    },
    reviewBreakdown: breakdownByReviewType(validationResult.needsReview),
    amountSummary: calculateAmountSummary(validationResult),
    topIssues: getTopIssues(validationResult),
    parseErrors: parseResult.errors
  };

  return summary;
}

function calculatePassRate(validationResult) {
  if (validationResult.totalRecords === 0) return '0%';
  const passCount = validationResult.totalRecords - validationResult.needsReviewCount;
  const rate = ((passCount / validationResult.totalRecords) * 100).toFixed(1);
  return `${rate}%`;
}

function breakdownByReviewType(needsReview) {
  const breakdown = {
    splitRefund: [],
    tagExpired: [],
    blacklistRemoved: [],
    duplicateRun: [],
    highAmount: [],
    highRiskReason: [],
    highRiskTag: []
  };

  for (const item of needsReview) {
    const { record, reasons } = item;
    
    if (record.splitRefundFlag === 'Y' || record.splitRefundFlag === '是') {
      breakdown.splitRefund.push(record);
    }
    if (record.tagExpireTime && record.tagExpireTime < new Date()) {
      breakdown.tagExpired.push(record);
    }
    if (record.blacklistStatus === '已解除' || record.blacklistStatus === 'REMOVED') {
      breakdown.blacklistRemoved.push(record);
    }
    if (reasons.some(r => r.includes('重复运行'))) {
      breakdown.duplicateRun.push(record);
    }
    if (record.refundAmount >= 5000) {
      breakdown.highAmount.push(record);
    }
    if (['质量问题造假', '恶意退款', '虚假物流'].includes(record.refundReason)) {
      breakdown.highRiskReason.push(record);
    }
    const riskKeywords = ['欺诈', '恶意', '盗刷', '套现', '虚假', '异常', '高风险'];
    if (record.riskTags.some(tag => riskKeywords.some(keyword => tag.includes(keyword)))) {
      breakdown.highRiskTag.push(record);
    }
  }

  return {
    splitRefund: { count: breakdown.splitRefund.length, records: breakdown.splitRefund },
    tagExpired: { count: breakdown.tagExpired.length, records: breakdown.tagExpired },
    blacklistRemoved: { count: breakdown.blacklistRemoved.length, records: breakdown.blacklistRemoved },
    duplicateRun: { count: breakdown.duplicateRun.length, records: breakdown.duplicateRun },
    highAmount: { count: breakdown.highAmount.length, records: breakdown.highAmount },
    highRiskReason: { count: breakdown.highRiskReason.length, records: breakdown.highRiskReason },
    highRiskTag: { count: breakdown.highRiskTag.length, records: breakdown.highRiskTag }
  };
}

function calculateAmountSummary(validationResult) {
  let totalAmount = 0;
  let reviewAmount = 0;

  for (const result of validationResult.results) {
    totalAmount += result.record.refundAmount;
    if (result.needsReview) {
      reviewAmount += result.record.refundAmount;
    }
  }

  return {
    totalAmount: totalAmount.toFixed(2),
    reviewAmount: reviewAmount.toFixed(2),
    reviewPercentage: totalAmount > 0 
      ? ((reviewAmount / totalAmount) * 100).toFixed(1) + '%' 
      : '0%'
  };
}

function getTopIssues(validationResult) {
  const issueCounts = {};

  for (const warning of validationResult.warnings) {
    for (const w of warning.warnings) {
      issueCounts[w.type] = (issueCounts[w.type] || 0) + 1;
    }
  }

  const sortedIssues = Object.entries(issueCounts)
    .map(([type, count]) => ({ type, count, description: getIssueDescription(type) }))
    .sort((a, b) => b.count - a.count);

  return sortedIssues;
}

function getIssueDescription(type) {
  const descriptions = {
    SPLIT_REFUND: '拆单退款 - 订单拆分多笔退款，需核对金额',
    TAG_EXPIRED: '风控标签过期 - 标签已失效，需重新评估',
    BLACKLIST_REMOVED: '黑名单解除 - 用户已移出黑名单，需重新确认',
    DUPLICATE_RUN: '重复运行 - 退款单已处理过，需确认是否重复'
  };
  return descriptions[type] || type;
}
