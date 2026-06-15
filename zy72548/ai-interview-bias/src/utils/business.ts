import type {
  InterviewSample,
  ManualCorrection,
  ReviewRecord,
  ConflictEvidence,
  HistoryRecord,
  Role,
  SelfCheckResult,
} from '../types';
import { generateId } from './storage';

export const detectConflicts = (
  record: ReviewRecord,
  allRecords: ReviewRecord[]
): ConflictEvidence[] => {
  const conflicts: ConflictEvidence[] = [];
  const now = new Date().toISOString();

  if (record.correction && record.promptVersion) {
    const correctionDate = new Date(record.correction.correctedAt);
    const promptDate = new Date(record.promptVersion.effectiveDate);
    
    const conclusionRefersPrompt = record.correction.reason.includes('提示词') || 
                                   record.correction.conclusion.includes('v');
    
    if (conclusionRefersPrompt && correctionDate < promptDate) {
      conflicts.push({
        conflictId: generateId('conflict'),
        type: 'prompt_version_mismatch',
        sampleId: record.sampleId,
        description: '人工改判结论引用了后续版本的提示词',
        fieldA: '改判时间',
        valueA: record.correction.correctedAt,
        fieldB: '提示词生效时间',
        valueB: record.promptVersion.effectiveDate,
        detectedAt: now,
      });
    }
  }

  const sameSampleSameModelAndCorrection = allRecords.filter(
    r => r.sampleId === record.sampleId && 
         r.interview.modelVersion === record.interview.modelVersion &&
         r.recordId !== record.recordId
  );
  
  if (sameSampleSameModelAndCorrection.length > 0) {
    const otherRecord = sameSampleSameModelAndCorrection[0];
    conflicts.push({
      conflictId: generateId('conflict'),
      type: 'duplicate_import',
      sampleId: record.sampleId,
      description: '同样本编号+同模型版本已存在记录，可能是重复导入',
      fieldA: '已有记录ID',
      valueA: otherRecord.recordId,
      fieldB: '当前记录ID',
      valueB: record.recordId,
      detectedAt: now,
    });
  }

  const duplicateImport = allRecords.filter(
    r => r.correction?.batchId === record.correction?.batchId &&
         r.sampleId === record.sampleId &&
         r.interview.modelVersion === record.interview.modelVersion &&
         r.correction?.correctionId !== record.correction?.correctionId
  );
  
  if (duplicateImport.length > 0) {
    conflicts.push({
      conflictId: generateId('conflict'),
      type: 'duplicate_import',
      sampleId: record.sampleId,
      description: '同批次重复导入同样本',
      fieldA: '已有改判ID',
      valueA: duplicateImport[0].correction?.correctionId,
      fieldB: '当前改判ID',
      valueB: record.correction?.correctionId,
      detectedAt: now,
    });
  }

  if (record.correction && record.interview) {
    const aiPass = record.interview.aiScore >= 60;
    const aiConclusion = aiPass ? '通过' : '不通过';
    const humanConclusion = record.correction.conclusion;
    
    if (humanConclusion && !humanConclusion.includes(aiConclusion) && 
        !record.correction.reason.includes('评分标准差异')) {
      conflicts.push({
        conflictId: generateId('conflict'),
        type: 'conclusion_inconsistent',
        sampleId: record.sampleId,
        description: 'AI结论与人工结论存在偏差',
        fieldA: 'AI结论',
        valueA: `${aiConclusion} (${record.interview.aiScore}分)`,
        fieldB: '人工结论',
        valueB: `${humanConclusion} (${record.correction.humanScore}分)`,
        detectedAt: now,
      });
    }
  }

  return conflicts;
};

export const getRelatedRecords = (
  record: ReviewRecord,
  allRecords: ReviewRecord[]
): ReviewRecord[] => {
  return allRecords.filter(
    r => r.sampleId === record.sampleId && r.recordId !== record.recordId
  );
};

export const createHistoryRecord = (
  recordId: string,
  sampleId: string,
  action: string,
  operator: string,
  role: Role,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
  remark?: string
): HistoryRecord => ({
  historyId: generateId('history'),
  recordId,
  sampleId,
  action,
  operator,
  role,
  timestamp: new Date().toISOString(),
  before,
  after,
  remark,
});

export const createReviewRecord = (
  interview: InterviewSample,
  correction?: ManualCorrection,
  operator: string = 'system',
  role: Role = 'admin'
): ReviewRecord => {
  const now = new Date().toISOString();
  const recordId = generateId('rec');
  return {
    recordId,
    sampleId: interview.sampleId,
    interview,
    correction,
    status: 'pending_review',
    conflicts: [],
    history: [
      createHistoryRecord(
        recordId,
        interview.sampleId,
        correction ? '创建记录并导入人工改判' : '创建面试记录',
        operator,
        role,
        undefined,
        { interview, correction },
        correction ? '首次导入人工改判表' : undefined
      ),
    ],
    createdAt: now,
    updatedAt: now,
  };
};

