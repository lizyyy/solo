import type { Settlement, ValidationIssue } from '../types';
import { calculateDiffPercent } from './amount';
import { parseDate } from './date';

export function validateSettlementData(s: Settlement): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!s.merchantName || s.merchantName.trim() === '') {
    issues.push({
      severity: 'error',
      field: 'merchantName',
      message: '商户名称不能为空',
      suggestion: '请补充完整的商户名称',
    });
  }

  if (s.amount <= 0) {
    issues.push({
      severity: 'error',
      field: 'amount',
      message: `清分金额 ${s.amount} 不能为负或零`,
      suggestion: '请核对清分金额，确保大于0',
    });
  }

  if (!s.id || s.id.trim() === '') {
    issues.push({
      severity: 'error',
      field: 'id',
      message: '批次号不能为空',
      suggestion: '请填写或生成批次号',
    });
  }

  const transSum = s.transactions.reduce((sum, t) => sum + t.amount, 0);
  const refundSum = s.refundRequests.reduce((sum, r) => sum + r.amount, 0);
  const expected = transSum - refundSum;

  if (s.transactions.length > 0 && expected > 0) {
    const diffPercent = calculateDiffPercent(s.amount, expected);
    if (diffPercent > 5) {
      issues.push({
        severity: 'error',
        field: 'amount',
        message: `金额差异过大：清分金额与"流水-退款"差额 ${diffPercent.toFixed(1)}%`,
        suggestion: '请务必核对后人工改判，禁止直接确认',
      });
    } else if (diffPercent > 0.5) {
      issues.push({
        severity: 'warning',
        field: 'amount',
        message: `金额有细微差异（${diffPercent.toFixed(1)}%）`,
        suggestion: '可能是手续费或抹零，确认业务含义后可人工改判',
      });
    }
  }

  s.transactions.forEach((t, idx) => {
    if (!parseDate(t.transTime)) {
      issues.push({
        severity: 'error',
        field: `transactions[${idx}].transTime`,
        message: `第${idx + 1}条收款流水的交易时间格式错误：${t.transTime}`,
        suggestion: '请使用正确的日期格式，如 2026-05-23 14:30:00',
      });
    }
  });

  if (s.transactions.length === 0) {
    issues.push({
      severity: 'warning',
      field: 'transactions',
      message: '缺少收款流水',
      suggestion: '请联系运营岗补充该批次对应的银行收款凭证',
    });
  }

  if (s.approvalEmails.length === 0) {
    issues.push({
      severity: 'warning',
      field: 'approvalEmails',
      message: '缺少审批邮件',
      suggestion: '该清分批次缺少部门经理审批邮件，请让商户补充审批材料',
    });
  }

  return issues;
}

export function detectDuplicates(
  newSettlements: Settlement[],
  existingSettlements: Settlement[]
): string[] {
  const existingIds = new Set(existingSettlements.map(s => s.id));
  return newSettlements.filter(s => existingIds.has(s.id)).map(s => s.id);
}

export function hasCriticalIssues(issues: ValidationIssue[]): boolean {
  return issues.some(i => i.severity === 'error');
}
