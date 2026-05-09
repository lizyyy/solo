const dataStore = require('./dataStore');
const utils = require('./utils');

const STATUS = {
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL'
};

function validateBudget(activityId, budget) {
  const issues = [];
  
  if (!budget) {
    issues.push({
      type: 'MISSING_BUDGET',
      message: `活动 ${activityId} 没有对应的预算记录`,
      severity: STATUS.FAIL
    });
    return issues;
  }
  
  if (!budget.status || budget.status !== 'approved') {
    issues.push({
      type: 'BUDGET_NOT_APPROVED',
      message: `活动 ${activityId} 的预算状态为 "${budget.status || 'unknown'}"，未生效`,
      severity: STATUS.WARN
    });
  }
  
  if (!budget.totalAmount || parseFloat(budget.totalAmount) <= 0) {
    issues.push({
      type: 'INVALID_BUDGET_AMOUNT',
      message: `活动 ${activityId} 的预算金额无效`,
      severity: STATUS.WARN
    });
  }
  
  return issues;
}

function validateInvoices(activityId, invoices, budget) {
  const issues = [];
  
  if (!invoices || invoices.length === 0) {
    issues.push({
      type: 'NO_INVOICES',
      message: `活动 ${activityId} 没有对应的票据记录`,
      severity: STATUS.FAIL
    });
    return issues;
  }
  
  let totalInvoiceAmount = 0;
  const invoiceMap = new Map();
  
  invoices.forEach((invoice, index) => {
    if (!invoice.invoiceNumber) {
      issues.push({
        type: 'MISSING_INVOICE_NUMBER',
        message: `活动 ${activityId} 的第 ${index + 1} 张票据缺少票据编号`,
        severity: STATUS.FAIL
      });
    } else {
      if (invoiceMap.has(invoice.invoiceNumber)) {
        issues.push({
          type: 'DUPLICATE_INVOICE_NUMBER',
          message: `活动 ${activityId} 存在重复的票据编号: ${invoice.invoiceNumber}`,
          severity: STATUS.FAIL
        });
      }
      invoiceMap.set(invoice.invoiceNumber, true);
    }
    
    if (!invoice.amount || parseFloat(invoice.amount) <= 0) {
      issues.push({
        type: 'INVALID_INVOICE_AMOUNT',
        message: `活动 ${activityId} 的票据 "${invoice.invoiceNumber || index + 1}" 金额无效`,
        severity: STATUS.FAIL
      });
    } else {
      totalInvoiceAmount += parseFloat(invoice.amount);
    }
    
    if (!invoice.date) {
      issues.push({
        type: 'MISSING_INVOICE_DATE',
        message: `活动 ${activityId} 的票据 "${invoice.invoiceNumber || index + 1}" 缺少日期`,
        severity: STATUS.WARN
      });
    }
  });
  
  if (budget && budget.totalAmount && totalInvoiceAmount > parseFloat(budget.totalAmount)) {
    issues.push({
      type: 'INVOICE_EXCEEDS_BUDGET',
      message: `活动 ${activityId} 的票据总金额 (¥${totalInvoiceAmount.toFixed(2)}) 超过预算金额 (¥${parseFloat(budget.totalAmount).toFixed(2)})`,
      severity: STATUS.WARN
    });
  }
  
  return issues;
}

function validateApproval(activityId, approval, invoices) {
  const issues = [];
  
  if (!approval) {
    issues.push({
      type: 'MISSING_APPROVAL',
      message: `活动 ${activityId} 没有对应的审批记录`,
      severity: STATUS.FAIL
    });
    return issues;
  }
  
  if (!approval.status) {
    issues.push({
      type: 'MISSING_APPROVAL_STATUS',
      message: `活动 ${activityId} 的审批记录缺少状态`,
      severity: STATUS.FAIL
    });
  }
  
  if (invoices && invoices.length > 0) {
    const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
    
    if (approval.approvedAmount !== undefined && approval.approvedAmount !== null) {
      const approvedAmount = parseFloat(approval.approvedAmount);
      if (Math.abs(approvedAmount - totalInvoiceAmount) > 0.01) {
        issues.push({
          type: 'APPROVAL_AMOUNT_MISMATCH',
          message: `活动 ${activityId} 的审批金额 (¥${approvedAmount.toFixed(2)}) 与票据总金额 (¥${totalInvoiceAmount.toFixed(2)}) 不一致`,
          severity: STATUS.WARN
        });
      }
    }
  }
  
  if (!approval.approver) {
    issues.push({
      type: 'MISSING_APPROVER',
      message: `活动 ${activityId} 的审批记录缺少审批人`,
      severity: STATUS.WARN
    });
  }
  
  if (!approval.approvalDate) {
    issues.push({
      type: 'MISSING_APPROVAL_DATE',
      message: `活动 ${activityId} 的审批记录缺少审批日期`,
      severity: STATUS.WARN
    });
  }
  
  return issues;
}

function validateActivity(activityId) {
  const budget = dataStore.findBudgetByActivityId(activityId);
  const invoices = dataStore.findInvoicesByActivityId(activityId);
  const approval = dataStore.findApprovalByActivityId(activityId);
  
  const issues = [];
  
  issues.push(...validateBudget(activityId, budget));
  issues.push(...validateInvoices(activityId, invoices, budget));
  issues.push(...validateApproval(activityId, approval, invoices));
  
  const hasFail = issues.some(i => i.severity === STATUS.FAIL);
  const hasWarn = issues.some(i => i.severity === STATUS.WARN);
  
  let overallStatus;
  if (hasFail) {
    overallStatus = STATUS.FAIL;
  } else if (hasWarn) {
    overallStatus = STATUS.WARN;
  } else {
    overallStatus = STATUS.PASS;
  }
  
  return {
    activityId,
    status: overallStatus,
    budget: budget || null,
    invoices: invoices || [],
    approval: approval || null,
    issues,
    summary: generateSummary(activityId, budget, invoices, approval, overallStatus)
  };
}

function generateSummary(activityId, budget, invoices, approval, status) {
  const totalInvoiceAmount = (invoices || []).reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  
  return {
    activityId,
    activityName: budget?.activityName || approval?.activityName || '未知活动',
    budgetAmount: budget?.totalAmount ? parseFloat(budget.totalAmount) : 0,
    budgetStatus: budget?.status || 'N/A',
    invoiceCount: invoices?.length || 0,
    totalInvoiceAmount,
    approvalStatus: approval?.status || 'N/A',
    approvedAmount: approval?.approvedAmount ? parseFloat(approval.approvedAmount) : 0,
    overallStatus: status
  };
}

function validateAll() {
  const activityIds = dataStore.getAllActivityIds();
  const results = activityIds.map(validateActivity);
  
  const passCount = results.filter(r => r.status === STATUS.PASS).length;
  const warnCount = results.filter(r => r.status === STATUS.WARN).length;
  const failCount = results.filter(r => r.status === STATUS.FAIL).length;
  
  const historyRecord = {
    id: utils.generateId(),
    timestamp: utils.getTimestamp(),
    summary: {
      total: results.length,
      pass: passCount,
      warn: warnCount,
      fail: failCount
    },
    results
  };
  
  const historyFile = require('path').join(utils.getHistoryDir(), `check-${Date.now()}.json`);
  utils.writeJsonFile(historyFile, historyRecord);
  
  return historyRecord;
}

module.exports = {
  STATUS,
  validateActivity,
  validateAll
};
