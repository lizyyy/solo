import type { ExportData, ExportOptions, Classroom, Record, ScoreSheet } from '@/types';
import { formatTimestamp } from '@/utils/storage';

export const exportToJSON = (
  classroom: Classroom,
  records: Record[],
  scoreSheets: ScoreSheet[]
): string => {
  const data: ExportData = {
    classroom,
    records,
    scoreSheets,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };
  return JSON.stringify(data, null, 2);
};

export const exportToText = (
  classroom: Classroom,
  records: Record[],
  scoreSheets: ScoreSheet[],
  options: ExportOptions
): string => {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('医学骨架标注 - 课堂记录报告');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`课堂名称: ${classroom.name}`);
  lines.push(`创建时间: ${formatTimestamp(classroom.createdAt)}`);
  lines.push(`导出时间: ${formatTimestamp(new Date().toISOString())}`);
  lines.push('');

  const filteredRecords = options.includeSupplemental
    ? records
    : records.filter((r) => r.materialType !== 'supplement');

  lines.push('-'.repeat(60));
  lines.push(`操作记录 (${filteredRecords.length} 条)`);
  lines.push('-'.repeat(60));
  lines.push('');

  filteredRecords.forEach((record, index) => {
    lines.push(`[${index + 1}] ${formatTimestamp(record.timestamp)}`);
    lines.push(`    操作人: ${record.operator}`);
    lines.push(`    类型: ${getRecordTypeLabel(record.type)}`);
    lines.push(`    性质: ${getMaterialTypeLabel(record.materialType)}`);
    lines.push(`    内容: ${record.content}`);

    if (options.includeAnnotations && record.annotation) {
      lines.push('');
      lines.push(`    ┌─ 异常标注 ─`);
      lines.push(`    │ 类型: ${getAnomalyTypeLabel(record.annotation.anomalyType)}`);
      lines.push(`    │ 解释: ${record.annotation.explanation}`);
      lines.push(`    │ 标注人: ${record.annotation.annotator}`);
      lines.push(`    └─────────`);
    }
    lines.push('');
  });

  if (options.includeScoreSheets && scoreSheets.length > 0) {
    lines.push('-'.repeat(60));
    lines.push(`评分表 (${scoreSheets.length} 份)`);
    lines.push('-'.repeat(60));
    lines.push('');

    scoreSheets.forEach((sheet) => {
      const latestVersion = sheet.versions[sheet.versions.length - 1];
      lines.push(`【${sheet.name}】`);
      lines.push(`版本: v${latestVersion.version} (${formatTimestamp(latestVersion.uploadedAt)})`);
      lines.push(`上传人: ${latestVersion.uploader}`);
      lines.push('');
      lines.push(latestVersion.content);
      lines.push('');
      lines.push('-'.repeat(40));
      lines.push('');
    });
  }

  return lines.join('\n');
};

export const downloadFile = (content: string, filename: string, type: string = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const getRecordTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    operation: '操作记录',
    script: '脚本变更',
    note: '备注',
    score: '评分',
  };
  return labels[type] || type;
};

const getMaterialTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    supplement: '补材料',
    conclusion_change: '改结论',
  };
  return labels[type] || type;
};

const getAnomalyTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    normal: '正常',
    view_reset: '视角重置',
    misoperation: '误操作',
    other: '其他',
  };
  return labels[type] || type;
};
