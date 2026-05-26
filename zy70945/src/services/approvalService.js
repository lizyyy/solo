/**
 * 审批服务 - 整合分类、去重、审批流程
 */

const store = require('../models/store');
const rulesEngine = require('./rulesEngine');
const fileReader = require('./fileReader');
const { v4: uuidv4 } = require('uuid');

/**
 * 处理装修申请文件（CSV上传或读取）
 */
async function processDecorationFile(filePath, fileType = 'csv') {
  const parsed = await fileReader.processUploadedFile(filePath, fileType);

  if (parsed.errors.length > 0 && parsed.success.length === 0) {
    return {
      success: false,
      error: '文件解析失败',
      parseErrors: parsed.errors
    };
  }

  const batchFingerprint = fileReader.generateBatchFingerprint(parsed.success);

  if (store.isBatchProcessed(batchFingerprint)) {
    const batchInfo = store.getBatchInfo(batchFingerprint);
    return {
      duplicate: true,
      message: '该批次数据已处理过，不会重复生效',
      batchFingerprint,
      batchInfo
    };
  }

  const applications = parsed.success.map(app => store.addDecorationApplication(app));

  const result = rulesEngine.processApplications(applications, batchFingerprint);

  return {
    success: true,
    batchFingerprint,
    batchId: `BATCH-${uuidv4().split('-')[0].toUpperCase()}`,
    parseErrors: parsed.errors,
    ...result
  };
}

/**
 * 处理巡检文件
 */
async function processInspectionFile(filePath) {
  const parsed = await fileReader.processUploadedFile(filePath, 'inspection');

  if (parsed.errors.length > 0 && parsed.success.length === 0) {
    return {
      success: false,
      error: '巡检文件解析失败',
      parseErrors: parsed.errors
    };
  }

  const batchFingerprint = fileReader.generateBatchFingerprint(parsed.success);

  if (store.isBatchProcessed(batchFingerprint)) {
    const batchInfo = store.getBatchInfo(batchFingerprint);
    return {
      duplicate: true,
      message: '该批次巡检数据已处理过，不会重复生效',
      batchFingerprint,
      batchInfo
    };
  }

  const inspections = parsed.success.map(ins => store.addInspectionRecord(ins));

  // 检查每个巡检记录对应的申请状态
  const inspectionResults = inspections.map(ins => {
    const application = store.getDecorationApplication(ins.applicationId);
    let impact = null;

    if (application && ins.result === 'failed') {
      impact = {
        needsRecheck: true,
        message: '巡检发现问题，需要复查',
        findings: ins.findings
      };
    }

    return {
      inspectionId: ins.id,
      applicationId: ins.applicationId,
      inspector: ins.inspector,
      result: ins.result,
      impact,
      applicationAddress: application ? application.address : null
    };
  });

  return {
    success: true,
    batchId: `INSP-BATCH-${uuidv4().split('-')[0].toUpperCase()}`,
    count: inspections.length,
    parseErrors: parsed.errors,
    results: inspectionResults
  };
}

/**
 * 处理扣款规则文件
 */
async function processDeductionRulesFile(filePath) {
  const parsed = await fileReader.processUploadedFile(filePath, 'rules');

  if (parsed.errors.length > 0 && parsed.success.length === 0) {
    return {
      success: false,
      error: '规则文件解析失败',
      parseErrors: parsed.errors
    };
  }

  const batchFingerprint = fileReader.generateBatchFingerprint(parsed.success);

  if (store.isBatchProcessed(batchFingerprint)) {
    const batchInfo = store.getBatchInfo(batchFingerprint);
    return {
      duplicate: true,
      message: '该批次规则已处理过，不会重复生效',
      batchFingerprint,
      batchInfo
    };
  }

  const rules = parsed.success.map(rule => store.addDeductionRule(rule));

  return {
    success: true,
    batchId: `RULE-BATCH-${uuidv4().split('-')[0].toUpperCase()}`,
    count: rules.length,
    parseErrors: parsed.errors,
    rules: rules.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      priority: r.priority,
      active: r.active
    }))
  };
}

/**
 * 从原始数据处理（直接传入JSON对象，非文件）
 */
