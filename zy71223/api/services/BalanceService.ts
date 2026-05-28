import { VoucherRepository } from '../repositories/VoucherRepository';
import { SubjectRepository } from '../repositories/SubjectRepository';
import { BalanceRepository } from '../repositories/BalanceRepository';
import type { BalanceWarning, Direction, BalanceRecord } from '../../shared/types';

export class BalanceService {
  static calculateBalances(period: string): BalanceRecord[] {
    const subjects = SubjectRepository.findAll();
    const vouchers = VoucherRepository.findAll();

    const periodVouchers = vouchers.filter(v => {
      const voucherMonth = v.date.substring(0, 7);
      return voucherMonth === period || v.date < `${period}-32`;
    });

    const balances: Map<string, { debit: number; credit: number }> = new Map();

    for (const sub of subjects) {
      balances.set(sub.id, { debit: 0, credit: 0 });
    }

    for (const voucher of periodVouchers) {
      for (const mapping of voucher.mappings) {
        const bal = balances.get(mapping.subjectId);
        if (bal) {
          if (mapping.direction === 'debit') {
            bal.debit += mapping.amount;
          } else {
            bal.credit += mapping.amount;
          }
        }
      }
    }

    const results: BalanceRecord[] = [];

    for (const subject of subjects) {
      const bal = balances.get(subject.id) || { debit: 0, credit: 0 };
      const net = bal.debit - bal.credit;
      const direction: Direction = net >= 0 ? 'debit' : 'credit';
      const closingBalance = Math.abs(net);
      const isOverdrawn = this.checkOverdrawn(subject, closingBalance, direction);

      let warningReason: string | null = null;
      if (isOverdrawn) {
        warningReason = this.analyzeOverdrawnReason(subject, bal.debit, bal.credit);
      }

      results.push(BalanceRepository.upsert({
        subjectId: subject.id,
        period,
        openingBalance: 0,
        currentDebit: bal.debit,
        currentCredit: bal.credit,
        closingBalance,
        direction,
        isOverdrawn,
        warningReason,
      }));
    }

    return results;
  }

  static checkOverdrawn(subject: { code: string; category: string; direction: Direction }, closingBalance: number, actualDirection: Direction): boolean {
    if (closingBalance === 0) return false;

    if (subject.code === '1001' || subject.code === '1002') {
      return actualDirection === 'credit';
    }

    if (subject.category === 'asset' && subject.direction === 'debit') {
      return actualDirection === 'credit' && closingBalance > 0;
    }

    if (subject.category === 'liability' && subject.direction === 'credit') {
      return actualDirection === 'debit' && closingBalance > 0;
    }

    if (subject.category === 'revenue') {
      return actualDirection === 'debit' && closingBalance > 0;
    }

    if (subject.category === 'expense') {
      return actualDirection === 'credit' && closingBalance > 0;
    }

    return false;
  }

  static analyzeOverdrawnReason(subject: { code: string; name: string }, debit: number, credit: number): string {
    const diff = Math.abs(debit - credit);

    if (subject.code === '1001') {
      if (credit > debit) {
        return `库存现金出现贷方余额¥${diff.toFixed(2)}，可能原因：1) 支出凭证录入顺序错误；2) 存在未入账的现金收入；3) 金额录入错误。建议检查凭证时间顺序和收入凭证完整性。`;
      }
    }

    if (subject.code === '1002') {
      if (credit > debit) {
        return `银行存款出现贷方余额¥${diff.toFixed(2)}，可能原因：1) 存在未达账项；2) 支付凭证先到而收款凭证未录入；3) 金额录入错误。建议与银行对账单核对。`;
      }
    }

    if (credit > debit) {
      return `${subject.name}出现贷方余额¥${diff.toFixed(2)}，可能存在科目错挂或漏记收入凭证。建议检查相关凭证的科目映射和完整性。`;
    } else {
      return `${subject.name}出现借方余额¥${diff.toFixed(2)}，可能存在科目错挂或漏记成本费用凭证。建议检查相关凭证的科目映射和完整性。`;
    }
  }

  static verifyBalances(period: string): BalanceWarning[] {
    const balances = BalanceRepository.findAll(period);
    const warnings: BalanceWarning[] = [];

    for (const bal of balances) {
      if (bal.isOverdrawn) {
        warnings.push({
          subjectId: bal.subjectId,
          subjectCode: bal.subjectCode || '',
          subjectName: bal.subjectName || '',
          type: 'overdrawn',
          message: `${bal.subjectName}余额异常，${bal.direction === 'debit' ? '借方' : '贷方'}余额¥${bal.closingBalance.toFixed(2)}`,
          suggestion: bal.warningReason || '请人工复核该科目下的所有凭证',
        });
      }

      if (bal.closingBalance > 100000 && bal.subjectCode?.startsWith('6')) {
        warnings.push({
          subjectId: bal.subjectId,
          subjectCode: bal.subjectCode,
          subjectName: bal.subjectName || '',
          type: 'unusual',
          message: `${bal.subjectName}本期发生额较大，达¥${bal.closingBalance.toFixed(2)}`,
          suggestion: '建议与往期数据对比，确认是否存在异常波动',
        });
      }
    }

    const totalDebit = balances.reduce((sum, b) => sum + b.currentDebit, 0);
    const totalCredit = balances.reduce((sum, b) => sum + b.currentCredit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      warnings.push({
        subjectId: 'total',
        subjectCode: 'TOTAL',
        subjectName: '借贷平衡检查',
        type: 'mismatch',
        message: `借贷不平衡，借方合计¥${totalDebit.toFixed(2)}，贷方合计¥${totalCredit.toFixed(2)}，差额¥${Math.abs(totalDebit - totalCredit).toFixed(2)}`,
        suggestion: '请检查所有凭证的科目映射，确保借贷相等',
      });
    }

    return warnings;
  }
}
