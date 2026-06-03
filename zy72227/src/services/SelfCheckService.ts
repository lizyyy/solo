import { dataStore } from '../store/DataStore';
import { PensionFundSwapRecord, SelfCheckIssue, SelfCheckResult, SelfCheckType, BusinessRecordLine } from '../types';

export interface RecalculationResult {
  originalAmount: number;
  recalculatedAmount: number;
  difference: number;
  feeRate: number;
  reason: string;
}

export class SelfCheckService {
  checkDuplicateImport(recordId: string): SelfCheckIssue | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const sameBusinessNoRecords = dataStore.getRecordsByBusinessNo(record.businessNo);
    const otherRecords = sameBusinessNoRecords.filter(r => r.id !== recordId);

    if (otherRecords.length === 0) {
      return {
        id: '',
        checkType: 'DUPLICATE_IMPORT',
        result: 'PASSED',
        description: `未检测到重复导入，业务号 ${record.businessNo} 当前记录唯一`,
        relatedRecordIds: [recordId],
        relatedLineIds: [],
        detectedAt: ''
      };
    }

    const duplicateDetails = otherRecords.map(r =>
      `记录ID: ${r.id}, 导入时间: ${r.managerEmailImportedAt}, 邮件来源: ${r.managerEmailSource}`
    ).join('; ');

