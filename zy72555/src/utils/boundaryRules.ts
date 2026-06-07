import type { TrainingLog, BoundaryRule } from '@/types';

export const OVERALL_THRESHOLD = 0.85;
export const MINORITY_RATIO_THRESHOLD = 0.8;

export function checkMinorityClassMasked(log: TrainingLog): boolean {
  return log.overallMetric >= OVERALL_THRESHOLD && 
         log.minorityMetric < OVERALL_THRESHOLD * MINORITY_RATIO_THRESHOLD;
}

export function applyBoundaryRules(log: TrainingLog): Partial<TrainingLog> {
  const updates: Partial<TrainingLog> = {};

  if (checkMinorityClassMasked(log)) {
    updates.isBoundaryCase = true;
    updates.boundaryReason = 'BR-001: 少数类样本被总指标盖住';
    updates.status = 'reviewing';
  }

  return updates;
}

export function canConfirmLog(log: TrainingLog): boolean {
  if (log.isBoundaryCase && log.status !== 'reviewing') {
    return false;
  }
  return true;
}

export const BOUNDARY_RULES: BoundaryRule[] = [
  {
    id: 'BR-001',
    name: '少数类样本被总指标盖住',
    description: `当总指标 >= ${OVERALL_THRESHOLD}，但少数类指标 < 总指标阈值 × ${MINORITY_RATIO_THRESHOLD} 时，自动标记为边界案例，状态设为"待复核"，不允许直接确认。需算法工程师人工复核。`,
    codeReference: 'src/utils/boundaryRules.ts#L8-L11',
    rollbackSteps: [
      '算法工程师在"训练日志管理"页找到标记为边界案例的记录',
      '点击"复核"按钮，查看原始行号和少数类指标明细',
      '确认无误后选择"确认通过"或"驳回"',
      '系统生成变更历史记录，状态流转为 confirmed 或 rejected'
    ]
  },
  {
    id: 'BR-002',
    name: '晚到材料刷新规则',
    description: '阈值调参笔记晚到补录时，仅刷新关联日志的阈值相关字段和备注，不覆盖已确认状态的日志的其他字段。已 confirmed 的记录保持其状态不变。',
    codeReference: 'src/store/useAppStore.ts',
    rollbackSteps: [
      '在"变更历史"页找到对应的更新操作',
      '点击"回滚"按钮',
      '系统将该条笔记关联的日志恢复到更新前的状态',
      '生成回滚操作的变更历史记录'
    ]
  },
  {
    id: 'BR-003',
    name: '重复导入去重规则',
    description: '基于 fileHash + originalLineNumber 作为唯一键。重复导入同一批训练日志时，已存在的行自动跳过，数量不翻倍。导入报告中明确显示新增、重复、跳过的数量。',
    codeReference: 'src/utils/deduplication.ts',
    rollbackSteps: [
      '在"训练日志管理"页按导入批次筛选',
      '选择需要撤销的导入批次',
      '点击"撤销导入"，删除该批次新增的记录',
      '保留变更历史以供审计'
    ]
  }
];
