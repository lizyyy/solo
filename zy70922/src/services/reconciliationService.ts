import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll } from '../database';
import { SampleRecord, InspectionItem, Discrepancy, DiscrepancyType } from '../types';
import { getRetestRulesForItem } from './retestRuleService';

export interface ReconciliationContext {
  reconciliationId: string;
  batchId: string;
}

export interface MatchResult {
  sample: SampleRecord;
  items: InspectionItem[];
  matched: boolean;
  discrepancies: Discrepancy[];
}

export async function getSamplesByBatch(batchId: string): Promise<SampleRecord[]> {
  return getAll<SampleRecord>(`SELECT * FROM sample_records WHERE batch_id = ?`, [batchId]);
}

export async function getInspectionItemsByBatch(batchId: string): Promise<InspectionItem[]> {
  return getAll<InspectionItem>(`SELECT * FROM inspection_items WHERE batch_id = ?`, [batchId]);
}

export async function getInspectionItemsBySample(sampleNo: string, batchId: string): Promise<InspectionItem[]> {
  return getAll<InspectionItem>(
    `SELECT * FROM inspection_items WHERE sample_no = ? AND batch_id = ? ORDER BY created_at`,
    [sampleNo, batchId]
  );
}

function parseValue(value: string): number | null {
  if (!value || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function compareValue(actual: string, standard: string): { pass: boolean; reason?: string } {
  const actualNum = parseValue(actual);
  const standardNum = parseValue(standard);

  if (actualNum !== null && standardNum !== null) {
    return { pass: actualNum <= standardNum };
  }

  const stdLower = standard.toLowerCase();
  const actLower = actual.toLowerCase();

  if (stdLower.includes('阴性') || stdLower.includes('negative')) {
    return { pass: actLower.includes('阴性') || actLower.includes('negative') || actLower.includes('未检出') };
  }

  if (stdLower.includes('阳性') || stdLower.includes('positive')) {
    return { pass: actLower.includes('阳性') || actLower.includes('positive') };
  }

  if (stdLower.includes('≤') || stdLower.includes('<=')) {
    const threshold = parseValue(stdLower.replace(/[≤<=]/g, ''));
    if (threshold !== null && actualNum !== null) {
      return { pass: actualNum <= threshold };
    }
  }

  if (stdLower.includes('≥') || stdLower.includes('>=')) {
    const threshold = parseValue(stdLower.replace(/[≥>=]/g, ''));
    if (threshold !== null && actualNum !== null) {
      return { pass: actualNum >= threshold };
    }
  }

  return { pass: actual === standard, reason: '文本值不匹配' };
}

export async function detectMixedBatch(
  samples: SampleRecord[],
  context: ReconciliationContext
): Promise<Discrepancy[]> {
  const discrepancies: Discrepancy[] = [];
  const sampleNoMap = new Map<string, SampleRecord[]>();

  for (const sample of samples) {
    if (!sampleNoMap.has(sample.sample_no)) {
      sampleNoMap.set(sample.sample_no, []);
    }
    sampleNoMap.get(sample.sample_no)!.push(sample);
  }

  for (const [sampleNo, records] of sampleNoMap) {
    if (records.length > 1) {
      const batches = records.map(r => r.batch_id).filter((v, i, a) => a.indexOf(v) === i);
      if (batches.length > 1) {
        discrepancies.push({
          id: uuidv4(),
          reconciliation_id: context.reconciliationId,
          sample_no: sampleNo,
          batch_id: context.batchId,
          type: 'mixed_batch',
          severity: 'high',
          description: `样品 ${sampleNo} 存在混批情况，涉及批次: ${batches.join(', ')}`,
          source_field: 'sample_no,batch_id',
          expected_value: batches[0],
          actual_value: batches.join(','),
          evidence: JSON.stringify({ sampleNos: records.map(r => r.id), batches }),
          requires_manual_review: true,
          resolved: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  return discrepancies;
}

export async function checkRetestWindow(
  items: InspectionItem[],
  context: ReconciliationContext
): Promise<Discrepancy[]> {
  const discrepancies: Discrepancy[] = [];
  const retestItems = items.filter(item => item.is_retest && item.retest_of);

  for (const retestItem of retestItems) {
    const originalItem = items.find(i => i.id === retestItem.retest_of);
    if (!originalItem) continue;

    const rules = await getRetestRulesForItem(retestItem.item_code);
    for (const rule of rules) {
      const originalDate = new Date(originalItem.inspection_date || originalItem.created_at);
      const retestDate = new Date(retestItem.inspection_date || retestItem.created_at);
      const hoursDiff = (retestDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > rule.retest_window_hours) {
        discrepancies.push({
          id: uuidv4(),
          reconciliation_id: context.reconciliationId,
          sample_no: retestItem.sample_no,
          batch_id: context.batchId,
          type: 'retest_window',
          severity: 'medium',
          description: `样品 ${retestItem.sample_no} 的 ${retestItem.item_name} 复检超出规定时间窗口`,
          source_field: 'inspection_date',
          expected_value: `≤${rule.retest_window_hours}小时`,
          actual_value: `${hoursDiff.toFixed(1)}小时`,
          evidence: JSON.stringify({
            rule: rule.rule_code,
            originalDate: originalItem.inspection_date,
            retestDate: retestItem.inspection_date,
            hoursDiff,
            allowedWindow: rule.retest_window_hours,
          }),
          requires_manual_review: true,
          resolved: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  return discrepancies;
}

export async function matchSampleWithInspection(
  sample: SampleRecord,
  items: InspectionItem[],
  context: ReconciliationContext
): Promise<MatchResult> {
  const discrepancies: Discrepancy[] = [];
  const sampleItems = items.filter(item => item.sample_no === sample.sample_no);

  if (sampleItems.length === 0) {
    discrepancies.push({
      id: uuidv4(),
      reconciliation_id: context.reconciliationId,
      sample_no: sample.sample_no,
      batch_id: sample.batch_id,
      type: 'missing_data',
      severity: 'high',
      description: `样品 ${sample.sample_no} 未找到对应的检测项目数据`,
      source_field: 'sample_no',
      expected_value: '存在检测项目',
      actual_value: '无检测项目',
      evidence: JSON.stringify({ sampleId: sample.id }),
      requires_manual_review: true,
      resolved: false,
      created_at: new Date().toISOString(),
    });
    return { sample, items: sampleItems, matched: false, discrepancies };
  }

  for (const item of sampleItems) {
    if (item.result === 'fail') {
      const comparison = compareValue(item.actual_value, item.standard_value);
      if (!comparison.pass) {
        discrepancies.push({
          id: uuidv4(),
          reconciliation_id: context.reconciliationId,
          sample_no: sample.sample_no,
          batch_id: sample.batch_id,
          type: 'value_out_of_range',
          severity: 'medium',
          description: `样品 ${sample.sample_no} 的 ${item.item_name} 检测值超出标准范围`,
          source_field: 'actual_value',
          expected_value: item.standard_value,
          actual_value: item.actual_value,
          evidence: JSON.stringify({
            itemCode: item.item_code,
            standard: item.standard_value,
            actual: item.actual_value,
            unit: item.unit,
          }),
          requires_manual_review: true,
          resolved: false,
          created_at: new Date().toISOString(),
        });
      }
    }

    const rules = await getRetestRulesForItem(item.item_code);
    for (const rule of rules) {
      if (rule.fail_threshold && item.result === 'fail') {
        const thresholdMatch = compareValue(item.actual_value, rule.fail_threshold);
        if (!thresholdMatch.pass && !item.is_retest) {
          discrepancies.push({
            id: uuidv4(),
            reconciliation_id: context.reconciliationId,
            sample_no: sample.sample_no,
            batch_id: sample.batch_id,
            type: 'project_mismatch',
            severity: 'medium',
            description: `样品 ${sample.sample_no} 的 ${item.item_name} 触发复检规则但未进行复检`,
            source_field: 'result',
            expected_value: `复检 (规则: ${rule.rule_code})`,
            actual_value: '未复检',
            evidence: JSON.stringify({
              rule: rule.rule_code,
              ruleName: rule.rule_name,
              failThreshold: rule.fail_threshold,
              actualValue: item.actual_value,
            }),
            requires_manual_review: true,
            resolved: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  return {
    sample,
    items: sampleItems,
    matched: discrepancies.length === 0,
    discrepancies,
  };
}

export async function performReconciliation(
  reconciliationId: string,
  batchId: string
): Promise<{
  totalSamples: number;
  matchedSamples: number;
  mismatchedSamples: number;
  discrepancies: Discrepancy[];
}> {
  const context: ReconciliationContext = { reconciliationId, batchId };

  const samples = await getSamplesByBatch(batchId);
  const allItems = await getInspectionItemsByBatch(batchId);

  const allDiscrepancies: Discrepancy[] = [];
  let matchedCount = 0;
  let mismatchedCount = 0;

  await runQuery(`DELETE FROM discrepancies WHERE reconciliation_id = ?`, [reconciliationId]);

  const mixedBatchDiscrepancies = await detectMixedBatch(samples, context);
  allDiscrepancies.push(...mixedBatchDiscrepancies);

  const retestWindowDiscrepancies = await checkRetestWindow(allItems, context);
  allDiscrepancies.push(...retestWindowDiscrepancies);

  for (const sample of samples) {
    const result = await matchSampleWithInspection(sample, allItems, context);
    allDiscrepancies.push(...result.discrepancies);

    if (result.discrepancies.length === 0) {
      matchedCount++;
      await runQuery(
        `UPDATE sample_records SET status = 'matched', updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), sample.id]
      );
    } else {
      mismatchedCount++;
      await runQuery(
        `UPDATE sample_records SET status = 'mismatch', updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), sample.id]
      );
    }
  }

  for (const d of allDiscrepancies) {
    await runQuery(
      `INSERT INTO discrepancies 
       (id, reconciliation_id, sample_no, batch_id, type, severity, description,
        source_field, expected_value, actual_value, evidence, requires_manual_review,
        resolved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.id, d.reconciliation_id, d.sample_no, d.batch_id, d.type, d.severity,
       d.description, d.source_field, d.expected_value, d.actual_value, d.evidence,
       d.requires_manual_review ? 1 : 0, d.resolved ? 1 : 0, d.created_at]
    );
  }

  await runQuery(
    `UPDATE reconciliations SET 
     status = 'completed',
     total_samples = ?,
     matched_samples = ?,
     mismatched_samples = ?,
     pending_samples = 0,
     discrepancies_count = ?,
     resolved_discrepancies = 0,
     updated_at = ?
     WHERE id = ?`,
    [samples.length, matchedCount, mismatchedCount, allDiscrepancies.length,
     new Date().toISOString(), reconciliationId]
  );

  return {
    totalSamples: samples.length,
    matchedSamples: matchedCount,
    mismatchedSamples: mismatchedCount,
    discrepancies: allDiscrepancies,
  };
}

export async function getDiscrepancies(reconciliationId: string): Promise<Discrepancy[]> {
  return getAll<Discrepancy>(
    `SELECT * FROM discrepancies WHERE reconciliation_id = ? ORDER BY severity DESC, created_at`,
    [reconciliationId]
  );
}

export async function getDiscrepanciesBySample(
  reconciliationId: string,
  sampleNo: string
): Promise<Discrepancy[]> {
  return getAll<Discrepancy>(
    `SELECT * FROM discrepancies WHERE reconciliation_id = ? AND sample_no = ? ORDER BY severity DESC`,
    [reconciliationId, sampleNo]
  );
}
