import type { Comparison, Annotation, Preset, Difference, DifferenceType } from '@/types';
import { DIFFERENCE_TYPE_LABELS } from '@/types';
import { formatTimestamp } from './versionParser';

interface ExportData {
  comparison: Comparison;
  basePreset: Preset | undefined;
  targetPreset: Preset | undefined;
  annotations: Annotation[];
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '∅ (空值)';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function getDiffEmoji(type: DifferenceType): string {
  const emojis: Record<DifferenceType, string> = {
    changed: '🔄',
    added: '➕',
    removed: '➖',
    null: '⚠️',
    duplicate: '📋',
    boundary: '🔴',
  };
  return emojis[type] || '•';
}

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };
  return labels[severity] || severity;
}

export function formatMarkdown(data: ExportData): string {
  const { comparison, basePreset, targetPreset, annotations } = data;
  
  const lines: string[] = [];
  
  lines.push('# 合成器预设差异比对报告');
  lines.push('');
  lines.push(`> 生成时间: ${formatTimestamp(Date.now())}`);
  lines.push(`> 比对原因: ${comparison.reason || '未说明'}`);
  lines.push(`> 操作人: ${comparison.operator}`);
  lines.push('');
  
  lines.push('## 版本信息');
  lines.push('');
  lines.push('| 角色 | 预设名称 | 版本 | 操作人 | 创建时间 |');
  lines.push('|------|----------|------|--------|----------|');
  lines.push(`| 基准版本 | ${basePreset?.name || 'N/A'} | ${basePreset?.version || 'N/A'} | ${basePreset?.operator || 'N/A'} | ${basePreset ? formatTimestamp(basePreset.createdAt) : 'N/A'} |`);
  lines.push(`| 目标版本 | ${targetPreset?.name || 'N/A'} | ${targetPreset?.version || 'N/A'} | ${targetPreset?.operator || 'N/A'} | ${targetPreset ? formatTimestamp(targetPreset.createdAt) : 'N/A'} |`);
  lines.push('');
  
  const stats = {
    high: comparison.differences.filter(d => d.severity === 'high').length,
    medium: comparison.differences.filter(d => d.severity === 'medium').length,
    low: comparison.differences.filter(d => d.severity === 'low').length,
  };
  
  lines.push('## 差异统计');
  lines.push('');
  lines.push(`- 🔴 严重差异: ${stats.high} 项`);
  lines.push(`- 🟡 中等差异: ${stats.medium} 项`);
  lines.push(`- 🟢 轻微差异: ${stats.low} 项`);
  lines.push(`- **总计: ${comparison.differences.length} 项**`);
  lines.push('');
  
  lines.push('## 差异详情');
  lines.push('');
  
  const grouped: Record<string, Difference[]> = {};
  comparison.differences.forEach(diff => {
    if (!grouped[diff.type]) {
      grouped[diff.type] = [];
    }
    grouped[diff.type].push(diff);
  });
  
  Object.entries(grouped).forEach(([type, diffs]) => {
    lines.push(`### ${getDiffEmoji(type as DifferenceType)} ${DIFFERENCE_TYPE_LABELS[type as DifferenceType]} (${diffs.length}项)`);
    lines.push('');
    lines.push('| 字段 | 基准值 | 目标值 | 严重程度 |');
    lines.push('|------|--------|--------|----------|');
    diffs.forEach(diff => {
      lines.push(`| \`${diff.field}\` | \`${formatValue(diff.baseValue)}\` | \`${formatValue(diff.targetValue)}\` | ${getSeverityLabel(diff.severity)} |`);
    });
    lines.push('');
  });
  
  if (annotations.length > 0) {
    lines.push('## 人工批注');
    lines.push('');
    annotations.forEach((ann, index) => {
      lines.push(`### ${index + 1}. ${ann.type === 'manual-diff' ? '📝 补录差异' : '💬 备注'}`);
      lines.push(`> 操作人: ${ann.operator} | 时间: ${formatTimestamp(ann.createdAt)}`);
      if (ann.field) {
        lines.push(`> 关联字段: \`${ann.field}\``);
      }
      lines.push('');
      lines.push(ann.content);
      lines.push('');
    });
  }
  
  lines.push('---');
  lines.push('');
  lines.push('*此报告由合成器预设差异比对工具自动生成*');
  
  return lines.join('\n');
}

export function formatJSON(data: ExportData): string {
  const exportObj = {
    metadata: {
      generatedAt: new Date().toISOString(),
      tool: '合成器预设差异比对工具',
      version: '1.0.0',
    },
    comparison: data.comparison,
    basePreset: data.basePreset,
    targetPreset: data.targetPreset,
    annotations: data.annotations,
    summary: {
      totalDifferences: data.comparison.differences.length,
      bySeverity: {
        high: data.comparison.differences.filter(d => d.severity === 'high').length,
        medium: data.comparison.differences.filter(d => d.severity === 'medium').length,
        low: data.comparison.differences.filter(d => d.severity === 'low').length,
      },
      byType: data.comparison.differences.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
  };
  
  return JSON.stringify(exportObj, null, 2);
}

export function formatCSV(data: ExportData): string {
  const lines: string[] = [];
  
  lines.push('类型,字段,基准值,目标值,严重程度,操作人,比对时间,比对原因');
  
  data.comparison.differences.forEach(diff => {
    const baseVal = String(diff.baseValue ?? '').replace(/,/g, '，').replace(/"/g, '""');
    const targetVal = String(diff.targetValue ?? '').replace(/,/g, '，').replace(/"/g, '""');
    lines.push([
      DIFFERENCE_TYPE_LABELS[diff.type],
      `"${diff.field}"`,
      `"${baseVal}"`,
      `"${targetVal}"`,
      getSeverityLabel(diff.severity),
      data.comparison.operator,
      formatTimestamp(data.comparison.createdAt),
      `"${data.comparison.reason.replace(/"/g, '""')}"`,
    ].join(','));
  });
  
  return lines.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportComparison(
  format: 'markdown' | 'json' | 'csv',
  data: ExportData
): void {
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName = `预设比对报告_${data.basePreset?.name || 'unknown'}_vs_${data.targetPreset?.name || 'unknown'}_${timestamp}`;
  
  switch (format) {
    case 'markdown':
      downloadFile(formatMarkdown(data), `${baseName}.md`, 'text/markdown');
      break;
    case 'json':
      downloadFile(formatJSON(data), `${baseName}.json`, 'application/json');
      break;
    case 'csv':
      downloadFile(formatCSV(data), `${baseName}.csv`, 'text/csv');
      break;
  }
}