    return {
      id: '',
      checkType: 'DUPLICATE_IMPORT',
      result: 'WARNING',
      description: `检测到重复导入风险：业务号 ${record.businessNo} 已有 ${otherRecords.length} 条其他记录。${duplicateDetails}`,
      relatedRecordIds: [recordId, ...otherRecords.map(r => r.id)],
      relatedLineIds: [],
      detectedAt: ''
    };
  }

  checkSplitLines(recordId: string): SelfCheckIssue | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const principalLines = record.lines.filter(l => l.lineType === 'PRINCIPAL');
    const feeLines = record.lines.filter(l => l.lineType === 'FEE');
    const combinedLines = record.lines.filter(l => l.lineType === 'COMBINED');

    const hasSplit = principalLines.length > 0 && feeLines.length > 0;

    if (!hasSplit && combinedLines.length === 0) {
      return {
        id: '',
        checkType: 'SPLIT_LINES_DETECTED',
        result: 'PASSED',
        description: '该记录为单行业务，无需拆分处理',
        relatedRecordIds: [recordId],
        relatedLineIds: record.lines.map(l => l.id),
        detectedAt: ''
      };
    }

    if (hasSplit) {
      const lineDetails: string[] = [];

      principalLines.forEach((p, idx) => {
        const matchingFee = feeLines[idx];
        if (matchingFee) {
          const total = p.amount + matchingFee.amount;
          lineDetails.push(
            `拆分对 ${idx + 1}: 本金=${p.amount}元, 手续费=${matchingFee.amount}元, 合计=${total}元, 基金=${p.fundCode}`
          );
        }
      });

      return {
        id: '',
        checkType: 'SPLIT_LINES_DETECTED',
        result: 'WARNING',
        description: `检测到同一业务号拆分为手续费和本金两行，共 ${Math.min(principalLines.length, feeLines.length)} 对拆分记录。${lineDetails.join('; ')}。此记录需结算主管复核，暂不归为正常。`,
        relatedRecordIds: [recordId],
        relatedLineIds: record.lines.map(l => l.id),
        detectedAt: ''
      };
    }

    return {
      id: '',
      checkType: 'SPLIT_LINES_DETECTED',
      result: 'PASSED',
      description: '该记录为合并类型，金额已包含手续费和本金',
      relatedRecordIds: [recordId],
      relatedLineIds: record.lines.map(l => l.id),
      detectedAt: ''
    };
  }

  recalculateLine(
    principalLine: BusinessRecordLine | undefined,
    feeLine: BusinessRecordLine | undefined,
    holdingDays: number
  ): RecalculationResult {
    const { rate, reason } = this.getFeeRate(holdingDays);

    const principalAmount = principalLine?.amount || 0;
    const feeAmount = feeLine?.amount || 0;
    const expectedFee = principalAmount * rate;
    const difference = Math.abs(feeAmount - expectedFee);

    return {
      originalAmount: feeAmount,
      recalculatedAmount: expectedFee,
      difference,
      feeRate: rate,
      reason
    };
  }

  private getFeeRate(holdingDays: number): { rate: number; reason: string } {
    if (holdingDays < 30) return { rate: 0.015, reason: '持有不满30天，惩罚性费率1.5%' };
    if (holdingDays < 90) return { rate: 0.0075, reason: '持有30-90天，普通赎回费率0.75%' };
    if (holdingDays < 365) return { rate: 0.005, reason: '持有90-365天，优惠费率0.5%' };
    return { rate: 0, reason: '持有满1年，免赎回费' };
  }

  checkRecalculationAfterSupplement(recordId: string): SelfCheckIssue | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    if (!record.settlementBatchNo) {
      return {
        id: '',
        checkType: 'RECALCULATION_AFTER_SUPPLEMENT',
        result: 'WARNING',
        description: '尚未补录清算批次号，补录后将自动触发重算',
        relatedRecordIds: [recordId],
        relatedLineIds: [],
        detectedAt: ''
      };
    }

    const recalculationResults: string[] = [];
    let hasSignificantDiff = false;

    const principalLines = record.lines.filter(l => l.lineType === 'PRINCIPAL');
    const feeLines = record.lines.filter(l => l.lineType === 'FEE');
    const combinedLines = record.lines.filter(l => l.lineType === 'COMBINED');

    if (combinedLines.length > 0) {
      combinedLines.forEach(line => {
        const result = this.recalculateLine(line, undefined, 400);
        if (result.difference > 0.01) {
          hasSignificantDiff = true;
          recalculationResults.push(
            `合并行 ${line.id}: 原手续费=${result.originalAmount}, 期望手续费=${result.recalculatedAmount.toFixed(2)}, 差异=${result.difference.toFixed(2)}, 费率=${result.feeRate * 100}%, 理由=${result.reason}`
          );
        }
      });
    } else if (principalLines.length > 0 && feeLines.length > 0) {
      const maxLen = Math.max(principalLines.length, feeLines.length);
      for (let i = 0; i < maxLen; i++) {
        const principalLine = principalLines[i];
        const feeLine = feeLines[i];
        const result = this.recalculateLine(principalLine, feeLine, 400);

        if (result.difference > 0.01) {
          hasSignificantDiff = true;
          recalculationResults.push(
            `拆分行对 ${i + 1}: 本金=${principalLine?.amount || 0}, 原手续费=${result.originalAmount}, 期望手续费=${result.recalculatedAmount.toFixed(2)}, 差异=${result.difference.toFixed(2)}, 费率=${result.feeRate * 100}%, 理由=${result.reason}`
          );
        }
      }
    }

    if (hasSignificantDiff) {
      return {
        id: '',
        checkType: 'RECALCULATION_AFTER_SUPPLEMENT',
        result: 'FAILED',
        description: `补录清算批次号后重算发现差异：${recalculationResults.join('; ')}`,
        relatedRecordIds: [recordId],
        relatedLineIds: record.lines.map(l => l.id),
        detectedAt: ''
      };
    }

    return {
      id: '',
      checkType: 'RECALCULATION_AFTER_SUPPLEMENT',
      result: 'PASSED',
      description: '补录后重算验证通过，金额一致',
      relatedRecordIds: [recordId],
      relatedLineIds: record.lines.map(l => l.id),
      detectedAt: ''
    };
  }

  checkExportConsistency(recordId: string): SelfCheckIssue | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const unifiedView = dataStore.getUnifiedView(recordId);
    if (!unifiedView) return null;

    const apiTotal = unifiedView.totalPrincipal + unifiedView.totalFee;
    const lineSum = record.lines.reduce((sum, l) => sum + l.amount, 0);

    const pageDisplaySum = unifiedView.totalAmount;

    if (Math.abs(apiTotal - lineSum) > 0.01 || Math.abs(pageDisplaySum - lineSum) > 0.01) {
      return {
        id: '',
        checkType: 'EXPORT_CONSISTENCY',
        result: 'FAILED',
        description: `导出一致性校验失败：接口合计=${apiTotal}, 明细合计=${lineSum}, 页面显示=${pageDisplaySum}`,
        relatedRecordIds: [recordId],
        relatedLineIds: record.lines.map(l => l.id),
        detectedAt: ''
      };
    }

    const splitLinesOk = this.verifySplitLineConsistency(record);
    if (!splitLinesOk.passed) {
      return {
        id: '',
        checkType: 'EXPORT_CONSISTENCY',
        result: 'WARNING',
        description: `拆分记录一致性警告：${splitLinesOk.message}`,
        relatedRecordIds: [recordId],
        relatedLineIds: record.lines.map(l => l.id),
        detectedAt: ''
      };
    }

    return {
      id: '',
      checkType: 'EXPORT_CONSISTENCY',
      result: 'PASSED',
      description: `导出一致性校验通过：接口、页面、明细三方数据一致，合计${lineSum}元。${splitLinesOk.message}`,
      relatedRecordIds: [recordId],
      relatedLineIds: record.lines.map(l => l.id),
      detectedAt: ''
    };
  }

  private verifySplitLineConsistency(record: PensionFundSwapRecord): { passed: boolean; message: string } {
    const principalLines = record.lines.filter(l => l.lineType === 'PRINCIPAL');
    const feeLines = record.lines.filter(l => l.lineType === 'FEE');

    if (principalLines.length === 0 || feeLines.length === 0) {
      return { passed: true, message: '无拆分行，无需额外校验' };
    }

    if (principalLines.length !== feeLines.length) {
      return {
        passed: false,
        message: `拆分行数量不匹配：本金${principalLines.length}行，手续费${feeLines.length}行`
      };
    }

    for (let i = 0; i < principalLines.length; i++) {
      const p = principalLines[i];
      const f = feeLines[i];
      if (p.tradeDate !== f.tradeDate) {
        return {
          passed: false,
          message: `第${i + 1}对拆分行交易日期不一致：本金${p.tradeDate}，手续费${f.tradeDate}`
        };
      }
      if (p.fundCode !== f.fundCode) {
        return {
          passed: false,
          message: `第${i + 1}对拆分行基金代码不一致：本金${p.fundCode}，手续费${f.fundCode}`
        };
      }
    }

    return { passed: true, message: `${principalLines.length}对拆分行一致性校验通过` };
  }

  runAllChecks(recordId: string): SelfCheckIssue[] {
    let record = dataStore.getRecord(recordId);
    if (!record) return [];

    const checkTypes: SelfCheckType[] = ['DUPLICATE_IMPORT', 'SPLIT_LINES_DETECTED', 'RECALCULATION_AFTER_SUPPLEMENT', 'EXPORT_CONSISTENCY'];

    const resultIssues: SelfCheckIssue[] = [];

    for (const checkType of checkTypes) {
      let issue: SelfCheckIssue | null = null;

      switch (checkType) {
        case 'DUPLICATE_IMPORT':
          issue = this.checkDuplicateImport(recordId);
          break;
        case 'SPLIT_LINES_DETECTED':
          issue = this.checkSplitLines(recordId);
          break;
        case 'RECALCULATION_AFTER_SUPPLEMENT':
          issue = this.checkRecalculationAfterSupplement(recordId);
          break;
        case 'EXPORT_CONSISTENCY':
          issue = this.checkExportConsistency(recordId);
          break;
      }

      if (issue) {
        record = dataStore.getRecord(recordId)!;
        const existingIndex = record.selfCheckIssues.findIndex(i => i.checkType === checkType);
        if (existingIndex >= 0) {
          const updatedIssue = { ...issue, id: record.selfCheckIssues[existingIndex].id };
          const updatedIssues = [...record.selfCheckIssues];
          updatedIssues[existingIndex] = updatedIssue;
          dataStore.updateRecord(recordId, { selfCheckIssues: updatedIssues });
          resultIssues.push(updatedIssue);
        } else {
          const savedIssue = dataStore.addSelfCheckIssue(recordId, issue);
          resultIssues.push(savedIssue);
        }
      }
    }

    const currentRecord = dataStore.getRecord(recordId)!;
    const hasSplitLines = resultIssues.some(i =>
      i.checkType === 'SPLIT_LINES_DETECTED' && i.result === 'WARNING'
    );
    const hasConflicts = currentRecord.conflicts.some(c => !c.resolvedAt);

    if (hasSplitLines && !hasConflicts && currentRecord.status === 'EMAIL_IMPORTED') {
      dataStore.updateRecord(recordId, { status: 'SPLIT_LINES_PENDING' });
    }

    return resultIssues;
  }

  getFailedChecks(recordId: string): SelfCheckIssue[] {
    const record = dataStore.getRecord(recordId);
    if (!record) return [];
    return record.selfCheckIssues.filter(i => i.result === 'FAILED');
  }
}

export const selfCheckService = new SelfCheckService();
