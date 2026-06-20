import type { Workorder, SparePart, HandoverStatus } from '@/types';

export function computeHandoverStatus(
  _wo: Workorder,
  parts: SparePart[],
): HandoverStatus {
  const exceptions = parts.filter(p => p.recall_tag !== '正常');
  const missing = parts.filter(p => p.material_status === '缺料');
  const tempParts = parts.filter(p => p.is_temp === true);

  if (exceptions.length > 0) return '异常待核';
  if (missing.length > 0) return '缺材料待补';
  if (parts.length === 0) return '待交接';
  if (tempParts.length > 0) return '待交接';
  return '可放行';
}

export function handoverSuggestion(wo: Workorder, parts: SparePart[]): string {
  const exceptions = parts.filter(p => p.recall_tag !== '正常');
  const missing = parts.filter(p => p.material_status === '缺料');
  const tempParts = parts.filter(p => p.is_temp === true);

  if (exceptions.length > 0) {
    return `异常待核：存在 ${exceptions.length} 项备件异常，需安全员老唐确认`;
  }
  if (missing.length > 0) {
    return `缺材料：缺 ${missing.length} 项（${missing.map(m => m.part_name).join('、')}）`;
  }
  if (parts.length === 0) return '待处理：未关联备件清单';
  if (tempParts.length > 0) {
    return `注意：含 ${tempParts.length} 项临时材料（${tempParts.map(t => t.part_name).join('、')}），建议复核`;
  }
  return '可放行：备件齐全，异常归零';
}
