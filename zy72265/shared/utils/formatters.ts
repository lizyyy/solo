import type { ProcessingStatus, CoordinateType, RadiusSource, WorkflowStep } from '../types';

export const STATUS_LABELS: Record<ProcessingStatus, string> = {
  IMPORTED: '已导入',
  ENGINEER_REVIEW: '工程师复核中',
  INSPECTION_REVIEW: '巡检组复核中',
  PUBLISHED: '已发布',
  REJECTED: '已驳回',
  ROLLBACK: '已回滚',
};

export const STATUS_COLORS: Record<ProcessingStatus, string> = {
  IMPORTED: 'bg-zinc-500 text-white',
  ENGINEER_REVIEW: 'bg-blue-500 text-white',
  INSPECTION_REVIEW: 'bg-amber-500 text-white',
  PUBLISHED: 'bg-emerald-500 text-white',
  REJECTED: 'bg-red-500 text-white',
  ROLLBACK: 'bg-purple-500 text-white',
};

export const COORDINATE_TYPE_LABELS: Record<CoordinateType, string> = {
  LAT_LNG: '经纬度',
  METRIC: '米制',
  MIXED: '混合',
};

export const COORDINATE_TYPE_COLORS: Record<CoordinateType, string> = {
  LAT_LNG: 'bg-blue-100 text-blue-800',
  METRIC: 'bg-green-100 text-green-800',
  MIXED: 'bg-amber-100 text-amber-800',
};

export const RADIUS_SOURCE_LABELS: Record<NonNullable<RadiusSource>, string> = {
  LOG: '点云日志',
  TABLE: '安全半径表',
  MANUAL: '人工指定',
};

export const RADIUS_SOURCE_COLORS: Record<NonNullable<RadiusSource>, string> = {
  LOG: 'bg-slate-100 text-slate-800',
  TABLE: 'bg-emerald-100 text-emerald-800',
  MANUAL: 'bg-amber-100 text-amber-800',
};

export const WORKFLOW_STEPS: { step: WorkflowStep; name: string; description: string }[] = [
  { step: 1, name: '导入点云抽稀日志', description: '设备工程师许工导入原始日志' },
  { step: 2, name: '许工补看安全半径表', description: '对照安全半径表复核正常记录' },
  { step: 3, name: '更新现场说明', description: '巡检组复核后发布给现场班组' },
];

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatCoordinate(value: number, type: CoordinateType): string {
  if (type === 'LAT_LNG') {
    return `${value.toFixed(6)}°`;
  }
  return `${value.toFixed(3)}m`;
}

export function parseCsv(content: string): string[][] {
  const lines = content.trim().split(/\r?\n/);
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}
