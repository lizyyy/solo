import type { SensitiveWord, QARecord, ContractClause, ImportLog, ReviewLog, DashboardMetrics, QAFilter, DuplicateStrategy, DetectionResult } from '@/types';
import { create } from 'zustand';
import { MOCK_CLAUSES, MOCK_QA_RECORDS, MOCK_IMPORT_LOGS, SENSITIVE_WORDS, MOCK_TREND_DATA } from '@/data/mockData';
import type { TrendDataPoint } from '@/types';

interface StoreState {
  clauses: ContractClause[];
  qaRecords: QARecord[];
  importLogs: ImportLog[];
  reviewLogs: ReviewLog[];
  sensitiveWords: SensitiveWord[];
  trendData: TrendDataPoint[];
  filter: QAFilter;
  selectedRecordId: string | null;

  setFilter: (filter: Partial<QAFilter>) => void;
  setSelectedRecordId: (id: string | null) => void;
  getMetrics: () => DashboardMetrics;
  getFilteredRecords: () => QARecord[];
  getPendingRecords: () => QARecord[];
  getReviewLogsForRecord: (recordId: string) => ReviewLog[];
  reviewRecord: (recordId: string, result: 'confirmed' | 'rejected' | 'known_issue', reviewer: string, reason: string) => void;
  addImportLog: (log: ImportLog) => void;
  rollbackImport: (batchId: string) => void;
  addClauses: (clauses: ContractClause[], strategy: DuplicateStrategy) => { newCount: number; duplicateCount: number };
  detectIssues: (record: QARecord) => DetectionResult;
  exportFilteredData: () => QARecord[];
}

