import type { Annotation, SampleRecord, SelfCheckResult, ImportBatch } from '@/types';
import { createSelfCheckResult } from './factories';

export function checkDuplicateImport(
  batchId: string,
  newAnnotations: Annotation[],
  existingAnnotations: Annotation[],
): SelfCheckResult {
  const existingKeys = new Set(
    existingAnnotations.map((a) => `${a.subject}|${a.teacherId}|${a.score}|${a.denominator}`),
  );
  const duplicates = newAnnotations.filter((a) =>
    existingKeys.has(`${a.subject}|${a.teacherId}|${a.score}|${a.denominator}`),
  );
  const passed = duplicates.length === 0;
  const detail = passed
    ? '无重复导入项'
    : `发现 ${duplicates.length} 条重复记录：${duplicates.map((d) => `[${d.subject}/${d.teacherId}]`).join('、')}`;
  return createSelfCheckResult(batchId, 'duplicate_import', passed, detail);
}

export function checkDenominatorZeroEmpty(
  batchId: string,
  annotations: Annotation[],
): SelfCheckResult {
  const issues = annotations.filter(
    (a) => a.rawDenominator === '0' && (a.denominator === '' || a.denominator.trim() === ''),
  );
  const passed = issues.length === 0;
  const detail = passed
    ? '无分母为0空字符串项'
    : `发现 ${issues.length} 条分母为0却被填成空字符串的记录：${issues.map((i) => `[${i.subject}/${i.teacherId} rawDenominator="${i.rawDenominator}" denominator="${i.denominator}"]`).join('、')}——此类项不可自动归为正常，需数据复核人复核`;
  return createSelfCheckResult(batchId, 'denominator_zero_empty', passed, detail);
}

export function checkRecalcAfterSupplement(
  batchId: string,
  currentMedians: { subject: string; value: number }[],
  previousMedians: { subject: string; value: number }[],
  supplementAnnotations: Annotation[],
): SelfCheckResult {
  const supplementSubjects = new Set(supplementAnnotations.map((a) => a.subject));
  const mismatches: string[] = [];
  for (const curr of currentMedians) {
    if (!supplementSubjects.has(curr.subject)) continue;
    const prev = previousMedians.find((p) => p.subject === curr.subject);
    if (prev && prev.value === curr.value) {
      mismatches.push(`${curr.subject}: 补录后中位数仍为 ${curr.value}，未发生变化`);
    }
  }
  const passed = mismatches.length === 0;
  const detail = passed
    ? '补录后重算验证通过'
    : `补录后 ${mismatches.length} 个学科中位数未变化：${mismatches.join('；')}`;
  return createSelfCheckResult(batchId, 'recalc_after_supplement', passed, detail);
}

export function checkExportConsistency(
  batchId: string,
  displayData: { subject: string; median: number; alert: boolean }[],
  exportData: { subject: string; median: number; alert: boolean }[],
): SelfCheckResult {
  const mismatches: string[] = [];
  for (const d of displayData) {
    const e = exportData.find((ex) => ex.subject === d.subject);
    if (!e) {
      mismatches.push(`${d.subject}: 导出数据中缺失`);
    } else if (d.median !== e.median || d.alert !== e.alert) {
      mismatches.push(`${d.subject}: 展示值(${d.median}/${d.alert})≠导出值(${e.median}/${e.alert})`);
    }
  }
  const passed = mismatches.length === 0;
  const detail = passed
    ? '导出一致性验证通过'
    : `${mismatches.length} 条不一致：${mismatches.join('；')}`;
  return createSelfCheckResult(batchId, 'export_consistency', passed, detail);
}

export function runAllSelfChecks(
  batch: ImportBatch,
  newAnnotations: Annotation[],
  existingAnnotations: Annotation[],
  currentMedians: { subject: string; value: number }[],
  previousMedians: { subject: string; value: number }[],
  supplementAnnotations: Annotation[],
  displayData: { subject: string; median: number; alert: boolean }[],
  exportData: { subject: string; median: number; alert: boolean }[],
): SelfCheckResult[] {
  return [
    checkDuplicateImport(batch.id, newAnnotations, existingAnnotations),
    checkDenominatorZeroEmpty(batch.id, newAnnotations),
    checkRecalcAfterSupplement(batch.id, currentMedians, previousMedians, supplementAnnotations),
    checkExportConsistency(batch.id, displayData, exportData),
  ];
}
