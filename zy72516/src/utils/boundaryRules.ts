import { AnnotationRecord, AbnormalType, RecordStatus } from '../types';

export const BOUNDARY_RULES_VERSION = '1.0.0';

export interface BoundaryRule {
  id: string;
  name: string;
  description: string;
  detect: (record: Partial<AnnotationRecord>) => boolean;
  suggestedStatus: RecordStatus;
  suggestedAbnormalType: AbnormalType;
  priority: number;
  allowRollback: boolean;
  rollbackTo?: RecordStatus;
}

export const boundaryRules: BoundaryRule[] = [
  {
    id: 'url_404_passed',
    name: '引用链接404仍被判通过',
    description: '当引用链接状态为404（无效），但机器人仍判断通过时，需标记为待产品经理复核，不得直接归为正常',
    detect: (record) => {
      const urlStatus = record.urlStatus;
      const robotJudgment = record.robotJudgment?.toLowerCase() || '';
      return urlStatus === false && (robotJudgment.includes('通过') || robotJudgment.includes('pass'));
    },
    suggestedStatus: RecordStatus.PM_REVIEW,
    suggestedAbnormalType: AbnormalType.URL_404_PASSED,
    priority: 1,
    allowRollback: true,
    rollbackTo: RecordStatus.PENDING
  },
  {
    id: 'wrong_criteria',
    name: '错口径',
    description: '标注员留言明确指出口径错误或不符合标准回复',
    detect: (record) => {
      const message = record.annotatorMessage?.toLowerCase() || '';
      return message.includes('错口径') || message.includes('口径错误') || message.includes('不符合标准');
    },
    suggestedStatus: RecordStatus.WRONG_CRITERIA,
    suggestedAbnormalType: AbnormalType.WRONG_CRITERIA,
    priority: 2,
    allowRollback: true,
    rollbackTo: RecordStatus.PENDING
  },
  {
    id: 'rework_needed',
    name: '补录返工',
    description: '标注员留言指出需要补录或返工',
    detect: (record) => {
      const message = record.annotatorMessage?.toLowerCase() || '';
      return message.includes('补录') || message.includes('返工') || message.includes('重新标注');
    },
    suggestedStatus: RecordStatus.REWORK,
    suggestedAbnormalType: AbnormalType.REWORK_NEEDED,
    priority: 2,
    allowRollback: true,
    rollbackTo: RecordStatus.PENDING
  }
];

export function applyBoundaryRules(
  record: Partial<AnnotationRecord>,
  operator: string
): Partial<Pick<AnnotationRecord, 'currentStatus' | 'abnormalType' | 'judgmentLogs' | 'updatedAt' | 'lastOperator'>> {
  const matchedRule = boundaryRules
    .sort((a, b) => a.priority - b.priority)
    .find(rule => rule.detect(record));

  if (matchedRule) {
    return {
      currentStatus: matchedRule.suggestedStatus,
      abnormalType: matchedRule.suggestedAbnormalType,
      updatedAt: new Date().toISOString(),
      lastOperator: operator
    };
  }

  return {
    currentStatus: RecordStatus.PENDING,
    abnormalType: AbnormalType.NONE,
    updatedAt: new Date().toISOString(),
    lastOperator: operator
  };
}

export function isRollbackAllowed(status: RecordStatus): boolean {
  const rule = boundaryRules.find(r => r.suggestedStatus === status);
  return rule?.allowRollback ?? true;
}

export function getRollbackTarget(status: RecordStatus): RecordStatus {
  const rule = boundaryRules.find(r => r.suggestedStatus === status);
  return rule?.rollbackTo ?? RecordStatus.PENDING;
}

export function getAllRuleDescriptions(): Array<{
  name: string;
  description: string;
  suggestedAction: string;
}> {
  return boundaryRules.map(rule => ({
    name: rule.name,
    description: rule.description,
    suggestedAction: rule.suggestedStatus
  }));
}
