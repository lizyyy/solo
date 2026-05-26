/**
 * 规则引擎 - 违规复查、押金冻结、重复退款检测
 */

const store = require('../models/store');
const { v4: uuidv4 } = require('uuid');

/**
 * 规则条件评估
 */
function evaluateCondition(condition, data) {
  const { item, value, check } = condition;
  const actualValue = data[item];

  switch (check) {
    case 'equals':
      return actualValue === value;
    case 'not_equals':
      return actualValue !== value;
    case 'gt':
      return parseFloat(actualValue) > parseFloat(value);
    case 'gte':
      return parseFloat(actualValue) >= parseFloat(value);
    case 'lt':
      return parseFloat(actualValue) < parseFloat(value);
    case 'lte':
      return parseFloat(actualValue) <= parseFloat(value);
    case 'contains':
      return String(actualValue).includes(String(value));
    case 'in':
      return Array.isArray(value) && value.includes(actualValue);
    case 'exists':
      return actualValue !== undefined && actualValue !== null;
    default:
      return false;
  }
}

/**
 * 违规复查 - 检查装修申请是否触发违规规则
 */
function checkViolations(application) {
  const rules = store.getRulesByType('violation_recheck');
  const triggered = [];

  for (const rule of rules) {
    if (evaluateCondition(rule.condition, application)) {
      triggered.push({
        ruleId: rule.id,
        ruleName: rule.name,
        condition: rule.condition,
        penalty: rule.penalty,
        priority: rule.priority
      });
    }
  }

  return triggered;
}

/**
 * 检查是否需要冻结押金
 */
function checkDepositFreeze(application, violations = []) {
  const shouldFreeze = violations.some(v => v.penalty && v.penalty.freezeDeposit);

  const depositRules = store.getRulesByType('deposit_check');
  for (const rule of depositRules) {
    if (evaluateCondition(rule.condition, application) && rule.penalty.freezeDeposit) {
      return {
        shouldFreeze: true,
        reason: rule.penalty.description || rule.name,
        ruleId: rule.id,
        ruleName: rule.name,
        amount: rule.penalty.amount || application.depositAmount
      };
    }
  }

  if (shouldFreeze) {
    const violation = violations.find(v => v.penalty && v.penalty.freezeDeposit);
    return {
      shouldFreeze: true,
      reason: violation.penalty.description || '违规触发押金冻结',
      ruleId: violation.ruleId,
      ruleName: violation.ruleName,
      amount: application.depositAmount
    };
  }

  return { shouldFreeze: false };
}

/**
 * 重复退款检测 - 检查是否已有退款记录
 */
function checkDuplicateRefund(applicationId) {
  const existingRefunds = store.getRefundByApplication(applicationId);

  const completedRefunds = existingRefunds.filter(
    r => r.status === 'approved' || r.status === 'completed'
  );

  if (completedRefunds.length > 0) {
    return {
      hasDuplicate: true,
      existingRecords: completedRefunds,
      message: `该申请已有 ${completedRefunds.length} 条已完成的退款记录`
    };
  }

  const pendingRefunds = existingRefunds.filter(
    r => r.status === 'pending' || r.status === 'processing'
  );

  if (pendingRefunds.length > 0) {
    return {
      hasDuplicate: true,
      existingRecords: pendingRefunds,
      message: `该申请已有 ${pendingRefunds.length} 条待处理的退款记录`
    };
  }

  return { hasDuplicate: false };
}

/**
 * 检查退款资格
 */
