import type { Workorder, SparePart, RecallRecord, FullDataset } from '@/types';
import { runAllChecks, hasException } from './detector';

export function nowISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export interface ImportMergeResult {
  workorders: Workorder[];
  spare_parts: SparePart[];
  recall_records: RecallRecord[];
  duplicateCount: number;
  preservedNotes: number;
  newRecalls: RecallRecord[];
}

export function mergeImport(
  existing: FullDataset,
  incoming: FullDataset,
): ImportMergeResult {
  const woMap = new Map<string, Workorder>(existing.workorders.map(w => [w.id, w]));
  let duplicateCount = 0;
  let preservedNotes = 0;

  for (const w of incoming.workorders) {
    const old = woMap.get(w.id);
    if (old) {
      duplicateCount += 1;
      const { handover_note: _keep, ...updatable } = w;
      if (old.handover_note && old.handover_note !== w.handover_note) {
        preservedNotes += 1;
      }
      woMap.set(w.id, {
        ...old,
        ...updatable,
        handover_note: old.handover_note || w.handover_note,
        is_duplicate: true,
        updated_at: nowISO(),
      });
    } else {
      woMap.set(w.id, { ...w, is_duplicate: false, created_at: w.created_at || nowISO(), updated_at: nowISO() });
    }
  }

  const incomingPartIds = new Set(incoming.spare_parts.map(p => p.id));
  const parts = [
    ...existing.spare_parts.filter(p => !incomingPartIds.has(p.id)),
    ...incoming.spare_parts,
  ];

  const incomingRecallIds = new Set(incoming.recall_records.map(r => r.id));
  const recalls = [
    ...existing.recall_records.filter(r => !incomingRecallIds.has(r.id)),
    ...incoming.recall_records,
  ];

  const newRecalls = autoGenerateRecalls(incoming.workorders, incoming.spare_parts);
  const allRecalls = mergeRecalls(recalls, newRecalls);

  return {
    workorders: Array.from(woMap.values()),
    spare_parts: parts,
    recall_records: allRecalls,
    duplicateCount,
    preservedNotes,
    newRecalls,
  };
}

function mergeRecalls(existing: RecallRecord[], incoming: RecallRecord[]): RecallRecord[] {
  const key = (r: RecallRecord) => `${r.workorder_id}:${r.category}:${r.fields_involved}`;
  const map = new Map<string, RecallRecord>();
  for (const r of existing) map.set(key(r), r);
  for (const r of incoming) {
    if (!map.has(key(r))) map.set(key(r), r);
  }
  return Array.from(map.values());
}

export function autoGenerateRecalls(
  workorders: Workorder[],
  parts: SparePart[],
): RecallRecord[] {
  const recalls: RecallRecord[] = [];
  const woIndex = new Map(workorders.map(w => [w.id, w]));

  for (const sp of parts) {
    const checks = runAllChecks(sp);
    if (!hasException(checks)) continue;
    const wo = woIndex.get(sp.workorder_id);

    if (checks.formula) {
      recalls.push(buildRecall(sp, '公式问题', checks.formula, wo));
    }
    if (checks.unit) {
      recalls.push(buildRecall(sp, '单位问题', checks.unit, wo));
    }
    if (checks.threshold) {
      recalls.push(buildRecall(sp, '阈值问题', checks.threshold, wo));
    }
  }
  return recalls;
}

function buildRecall(
  sp: SparePart,
  category: '公式问题' | '单位问题' | '阈值问题',
  detail: string,
  wo?: Workorder,
): RecallRecord {
  const originals: Record<string, string> = {
    公式问题: `申报数量=${sp.req_qty}, 出库数量=${sp.act_qty}, 单价=${sp.price}`,
    单位问题: `当前单位=${sp.unit}`,
    阈值问题: `申报数量=${sp.req_qty}, 出库数量=${sp.act_qty}, 单价=${sp.price}`,
  };
  const corrects: Record<string, string> = {
    公式问题: '所有数值字段应为 ≥ 0 的数字',
    单位问题: '根据备件名匹配：螺栓→个、密封→个/套、油管→米、油脂→公斤、焊丝→卷',
    阈值问题: '申报≤1000、高值件(>10万)≤10件、主轴承≤2个、出库≤申报×1.5',
  };
  return {
    id: uid('recall'),
    workorder_id: sp.workorder_id,
    recall_time: nowISO(),
    category,
    fields_involved: `备件「${sp.part_name}」相关字段`,
    detail: detail + (wo ? `（工单 ${wo.id}）` : ''),
    original_value: originals[category],
    correct_example: corrects[category],
    process_status: '待处理',
    process_remark: '',
    process_by: '',
    process_time: '',
    safety_confirmed: false,
    safety_by: '',
    safety_time: '',
  };
}
