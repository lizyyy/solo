import { create } from 'zustand';
import type {
  DesensitizationRule,
  GrayBatch,
  ReviewRecord,
  ChangeHistory,
  JudgmentRecord,
  EvaluationReport,
  ImportResult,
} from '@/types';
import { generateHash, generateId } from '@/utils/hash';
import { loadFromStorage, saveToStorage } from '@/utils/storage';
import {
  mockRules,
  mockBatches,
  mockRecords,
  mockChangeHistory,
  mockJudgments,
  mockReports,
} from '@/data/mockData';

interface ReviewState {
  rules: DesensitizationRule[];
  batches: GrayBatch[];
  records: ReviewRecord[];
  changeHistory: ChangeHistory[];
  judgments: JudgmentRecord[];
  reports: EvaluationReport[];
  initialized: boolean;

  initializeData: () => void;
  importRules: (ruleContents: { content: string; remark: string }[]) => Promise<ImportResult>;
  updateRuleRemark: (ruleId: string, newRemark: string, reason: string) => void;
  addBatch: (batch: Omit<GrayBatch, 'id' | 'createdBy' | 'createdAt'>) => void;
  linkBatchToRecord: (recordId: string, batchId: string) => void;
  addManualJudgment: (
    recordId: string,
    result: 'PASS' | 'FAIL',
    reason: string
  ) => void;
  reviewJudgment: (
    judgmentId: string,
    reviewStatus: 'APPROVED' | 'REJECTED'
  ) => void;
  runBatchProcess: () => void;
  generateReport: (recordId: string) => void;
  getChangeHistoryByRecord: (recordId: string) => ChangeHistory[];
  getJudgmentByRecord: (recordId: string) => JudgmentRecord | undefined;
  getReportByRecord: (recordId: string) => EvaluationReport | undefined;
  getRuleById: (ruleId: string) => DesensitizationRule | undefined;
  getBatchById: (batchId: string) => GrayBatch | undefined;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  rules: [],
  batches: [],
  records: [],
  changeHistory: [],
  judgments: [],
  reports: [],
  initialized: false,

  initializeData: () => {
    if (get().initialized) return;

    const savedRules = loadFromStorage<DesensitizationRule[]>('rules', []);
    const savedBatches = loadFromStorage<GrayBatch[]>('batches', []);
    const savedRecords = loadFromStorage<ReviewRecord[]>('records', []);
    const savedHistory = loadFromStorage<ChangeHistory[]>('changeHistory', []);
    const savedJudgments = loadFromStorage<JudgmentRecord[]>('judgments', []);
    const savedReports = loadFromStorage<EvaluationReport[]>('reports', []);

    set({
      rules: savedRules.length > 0 ? savedRules : mockRules,
      batches: savedBatches.length > 0 ? savedBatches : mockBatches,
      records: savedRecords.length > 0 ? savedRecords : mockRecords,
      changeHistory: savedHistory.length > 0 ? savedHistory : mockChangeHistory,
      judgments: savedJudgments.length > 0 ? savedJudgments : mockJudgments,
      reports: savedReports.length > 0 ? savedReports : mockReports,
      initialized: true,
    });

    if (savedRules.length === 0) {
      saveToStorage('rules', mockRules);
      saveToStorage('batches', mockBatches);
      saveToStorage('records', mockRecords);
      saveToStorage('changeHistory', mockChangeHistory);
      saveToStorage('judgments', mockJudgments);
      saveToStorage('reports', mockReports);
    }
  },

