import { DataGaps } from '../types';

interface ImportData {
  studentName?: string;
  className?: string;
  workTitle?: string;
  theme?: string;
  hasImage: boolean;
  hasTransparency?: boolean;
  backgroundPercentage?: number;
  excludedPixelRatio?: number;
}

const REQUIRED_FIELDS = [
  { key: 'studentName', label: '学生姓名', required: true },
  { key: 'className', label: '班级', required: true },
  { key: 'workTitle', label: '作品标题', required: true },
] as const;

const RECOMMENDED_FIELDS = [
  { key: 'theme', label: '主题' },
] as const;

export function detectDataGaps(data: ImportData): DataGaps {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    const value = data[field.key as keyof ImportData];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push(field.label);
    }
  }

  for (const field of RECOMMENDED_FIELDS) {
    const value = data[field.key as keyof ImportData];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      warnings.push(`建议补充字段：${field.label}`);
    }
  }

  if (!data.hasImage) {
    missingFields.push('作品图片');
  }

  if (data.hasTransparency) {
    warnings.push('图片包含透明像素，分析时会自动排除');
  }

  if (data.backgroundPercentage && data.backgroundPercentage > 30) {
    warnings.push(`背景色占比较高（${data.backgroundPercentage.toFixed(1)}%），已自动排除`);
  }

  if (data.excludedPixelRatio && data.excludedPixelRatio > 0.5) {
    warnings.push(`超过50%的像素被排除（${(data.excludedPixelRatio * 100).toFixed(1)}%），结果可能不准确`);
  }

  return {
    missingFields,
    incomplete: missingFields.length > 0,
    warnings,
    forcedImport: false
  };
}

export function getGapSeverity(gaps: DataGaps): 'ok' | 'warning' | 'error' {
  if (gaps.missingFields.length > 0) return 'error';
  if (gaps.warnings.length > 0) return 'warning';
  return 'ok';
}

export function formatGapsMessage(gaps: DataGaps): string {
  const messages: string[] = [];

  if (gaps.missingFields.length > 0) {
    messages.push(`缺少必填字段：${gaps.missingFields.join('、')}`);
  }

  if (gaps.warnings.length > 0) {
    messages.push(...gaps.warnings);
  }

  return messages.join('\n');
}

export function canImport(gaps: DataGaps, forceImport: boolean = false): boolean {
  if (forceImport) return true;
  return !gaps.incomplete;
}
