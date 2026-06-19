import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import {
  CounterTransaction,
  EmailSupplement,
  MarginCalculation,
  DiffRecord,
  HistoryVersion,
  ImportBatch,
  SplitInfo,
  RecordStatus,
  WorkflowStep,
  TransactionType,
} from '../types';
import { detectSplit, validateImport, generateDiffRecords, normalizeImportRow, mapColumnHeaders, formatCurrency } from '../services/businessLogic';

interface CalculationState {
  transactions: CounterTransaction[];
  emailSupplements: EmailSupplement[];
  calculations: MarginCalculation[];
  diffRecords: DiffRecord[];
  historyVersions: HistoryVersion[];
  importBatches: ImportBatch[];
  splitInfos: SplitInfo[];
  currentUser: string;
  importTransactions: (rawRows: Record<string, string>[], fileName: string) => Promise<{
    success: number;
    skipped: number;
    errors: string[];
  }>;
  importEmailSupplement: (emailData: any) => Promise<void>;
  updateRemark: (transactionId: string, newRemark: string) => Promise<void>;
  performCalculation: (businessNumber: string, scenario: string) => Promise<void>;
  rollbackCalculation: (calculationId: string) => Promise<void>;
  confirmSplit: (businessNumber: string, confirmed: boolean) => Promise<void>;
  resolveDiff: (diffId: string, resolution: string) => Promise<void>;
  getTransactionHistory: (transactionId: string) => HistoryVersion[];
  getCalculationByBusinessNumber: (businessNumber: string) => MarginCalculation | undefined;
  getSplitInfo: (businessNumber: string) => SplitInfo | undefined;
  generateReport: () => string;
  exportReportCSV: () => void;
}