  importRules: async (ruleContents) => {
    const { rules, changeHistory, records } = get();
    const existingHashes = new Set(rules.map(r => r.ruleHash));
    const added: DesensitizationRule[] = [];
    const newRecords: ReviewRecord[] = [];

    for (const item of ruleContents) {
      const hash = await generateHash(item.content);
      
      if (existingHashes.has(hash)) {
        continue;
      }

      const newRule: DesensitizationRule = {
        id: generateId(),
        ruleHash: hash,
        content: item.content,
        remark: item.remark,
        createdBy: '模型评测同事小孟',
        createdAt: new Date().toISOString(),
      };

      added.push(newRule);
      existingHashes.add(hash);

      const newRecord: ReviewRecord = {
        id: generateId(),
        ruleId: newRule.id,
        scriptContent: `示例脚本：${item.content.substring(0, 30)}...`,
        autoResult: 'PENDING',
        status: 'DRAFT',
        hasManualJudgment: false,
        createdBy: '系统自动',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      newRecords.push(newRecord);
    }

    const newRules = [...rules, ...added];
    const allRecords = [...records, ...newRecords];

    set({
      rules: newRules,
      records: allRecords,
    });

    saveToStorage('rules', newRules);
    saveToStorage('records', allRecords);

    return {
      added: added.length,
      skipped: ruleContents.length - added.length,
      total: ruleContents.length,
    };
  },

  updateRuleRemark: (ruleId, newRemark, reason) => {
    const { rules, changeHistory, records } = get();
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    const oldRemark = rule.remark;
    if (oldRemark === newRemark) return;

    const updatedRules = rules.map(r =>
      r.id === ruleId ? { ...r, remark: newRemark } : r
    );

    const record = records.find(r => r.ruleId === ruleId);
    if (record) {
      const historyEntry: ChangeHistory = {
        id: generateId(),
        recordId: record.id,
        fieldName: 'remark',
        oldValue: oldRemark,
        newValue: newRemark,
        changedBy: '模型评测同事小孟',
        changeReason: reason,
        changedAt: new Date().toISOString(),
      };

      const newHistory = [...changeHistory, historyEntry];
      set({ changeHistory: newHistory });
      saveToStorage('changeHistory', newHistory);
    }

    set({ rules: updatedRules });
    saveToStorage('rules', updatedRules);
  },

  addBatch: (batch) => {
    const { batches } = get();
    const newBatch: GrayBatch = {
      ...batch,
      id: generateId(),
      createdBy: '模型评测同事小孟',
    };
    const newBatches = [...batches, newBatch];
    set({ batches: newBatches });
    saveToStorage('batches', newBatches);
  },

  linkBatchToRecord: (recordId, batchId) => {
    const { records } = get();
    const updatedRecords = records.map(r =>
      r.id === recordId
        ? { ...r, batchId, updatedAt: new Date().toISOString() }
        : r
    );
    set({ records: updatedRecords });
    saveToStorage('records', updatedRecords);
  },

  addManualJudgment: (recordId, result, reason) => {
    const { judgments, records } = get();
    const newJudgment: JudgmentRecord = {
      id: generateId(),
      recordId,
      judgmentResult: result,
      judgmentReason: reason,
      judgedBy: '安全审核同事',
      judgedAt: new Date().toISOString(),
      reviewStatus: 'PENDING',
    };

    const newJudgments = [...judgments, newJudgment];
    const updatedRecords = records.map(r =>
      r.id === recordId
        ? { ...r, hasManualJudgment: true, status: 'REVIEWING' as const, updatedAt: new Date().toISOString() }
        : r
    );

    set({ judgments: newJudgments, records: updatedRecords });
    saveToStorage('judgments', newJudgments);
    saveToStorage('records', updatedRecords);
  },

  reviewJudgment: (judgmentId, reviewStatus) => {
    const { judgments, records } = get();
    const judgment = judgments.find(j => j.id === judgmentId);
    if (!judgment) return;

    const updatedJudgments = judgments.map(j =>
      j.id === judgmentId
        ? {
            ...j,
            reviewStatus,
            reviewedBy: '安全审核同事',
            reviewedAt: new Date().toISOString(),
          }
        : j
    );

    const updatedRecords = records.map(r =>
      r.id === judgment.recordId
        ? { ...r, status: reviewStatus === 'APPROVED' ? ('CONFIRMED' as const) : ('REVIEWING' as const), updatedAt: new Date().toISOString() }
        : r
    );

    set({ judgments: updatedJudgments, records: updatedRecords });
    saveToStorage('judgments', updatedJudgments);
    saveToStorage('records', updatedRecords);
  },

  runBatchProcess: () => {
    const { records } = get();
    const updatedRecords = records.map(r => {
      if (r.hasManualJudgment) {
        return { ...r, status: 'PENDING_REVIEW' as const, updatedAt: new Date().toISOString() };
      }
      return {
        ...r,
        autoResult: (Math.random() > 0.5 ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
        updatedAt: new Date().toISOString(),
      };
    });

    set({ records: updatedRecords });
    saveToStorage('records', updatedRecords);
  },

  generateReport: (recordId) => {
    const { reports, records, rules, judgments } = get();
    const record = records.find(r => r.id === recordId);
    if (!record) return;

    const rule = rules.find(r => r.id === record.ruleId);
    const judgment = judgments.find(j => j.recordId === recordId);

    const isPass = judgment
      ? judgment.judgmentResult === 'PASS'
      : record.autoResult === 'PASS';

    const missingMaterials: string[] = [];
    let assignee: '安全审核同事' | '模型评测同事小孟' = '模型评测同事小孟';
    let nextStep = '';

    if (record.status === 'PENDING_REVIEW') {
      missingMaterials.push('安全审核同事的复核确认');
      assignee = '安全审核同事';
      nextStep = '请安全审核同事完成人工改判的复核确认';
    } else if (!isPass) {
      missingMaterials.push('脱敏规则备注的详细说明');
      missingMaterials.push('脚本修改后的版本');
      assignee = '模型评测同事小孟';
      nextStep = '请模型评测同事小孟更新脱敏规则备注并修改脚本';
    } else {
      nextStep = '审查通过，可正常上线使用';
    }

    const newReport: EvaluationReport = {
      id: generateId(),
      recordId,
      conclusion: isPass
        ? `审查结论：通过。该脚本${rule ? `针对"${rule.content}"的处理` : ''}符合安全规范要求。`
        : `审查结论：未通过。该脚本${rule ? `在"${rule.content}"方面` : ''}存在安全风险，需要进一步处理。`,
      reason: judgment
        ? `人工改判理由：${judgment.judgmentReason}（由${judgment.judgedBy}判定）`
        : `模型自动审查结果：${record.autoResult === 'PASS' ? '通过' : '未通过'}。${rule ? `规则说明：${rule.remark}` : ''}`,
      missingMaterials,
      nextStep,
      assignee,
      generatedBy: '系统自动生成',
      createdAt: new Date().toISOString(),
    };

    const newReports = [...reports.filter(r => r.recordId !== recordId), newReport];
    set({ reports: newReports });
    saveToStorage('reports', newReports);
  },

  getChangeHistoryByRecord: (recordId) => {
    return get().changeHistory.filter(h => h.recordId === recordId);
  },

  getJudgmentByRecord: (recordId) => {
    return get().judgments.find(j => j.recordId === recordId);
  },

  getReportByRecord: (recordId) => {
    return get().reports.find(r => r.recordId === recordId);
  },

  getRuleById: (ruleId) => {
    return get().rules.find(r => r.id === ruleId);
  },

  getBatchById: (batchId) => {
    return get().batches.find(b => b.id === batchId);
  },
}));
