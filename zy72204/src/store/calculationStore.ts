import { create } from 'zustand';
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
import { detectSplit, validateImport, generateDiffRecords } from '../services/businessLogic';

interface CalculationState {
  transactions: CounterTransaction[];
  emailSupplements: EmailSupplement[];
  calculations: MarginCalculation[];
  diffRecords: DiffRecord[];
  historyVersions: HistoryVersion[];
  importBatches: ImportBatch[];
  splitInfos: SplitInfo[];
  currentUser: string;
  importTransactions: (records: any[], fileName: string) => Promise<{
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
}

export const useCalculationStore = create<CalculationState>((set, get) => ({
  transactions: [],
  emailSupplements: [],
  calculations: [],
  diffRecords: [],
  historyVersions: [],
  importBatches: [],
  splitInfos: [],
  currentUser: '支付平台产品阿南',

  importTransactions: async (records, fileName) => {
    const errors: string[] = [];
    let successCount = 0;
    let skippedCount = 0;

    const batchId = uuidv4();
    const importedAt = dayjs().toISOString();
    const { currentUser } = get();

    const existingTailNumbers = new Set(
      get().transactions.map(t => t.tailNumber)
    );

    const newTransactions: CounterTransaction[] = [];
    const newHistoryVersions: HistoryVersion[] = [];
    const businessNumberGroups: Record<string, CounterTransaction[]> = {};

    for (const record of records) {
      const validation = validateImport(record);
      if (!validation.valid) {
        errors.push(`记录 ${record.tailNumber || '未知'}: ${validation.error}`);
        continue;
      }

      if (existingTailNumbers.has(record.tailNumber)) {
        skippedCount++;
        continue;
      }

      const transactionType: TransactionType = 
        record.amountType === 'FEE' ? 'FEE' :
        record.amountType === 'PRINCIPAL' ? 'PRINCIPAL' : 'COMBINED';

      const transaction: CounterTransaction = {
        id: uuidv4(),
        tailNumber: record.tailNumber,
        businessNumber: record.businessNumber,
        transactionDate: record.transactionDate,
        amount: parseFloat(record.amount),
        transactionType,
        counterparty: record.counterparty || '',
        remark: record.remark || '',
        importBatchId: batchId,
        importedAt,
        importedBy: currentUser,
      };

      newTransactions.push(transaction);
      existingTailNumbers.add(record.tailNumber);
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
        remark: '柜台流水导入',
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
        newCalculations.push({
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
        });
      }
    }

    const importBatch: ImportBatch = {
      id: batchId,
      source: 'COUNTER',
      fileName,
      recordCount: records.length,
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
    const { currentUser, transactions, calculations } = get();
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
          version: state.historyVersions.filter(h => h.entityId === newCalc.id).length + 1,
          action: 'UPDATE',
          changedFields: {
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

    if (versions.length < 2) return;

    const previousVersion = versions[1];
    const rolledBackAt = dayjs().toISOString();

    set(state => ({
      calculations: state.calculations.map(c =>
        c.id === calculationId
          ? {
              ...c,
              scenario: previousVersion.changedFields.scenario?.old || c.scenario,
              baseMargin: previousVersion.changedFields.baseMargin?.old || c.baseMargin,
              stressMargin: previousVersion.changedFields.stressMargin?.old || c.stressMargin,
              status: 'ROLLBACKED' as RecordStatus,
              updatedAt: rolledBackAt,
            }
          : c
      ),
      historyVersions: [
        ...state.historyVersions,
        {
          id: uuidv4(),
          entityType: 'CALCULATION',
          entityId: calculationId,
          version: versions.length + 1,
          action: 'ROLLBACK',
          changedFields: previousVersion.changedFields,
          operatedBy: currentUser,
          operatedAt: rolledBackAt,
          remark: '回滚到上一版本',
        },
      ],
    }));
  },

  confirmSplit: async (businessNumber, confirmed) => {
    const { currentUser } = get();
    const confirmedAt = dayjs().toISOString();

    set(state => ({
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
      calculations: state.calculations.map(c =>
        c.businessNumber === businessNumber
          ? {
              ...c,
              status: confirmed ? 'NORMAL' : 'DISPUTED',
              isPendingReview: !confirmed,
              workflowStep: 'STEP3_DIFF_UPDATED' as WorkflowStep,
              reviewedBy: currentUser,
              reviewedAt: confirmedAt,
              updatedAt: confirmedAt,
            }
          : c
      ),
    }));
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
}));
