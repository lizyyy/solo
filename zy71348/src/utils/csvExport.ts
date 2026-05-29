import type { InventoryRecord } from '@/types';
import { CONDITION_GRADES, STATUS_LABELS } from '@/types';

function getConditionLabel(condition: string): string {
  const found = CONDITION_GRADES.find((g) => g.value === condition);
  return found ? found.label : condition;
}

export function generateCSV(records: InventoryRecord[]): string {
  const headers = [
    '版号',
    '版本标记',
    '专辑名',
    '艺人',
    '发行年份',
    '品相',
    '寄售人',
    '寄售价格',
    '上架位置',
    '状态',
    '核对报告',
    '创建时间',
    '更新时间',
  ];

  const rows = records.map((r) => [
    r.catalogNumber,
    r.versionTag,
    r.albumName,
    r.artist,
    r.pressYear,
    getConditionLabel(r.condition),
    r.consignor,
    r.price.toString(),
    r.shelfLocation,
    STATUS_LABELS[r.status],
    r.verificationReport,
    r.createdAt,
    r.updatedAt,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return '\uFEFF' + csvContent;
}

export function downloadCSV(records: InventoryRecord[], filename?: string): void {
  const csv = generateCSV(records);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10);

  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    filename || `黑胶上架清单_${timestamp}.csv`
  );
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function filterRecordsForExport(records: InventoryRecord[]): InventoryRecord[] {
  return records.filter((r) => r.status === 'verified');
}
