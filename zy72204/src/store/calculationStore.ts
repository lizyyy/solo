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
import { detectSplit, validateImport, generateDiffRecords, normalizeImportRow, mapColumnHeaders } from '../services/businessLogic';

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
  generateReport: () => any;
  exportReportToCSV: () => string;
  exportReportToJSON: () => string;
  clearAllData: () => void;
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
        fullSnapshot: transaction,
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
        const newCalc: MarginCalculation = {
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
        newCalculations.push(newCalc);

        newHistoryVersions.push({
          id: uuidv4(),
          entityType: 'CALCULATION',
          entityId: newCalc.id,
          version: 1,
          action: 'CREATE',
          changedFields: {
            all: { old: null, new: newCalc },
          },
          fullSnapshot: newCalc,
          operatedBy: currentUser,
          operatedAt: importedAt,
          remark: `业务号 ${businessNumber} 初始试算记录创建`,
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
    const { currentUser, calculations } = get();
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

    const existingCalc = calculations.find(c => c.businessNumber === emailData.businessNumber);

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

      const updatedCalc = updatedCalculations.find(c => c.businessNumber === emailData.businessNumber);

      const newHistoryVersions: HistoryVersion[] = [
        {
          id: uuidv4(),
          entityType: 'EMAIL',
          entityId: supplement.id,
          version: 1,
          action: 'CREATE',
          changedFields: { all: { old: null, new: supplement } },
          fullSnapshot: supplement,
          operatedBy: currentUser,
          operatedAt: importedAt,
          remark: '客户经理补充邮件导入',
        },
      ];

      if (updatedCalc && existingCalc) {
        newHistoryVersions.push({
          id: uuidv4(),
          entityType: 'CALCULATION',
          entityId: updatedCalc.id,
          version: state.historyVersions.filter(h => h.entityId === updatedCalc.id && h.entityType === 'CALCULATION').length + 1,
          action: 'UPDATE',
          changedFields: {
            workflowStep: { old: existingCalc.workflowStep, new: updatedCalc.workflowStep },
            updatedAt: { old: existingCalc.updatedAt, new: updatedCalc.updatedAt },
          },
          fullSnapshot: updatedCalc,
          operatedBy: currentUser,
          operatedAt: importedAt,
          remark: '邮件补录完成，工作流进入STEP2',
        });
      }

      return {
        emailSupplements: [...state.emailSupplements, supplement],
        diffRecords: [...state.diffRecords, ...newDiffs],
        calculations: updatedCalculations,
        historyVersions: [...state.historyVersions, ...newHistoryVersions],
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
      const updatedTransactions = state.transactions.map(t =>
        t.id === transactionId ? { ...t, remark: newRemark } : t
      );
      const updatedTransaction = updatedTransactions.find(t => t.id === transactionId);
      const version = state.historyVersions.filter(
        h => h.entityId === transactionId
      ).length + 1;

      return {
        transactions: updatedTransactions,
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
            fullSnapshot: updatedTransaction,
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
      createdAt: existingCalc?.createdAt || updatedAt,
      updatedAt,
    };

    const version = historyVersions.filter(
      h => h.entityId === newCalc.id && h.entityType === 'CALCULATION'
    ).length + 1;

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
          version,
          action: 'UPDATE',
          changedFields: {
            scenario: { old: existingCalc?.scenario, new: scenario },
            baseMargin: { old: existingCalc?.baseMargin, new: newCalc.baseMargin },
            stressMargin: { old: existingCalc?.stressMargin, new: newCalc.stressMargin },
            marginRatio: { old: existingCalc?.marginRatio, new: newCalc.marginRatio },
            calculationDate: { old: existingCalc?.calculationDate, new: updatedAt },
            updatedAt: { old: existingCalc?.updatedAt, new: updatedAt },
          },
          fullSnapshot: newCalc,
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

    if (versions.length < 1) return;

    const latestVersion = versions[0];
    let targetSnapshot: any;
    let rollbackRemark: string;
    let changedFields: Record<string, { old: any; new: any }>;

    if (versions.length === 1) {
      targetSnapshot = latestVersion.fullSnapshot;
      rollbackRemark = '回滚到初始创建状态';
      changedFields = {
        status: { old: calc.status, new: targetSnapshot.status },
        workflowStep: { old: calc.workflowStep, new: targetSnapshot.workflowStep },
        scenario: { old: calc.scenario, new: targetSnapshot.scenario },
        baseMargin: { old: calc.baseMargin, new: targetSnapshot.baseMargin },
        stressMargin: { old: calc.stressMargin, new: targetSnapshot.stressMargin },
        marginRatio: { old: calc.marginRatio, new: targetSnapshot.marginRatio },
        isPendingReview: { old: calc.isPendingReview, new: targetSnapshot.isPendingReview },
        hasSplit: { old: calc.hasSplit, new: targetSnapshot.hasSplit },
      };
    } else {
      const previousVersion = versions[1];
      targetSnapshot = previousVersion.fullSnapshot;
      rollbackRemark = `回滚到版本 ${previousVersion.version}（${previousVersion.remark}）`;
      changedFields = {};
      for (const key of Object.keys(latestVersion.changedFields)) {
        changedFields[key] = {
          old: latestVersion.changedFields[key].new,
          new: previousVersion.changedFields[key]?.old ?? targetSnapshot[key],
        };
      }
    }

    const rolledBackAt = dayjs().toISOString();
    const rolledBackCalc: MarginCalculation = {
      ...targetSnapshot,
      id: calc.id,
      updatedAt: rolledBackAt,
    };

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
          version: latestVersion.version + 1,
          action: 'ROLLBACK',
          changedFields,
          fullSnapshot: rolledBackCalc,
          operatedBy: currentUser,
          operatedAt: rolledBackAt,
          remark: rollbackRemark,
        },
      ],
    }));
  },

  confirmSplit: async (businessNumber, confirmed) => {
    const { currentUser, calculations, historyVersions } = get();
    const confirmedAt = dayjs().toISOString();
    const existingCalc = calculations.find(c => c.businessNumber === businessNumber);

    set(state => {
      const updatedCalculations = state.calculations.map(c =>
        c.businessNumber === businessNumber
          ? {
              ...c,
              status: (confirmed ? 'NORMAL' : 'DISPUTED') as RecordStatus,
              isPendingReview: !confirmed,
              workflowStep: 'STEP3_DIFF_UPDATED' as WorkflowStep,
              reviewedBy: currentUser,
              reviewedAt: confirmedAt,
              updatedAt: confirmedAt,
            }
          : c
      );

      const updatedCalc = updatedCalculations.find(c => c.businessNumber === businessNumber);

      const newHistoryVersions: HistoryVersion[] = [];

      if (updatedCalc && existingCalc) {
        const version = historyVersions.filter(
          h => h.entityId === updatedCalc.id && h.entityType === 'CALCULATION'
        ).length + 1;

        newHistoryVersions.push({
          id: uuidv4(),
          entityType: 'CALCULATION',
          entityId: updatedCalc.id,
          version,
          action: 'UPDATE',
          changedFields: {
            status: { old: existingCalc.status, new: updatedCalc.status },
            isPendingReview: { old: existingCalc.isPendingReview, new: updatedCalc.isPendingReview },
            workflowStep: { old: existingCalc.workflowStep, new: updatedCalc.workflowStep },
            reviewedBy: { old: existingCalc.reviewedBy, new: updatedCalc.reviewedBy },
            reviewedAt: { old: existingCalc.reviewedAt, new: updatedCalc.reviewedAt },
            updatedAt: { old: existingCalc.updatedAt, new: updatedCalc.updatedAt },
          },
          fullSnapshot: updatedCalc,
          operatedBy: currentUser,
          operatedAt: confirmedAt,
          remark: confirmed ? '拆分确认无误，状态更新为正常' : '拆分标记为有争议',
        });
      }

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
        calculations: updatedCalculations,
        historyVersions: [...state.historyVersions, ...newHistoryVersions],
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
    const { transactions, calculations, diffRecords, historyVersions, emailSupplements, splitInfos } = get();
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalBaseMargin = calculations.reduce((sum, c) => sum + c.baseMargin, 0);
    const totalStressMargin = calculations.reduce((sum, c) => sum + c.stressMargin, 0);
    
    const statusCounts: Record<string, number> = {};
    calculations.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    const stepCounts: Record<string, number> = {};
    calculations.forEach(c => {
      stepCounts[c.workflowStep] = (stepCounts[c.workflowStep] || 0) + 1;
    });

    return {
      generatedAt: dayjs().toISOString(),
      generatedBy: get().currentUser,
      summary: {
        totalTransactions: transactions.length,
        totalAmount,
        totalCalculations: calculations.length,
        totalBaseMargin,
        totalStressMargin,
        totalDiffs: diffRecords.length,
        resolvedDiffs: diffRecords.filter(d => d.resolved).length,
        unresolvedDiffs: diffRecords.filter(d => !d.resolved).length,
        totalEmails: emailSupplements.length,
        totalSplits: splitInfos.length,
        confirmedSplits: splitInfos.filter(s => s.status === 'CONFIRMED').length,
        rejectedSplits: splitInfos.filter(s => s.status === 'REJECTED').length,
        statusCounts,
        stepCounts,
        totalHistoryVersions: historyVersions.length,
      },
      calculations: calculations.map(c => ({
        ...c,
        transactions: transactions.filter(t => t.businessNumber === c.businessNumber),
        diffs: diffRecords.filter(d => d.businessNumber === c.businessNumber),
        emails: emailSupplements.filter(e => e.businessNumber === c.businessNumber),
        splitInfo: splitInfos.find(s => s.businessNumber === c.businessNumber),
      })),
      transactions,
      diffRecords,
      emailSupplements,
      splitInfos,
      historyVersions,
    };
  },

  exportReportToCSV: () => {
    const { calculations, transactions } = get();
    let csv = '业务号,场景,基础保证金,压力保证金,比例,状态,流程步骤,是否拆分,流水数量,总金额\n';
    
    calculations.forEach(c => {
      const trans = transactions.filter(t => t.businessNumber === c.businessNumber);
      const total = trans.reduce((sum, t) => sum + t.amount, 0);
      csv += `${c.businessNumber},${c.scenario},${c.baseMargin.toFixed(2)},${c.stressMargin.toFixed(2)},${(c.marginRatio * 100).toFixed(1)}%,${c.status},${c.workflowStep},${c.hasSplit ? '是' : '否'},${trans.length},${total.toFixed(2)}\n`;
    });

    csv += '\n\n柜台流水明细\n';
    csv += '流水尾号,业务号,交易日期,金额,类型,对手方,备注,来源行\n';
    transactions.forEach(t => {
      const type = t.transactionType === 'FEE' ? '手续费' : t.transactionType === 'PRINCIPAL' ? '本金' : '合计';
      csv += `${t.tailNumber},${t.businessNumber},${t.transactionDate},${t.amount.toFixed(2)},${type},${t.counterparty},"${t.remark}",${t.sourceRowNumber}\n`;
    });

    return csv;
  },

  exportReportToJSON: () => {
    const report = get().generateReport();
    return JSON.stringify(report, null, 2);
  },

  clearAllData: () => {
    set({
      transactions: [],
      emailSupplements: [],
      calculations: [],
      diffRecords: [],
      historyVersions: [],
      importBatches: [],
      splitInfos: [],
    });
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