export const useCalculationStore = create<CalculationState>()(
  persist(
    (set, get) => ({
  transactions: [],
  emailSupplements: [],
  calculations: [],
  diffRecords: [],
  historyVersions: [],
  importBatches: [],
  splitInfos: [],
  currentUser: '支付平台产品阿南',

  importTransactions: async (rawRows, fileName) => {
    const errors: string[] = [];
    let successCount = 0;
    let skippedCount = 0;

    const batchId = uuidv4();
    const importedAt = dayjs().toISOString();
    const { currentUser } = get();

    const rawHeaders = Object.keys(rawRows[0] || {});
    const { mapped: headerMapping, unmapped } = mapColumnHeaders(rawHeaders);

    if (unmapped.length > 0) {
      errors.push(`以下列名未能识别：${unmapped.join('、')}，对应数据将被忽略`);
    }

    const existingTailNumbers = new Set(
      get().transactions.map(t => t.tailNumber)
    );

    const newTransactions: CounterTransaction[] = [];
    const newHistoryVersions: HistoryVersion[] = [];
    const businessNumberGroups: Record<string, CounterTransaction[]> = {};

    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2;
      const { normalized, rawSource, missingFields } = normalizeImportRow(
        rawRows[i],
        headerMapping,
        rowNumber
      );

      if (missingFields.length > 0) {
        errors.push(`第 ${rowNumber} 行缺少必填字段：${missingFields.join('、')}`);
        continue;
      }

      const validation = validateImport(normalized);
      if (!validation.valid) {
        errors.push(`第 ${rowNumber} 行：${validation.error}`);
        continue;
      }

      if (existingTailNumbers.has(normalized.tailNumber)) {
        skippedCount++;
        continue;
      }

      const transactionType: TransactionType = 
        normalized.amountType === 'FEE' ? 'FEE' :
        normalized.amountType === 'PRINCIPAL' ? 'PRINCIPAL' : 'COMBINED';

      const transaction: CounterTransaction = {
        id: uuidv4(),
        tailNumber: normalized.tailNumber,
        businessNumber: normalized.businessNumber,
        transactionDate: normalized.transactionDate,
        amount: parseFloat(String(normalized.amount).replace(/,/g, '')),
        transactionType,
        counterparty: normalized.counterparty || '',
        remark: normalized.remark || '',
        importBatchId: batchId,
        importedAt,
        importedBy: currentUser,
        sourceRowNumber: rowNumber,
        rawSource,
      };

      newTransactions.push(transaction);
      existingTailNumbers.add(normalized.tailNumber);
      successCount++;

      if (!businessNumberGroups[transaction.businessNumber]) {
        businessNumberGroups[transaction.businessNumber] = [];
      }
      businessNumberGroups[transaction.businessNumber].push(transaction);

      newHistoryVersions.push({
        id: uuidv4(),
        entityType: 'TRANSACTION',
        entityId: transaction.id,
        version: 1,
        action: 'CREATE',
        changedFields: {
          all: { old: null, new: transaction },
        },
        operatedBy: currentUser,
        operatedAt: importedAt,
        remark: `柜台流水导入（来源行 ${rowNumber}）`,
      });
    }

    const newSplitInfos: SplitInfo[] = [];
    const newCalculations: MarginCalculation[] = [];

    for (const [businessNumber, trans] of Object.entries(businessNumberGroups)) {
      const splitInfo = detectSplit(trans);
      if (splitInfo) {
        newSplitInfos.push(splitInfo);
      }

      const existingCalc = get().calculations.find(
        c => c.businessNumber === businessNumber
      );

      if (!existingCalc) {
        const hasSplit = !!splitInfo;
        const calc: MarginCalculation = {
          id: uuidv4(),
          businessNumber,
          calculationDate: dayjs().toISOString(),
          scenario: '默认场景',
          baseMargin: trans.reduce((sum, t) => sum + t.amount, 0) * 0.15,
          stressMargin: trans.reduce((sum, t) => sum + t.amount, 0) * 0.25,
          marginRatio: 0.15,
          status: hasSplit ? 'SPLIT_PENDING' : 'PENDING_REVIEW',
          workflowStep: 'STEP1_IMPORTED',
          hasSplit,
          isPendingReview: hasSplit,
          createdAt: importedAt,
          updatedAt: importedAt,
        };
        newCalculations.push(calc);

        newHistoryVersions.push({
          id: uuidv4(),
          entityType: 'CALCULATION',
          entityId: calc.id,
          version: 1,
          action: 'CREATE',
          changedFields: {
            all: { old: null, new: calc },
          },
          operatedBy: currentUser,
          operatedAt: importedAt,
          remark: `创建初始试算记录（${hasSplit ? '待拆分复核' : '待复核'}）`,
        });
      }
    }

    const importBatch: ImportBatch = {
      id: batchId,
      source: 'COUNTER',
      fileName,
      recordCount: rawRows.length,
      importedAt,
      importedBy: currentUser,
      status: errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
    };

    set(state => ({
      transactions: [...state.transactions, ...newTransactions],
      historyVersions: [...state.historyVersions, ...newHistoryVersions],
      importBatches: [...state.importBatches, importBatch],
      splitInfos: [...state.splitInfos, ...newSplitInfos],
      calculations: [...state.calculations, ...newCalculations],
    }));

    return {
      success: successCount,
      skipped: skippedCount,
      errors,
    };
  },

  importEmailSupplement: async (emailData) => {
    const { currentUser } = get();
    const importedAt = dayjs().toISOString();

    const supplement: EmailSupplement = {
      id: uuidv4(),
      businessNumber: emailData.businessNumber,
      emailId: emailData.emailId || uuidv4(),
      subject: emailData.subject,
      sender: emailData.sender,
      sentAt: emailData.sentAt,
      supplementContent: emailData.content,
      attachedFiles: emailData.attachments || [],
      importedAt,
      importedBy: currentUser,
    };

    const diffs = generateDiffRecords(
      get().transactions.filter(t => t.businessNumber === emailData.businessNumber),
      supplement
    );

    const newDiffs = diffs.map(d => ({
      ...d,
      id: uuidv4(),
      createdAt: importedAt,
    }));

    set(state => {
      const updatedCalculations = state.calculations.map(c => {
        if (c.businessNumber === emailData.businessNumber) {
          return {
            ...c,
            workflowStep: 'STEP2_EMAIL_SUPPLEMENTED' as WorkflowStep,
            updatedAt: importedAt,
          };
        }
        return c;
      });

      return {
        emailSupplements: [...state.emailSupplements, supplement],
        diffRecords: [...state.diffRecords, ...newDiffs],
        calculations: updatedCalculations,
        historyVersions: [
          ...state.historyVersions,
          {
            id: uuidv4(),
            entityType: 'EMAIL',
            entityId: supplement.id,
            version: 1,
            action: 'CREATE',
            changedFields: { all: { old: null, new: supplement } },
            operatedBy: currentUser,
            operatedAt: importedAt,
            remark: '客户经理补充邮件导入',
          },
        ],
      };
    });
  },

  updateRemark: async (transactionId, newRemark) => {
    const { currentUser, transactions } = get();
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    const oldRemark = transaction.remark;
    const updatedAt = dayjs().toISOString();

    set(state => {
      const version = state.historyVersions.filter(
        h => h.entityId === transactionId
      ).length + 1;

      return {
        transactions: state.transactions.map(t =>
          t.id === transactionId ? { ...t, remark: newRemark } : t
        ),
        historyVersions: [
          ...state.historyVersions,
          {
            id: uuidv4(),
            entityType: 'TRANSACTION',
            entityId: transactionId,
            version,
            action: 'UPDATE',
            changedFields: {
              remark: { old: oldRemark, new: newRemark },
            },
            operatedBy: currentUser,
            operatedAt: updatedAt,
            remark: '修改备注',
          },
        ],
      };
    });
  },

  performCalculation: async (businessNumber, scenario) => {
    const { currentUser, transactions, calculations, historyVersions } = get();
    const businessTransactions = transactions.filter(
      t => t.businessNumber === businessNumber
    );
    const totalAmount = businessTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    const scenarioMultipliers: Record<string, { base: number; stress: number }> = {
      '轻度压力': { base: 0.15, stress: 0.20 },
      '中度压力': { base: 0.15, stress: 0.30 },
      '重度压力': { base: 0.15, stress: 0.45 },
    };
    const multiplier = scenarioMultipliers[scenario] || scenarioMultipliers['中度压力'];

    const updatedAt = dayjs().toISOString();
    const existingCalc = calculations.find(c => c.businessNumber === businessNumber);
    const oldCalc = existingCalc ? { ...existingCalc } : null;

    const newCalc: MarginCalculation = {
      id: existingCalc?.id || uuidv4(),
      businessNumber,
      calculationDate: updatedAt,
      scenario,
      baseMargin: totalAmount * multiplier.base,
      stressMargin: totalAmount * multiplier.stress,
      marginRatio: multiplier.stress,
      status: existingCalc?.status || 'PENDING_REVIEW',
      workflowStep: existingCalc?.workflowStep || 'STEP1_IMPORTED',
      hasSplit: existingCalc?.hasSplit || false,
      isPendingReview: existingCalc?.isPendingReview || false,
      reviewedBy: existingCalc?.reviewedBy,
      reviewedAt: existingCalc?.reviewedAt,
      createdAt: existingCalc?.createdAt || updatedAt,
      updatedAt,
    };

    const currentVersions = historyVersions.filter(
      h => h.entityId === newCalc.id && h.entityType === 'CALCULATION'
    );

    set(state => ({
      calculations: existingCalc
        ? state.calculations.map(c => c.id === existingCalc.id ? newCalc : c)
        : [...state.calculations, newCalc],
      historyVersions: [
        ...state.historyVersions,
        {
          id: uuidv4(),
          entityType: 'CALCULATION',
          entityId: newCalc.id,
          version: currentVersions.length + 1,
          action: 'UPDATE',
          changedFields: {
            snapshot: { old: oldCalc, new: newCalc },
            scenario: { old: existingCalc?.scenario, new: scenario },
            baseMargin: { old: existingCalc?.baseMargin, new: newCalc.baseMargin },
            stressMargin: { old: existingCalc?.stressMargin, new: newCalc.stressMargin },
          },
          operatedBy: currentUser,
          operatedAt: updatedAt,
          remark: `执行${scenario}试算`,
        },
      ],
    }));
  },

  rollbackCalculation: async (calculationId) => {
    const { currentUser, calculations, historyVersions } = get();
    const calc = calculations.find(c => c.id === calculationId);
    if (!calc) return;

    const versions = historyVersions
      .filter(h => h.entityId === calculationId && h.entityType === 'CALCULATION')
      .sort((a, b) => b.version - a.version);

    if (versions.length < 2) {
      throw new Error('无可回滚的历史版本');
    }

    const currentVersion = versions[0];
    const targetVersion = versions[1];
    const rolledBackAt = dayjs().toISOString();

    let restoredState: Partial<MarginCalculation> = {};

    if (targetVersion.changedFields.snapshot?.old) {
      restoredState = { ...targetVersion.changedFields.snapshot.old };
    } else if (targetVersion.action === 'CREATE' && targetVersion.changedFields.all?.new) {
      restoredState = { ...targetVersion.changedFields.all.new };
    } else {
      restoredState = {
        scenario: targetVersion.changedFields.scenario?.old || calc.scenario,
        baseMargin: targetVersion.changedFields.baseMargin?.old ?? calc.baseMargin,
        stressMargin: targetVersion.changedFields.stressMargin?.old ?? calc.stressMargin,
        marginRatio: targetVersion.changedFields.marginRatio?.old ?? calc.marginRatio,
        status: targetVersion.changedFields.status?.old || calc.status,
        workflowStep: targetVersion.changedFields.workflowStep?.old || calc.workflowStep,
        hasSplit: targetVersion.changedFields.hasSplit?.old ?? calc.hasSplit,
        isPendingReview: targetVersion.changedFields.isPendingReview?.old ?? calc.isPendingReview,
      };
    }

    delete restoredState.updatedAt;
    delete restoredState.createdAt;

    const rolledBackCalc: MarginCalculation = {
      ...calc,
      ...restoredState,
      status: 'ROLLBACKED' as RecordStatus,
      updatedAt: rolledBackAt,
    };

    const diffFields: Record<string, { old: any; new: any }> = {};
    for (const key of Object.keys(calc) as Array<keyof MarginCalculation>) {
      if (key === 'updatedAt') continue;
      const oldVal = calc[key];
      const newVal = rolledBackCalc[key];
      if (oldVal !== newVal) {
        diffFields[key] = { old: oldVal, new: newVal };
      }
    }
    diffFields.snapshot = { old: calc, new: rolledBackCalc };

    set(state => ({
      calculations: state.calculations.map(c =>
        c.id === calculationId ? rolledBackCalc : c
      ),
      historyVersions: [
        ...state.historyVersions,
        {
          id: uuidv4(),
          entityType: 'CALCULATION',
          entityId: calculationId,
          version: versions.length + 1,
          action: 'ROLLBACK',
          changedFields: {
            ...diffFields,
            _targetVersion: { old: currentVersion.version, new: targetVersion.version },
          },
          operatedBy: currentUser,
          operatedAt: rolledBackAt,
          remark: `回滚到版本 ${targetVersion.version}（${targetVersion.remark}）`,
        },
      ],
    }));
  },

  confirmSplit: async (businessNumber, confirmed) => {
    const { currentUser, calculations, historyVersions } = get();
    const confirmedAt = dayjs().toISOString();
    const existingCalc = calculations.find(c => c.businessNumber === businessNumber);
    const oldCalc = existingCalc ? { ...existingCalc } : null;

    const currentVersions = existingCalc
      ? historyVersions.filter(
          h => h.entityId === existingCalc.id && h.entityType === 'CALCULATION'
        )
      : [];

    set(state => {
      const newCalculations = state.calculations.map(c =>
        c.businessNumber === businessNumber
          ? ({
              ...c,
              status: (confirmed ? 'NORMAL' : 'DISPUTED') as RecordStatus,
              isPendingReview: !confirmed,
              workflowStep: 'STEP3_DIFF_UPDATED' as WorkflowStep,
              reviewedBy: currentUser,
              reviewedAt: confirmedAt,
              updatedAt: confirmedAt,
            } as MarginCalculation)
          : c
      );

      const newCalc = newCalculations.find(c => c.businessNumber === businessNumber);

      return {
        splitInfos: state.splitInfos.map(s =>
          s.businessNumber === businessNumber
            ? {
                ...s,
                status: confirmed ? 'CONFIRMED' : 'REJECTED',
                confirmedBy: currentUser,
                confirmedAt,
              }
            : s
        ),
        calculations: newCalculations,
        historyVersions: [
          ...state.historyVersions,
          ...(existingCalc && newCalc
            ? [
                {
                  id: uuidv4(),
                  entityType: 'CALCULATION' as const,
                  entityId: existingCalc.id,
                  version: currentVersions.length + 1,
                  action: 'UPDATE' as const,
                  changedFields: {
                    snapshot: { old: oldCalc, new: newCalc },
                    status: { old: oldCalc?.status, new: newCalc.status },
                    workflowStep: { old: oldCalc?.workflowStep, new: newCalc.workflowStep },
                    isPendingReview: { old: oldCalc?.isPendingReview, new: newCalc.isPendingReview },
                    reviewedBy: { old: oldCalc?.reviewedBy, new: newCalc.reviewedBy },
                    reviewedAt: { old: oldCalc?.reviewedAt, new: newCalc.reviewedAt },
                  },
                  operatedBy: currentUser,
                  operatedAt: confirmedAt,
                  remark: confirmed ? '结算主管确认拆分正常' : '结算主管标记为有争议',
                },
              ]
            : []),
        ],
      };
    });
  },

  resolveDiff: async (diffId, resolution) => {
    const { currentUser } = get();
    const resolvedAt = dayjs().toISOString();

    set(state => ({
      diffRecords: state.diffRecords.map(d =>
        d.id === diffId
          ? {
              ...d,
              resolved: true,
              resolvedBy: currentUser,
              resolvedAt,
              resolution,
            }
          : d
      ),
    }));
  },

  getTransactionHistory: (transactionId) => {
    return get()
      .historyVersions.filter(h => h.entityId === transactionId)
      .sort((a, b) => b.version - a.version);
  },

  getCalculationByBusinessNumber: (businessNumber) => {
    return get().calculations.find(c => c.businessNumber === businessNumber);
  },

  getSplitInfo: (businessNumber) => {
    return get().splitInfos.find(s => s.businessNumber === businessNumber);
  },

  generateReport: () => {
    const state = get();
    const { transactions, calculations, diffRecords, emailSupplements, splitInfos, historyVersions } = state;

    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const splitCount = calculations.filter(c => c.hasSplit).length;
    const normalCount = calculations.filter(c => c.status === 'NORMAL').length;
    const disputedCount = calculations.filter(c => c.status === 'DISPUTED').length;
    const pendingReviewCount = calculations.filter(c => c.isPendingReview || c.status === 'SPLIT_PENDING').length;
    const rollbackedCount = calculations.filter(c => c.status === 'ROLLBACKED').length;
    const totalBaseMargin = calculations.reduce((sum, c) => sum + c.baseMargin, 0);
    const totalStressMargin = calculations.reduce((sum, c) => sum + c.stressMargin, 0);
    const unresolvedDiffs = diffRecords.filter(d => !d.resolved).length;
    const totalHistoryVersions = historyVersions.length;

    const reportLines = [
      '========================================',
      '        期权保证金压力试算报告',
      '========================================',
      '',
      `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
      `操作用户: ${state.currentUser}`,
      '',
      '----------------------------------------',
      '一、柜台流水统计',
      '----------------------------------------',
      `柜台流水记录总数: ${totalTransactions} 条`,
      `交易总金额: ${formatCurrency(totalAmount)}`,
      `涉及业务号数量: ${calculations.length} 个`,
      `拆分记录数量: ${splitCount} 个`,
      '',
      '----------------------------------------',
      '二、保证金试算统计',
      '----------------------------------------',
      `试算记录总数: ${calculations.length} 条`,
      `基础保证金总额: ${formatCurrency(totalBaseMargin)}`,
      `压力保证金总额: ${formatCurrency(totalStressMargin)}`,
      `正常: ${normalCount} 条`,
      `待复核: ${pendingReviewCount} 条`,
      `有争议: ${disputedCount} 条`,
      `已回滚: ${rollbackedCount} 条`,
      '',
      '----------------------------------------',
      '三、流程进度统计',
      '----------------------------------------',
      `STEP1 已导入: ${calculations.filter(c => c.workflowStep === 'STEP1_IMPORTED').length} 条`,
      `STEP2 已补录邮件: ${calculations.filter(c => c.workflowStep === 'STEP2_EMAIL_SUPPLEMENTED').length} 条`,
      `STEP3 差异已更新: ${calculations.filter(c => c.workflowStep === 'STEP3_DIFF_UPDATED').length} 条`,
      `补充邮件总数: ${emailSupplements.length} 条`,
      `差异记录总数: ${diffRecords.length} 条`,
      `未解决差异: ${unresolvedDiffs} 条`,
      '',
      '----------------------------------------',
      '四、历史版本统计',
      '----------------------------------------',
      `历史版本总数: ${totalHistoryVersions} 条`,
      `创建操作: ${historyVersions.filter(h => h.action === 'CREATE').length} 条`,
      `更新操作: ${historyVersions.filter(h => h.action === 'UPDATE').length} 条`,
      `回滚操作: ${historyVersions.filter(h => h.action === 'ROLLBACK').length} 条`,
      '',
      '----------------------------------------',
      '五、试算明细',
      '----------------------------------------',
      '',
    ];

    calculations.forEach((calc, idx) => {
      const businessTransactions = transactions.filter(t => t.businessNumber === calc.businessNumber);
      const splitInfo = splitInfos.find(s => s.businessNumber === calc.businessNumber);
      const statusLabel = calc.status === 'NORMAL' ? '正常' :
                         calc.status === 'DISPUTED' ? '有争议' :
                         calc.status === 'SPLIT_PENDING' ? '待拆分复核' :
                         calc.status === 'ROLLBACKED' ? '已回滚' : '待复核';
      const stepLabel = calc.workflowStep === 'STEP1_IMPORTED' ? '已导入' :
                       calc.workflowStep === 'STEP2_EMAIL_SUPPLEMENTED' ? '已补录邮件' : '差异已更新';

      reportLines.push(`${idx + 1}. 业务号: ${calc.businessNumber}`);
      reportLines.push(`   试算场景: ${calc.scenario}`);
      reportLines.push(`   状态: ${statusLabel} | 流程: ${stepLabel}`);
      reportLines.push(`   基础保证金: ${formatCurrency(calc.baseMargin)}`);
      reportLines.push(`   压力保证金: ${formatCurrency(calc.stressMargin)}`);
      reportLines.push(`   保证金比例: ${(calc.marginRatio * 100).toFixed(1)}%`);
      reportLines.push(`   关联流水: ${businessTransactions.length} 条`);
      if (splitInfo) {
        reportLines.push(`   拆分信息: 本金 ${formatCurrency(splitInfo.principalAmount)} + 手续费 ${formatCurrency(splitInfo.feeAmount)} = ${formatCurrency(splitInfo.totalAmount)}`);
      }
      reportLines.push('');
    });

    reportLines.push('========================================');
    reportLines.push('                报告结束');
    reportLines.push('========================================');

    return reportLines.join('\n');
  },

  exportReportCSV: () => {
    const state = get();
    const { calculations, transactions } = state;

    const headers = [
      '业务号',
      '试算场景',
      '计算时间',
      '基础保证金',
      '压力保证金',
      '保证金比例',
      '是否拆分',
      '状态',
      '流程进度',
      '关联流水条数',
      '创建时间',
      '更新时间',
    ];

    const rows = calculations.map(calc => {
      const businessTransactions = transactions.filter(t => t.businessNumber === calc.businessNumber);
      const statusLabel = calc.status === 'NORMAL' ? '正常' :
                         calc.status === 'DISPUTED' ? '有争议' :
                         calc.status === 'SPLIT_PENDING' ? '待拆分复核' :
                         calc.status === 'ROLLBACKED' ? '已回滚' : '待复核';
      const stepLabel = calc.workflowStep === 'STEP1_IMPORTED' ? '已导入' :
                       calc.workflowStep === 'STEP2_EMAIL_SUPPLEMENTED' ? '已补录邮件' : '差异已更新';

      return [
        calc.businessNumber,
        calc.scenario,
        dayjs(calc.calculationDate).format('YYYY-MM-DD HH:mm:ss'),
        calc.baseMargin.toFixed(2),
        calc.stressMargin.toFixed(2),
        `${(calc.marginRatio * 100).toFixed(1)}%`,
        calc.hasSplit ? '是' : '否',
        statusLabel,
        stepLabel,
        businessTransactions.length,
        dayjs(calc.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        dayjs(calc.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `期权保证金压力试算报告_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
}),
{
  name: 'option-margin-stress-test-storage',
  partialize: (state) => ({
    transactions: state.transactions,
    emailSupplements: state.emailSupplements,
    calculations: state.calculations,
    diffRecords: state.diffRecords,
    historyVersions: state.historyVersions,
    importBatches: state.importBatches,
    splitInfos: state.splitInfos,
  }),
}
));
