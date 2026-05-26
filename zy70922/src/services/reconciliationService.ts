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
  
  const allSamples = await getAll<SampleRecord>(`SELECT * FROM sample_records`);
  
  const sampleNoMap = new Map<string, SampleRecord[]>();

  for (const sample of allSamples) {
    if (!sampleNoMap.has(sample.sample_no)) {
      sampleNoMap.set(sample.sample_no, []);
    }
    sampleNoMap.get(sample.sample_no)!.push(sample);
  }

  const currentBatchSampleNos = new Set(samples.map(s => s.sample_no));

  for (const [sampleNo, records] of sampleNoMap) {
    if (!currentBatchSampleNos.has(sampleNo)) continue;
    
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

  const allItems = await getAll<InspectionItem>(`SELECT * FROM inspection_items`);

  for (const retestItem of retestItems) {
    const originalItem = allItems.find(i => i.id === retestItem.retest_of);
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

export async function detectReportWithdrawn(
  samples: SampleRecord[],
  items: InspectionItem[],
  context: ReconciliationContext
): Promise<Discrepancy[]> {
  const discrepancies: Discrepancy[] = [];

  for (const sample of samples) {
    try {
      const rawData = sample.raw_data ? JSON.parse(sample.raw_data) : {};
      
      if (rawData.withdrawn || rawData.report_withdrawn || rawData.status === 'withdrawn') {
        discrepancies.push({
          id: uuidv4(),
          reconciliation_id: context.reconciliationId,
          sample_no: sample.sample_no,
          batch_id: context.batchId,
          type: 'report_withdrawn',
          severity: 'high',
          description: `样品 ${sample.sample_no} 的原报告已被撤回，需重新检测或补充材料`,
          source_field: 'raw_data',
          expected_value: '报告有效',
          actual_value: '报告已撤回',
          evidence: JSON.stringify({
            sampleId: sample.id,
            withdrawnReason: rawData.withdrawn_reason || rawData.reason || '未提供原因',
            withdrawnAt: rawData.withdrawn_at || sample.updated_at,
          }),
          requires_manual_review: true,
          resolved: false,
          created_at: new Date().toISOString(),
        });
      }

      const sampleItems = items.filter(i => i.sample_no === sample.sample_no);
      for (const item of sampleItems) {
        try {
          const itemRawData = item.raw_data ? JSON.parse(item.raw_data) : {};
          if (itemRawData.withdrawn || itemRawData.report_withdrawn) {
            discrepancies.push({
              id: uuidv4(),
              reconciliation_id: context.reconciliationId,
              sample_no: sample.sample_no,
              batch_id: context.batchId,
              type: 'report_withdrawn',
              severity: 'high',
              description: `样品 ${sample.sample_no} 的 ${item.item_name} 检测报告已被撤回`,
              source_field: 'raw_data',
              expected_value: '报告有效',
              actual_value: '报告已撤回',
              evidence: JSON.stringify({
                itemId: item.id,
                itemName: item.item_name,
                withdrawnReason: itemRawData.withdrawn_reason || '未提供原因',
              }),
              requires_manual_review: true,
              resolved: false,
              created_at: new Date().toISOString(),
            });
          }
        } catch {
          // 忽略解析错误
        }
      }
    } catch {
      // 忽略解析错误
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

  const existingResolved = await getAll<Discrepancy>(
    `SELECT * FROM discrepancies WHERE reconciliation_id = ? AND resolved = 1`,
    [reconciliationId]
  );

  const resolvedKeySet = new Set(
    existingResolved.map(d => `${d.sample_no}:${d.type}:${d.source_field || ''}`)
  );

  const allDiscrepancies: Discrepancy[] = [];
  let matchedCount = 0;
  let mismatchedCount = 0;

  await runQuery(`DELETE FROM discrepancies WHERE reconciliation_id = ? AND resolved = 0`, [reconciliationId]);

  const mixedBatchDiscrepancies = await detectMixedBatch(samples, context);
  allDiscrepancies.push(...mixedBatchDiscrepancies);

  const retestWindowDiscrepancies = await checkRetestWindow(allItems, context);
  allDiscrepancies.push(...retestWindowDiscrepancies);

  const reportWithdrawnDiscrepancies = await detectReportWithdrawn(samples, allItems, context);
  allDiscrepancies.push(...reportWithdrawnDiscrepancies);

  for (const sample of samples) {
    const result = await matchSampleWithInspection(sample, allItems, context);
    allDiscrepancies.push(...result.discrepancies);
  }

  const preservedDiscrepancies: Discrepancy[] = [];
  for (const d of allDiscrepancies) {
    const key = `${d.sample_no}:${d.type}:${d.source_field || ''}`;
    if (resolvedKeySet.has(key)) {
      const existing = existingResolved.find(
        ed => ed.sample_no === d.sample_no && ed.type === d.type && ed.source_field === d.source_field
      );
      if (existing) {
        preservedDiscrepancies.push({ ...d, ...existing, id: existing.id });
        continue;
      }
    }
    preservedDiscrepancies.push(d);
  }

  const sampleUnresolvedDiscrepancies = new Map<string, Discrepancy[]>();
  for (const d of preservedDiscrepancies) {
    if (!d.resolved) {
      if (!sampleUnresolvedDiscrepancies.has(d.sample_no)) {
        sampleUnresolvedDiscrepancies.set(d.sample_no, []);
      }
      sampleUnresolvedDiscrepancies.get(d.sample_no)!.push(d);
    }
  }

  const reviewedSamples = await getAll<{ sample_no: string; new_status: string }>(
    `SELECT sample_no, MAX(new_status) as new_status FROM review_records 
     WHERE reconciliation_id = ? GROUP BY sample_no`,
    [reconciliationId]
  );
  const reviewedStatusMap = new Map<string, string>();
  for (const r of reviewedSamples) {
    reviewedStatusMap.set(r.sample_no, r.new_status);
  }

  for (const sample of samples) {
    const reviewedStatus = reviewedStatusMap.get(sample.sample_no);
    const unresolved = sampleUnresolvedDiscrepancies.get(sample.sample_no) || [];
    
    if (reviewedStatus && (reviewedStatus === 'approved' || reviewedStatus === 'supplement' || reviewedStatus === 'rejected')) {
      if (reviewedStatus === 'approved') {
        matchedCount++;
      } else {
        mismatchedCount++;
      }
      await runQuery(
        `UPDATE sample_records SET status = ?, updated_at = ? WHERE id = ?`,
        [reviewedStatus, new Date().toISOString(), sample.id]
      );
    } else if (unresolved.length === 0) {
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

  for (const d of preservedDiscrepancies) {
    const existing = existingResolved.find(ed => ed.id === d.id);
    if (existing) {
      await runQuery(
        `UPDATE discrepancies SET 
         description = ?, severity = ?, expected_value = ?, actual_value = ?, evidence = ?
         WHERE id = ?`,
        [d.description, d.severity, d.expected_value, d.actual_value, d.evidence, d.id]
      );
    } else {
      await runQuery(
        `INSERT INTO discrepancies 
         (id, reconciliation_id, sample_no, batch_id, type, severity, description,
          source_field, expected_value, actual_value, evidence, requires_manual_review,
          resolved, resolved_by, resolved_at, resolution_note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, d.reconciliation_id, d.sample_no, d.batch_id, d.type, d.severity,
         d.description, d.source_field, d.expected_value, d.actual_value, d.evidence,
         d.requires_manual_review ? 1 : 0, d.resolved ? 1 : 0,
         d.resolved_by || null, d.resolved_at || null, d.resolution_note || null,
         d.created_at]
      );
    }
  }

  const resolvedCount = preservedDiscrepancies.filter(d => d.resolved).length;

  await runQuery(
    `UPDATE reconciliations SET 
     status = 'completed',
     total_samples = ?,
     matched_samples = ?,
     mismatched_samples = ?,
     pending_samples = 0,
     discrepancies_count = ?,
     resolved_discrepancies = ?,
     updated_at = ?
     WHERE id = ?`,
    [samples.length, matchedCount, mismatchedCount, preservedDiscrepancies.length,
     resolvedCount, new Date().toISOString(), reconciliationId]
  );

  return {
    totalSamples: samples.length,
    matchedSamples: matchedCount,
    mismatchedSamples: mismatchedCount,
    discrepancies: preservedDiscrepancies,
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
