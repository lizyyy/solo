import { Point, FilterCriteria } from '@/types';

export function filterPoints(points: Point[], criteria: FilterCriteria): Point[] {
  return points.filter(point => {
    if (criteria.types.length > 0 && !criteria.types.includes(point.type)) return false;

    if (criteria.statuses.length > 0 && !criteria.statuses.includes(point.status)) return false;

    if (criteria.schemeVersions.length > 0 && !criteria.schemeVersions.includes(point.schemeVersion)) return false;

    if (criteria.dateRange) {
      const [start, end] = criteria.dateRange;
      if (point.inspectionDate < start || point.inspectionDate > end) return false;
    }

    if (criteria.onlyReflectionChambers && !point.isReflectionChamber) return false;

    if (criteria.onlyAnomalies && point.status === 'normal') return false;

    return true;
  });
}

export function buildFilterSummary(criteria: FilterCriteria): string {
  const parts: string[] = [];

  if (criteria.types.length > 0) {
    const typeLabels: Record<string, string> = {
      'reflection-chamber': '反射舱',
      'microphone': '麦克风',
      'speaker': '音箱',
      'boundary': '边界点'
    };
    parts.push(`类型: ${criteria.types.map(t => typeLabels[t] || t).join('/')}`);
  }

  if (criteria.statuses.length > 0) {
    const statusLabels: Record<string, string> = {
      'normal': '正常', 'warning': '注意', 'error': '冲突',
      'empty': '缺失', 'duplicate': '重复', 'boundary': '边界'
    };
    parts.push(`状态: ${criteria.statuses.map(s => statusLabels[s] || s).join('/')}`);
  }

  if (criteria.schemeVersions.length > 0) {
    parts.push(`方案: ${criteria.schemeVersions.map(v => v.toUpperCase()).join('/')}`);
  }

  if (criteria.dateRange) {
    parts.push(`日期: ${criteria.dateRange[0]} ~ ${criteria.dateRange[1]}`);
  }

  if (criteria.onlyReflectionChambers) {
    parts.push('仅声线反射舱');
  }

  if (criteria.onlyAnomalies) {
    parts.push('仅异常项');
  }

  return parts.length > 0 ? parts.join(' | ') : '全部';
}
