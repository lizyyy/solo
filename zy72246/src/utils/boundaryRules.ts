import { ProcessingStatus, TaxNote, BoundaryRule, ImportRowData } from '@/types';

export const BOUNDARY_RULES: BoundaryRule[] = [
  {
    id: 'RULE_001',
    name: '金额为0但备注含冲正',
    description: '当税费金额为0但备注中包含"冲正"关键词时，不归为正常状态，需风控复核',
    condition: 'amount === 0 && remark.includes("冲正")',
    action: '设置状态为 REVERSAL_PENDING_REVIEW，推送风控复核队列',
    rollbackMethod: '恢复到上一状态，清除风控标记',
    codeReference: 'src/utils/boundaryRules.ts#L25-L40',
    status: 'ACTIVE',
  },
  {
    id: 'RULE_002',
    name: '重复导入检测',
    description: '基于业务主键（交易日期+证券代码+流水号）检测重复导入',
    condition: '业务主键已存在于数据库中',
    action: '对比字段变更，有变更则创建新版本，记录变更历史',
    rollbackMethod: '回滚到指定历史版本',
    codeReference: 'src/utils/boundaryRules.ts#L42-L60',
    status: 'ACTIVE',
  },
  {
    id: 'RULE_003',
    name: '三步流程强制流转',
    description: '状态变更必须符合三步流程顺序，禁止跳步',
    condition: '状态变更不符合预设的状态机流转路径',
    action: '拒绝状态变更，提示错误信息',
    rollbackMethod: '无（前置校验不通过）',
    codeReference: 'src/utils/stateMachine.ts',
    status: 'ACTIVE',
  },
  {
    id: 'RULE_004',
    name: '柜台流水尾号备注对齐',
    description: '补看柜台流水尾号时，尾号信息应追加到当前备注末尾，保持备注和尾号一致',
    condition: 'counterTailNumber有值但备注中未包含该尾号',
    action: '自动将"柜台尾号XXX"追加到当前备注，创建版本记录',
    rollbackMethod: '回滚备注到上一版本',
    codeReference: 'src/utils/boundaryRules.ts#alignCounterTailRemark',
    status: 'ACTIVE',
  },
  {
    id: 'RULE_005',
    name: '冲正记录流转限制',
    description: '金额为0且备注含冲正的记录，不得直接进入余额更新或摘要更新，必须先经风控复核通过',
    condition: 'amount===0 && remark含冲正 && processingStatus===REVERSAL_PENDING_REVIEW && 目标状态不是NORMAL或REJECTED',
    action: '拒绝状态变更，提示需先经风控复核',
    rollbackMethod: '无（前置校验不通过）',
    codeReference: 'src/utils/boundaryRules.ts#checkBalanceUpdatePrerequisite',
    status: 'ACTIVE',
  },
];

export function checkReversalRule(amount: number, remark: string): boolean {
  return amount === 0 && remark.includes('冲正');
}

export function determineInitialStatus(rowData: ImportRowData): ProcessingStatus {
  if (checkReversalRule(rowData.amount, rowData.remark)) {
    return ProcessingStatus.REVERSAL_PENDING_REVIEW;
  }
  return ProcessingStatus.PENDING;
}

export function generateBusinessKey(tradeDate: string, stockCode: string, serialNumber: string): string {
  return `${tradeDate}_${stockCode}_${serialNumber}`;
}

export function detectFieldChanges(
  existing: TaxNote,
  newData: Partial<TaxNote>
): Array<{ field: string; oldValue: string; newValue: string }> {
  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];
  const editableFields: (keyof TaxNote)[] = [
    'currentRemark',
    'currentAmount',
    'counterTailNumber',
    'summary',
  ];

  for (const field of editableFields) {
    if (newData[field] !== undefined && newData[field] !== existing[field]) {
      changes.push({
        field: field as string,
        oldValue: String(existing[field]),
        newValue: String(newData[field]),
      });
    }
  }

  return changes;
}

export function getBoundaryRules(): BoundaryRule[] {
  return BOUNDARY_RULES.filter(rule => rule.status === 'ACTIVE');
}

export function alignCounterTailRemark(currentRemark: string, counterTailNumber: string): string {
  if (!counterTailNumber) return currentRemark;
  if (currentRemark.includes(counterTailNumber)) return currentRemark;
  const suffix = ` 柜台尾号${counterTailNumber}`;
  if (currentRemark.includes('柜台尾号')) {
    return currentRemark.replace(/柜台尾号\S*/, `柜台尾号${counterTailNumber}`);
  }
  return currentRemark + suffix;
}

export interface BalanceCheckResult {
  canProceed: boolean;
  reason: string;
  ruleId?: string;
}

export function checkBalanceUpdatePrerequisite(taxNote: TaxNote): BalanceCheckResult {
  if (taxNote.processingStatus === ProcessingStatus.REVERSAL_PENDING_REVIEW
      && taxNote.currentAmount === 0
      && (taxNote.originalRemark.includes('冲正') || taxNote.currentRemark.includes('冲正'))) {
    return {
      canProceed: false,
      reason: '该记录为冲正待复核状态，需先经风控复核通过后方可继续后续流程',
      ruleId: 'RULE_005',
    };
  }

  if (!taxNote.counterTailNumber) {
    return {
      canProceed: false,
      reason: '该记录尚未补看柜台流水尾号，请先完成补看流水步骤',
      ruleId: 'RULE_004',
    };
  }

  return { canProceed: true, reason: '' };
}

export function isReversalRecord(taxNote: TaxNote): boolean {
  return taxNote.currentAmount === 0
    && (taxNote.originalRemark.includes('冲正') || taxNote.currentRemark.includes('冲正'));
}
