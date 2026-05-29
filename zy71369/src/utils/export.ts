import type { ReportRow } from '../types';

export function exportToCSV(rows: ReportRow[], filename: string = '校对报告.csv'): void {
  const headers = [
    '页码',
    '气泡序号',
    '气泡ID',
    '版本',
    '台词',
    '字数',
    '位置',
    '问题',
    '状态',
    '备注',
    '最后修改',
  ];

  const escape = (value: string | number): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map(row => [
      row.pageNumber,
      row.sequenceNumber,
      row.bubbleId,
      row.version,
      escape(row.text),
      row.textLength,
      row.position,
      escape(row.issues.join('; ')),
      row.status,
      escape(row.remark),
      row.lastModified,
    ].join(',')),
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export function exportToJSON(rows: ReportRow[], filename: string = '校对报告.json'): void {
  const jsonContent = JSON.stringify(rows, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
