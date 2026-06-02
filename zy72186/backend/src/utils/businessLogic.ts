import type { Sample, ReviewStatus, ReviewDecision, ConflictInfo } from '../types';

export function detectDuplicates(samples: Sample[]): Map<string, Sample[]> {
  const groups = new Map<string, Sample[]>();
  
  samples.forEach(sample => {
    const key = `${sample.contractId}-${sample.clauseType}-${sample.clauseContent}`;
    const existing = groups.get(key) || [];
    existing.push(sample);
    groups.set(key, existing);
  });
  
  const duplicateGroups = new Map<string, Sample[]>();
  let groupIndex = 0;
  
  groups.forEach((group, key) => {
    if (group.length > 1) {
      const groupId = `dup-${String(++groupIndex).padStart(3, '0')}`;
      group.forEach((sample, idx) => {
        if (idx > 0) {
          sample.isDuplicate = true;
          sample.duplicateOf = group[0].id;
          sample.duplicateGroupId = groupId;
        }
        group[0].duplicateGroupId = groupId;
      });
      duplicateGroups.set(groupId, group);
    }
  });
  
  return duplicateGroups;
}

export function detectConflicts(sample: Sample): ConflictInfo | null {
  if (sample.modelExtraction === null && sample.importedLabel === null) {
    return {
      type: 'missing_ref',
      modelClaim: null,
      importedClaim: null,
      evidenceDiff: '模型未输出抽取结果，导入数据也无对应标注，该字段为空值。',
      suggestedActions: ['人工阅读合同条款后补充标注', '检查模型日志排查未输出原因'],
    };
  }

  if (sample.importedLabel === null) {
    return {
      type: 'missing_ref',
      modelClaim: sample.modelExtraction,
      importedClaim: null,
      evidenceDiff: '导入数据中缺少该条款的人工标注结果，无法自动核对',
      suggestedActions: ['人工复核模型抽取结果', '补充人工标注后再比对'],
    };
  }

  if (sample.manualLabel !== null && sample.manualLabel !== sample.modelExtraction) {
    return {
      type: 'manual_override',
      modelClaim: sample.modelExtraction,
      importedClaim: sample.importedLabel,
      evidenceDiff: `模型抽取结果为${sample.modelExtraction}，但人工标注为${sample.manualLabel}，存在差异。模型${sample.modelVersion || '版本未知'}可能存在处理问题。`,
      suggestedActions: ['确认人工标注正确后，将模型结果标记为错误', `建议算法团队排查${sample.modelVersion || '当前'}版本的处理逻辑`],
    };
  }

  if (sample.modelExtraction !== sample.importedLabel) {
    return {
      type: 'model_import_mismatch',
      modelClaim: sample.modelExtraction,
      importedClaim: sample.importedLabel,
      evidenceDiff: `模型从合同原文提取为${sample.modelExtraction}，但导入的人工标注库中记录为${sample.importedLabel}。两者存在差异，需核对原始合同。`,
      suggestedActions: ['点击证据链接查看合同原文确认', '如导入数据错误，修正人工标注库', '如模型理解错误，反馈算法团队'],
    };
  }

  if (sample.modelConfidence !== null && sample.modelThreshold !== null && sample.modelConfidence < sample.modelThreshold) {
    return null;
  }

  return null;
}

export function determineInitialStatus(sample: Sample): ReviewStatus {
  if (sample.isDuplicate) return 'pending';
  
  const conflict = detectConflicts(sample);
  if (conflict) {
    sample.conflictInfo = conflict;
    
    if (conflict.type === 'missing_ref') return 'need_review';
    if (conflict.type === 'manual_override') return 'rejected';
    if (conflict.type === 'model_import_mismatch') return 'conflict';
  }

  if (sample.modelConfidence !== null && sample.modelThreshold !== null && sample.modelConfidence < sample.modelThreshold) {
    return 'need_review';
  }

  return 'pending';
}

export function determineNewStatus(decision: ReviewDecision, currentStatus: ReviewStatus): ReviewStatus {
  switch (decision) {
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    case 'escalate':
      return 'need_review';
    default:
      return currentStatus;
  }
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusLabel(status: ReviewStatus): string {
  const labels: Record<ReviewStatus, string> = {
    pending: '待复核',
    approved: '已通过',
    rejected: '已驳回',
    conflict: '存在冲突',
    need_review: '需人工复核',
  };
  return labels[status];
}

export function getStatusColor(status: ReviewStatus): string {
  const colors: Record<ReviewStatus, string> = {
    pending: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    conflict: 'bg-orange-100 text-orange-800',
    need_review: 'bg-yellow-100 text-yellow-800',
  };
  return colors[status];
}

export function generateReviewId(): string {
  return `r-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
