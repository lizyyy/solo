import type { BendLossRecord, ConflictEntry, SelfCheckResult } from '@/types';

export function checkDuplicateImport(records: BendLossRecord[]): SelfCheckResult {
  const seen = new Map<string, string[]>();
  const details: string[] = [];
  for (const r of records) {
    const key = `${r.nameplateId}-${r.bendRadius}-${r.direction}-${r.lossValue}`;
    const existing = seen.get(key) || [];
    existing.push(r.id);
    seen.set(key, existing);
  }
  let passed = true;
  for (const [key, ids] of seen) {
    if (ids.length > 1) {
      passed = false;
      details.push(`重复记录: 键值 "${key}" 出现 ${ids.length} 次 (ID: ${ids.join(', ')})`);
    }
  }
  return {
    type: 'duplicate_import',
    passed,
    message: passed ? '无重复导入' : `发现 ${details.length} 组重复记录`,
    details,
  };
}

export function checkNegativeDirection(records: BendLossRecord[]): SelfCheckResult {
  const details: string[] = [];
  let passed = true;
  for (const r of records) {
    if (r.direction === '向左') {
      if (r.status !== 'pending_review' && r.status !== 'reviewed') {
        passed = false;
        details.push(`记录 ${r.id} 方向为"向左"但状态为 "${r.status}"，应为"待复核"或"已复核"`);
      }
    }
  }
  return {
    type: 'negative_direction',
    passed,
    message: passed ? '负方向标记正确' : `发现 ${details.length} 条负方向标记异常`,
    details,
  };
}

export function checkSupplementaryRecalc(records: BendLossRecord[]): SelfCheckResult {
  const details: string[] = [];
  let passed = true;
  for (const r of records) {
    if (r.isSupplementary && !r.supplementaryNote) {
      passed = false;
      details.push(`补录记录 ${r.id} 缺少补录说明`);
    }
    if (r.isSupplementary && r.status === 'normal') {
      passed = false;
      details.push(`补录记录 ${r.id} 状态为"正常"，补录后应触发重算`);
    }
  }
  return {
    type: 'supplementary_recalc',
    passed,
    message: passed ? '补录重算验证通过' : `发现 ${details.length} 条补录重算异常`,
    details,
  };
}

export function checkExportConsistency(records: BendLossRecord[], conflicts: ConflictEntry[]): SelfCheckResult {
  const details: string[] = [];
  let passed = true;
  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  if (pendingConflicts.length > 0) {
    passed = false;
    details.push(`存在 ${pendingConflicts.length} 条未裁决的冲突，导出数据可能不一致`);
  }
  const pendingReview = records.filter(r => r.status === 'pending_review');
  if (pendingReview.length > 0) {
    passed = false;
    details.push(`存在 ${pendingReview.length} 条待复核记录，导出数据可能不完整`);
  }
  return {
    type: 'export_consistency',
    passed,
    message: passed ? '导出一致性校验通过' : `发现 ${details.length} 项一致性问题`,
    details,
  };
}

export function runAllSelfChecks(
  records: BendLossRecord[],
  conflicts: ConflictEntry[]
): SelfCheckResult[] {
  return [
    checkDuplicateImport(records),
    checkNegativeDirection(records),
    checkSupplementaryRecalc(records),
    checkExportConsistency(records, conflicts),
  ];
}
