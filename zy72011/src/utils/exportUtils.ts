import { WarningRecord, STATUS_LABELS, WARNING_TYPE_LABELS, MATERIAL_TYPE_LABELS } from '../types';

export function exportToCSV(records: WarningRecord[]): string {
  const headers = [
    'ID',
    '供应商名称',
    '票据金额',
    '预警类型',
    '状态',
    '数据来源',
    '原始备注',
    '当前备注',
    '处理建议',
    '创建时间',
    '更新时间',
  ];

  const rows = records.map((record) => [
    record.id,
    record.supplierName,
    record.billAmount.toFixed(2),
    WARNING_TYPE_LABELS[record.warningType],
    STATUS_LABELS[record.status],
    MATERIAL_TYPE_LABELS[record.source],
    `"${record.originalRemark.replace(/"/g, '""')}"`,
    `"${record.currentRemark.replace(/"/g, '""')}"`,
    `"${record.processingAdvice.replace(/"/g, '""')}"`,
    record.createdAt,
    record.updatedAt,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  
  const BOM = '\uFEFF';
  return BOM + csvContent;
}

export function exportToJSON(records: WarningRecord[]): string {
  return JSON.stringify(records, null, 2);
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

export function downloadCSV(records: WarningRecord[], filename?: string): void {
  const csvContent = exportToCSV(records);
  const defaultFilename = `供应商票据池预警_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csvContent, filename || defaultFilename, 'text/csv;charset=utf-8');
}

export function downloadJSON(records: WarningRecord[], filename?: string): void {
  const jsonContent = exportToJSON(records);
  const defaultFilename = `供应商票据池预警_${new Date().toISOString().split('T')[0]}.json`;
  downloadFile(jsonContent, filename || defaultFilename, 'application/json');
}
