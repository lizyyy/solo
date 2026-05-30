import type { ExperimentRecord } from '@/types';
import { RESULT_LABELS, ERROR_TYPE_LABELS } from '@/types';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportRecordsToCsv(records: ExperimentRecord[]): string {
  const headers = [
    '实验ID',
    '创建时间',
    '更新时间',
    '结果',
    '模拟时长(秒)',
    '发射角度(°)',
    '发射速度',
    '引力常数(原始)',
    '引力常数(修正)',
    '时间步长(原始)',
    '时间步长(修正)',
    '总能量',
    '动能',
    '势能',
    '碰撞星体ID',
    '轨道周期',
    '逃逸距离',
    '错误类型',
    '错误数量',
    '备注版本数',
    '最新备注',
    '摘要',
  ];

  const rows = records.map((record) => {
    const errorTypes = [
      ...new Set(record.conclusion.errorMarks.map((e) => ERROR_TYPE_LABELS[e.type])),
    ].join('; ');

    return [
      record.id,
      formatDate(record.createdAt),
      formatDate(record.updatedAt),
      RESULT_LABELS[record.conclusion.result],
      record.conclusion.duration.toFixed(3),
      record.raw.launchAngle.toFixed(2),
      record.raw.launchSpeed.toFixed(2),
      record.raw.physicsParams.gravitationalConstant.toFixed(2),
      record.corrected.physicsParams.gravitationalConstant.toFixed(2),
      record.raw.physicsParams.timeStep.toFixed(4),
      record.corrected.physicsParams.timeStep.toFixed(4),
      record.conclusion.finalEnergy.total.toFixed(4),
      record.conclusion.finalEnergy.kinetic.toFixed(4),
      record.conclusion.finalEnergy.potential.toFixed(4),
      record.conclusion.collisionBodyId || '',
      record.conclusion.orbitPeriod?.toFixed(4) || '',
      record.conclusion.escapeDistance?.toFixed(2) || '',
      errorTypes,
      record.conclusion.errorMarks.length.toString(),
      record.noteVersions.length.toString(),
      record.corrected.notes,
      record.conclusion.summary,
    ].map((v) => escapeCsvValue(String(v)));
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