function checkRefundEligibility(application) {
  const reasons = [];
  const warnings = [];

  // 检查押金余额
  if (!application.depositBalance || application.depositBalance <= 0) {
    reasons.push({
      code: 'NO_DEPOSIT',
      message: '押金余额为0，无法退款',
      severity: 'error'
    });
  }

  // 检查验收状态
  if (application.acceptanceStatus !== 'approved' && application.acceptanceStatus !== 'completed') {
    reasons.push({
      code: 'NOT_ACCEPTED',
      message: `装修尚未通过验收（当前状态: ${application.acceptanceStatus}）`,
      severity: 'error'
    });
  }

  // 检查未解决的违规
  const unresolvedViolations = store.getUnresolvedViolations(application.id);
  if (unresolvedViolations.length > 0) {
    reasons.push({
      code: 'UNRESOLVED_VIOLATIONS',
      message: `存在 ${unresolvedViolations.length} 条未解决的违规记录`,
      severity: 'error',
      details: unresolvedViolations.map(v => ({
        ruleName: v.ruleName,
        description: v.description
      }))
    });
  }

  // 检查押金冻结状态
  const activeFreezes = store.getActiveFreezeByApplication(application.id);
  if (activeFreezes.length > 0) {
    reasons.push({
      code: 'DEPOSIT_FROZEN',
      message: `押金处于冻结状态（${activeFreezes.length} 条冻结记录）`,
      severity: 'warning',
      details: activeFreezes.map(f => ({
        reason: f.reason,
        amount: f.amount
      }))
    });
  }

  // 检查重复退款
  const duplicateCheck = checkDuplicateRefund(application.id);
  if (duplicateCheck.hasDuplicate) {
    reasons.push({
      code: 'DUPLICATE_REFUND',
      message: duplicateCheck.message,
      severity: 'error',
      details: duplicateCheck.existingRecords.map(r => ({
        refundId: r.id,
        amount: r.amount,
        status: r.status,
        date: r.createdAt
      }))
    });
  }

  return {
    eligible: reasons.filter(r => r.severity === 'error').length === 0,
    reasons,
    warnings: reasons.filter(r => r.severity === 'warning')
  };
}

/**
 * 处理装修申请
 * 返回分类结果: 正常、待确认、失败
 */
function processApplication(application) {
  const violations = checkViolations(application);
  const freezeCheck = checkDepositFreeze(application, violations);
  const refundEligibility = checkRefundEligibility(application);

  const failedChecks = [];
  const pendingChecks = [];

  // 收集严重违规
  violations.filter(v => v.priority <= 1).forEach(v => {
    failedChecks.push({
      type: 'violation',
      ruleId: v.ruleId,
      ruleName: v.ruleName,
      message: v.penalty.description,
      penalty: v.penalty
    });
  });

  // 收集一般违规（待确认）
  violations.filter(v => v.priority > 1).forEach(v => {
    pendingChecks.push({
      type: 'violation',
      ruleId: v.ruleId,
      ruleName: v.ruleName,
      message: v.penalty.description,
      penalty: v.penalty,
      suggestion: '建议现场复核后处理'
    });
  });

  // 押金冻结问题
  if (freezeCheck.shouldFreeze) {
    failedChecks.push({
      type: 'deposit_freeze',
      ruleId: freezeCheck.ruleId,
      ruleName: freezeCheck.ruleName,
      message: freezeCheck.reason,
      amount: freezeCheck.amount
    });
  }

  // 退款资格问题
  refundEligibility.reasons.forEach(r => {
    if (r.severity === 'error') {
      failedChecks.push({
        type: 'refund_reject',
        code: r.code,
        message: r.message,
        details: r.details
      });
    } else {
      pendingChecks.push({
        type: 'refund_warning',
        code: r.code,
        message: r.message,
        suggestion: '建议人工确认后处理'
      });
    }
  });

  // 分类
  let category = 'normal';
  let suggestion = '无异常，可正常推进';

  if (failedChecks.length > 0) {
    category = 'failed';
    suggestion = '存在严重问题，需整改后重新提交';
  } else if (pendingChecks.length > 0) {
    category = 'pending_confirmation';
    suggestion = '存在需人工确认的事项';
  }

  return {
    applicationId: application.id,
    ownerName: application.ownerName,
    address: application.address,
    category,
    suggestion,
    failedChecks,
    pendingChecks,
    violations,
    freezeCheck,
    refundEligibility,
    originalData: application.rawData || application,
    depositAmount: application.depositAmount,
    depositBalance: application.depositBalance,
    acceptanceStatus: application.acceptanceStatus
  };
}

