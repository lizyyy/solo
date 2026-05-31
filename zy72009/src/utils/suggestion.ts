import type { Settlement } from '../types';
import { calculateDiffPercent } from './amount';

export function generateSuggestion(s: Settlement): string {
  if (s.transactions.length === 0) {
    return '💡 缺少收款流水：请联系运营岗补充该批次对应的银行收款凭证，核对无误后再确认。';
  }

  if (s.approvalEmails.length === 0) {
    return '💡 缺少审批邮件：该清分批次缺少部门经理审批邮件，请让商户补充审批材料。';
  }

  const transSum = s.transactions.reduce((sum, t) => sum + t.amount, 0);
  const refundSum = s.refundRequests.reduce((sum, r) => sum + r.amount, 0);
  const expected = transSum - refundSum;

  if (expected > 0) {
    const diffPercent = calculateDiffPercent(s.amount, expected);

    if (diffPercent > 5) {
      return `⚠️ 金额差异过大：清分金额与"流水-退款"差额 ${diffPercent.toFixed(1)}%，请务必核对后人工改判，禁止直接确认。`;
    }

    if (diffPercent > 0.5) {
      return `⚠️ 金额有细微差异（${diffPercent.toFixed(1)}%）：可能是手续费或抹零，确认业务含义后可人工改判。`;
    }
  }

  if (s.source === 'historical_reconciliation') {
    return 'ℹ️ 历史对账补录：此条数据来自月底对账表，采用旧口径计算，请确认口径一致性。';
  }

  if (s.status === 'need_material') {
    return '⏳ 待补材料：此记录已退回补材料，请关注补充进度，材料齐全后再审核。';
  }

  if (s.status === 'conflict') {
    return '🔴 存在冲突：此批次号重复导入，请人工确认哪份数据有效后再处理。';
  }

  if (s.status === 'manual_adjust') {
    return '✍️ 已人工改判：此记录已完成人工调整，如有疑问可查看操作日志中的改判原因。';
  }

  return '✅ 三单核对一致：收款流水、退款申请、审批邮件齐全且金额匹配，可直接确认通过。';
}

export function getOperatorName(): string {
  const stored = localStorage.getItem('operator_name');
  return stored || '林姐（风控复核员）';
}