export const runSelfCheck = (records: ReviewRecord[]): SelfCheckResult[] => {
  const results: SelfCheckResult[] = [];
  const now = new Date().toISOString();

  const keyMap = new Map<string, ReviewRecord[]>();
  records.forEach(r => {
    const key = `${r.sampleId}@${r.interview.modelVersion}`;
    const existing = keyMap.get(key) || [];
    keyMap.set(key, [...existing, r]);
  });
  
  const duplicateSamples = Array.from(keyMap.entries())
    .filter(([_, recs]) => recs.length > 1)
    .map(([key, recs]) => `${key} (${recs.length}条记录)`);
  
  results.push({
    checkId: generateId('check'),
    checkName: '重复导入检测',
    passed: duplicateSamples.length === 0,
    message: duplicateSamples.length === 0 
      ? '未发现重复导入' 
      : `发现 ${duplicateSamples.length} 个重复样本`,
    details: duplicateSamples,
    checkedAt: now,
  });

  const sampleMap = new Map<string, ReviewRecord[]>();
  records.forEach(r => {
    const existing = sampleMap.get(r.sampleId) || [];
    sampleMap.set(r.sampleId, [...existing, r]);
  });

  const modelVersionNotes: string[] = [];
  sampleMap.forEach((recs, sampleId) => {
    const modelVersions = new Set(recs.map(r => r.interview.modelVersion));
    if (modelVersions.size > 1) {
      modelVersionNotes.push(`${sampleId}: 存在 ${Array.from(modelVersions).join('、')} 多个模型版本，共 ${recs.length} 条独立记录`);
    }
  });
  
  results.push({
    checkId: generateId('check'),
    checkName: '模型版本多版本检测',
    passed: modelVersionNotes.length === 0,
    message: modelVersionNotes.length === 0 
      ? '未发现样本编号跨模型版本' 
      : `发现 ${modelVersionNotes.length} 个样本编号存在多模型版本（每条独立记录正常）`,
    details: modelVersionNotes,
    checkedAt: now,
  });

  const recalcIssues: string[] = [];
  records.forEach(r => {
    if (r.promptVersion && r.correction && r.finalScore !== undefined) {
      const expectedScore = r.correction.humanScore;
      if (r.finalScore !== expectedScore) {
        recalcIssues.push(`${r.sampleId}@${r.interview.modelVersion}: 最终分数${r.finalScore}≠人工分数${expectedScore}`);
      }
    }
  });
  
  results.push({
    checkId: generateId('check'),
    checkName: '补录后重算一致性',
    passed: recalcIssues.length === 0,
    message: recalcIssues.length === 0 
      ? '补录后数据重算一致' 
      : `发现 ${recalcIssues.length} 条重算不一致`,
    details: recalcIssues,
    checkedAt: now,
  });

  const exportConsistencyIssues: string[] = [];
  records.forEach(r => {
    if (r.finalConclusion && r.correction) {
      const scorePass = (r.finalScore ?? r.correction.humanScore) >= 60;
      const conclusionPass = r.finalConclusion.includes('通过');
      if (scorePass !== conclusionPass) {
        exportConsistencyIssues.push(`${r.sampleId}@${r.interview.modelVersion}: 分数与结论不一致`);
      }
    }
  });
  
  results.push({
    checkId: generateId('check'),
    checkName: '导出数据一致性',
    passed: exportConsistencyIssues.length === 0,
    message: exportConsistencyIssues.length === 0 
      ? '导出数据一致' 
      : `发现 ${exportConsistencyIssues.length} 条导出不一致`,
    details: exportConsistencyIssues,
    checkedAt: now,
  });

  return results;
};

export const parseCorrectionCSV = (content: string): ManualCorrection[] => {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const corrections: ManualCorrection[] = [];
  const batchId = generateId('batch');
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    
    corrections.push({
      correctionId: generateId('correction'),
      sampleId: row['样本编号'] || row['sampleId'] || '',
      humanScore: parseFloat(row['人工评分'] || row['humanScore'] || '0'),
      conclusion: row['人工结论'] || row['conclusion'] || '',
      reason: row['改判理由'] || row['reason'] || '',
      correctedBy: row['改判人'] || row['correctedBy'] || '未知',
      correctedAt: row['改判时间'] || row['correctedAt'] || new Date().toISOString(),
      batchId,
    });
  }
  
  return corrections;
};

export const parseInterviewCSV = (content: string): InterviewSample[] => {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const samples: InterviewSample[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    
    samples.push({
      sampleId: row['样本编号'] || row['sampleId'] || '',
      modelVersion: row['模型版本'] || row['modelVersion'] || 'v1.0',
      aiScore: parseFloat(row['AI评分'] || row['aiScore'] || '0'),
      candidateName: row['候选人'] || row['candidateName'] || '',
      interviewDate: row['面试日期'] || row['interviewDate'] || new Date().toISOString(),
      position: row['应聘岗位'] || row['position'] || '',
    });
  }
  
  return samples;
};