export const useStore = create<StoreState>((set, get) => ({
  clauses: [...MOCK_CLAUSES],
  qaRecords: [...MOCK_QA_RECORDS],
  importLogs: [...MOCK_IMPORT_LOGS],
  reviewLogs: [],
  sensitiveWords: [...SENSITIVE_WORDS],
  trendData: [...MOCK_TREND_DATA],
  filter: { status: 'all', search: '', dateFrom: '', dateTo: '', issueType: 'all' },
  selectedRecordId: null,

  setFilter: (partial) => set((s) => ({ filter: { ...s.filter, ...partial } })),
  setSelectedRecordId: (id) => set({ selectedRecordId: id }),

  getMetrics: () => {
    const records = get().qaRecords;
    return {
      pendingCount: records.filter((r) => r.status === 'pending').length,
      grayConflictCount: records.filter((r) => r.isGrayConflict).length,
      sensitiveLeakCount: records.filter((r) => r.isSensitiveLeak).length,
      sourceBrokenCount: records.filter((r) => r.isSourceBroken).length,
      confirmedCount: records.filter((r) => r.status === 'confirmed').length,
      normalCount: records.filter((r) => r.status === 'normal').length,
      rejectedCount: records.filter((r) => r.status === 'rejected').length,
      knownIssueCount: records.filter((r) => r.status === 'known_issue').length,
    };
  },

  getFilteredRecords: () => {
    const { qaRecords, filter } = get();
    return qaRecords.filter((r) => {
      if (filter.status !== 'all' && r.status !== filter.status) return false;
      if (filter.search) {
        const s = filter.search.toLowerCase();
        if (!r.question.toLowerCase().includes(s) && !r.answer.toLowerCase().includes(s) && !r.judgmentReason.toLowerCase().includes(s)) return false;
      }
      if (filter.dateFrom && r.createdAt < filter.dateFrom) return false;
      if (filter.dateTo && r.createdAt > filter.dateTo + 'T23:59:59') return false;
      if (filter.issueType !== 'all') {
        if (filter.issueType === 'gray_conflict' && !r.isGrayConflict) return false;
        if (filter.issueType === 'source_broken' && !r.isSourceBroken) return false;
        if (filter.issueType === 'sensitive_leak' && !r.isSensitiveLeak) return false;
      }
      return true;
    });
  },

  getPendingRecords: () => get().qaRecords.filter((r) => r.status === 'pending'),

  getReviewLogsForRecord: (recordId) => get().reviewLogs.filter((l) => l.recordId === recordId),

  reviewRecord: (recordId, result, reviewer, reason) => {
    set((s) => {
      const record = s.qaRecords.find((r) => r.id === recordId);
      if (!record) return s;

      const reviewTypes: string[] = [];
      if (record.isGrayConflict) reviewTypes.push('gray_conflict');
      if (record.isSourceBroken) reviewTypes.push('source_broken');
      if (record.isSensitiveLeak) reviewTypes.push('sensitive_leak');

      const newReviewLog: ReviewLog = {
        id: `rl-${Date.now()}`,
        recordId,
        reviewType: reviewTypes[0] as ReviewLog['reviewType'],
        reason,
        evidence: buildEvidence(record),
        nextStep: buildNextStep(result, record),
        result,
        reviewDate: new Date().toISOString(),
        reviewer,
      };

      return {
        qaRecords: s.qaRecords.map((r) =>
          r.id === recordId ? { ...r, status: result, reviewedAt: new Date().toISOString(), reviewedBy: reviewer } : r
        ),
        reviewLogs: [...s.reviewLogs, newReviewLog],
      };
    });
  },

  addImportLog: (log) => set((s) => ({ importLogs: [log, ...s.importLogs] })),

  rollbackImport: (batchId) => {
    set((s) => {
      const log = s.importLogs.find((l) => l.batchId === batchId);
      if (!log) return s;
      return {
        clauses: s.clauses.filter((c) => c.importBatchId !== batchId),
        qaRecords: s.qaRecords.filter((r) => !log.snapshot.includes(r.clauseId)),
        importLogs: s.importLogs.map((l) => l.batchId === batchId ? { ...l, status: 'rolled_back' as const } : l),
      };
    });
  },

  addClauses: (newClauses, strategy) => {
    const { clauses } = get();
    let duplicateCount = 0;
    let newCount = 0;

    const processedClauses: ContractClause[] = [];
    for (const clause of newClauses) {
      const existing = clauses.find((c) => c.clauseNumber === clause.clauseNumber);
      if (existing) {
        duplicateCount++;
        if (strategy === 'skip') continue;
        if (strategy === 'overwrite') {
          processedClauses.push(clause);
          continue;
        }
      }
      processedClauses.push(clause);
      newCount++;
    }

    set((s) => ({
      clauses: strategy === 'overwrite'
        ? [...s.clauses.filter((c) => !processedClauses.find((p) => p.clauseNumber === c.clauseNumber)), ...processedClauses]
        : [...s.clauses, ...processedClauses.filter((c) => !s.clauses.find((e) => e.clauseNumber === c.clauseNumber))],
    }));

    return { newCount, duplicateCount };
  },

  detectIssues: (record) => {
    const { sensitiveWords, clauses } = get();
    const clause = clauses.find((c) => c.id === record.clauseId);

    let isSourceBroken = false;
    let sourceBrokenReason = '';
    if (!clause?.sourceLink) {
      isSourceBroken = true;
      sourceBrokenReason = '条款来源文档链接为空，无法验证该条款的出处和权威性';
    } else if (clause.sourceLink.includes('/invalid')) {
      isSourceBroken = true;
      sourceBrokenReason = `来源链接 ${clause.sourceLink} 指向无效路径，无法访问验证`;
    }

    const isGrayConflict = record.grayConclusion !== record.reportConclusion;
    const grayConflictReason = isGrayConflict
      ? `灰度结论"${record.grayConclusion}"与报表结论"${record.reportConclusion}"不一致`
      : '';

    const activeSensitiveWords = sensitiveWords.filter((w) => w.isActive);
    const foundWords = activeSensitiveWords.filter((w) => record.answer.includes(w.word)).map((w) => w.word);
    const isSensitiveLeak = foundWords.length > 0;
    const sensitiveLeakReason = isSensitiveLeak
      ? `答案中包含未脱敏的敏感词：${foundWords.join('、')}`
      : '';

    const hasIssues = isSourceBroken || isGrayConflict || isSensitiveLeak;
    const reasons: string[] = [];
    if (isSourceBroken) reasons.push('答案来源断链：' + sourceBrokenReason);
    if (isGrayConflict) reasons.push('灰度结论与报表不一致：' + grayConflictReason);
    if (isSensitiveLeak) reasons.push('敏感词漏脱敏：' + sensitiveLeakReason);

    return {
      isSourceBroken,
      sourceBrokenReason,
      isGrayConflict,
      grayConflictReason,
      isSensitiveLeak,
      sensitiveWordsFound: foundWords,
      sensitiveLeakReason,
      overallStatus: hasIssues ? 'pending' : 'normal',
      judgmentReason: hasIssues ? reasons.join('；') : '三重检测全部通过：来源链路有效、灰度结论与报表一致、无敏感词漏脱敏',
    };
  },

  exportFilteredData: () => get().getFilteredRecords(),
}));

function buildEvidence(record: QARecord): string {
  const parts: string[] = [];
  if (record.isGrayConflict) {
    parts.push(`灰度结论：${record.grayConclusion} vs 报表结论：${record.reportConclusion}`);
  }
  if (record.isSourceBroken) {
    parts.push('来源链接无法访问或为空');
  }
  if (record.isSensitiveLeak) {
    parts.push(`敏感词：${record.sensitiveWordsFound.join('、')}`);
  }
  return parts.join('；');
}

function buildNextStep(result: string, record: QARecord): string {
  if (result === 'confirmed') return '已确认答案正确，更新状态为正常';
  if (result === 'rejected') {
    const steps: string[] = ['退回修正'];
    if (record.isGrayConflict) steps.push('核对灰度结论与报表数据，以报表为准修正答案');
    if (record.isSourceBroken) steps.push('补充或修正来源文档链接');
    if (record.isSensitiveLeak) steps.push(`对敏感词"${record.sensitiveWordsFound.join('、')}"进行脱敏处理`);
    return steps.join('；');
  }
  return '标记为已知问题，纳入定期复查清单';
}
