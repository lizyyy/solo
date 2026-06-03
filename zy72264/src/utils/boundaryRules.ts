import type { SafetyRadiusRow, ChangeRecord, RowStatus } from '../types';

export function generateRowKey(row: {
  originalRowNumber: number;
  tunnelName: string;
  coordinateOrigin: string;
}): string {
  return `${row.originalRowNumber}+${row.tunnelName}+${row.coordinateOrigin}`;
}

export function checkDuplicate(
  row: SafetyRadiusRow,
  existingRows: SafetyRadiusRow[]
): boolean {
  const key = generateRowKey(row);
  return existingRows.some(
    (existing) => generateRowKey(existing) === key
  );
}

export function detectLengthMismatch(row: SafetyRadiusRow): {
  isAbnormal: boolean;
  reason: string;
} {
  if (row.length !== row.calculatedLength) {
    return { isAbnormal: true, reason: '补录路线没有重新计算长度' };
  }
  return { isAbnormal: false, reason: '' };
}

export function determineImportStatus(row: SafetyRadiusRow): RowStatus {
  const { isAbnormal } = detectLengthMismatch(row);
  return isAbnormal ? 'review' : 'pending';
}

export function canEdit(row: SafetyRadiusRow): boolean {
  return row.status !== 'archived';
}

export function canRollback(_changeRecord: ChangeRecord): boolean {
  return true;
}

export function validateRowData(data: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const requiredFields: (keyof SafetyRadiusRow)[] = [
    'originalRowNumber',
    'tunnelName',
    'coordinateOrigin',
    'radius',
    'length',
    'calculatedLength',
  ];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`字段 ${field} 为必填项`);
    }
  }

  if (
    data.radius !== undefined &&
    data.radius !== null &&
    Number(data.radius) <= 0
  ) {
    errors.push('安全半径必须大于0');
  }

  if (
    data.length !== undefined &&
    data.length !== null &&
    Number(data.length) < 0
  ) {
    errors.push('长度不能为负数');
  }

  if (
    data.calculatedLength !== undefined &&
    data.calculatedLength !== null &&
    Number(data.calculatedLength) < 0
  ) {
    errors.push('计算长度不能为负数');
  }

  return { valid: errors.length === 0, errors };
}

export const BOUNDARY_RULES_DOC = {
  dedupKey:
    '去重规则：以"原始行号+隧道名称+坐标原点"组合作为唯一标识，导入时自动检测重复行并跳过',
  lengthMismatch:
    '长度异常检测：若实际长度与计算长度不一致，标记为"待审核"状态，原因：补录路线没有重新计算长度',
  importStatus:
    '导入状态判定：长度正常的行默认状态为"待处理"，长度异常的行默认状态为"待审核"',
  editRestriction:
    '编辑限制：已归档的行不可编辑，需先取消归档才能修改',
  rollback:
    '回滚规则：所有变更记录均可回滚，回滚操作将字段值恢复为变更前的值，并生成回滚记录',
  validation:
    '数据校验：原始行号、隧道名称、坐标原点、安全半径、长度、计算长度为必填项；安全半径必须大于0；长度和计算长度不能为负数',
} as const;
