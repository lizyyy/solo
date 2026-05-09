import * as XLSX from 'xlsx';
import { getAllBudgets, getAllPurchaseRequests, getAllContractPayments, getExceptions } from './models';
import { checkAllBudgets, CheckResult } from './budgetService';

export interface ReportData {
  summary: {
    totalBudgets: number;
    overBudgetCount: number;
    overThresholdCount: number;
    totalPurchaseRequests: number;
    totalPayments: number;
    pendingExceptions: number;
  };
  budgets: CheckResult[];
  purchaseRequests: ReturnType<typeof getAllPurchaseRequests>;
  payments: ReturnType<typeof getAllContractPayments>;
  exceptions: ReturnType<typeof getExceptions>;
}

export function generateReportData(): ReportData {
  const budgets = checkAllBudgets();
  const purchaseRequests = getAllPurchaseRequests();
  const payments = getAllContractPayments();
  const exceptions = getExceptions();

  const overBudgetCount = budgets.filter(b => b.isOverBudget).length;
  const overThresholdCount = budgets.filter(b => b.isOverThreshold).length;
  const pendingExceptions = exceptions.filter(e => !e.is_resolved).length;

  return {
    summary: {
      totalBudgets: budgets.length,
      overBudgetCount,
      overThresholdCount,
      totalPurchaseRequests: purchaseRequests.length,
      totalPayments: payments.length,
      pendingExceptions
    },
    budgets,
    purchaseRequests,
    payments,
    exceptions
  };
}

export function generateExcelReport(outputPath: string): void {
  const data = generateReportData();
  const workbook = XLSX.utils.book_new();

  const summaryData = [
    { '项目': '预算总数', '数值': data.summary.totalBudgets },
    { '项目': '超支预算', '数值': data.summary.overBudgetCount },
    { '项目': '超阈值预算', '数值': data.summary.overThresholdCount },
    { '项目': '采购申请数', '数值': data.summary.totalPurchaseRequests },
    { '项目': '付款记录数', '数值': data.summary.totalPayments },
    { '项目': '待处理异常', '数值': data.summary.pendingExceptions }
  ];

  XLSX.utils.book_append_sheet(
    workbook, 
    XLSX.utils.json_to_sheet(summaryData), 
    '概览'
  );

  const budgetSheetData = data.budgets.map(b => ({
    '部门': b.departmentName,
    '期间': b.period,
    '预算类型': b.budgetType,
    '预算金额': b.budgetAmount,
    '已用金额': b.usedAmount,
    '预留金额': b.reservedAmount,
    '剩余金额': b.remainingAmount,
    '使用率': `${(b.usageRate * 100).toFixed(1)}%`,
    '阈值': `${(b.threshold * 100)}%`,
    '是否超支': b.isOverBudget ? '是' : '否',
    '是否超阈值': b.isOverThreshold ? '是' : '否',
    '问题': b.issues.join('; ')
  }));

  XLSX.utils.book_append_sheet(
    workbook, 
    XLSX.utils.json_to_sheet(budgetSheetData), 
    '预算状况'
  );

  const purchaseSheetData = data.purchaseRequests.map(p => ({
    '申请单号': p.request_no,
    '部门': p.department_name,
    '物品名称': p.item_name,
    '申请金额': p.requested_amount,
    '审批金额': p.approved_amount ?? '',
    '状态': p.status,
    '申请日期': p.request_date,
    '申请人': p.requester ?? '',
    '预算期间': p.budget_period ?? '',
    '预算类型': p.budget_type ?? '',
    '描述': p.description ?? ''
  }));

  XLSX.utils.book_append_sheet(
    workbook, 
    XLSX.utils.json_to_sheet(purchaseSheetData), 
    '采购申请'
  );

  const paymentSheetData = data.payments.map(p => ({
    '付款单号': p.payment_no,
    '合同号': p.contract_no ?? '',
    '部门': p.department_name,
    '申请单号': p.request_no ?? '',
    '付款金额': p.amount,
    '付款日期': p.payment_date,
    '收款方': p.payee ?? '',
    '状态': p.status,
    '预算期间': p.budget_period ?? '',
    '预算类型': p.budget_type ?? '',
    '描述': p.description ?? ''
  }));

  XLSX.utils.book_append_sheet(
    workbook, 
    XLSX.utils.json_to_sheet(paymentSheetData), 
    '合同付款'
  );

  const exceptionSheetData = data.exceptions.map(e => ({
    '异常类型': e.exception_type,
    '严重程度': e.severity,
    '关联类型': e.related_type ?? '',
    '关联ID': e.related_id ?? '',
    '消息': e.message,
    '详情': e.details ?? '',
    '是否已解决': e.is_resolved ? '是' : '否',
    '解决时间': e.resolved_at ?? '',
    '创建时间': e.created_at
  }));

  XLSX.utils.book_append_sheet(
    workbook, 
    XLSX.utils.json_to_sheet(exceptionSheetData), 
    '异常记录'
  );

  XLSX.writeFile(workbook, outputPath);
}
