import type { EvidenceChainNode, OperationType } from '@/types';

export interface ChainStep {
  operationType: OperationType;
  stepName: string;
  operator: string;
}

export const WORKFLOW_STEPS: ChainStep[] = [
  { operationType: 'import_photo', stepName: '导入工况照片', operator: '业务人员' },
  { operationType: 'review_note', stepName: '林老师审阅巡检备注', operator: '林老师' },
  { operationType: 'unit_conversion', stepName: '单位换算口径更新', operator: '系统自动' },
  { operationType: 'data_cleaning', stepName: '数据清洗', operator: '系统自动' },
  { operationType: 'conflict_resolution', stepName: '证据冲突裁决', operator: '裁决人员' },
  { operationType: 'threshold_review', stepName: '超阈值记录复核', operator: '复核人员' },
];

export const createEvidenceChainNode = (
  recordId: string,
  operationType: OperationType,
  description: string,
  operator: string,
  evidenceRefs: string[]
): EvidenceChainNode => {
  return {
    id: `CHAIN-${recordId}-${operationType}-${Date.now()}`,
    recordId,
    operationType,
    description,
    operateTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
    operator,
    evidenceRefs,
  };
};

export const createWorkflowChain = (
  recordId: string,
  operationType: OperationType,
  additionalDetail: string = '',
  evidenceRefs: string[] = []
): EvidenceChainNode => {
  const stepInfo = WORKFLOW_STEPS.find(s => s.operationType === operationType);
  if (!stepInfo) {
    throw new Error(`未知工作流步骤: ${operationType}`);
  }

  return createEvidenceChainNode(
    recordId,
    operationType,
    additionalDetail || `${stepInfo.stepName}完成`,
    stepInfo.operator,
    evidenceRefs
  );
};

export const generateEvidenceId = (type: 'photo' | 'note' | 'conv' | 'alert'): string => {
  const prefix = { photo: 'PHOTO', note: 'NOTE', conv: 'CONV', alert: 'ALERT' };
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix[type]}-${timestamp}-${random}`;
};

export const formatEvidenceChainForDisplay = (
  chain: EvidenceChainNode[]
): { step: string; title: string; detail: string; operator: string; time: string; evidence: string }[] => {
  return chain
    .sort((a, b) => a.operateTime.localeCompare(b.operateTime))
    .map(node => ({
      step: node.operationType,
      title: WORKFLOW_STEPS.find(s => s.operationType === node.operationType)?.stepName ?? node.operationType,
      detail: node.description,
      operator: node.operator,
      time: node.operateTime,
      evidence: node.evidenceRefs.join(', '),
    }));
};

export const getEvidenceTypeLabel = (reference: string): string => {
  if (reference.startsWith('PHOTO')) return '工况照片';
  if (reference.startsWith('NOTE')) return '手写备注';
  if (reference.startsWith('CONV')) return '换算记录';
  if (reference.startsWith('ALERT')) return '超阈值告警';
  return '其他证据';
};

export const verifyEvidenceChain = (
  chain: EvidenceChainNode[],
  requiredTypes: OperationType[] = ['import_photo', 'review_note', 'unit_conversion']
): { complete: boolean; missingSteps: OperationType[] } => {
  const presentTypes = new Set(chain.map(n => n.operationType));
  const missingSteps: OperationType[] = [];

  for (const type of requiredTypes) {
    if (!presentTypes.has(type)) {
      missingSteps.push(type);
    }
  }

  return {
    complete: missingSteps.length === 0,
    missingSteps,
  };
};

export const getChainSummary = (chain: EvidenceChainNode[]): string => {
  if (chain.length === 0) return '暂无证据链记录';

  const operators = [...new Set(chain.map(n => n.operator))];
  const steps = chain.length;

  return `共 ${steps} 步操作，涉及 ${operators.join('、')}`;
};

export const createConflictResolutionChainNode = (
  recordId: string,
  conflictId: string,
  resolution: string,
  resolvedBy: string,
  note?: string
): EvidenceChainNode => {
  return createEvidenceChainNode(
    recordId,
    'conflict_resolution',
    `冲突 ${conflictId} 处理结果：${resolution}${note ? `，备注：${note}` : ''}`,
    resolvedBy,
    [conflictId]
  );
};

export const createThresholdReviewChainNode = (
  recordId: string,
  alertId: string,
  reviewResult: string,
  reviewedBy: string,
  comment?: string
): EvidenceChainNode => {
  return createEvidenceChainNode(
    recordId,
    'threshold_review',
    `告警 ${alertId} 复核结果：${reviewResult}${comment ? `，备注：${comment}` : ''}`,
    reviewedBy,
    [alertId]
  );
};
