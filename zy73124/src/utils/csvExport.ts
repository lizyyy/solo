import type { SeaReport, SampleBottle, CSVColumn } from '@/types';
import { formatDate, formatDateTime } from './storage';
import { abnormalTypeLabels } from './abnormalDetector';

export const reportListColumns: CSVColumn[] = [
  { key: 'reportNo', title: '报告编号', dataIndex: 'reportNo' },
  { key: 'samplingTime', title: '采样时间', dataIndex: 'samplingTime' },
  { key: 'seaArea', title: '海区', dataIndex: 'seaArea' },
  { key: 'tideLevel', title: '潮位值', dataIndex: 'tideLevel' },
  { key: 'tideUnit', title: '潮位单位', dataIndex: 'tideUnit' },
  { key: 'bottleCount', title: '采样瓶数量', dataIndex: 'bottleCount' },
  { key: 'status', title: '状态', dataIndex: 'status' },
  { key: 'sceneLabel', title: '场景标注', dataIndex: 'sceneLabel' },
  { key: 'sideNote', title: '侧边说明', dataIndex: 'sideNote' },
  { key: 'createdAt', title: '创建时间', dataIndex: 'createdAt' },
  { key: 'updatedAt', title: '更新时间', dataIndex: 'updatedAt' },
];

export const bottleDetailColumns: CSVColumn[] = [
  { key: 'bottleNo', title: '采样瓶编号', dataIndex: 'bottleNo' },
  { key: 'batchNo', title: '批次号', dataIndex: 'batchNo' },
  { key: 'sequence', title: '批次内序号', dataIndex: 'sequence' },
  { key: 'experimentResult', title: '实验结果', dataIndex: 'experimentResult' },
  { key: 'resultUnit', title: '结果单位', dataIndex: 'resultUnit' },
  { key: 'sampledAt', title: '采样时间', dataIndex: 'sampledAt' },
  { key: 'recordedAt', title: '录入时间', dataIndex: 'recordedAt' },
  { key: 'recorder', title: '录入人', dataIndex: 'recorder' },
  { key: 'remark', title: '备注', dataIndex: 'remark' },
];

export const abnormalColumns: CSVColumn[] = [
  { key: 'abnormalType', title: '异常类型', dataIndex: 'abnormalType' },
  { key: 'severity', title: '严重程度', dataIndex: 'severity' },
  { key: 'status', title: '处理状态', dataIndex: 'status' },
  { key: 'reportNo', title: '所属报告', dataIndex: 'reportNo' },
  { key: 'seaArea', title: '海区', dataIndex: 'seaArea' },
  { key: 'description', title: '异常描述', dataIndex: 'description' },
  { key: 'detectedAt', title: '发现时间', dataIndex: 'detectedAt' },
];

function formatValue(value: unknown, column: CSVColumn): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (column.key === 'samplingTime' || column.key === 'createdAt' || column.key === 'updatedAt') {
    return formatDateTime(String(value));
  }
  if (column.key === 'sampledAt' || column.key === 'recordedAt' || column.key === 'detectedAt') {
    return formatDateTime(String(value));
  }

  if (column.key === 'abnormalType') {
    return abnormalTypeLabels[String(value)] || String(value);
  }

  if (column.key === 'status') {
    const statusLabels: Record<string, string> = {
      draft: '草稿',
      partial: '部分完成',
      complete: '已完成',
      abnormal: '异常',
      pending: '待处理',
      processing: '处理中',
      resolved: '已解决',
    };
    return statusLabels[String(value)] || String(value);
  }

  if (column.key === 'severity') {
    const severityLabels: Record<string, string> = {
      high: '严重',
      medium: '中等',
      low: '轻微',
    };
    return severityLabels[String(value)] || String(value);
  }

  return String(value);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCSV<T>(
  data: T[],
  columns: CSVColumn[],
  includeHeader = true
): string {
  const lines: string[] = [];

  if (includeHeader) {
    const headerLine = columns.map((col) => escapeCSV(col.title)).join(',');
    lines.push(headerLine);
  }

  data.forEach((row) => {
    const line = columns
      .map((col) => {
        const value = (row as Record<string, unknown>)[col.dataIndex];
        return escapeCSV(formatValue(value, col));
      })
      .join(',');
    lines.push(line);
  });

  return lines.join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReportListCSV(
  reports: SeaReport[],
  abnormalCountMap: Record<string, number>
): void {
  const columns = [...reportListColumns, { key: 'abnormalCount', title: '异常数量', dataIndex: 'abnormalCount' }];

  const exportData = reports.map((report) => ({
    ...report,
    abnormalCount: abnormalCountMap[report.id] || 0,
  }));

  const csv = generateCSV(exportData, columns);
  const filename = `浮标海况报告汇总_${formatDate(new Date().toISOString())}.csv`;
  downloadCSV(csv, filename);
}

export function exportBottlesCSV(bottles: SampleBottle[], reportNo: string): void {
  const csv = generateCSV(bottles, bottleDetailColumns);
  const filename = `采样瓶明细_${reportNo}_${formatDate(new Date().toISOString())}.csv`;
  downloadCSV(csv, filename);
}

export function exportAbnormalRecordsCSV<T extends Record<string, unknown>>(
  abnormals: T[]
): void {
  const csv = generateCSV(abnormals, abnormalColumns);
  const filename = `异常记录_${formatDate(new Date().toISOString())}.csv`;
  downloadCSV(csv, filename);
}
