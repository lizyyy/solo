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

  const sameSampleDifferentModel = allRecords.filter(
    r => r.sampleId === record.sampleId && 
         r.interview.modelVersion !== record.interview.modelVersion
  );
  
  if (sameSampleDifferentModel.length > 0) {
    const otherRecord = sameSampleDifferentModel[0];
    conflicts.push({
      conflictId: generateId('conflict'),
      type: 'model_version_changed',
      sampleId: record.sampleId,
      description: '样本编号相同但模型版本不同，需运营复核',
      fieldA: '已有模型版本',
      valueA: otherRecord.interview.modelVersion,
      fieldB: '当前模型版本',
      valueB: record.interview.modelVersion,
      detectedAt: now,
    });
  }

  const duplicateImport = allRecords.filter(
    r => r.correction?.batchId === record.correction?.batchId &&
         r.sampleId === record.sampleId &&
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

export const createHistoryRecord = (
  sampleId: string,
  action: string,
  operator: string,
  role: Role,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
  remark?: string
): HistoryRecord => ({
  historyId: generateId('history'),
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
  return {
    sampleId: interview.sampleId,
    interview,
    correction,
    status: correction ? 'pending_review' : 'pending_review',
    conflicts: [],
    history: [
      createHistoryRecord(
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

  const sampleMap = new Map<string, ReviewRecord[]>();
  records.forEach(r => {
    const existing = sampleMap.get(r.sampleId) || [];
    sampleMap.set(r.sampleId, [...existing, r]);
  });
  
  const duplicateSamples = Array.from(sampleMap.entries())
    .filter(([_, recs]) => recs.length > 1)
    .map(([sampleId, recs]) => `${sampleId} (${recs.length}条记录)`);
  
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

  const modelVersionIssues: string[] = [];
  sampleMap.forEach((recs, sampleId) => {
    const modelVersions = new Set(recs.map(r => r.interview.modelVersion));
    if (modelVersions.size > 1) {
      modelVersionIssues.push(`${sampleId}: ${Array.from(modelVersions).join(' vs ')}`);
    }
  });
  
  results.push({
    checkId: generateId('check'),
    checkName: '模型版本一致性检测',
    passed: modelVersionIssues.length === 0,
    message: modelVersionIssues.length === 0 
      ? '样本编号与模型版本一致' 
      : `发现 ${modelVersionIssues.length} 个版本不一致样本`,
    details: modelVersionIssues,
    checkedAt: now,
  });

  const recalcIssues: string[] = [];
  records.forEach(r => {
    if (r.promptVersion && r.correction && r.finalScore !== undefined) {
      const expectedScore = r.correction.humanScore;
      if (r.finalScore !== expectedScore) {
        recalcIssues.push(`${r.sampleId}: 最终分数${r.finalScore}≠人工分数${expectedScore}`);
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
        exportConsistencyIssues.push(`${r.sampleId}: 分数与结论不一致`);
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