/**
 * 批量处理申请
 * 包含去重检查
 */
function processApplications(applications, batchFingerprint) {
  // 去重检查
  if (batchFingerprint && store.isBatchProcessed(batchFingerprint)) {
    const batchInfo = store.getBatchInfo(batchFingerprint);
    return {
      duplicate: true,
      message: '该批次数据已处理过，不会重复生效',
      batchInfo
    };
  }

  const results = {
    normal: [],
    pending_confirmation: [],
    failed: [],
    summary: {
      total: applications.length,
      normal: 0,
      pending_confirmation: 0,
      failed: 0
    }
  };

  applications.forEach(app => {
    const processed = processApplication(app);

    switch (processed.category) {
      case 'normal':
        results.normal.push(processed);
        results.summary.normal++;
        break;
      case 'pending_confirmation':
        results.pending_confirmation.push(processed);
        results.summary.pending_confirmation++;
        break;
      case 'failed':
        results.failed.push(processed);
        results.summary.failed++;
        break;
    }
  });

  // 标记批次已处理
  if (batchFingerprint) {
    store.markBatchProcessed(batchFingerprint, `BATCH-${uuidv4().split('-')[0].toUpperCase()}`, applications.length);
  }

  return results;
}

/**
 * 创建退款审批
 */
function createRefundApproval(applicationId, amount, approver, reason) {
  const application = store.getDecorationApplication(applicationId);
  if (!application) {
    return { success: false, error: '装修申请不存在' };
  }

  const duplicateCheck = checkDuplicateRefund(applicationId);
  if (duplicateCheck.hasDuplicate) {
    return {
      success: false,
      error: '重复退款检测未通过',
      details: duplicateCheck
    };
  }

  const eligibility = checkRefundEligibility(application);
  if (!eligibility.eligible) {
    return {
      success: false,
      error: '退款资格检查未通过',
      details: eligibility.reasons
    };
  }

  const approval = store.addApprovalRecord({
    type: 'refund',
    applicationId,
    amount: amount || application.depositBalance,
    approver: approver || '系统',
    reason: reason || '自动审批通过',
    status: 'pending',
    sourceApplication: {
      ownerId: application.ownerId,
      ownerName: application.ownerName,
      address: application.address,
      depositAmount: application.depositAmount,
      depositBalance: application.depositBalance
    }
  });

  return {
    success: true,
    approval,
    message: '退款审批已创建，等待最终确认'
  };
}

/**
 * 确认退款 - 执行退款操作
 */
function confirmRefund(refundId, operator) {
  const refund = store.refundHistory.get(refundId);
  if (!refund) {
    return { success: false, error: '退款记录不存在' };
  }

  if (refund.status === 'completed') {
    return { success: false, error: '该退款已完成，不能重复操作' };
  }

  const application = store.getDecorationApplication(refund.applicationId);
  if (!application) {
    return { success: false, error: '关联的装修申请不存在' };
  }

  // 更新退款状态
  refund.status = 'completed';
  refund.confirmedBy = operator;
  refund.confirmedAt = new Date().toISOString();
  store.refundHistory.set(refundId, refund);
  store.approvalRecords.set(refundId, refund);

  // 更新押金余额
  application.depositBalance = Math.max(0, application.depositBalance - refund.amount);
  application.refundStatus = 'completed';
  store.decorationApplications.set(application.id, application);

  // 解冻押金（如有冻结）
  const activeFreezes = store.getActiveFreezeByApplication(application.id);
  activeFreezes.forEach(f => {
    f.released = true;
    f.releasedAt = new Date().toISOString();
    f.releasedBy = operator;
    store.depositFreezeRecords.set(f.id, f);
  });

  return {
    success: true,
    refund,
    application,
    message: `退款已确认：${refund.amount} 元已退还业主 ${application.ownerName}`
  };
}

module.exports = {
  evaluateCondition,
  checkViolations,
  checkDepositFreeze,
  checkDuplicateRefund,
  checkRefundEligibility,
  processApplication,
  processApplications,
  createRefundApproval,
  confirmRefund
};
