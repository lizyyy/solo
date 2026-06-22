import type { Workorder, SparePart, HandoverStatus, RecallRecord } from '@/types';

interface RecallSummary {
  blocking: RecallRecord[];
  resolved: RecallRecord[];
  pendingConfirm: RecallRecord[];
  needManual: RecallRecord[];
  processing: RecallRecord[];
}

export function summarizeRecalls(recalls: RecallRecord[]): RecallSummary {
  return {
    resolved: recalls.filter(r => r.process_status === '已修正' && r.safety_confirmed),
    pendingConfirm: recalls.filter(r => r.process_status === '已修正' && !r.safety_confirmed),
    processing: recalls.filter(r => r.process_status === '处理中'),
    needManual: recalls.filter(r => r.process_status === '需人工确认'),
    blocking: recalls.filter(r =>
      !(r.process_status === '已修正' && r.safety_confirmed),
    ),
  };
}

export function computeHandoverStatus(
  _wo: Workorder,
  parts: SparePart[],
  recalls: RecallRecord[] = [],
): HandoverStatus {
  const missing = parts.filter(p => p.material_status === '缺料');
  const tempParts = parts.filter(p => p.is_temp === true);
  const { blocking, needManual, processing, pendingConfirm } = summarizeRecalls(recalls);

  if (needManual.length > 0) return '异常待核';
  if (processing.length > 0) return '异常待核';
  if (pendingConfirm.length > 0) return '异常待核';
  if (blocking.length > 0) return '异常待核';
  if (missing.length > 0) return '缺材料待补';
  if (parts.length === 0) return '待交接';
  if (tempParts.length > 0) return '待交接';
  return '可放行';
}

export function handoverSuggestion(
  wo: Workorder,
  parts: SparePart[],
  recalls: RecallRecord[] = [],
): string {
  const missing = parts.filter(p => p.material_status === '缺料');
  const tempParts = parts.filter(p => p.is_temp === true);
  const { resolved, needManual, processing, pendingConfirm, blocking } = summarizeRecalls(recalls);

  if (needManual.length > 0) {
    const reasons = needManual.map(r => `[${r.category}]${r.fields_involved}`).join('、');
    return `异常待核：${needManual.length} 条被标记「需人工确认」，项目经理需介入处理（${reasons}）`;
  }
  if (processing.length > 0) {
    const reasons = processing.map(r => `[${r.category}]${r.fields_involved}`).join('、');
    return `异常待核：${processing.length} 条处理中（${reasons}），处理完安全员确认后可放行`;
  }
  if (pendingConfirm.length > 0) {
    const reasons = pendingConfirm.map(r => `[${r.category}]${r.fields_involved}`).join('、');
    return `异常待核：${pendingConfirm.length} 条已修正但待安全员确认（${reasons}）`;
  }
  if (blocking.length > 0) {
    const reasons = blocking.map(r => `[${r.category}]${r.fields_involved}`).join('、');
    return `异常待核：${blocking.length} 条异常未处理（${reasons}），需先标记处理中/已修正`;
  }
  if (missing.length > 0) {
    return `缺材料待补：缺 ${missing.length} 项（${missing.map(m => m.part_name).join('、')}）`;
  }
  if (parts.length === 0) return '待交接：未关联备件清单';
  if (tempParts.length > 0) {
    return `待交接：含 ${tempParts.length} 项临时材料（${tempParts.map(t => t.part_name).join('、')}），建议复核`;
  }
  if (resolved.length > 0) {
    return `可放行：备件齐全，异常归零（${resolved.length} 条异常已修正并确认）`;
  }
  return '可放行：备件齐全，异常归零';
}