function processRawData(data, dataType) {
  const batchFingerprint = fileReader.generateBatchFingerprint(data);

  // 去重检查
  if (store.isBatchProcessed(batchFingerprint)) {
    const batchInfo = store.getBatchInfo(batchFingerprint);
    return {
      duplicate: true,
      message: '该批次数据已处理过，不会重复生效',
      batchInfo
    };
  }

  let applications = [];

  if (dataType === 'decoration' || dataType === 'csv') {
    applications = data.map(app => {
      const record = store.addDecorationApplication({
        ...app,
        source: 'direct_input'
      });
      return record;
    });
  }

  const result = rulesEngine.processApplications(applications, batchFingerprint);

  return {
    success: true,
    batchFingerprint,
    batchId: `BATCH-${uuidv4().split('-')[0].toUpperCase()}`,
    ...result
  };
}

/**
 * 获取分类统计
 */
function getCategoryStats() {
  const allApps = Array.from(store.decorationApplications.values());
  const stats = {
    total: allApps.length,
    normal: 0,
    pending_confirmation: 0,
    failed: 0,
    byStatus: {}
  };

  allApps.forEach(app => {
    if (app.acceptanceStatus) {
      stats.byStatus[app.acceptanceStatus] = (stats.byStatus[app.acceptanceStatus] || 0) + 1;
    }
  });

  return stats;
}

/**
 * 获取退款追踪信息
 */
function getRefundTrace(refundId) {
  const trace = store.getRefundTrace(refundId);
  if (!trace) {
    return { success: false, error: '退款记录不存在' };
  }

  return {
    success: true,
    trace: {
      refund: trace.refund,
      application: trace.application ? {
        id: trace.application.id,
        ownerId: trace.application.ownerId,
        ownerName: trace.application.ownerName,
        address: trace.application.address,
        depositAmount: trace.application.depositAmount,
        depositBalance: trace.application.depositBalance,
        acceptanceStatus: trace.application.acceptanceStatus
      } : null,
      inspections: trace.inspections.map(i => ({
        id: i.id,
        inspector: i.inspector,
        result: i.result,
        date: i.date
      })),
      violations: trace.violations.map(v => ({
        id: v.id,
        ruleName: v.ruleName,
        description: v.description,
        resolved: v.resolved
      })),
      freezeRecords: trace.freezeRecords.map(f => ({
        id: f.id,
        amount: f.amount,
        reason: f.reason,
        released: f.released
      })),
      timeline: trace.timeline
    }
  };
}

/**
 * 获取所有退款历史
 */
function getAllRefundHistory() {
  const history = store.getRefundHistory();
  return {
    success: true,
    count: history.length,
    refunds: history.map(r => ({
      id: r.id,
      applicationId: r.applicationId,
      amount: r.amount,
      status: r.status,
      approver: r.approver,
      reason: r.reason,
      createdAt: r.createdAt
    }))
  };
}

/**
 * 检查批次是否已处理
 */
function checkBatchStatus(batchFingerprint) {
  if (store.isBatchProcessed(batchFingerprint)) {
    return {
      processed: true,
      info: store.getBatchInfo(batchFingerprint)
    };
  }
  return { processed: false };
}

/**
 * 执行完整的扣款审批流程
 */
function executeDeductionProcess(applicationId, ruleId, operator) {
  const application = store.getDecorationApplication(applicationId);
  if (!application) {
    return { success: false, error: '装修申请不存在' };
  }

  const rule = store.deductionRules.get(ruleId);
  if (!rule) {
    return { success: false, error: '扣款规则不存在' };
  }

  // 创建违规记录
  const violation = store.addViolation({
    applicationId,
    ruleId,
    ruleName: rule.name,
    description: rule.penalty.description,
    penaltyAmount: rule.penalty.amount,
    operator: operator || '系统'
  });

  // 如果规则要求冻结押金
  let freezeRecord = null;
  if (rule.penalty.freezeDeposit) {
    freezeRecord = store.addDepositFreeze({
      applicationId,
      amount: application.depositAmount,
      reason: rule.penalty.description,
      ruleId,
      operator: operator || '系统'
    });
  }

  // 创建审批记录
  const approval = store.addApprovalRecord({
    type: 'deduction',
    applicationId,
    ruleId,
    ruleName: rule.name,
    amount: rule.penalty.amount,
    operator: operator || '系统',
    status: 'pending',
    reason: rule.penalty.description
  });

  return {
    success: true,
    violation,
    freezeRecord,
    approval
  };
}

module.exports = {
  processDecorationFile,
  processInspectionFile,
  processDeductionRulesFile,
  processRawData,
  getCategoryStats,
  getRefundTrace,
  getAllRefundHistory,
  checkBatchStatus,
  executeDeductionProcess
};
