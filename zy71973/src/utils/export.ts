import * as XLSX from 'xlsx';
import { AuditRecord, STATUS_LABELS, TYPE_LABELS } from '@/types';

export const exportToExcel = (records: AuditRecord[], filename: string) => {
  const exportData = records.map((record) => ({
    '记录ID': record.id,
    '来源': record.source,
    '内容': record.content,
    '状态': STATUS_LABELS[record.status],
    '类型': TYPE_LABELS[record.type],
    '处理人': record.handlerName || '-',
    '待处理原因': record.pendingReason || '-',
    '来源链路': record.sourceChain,
    '创建时间': formatDate(record.createdAt),
    '更新时间': formatDate(record.updatedAt),
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '质检记录');
  
  ws['!cols'] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 40 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 30 },
    { wch: 30 },
    { wch: 20 },
    { wch: 20 },
  ];

  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getWeeklyReportData = (records: AuditRecord[]) => {
  const statusStats = records.reduce(
    (acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const typeStats = records.reduce(
    (acc, record) => {
      acc[record.type] = (acc[record.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const handlerStats = records
    .filter((r) => r.handlerName)
    .reduce(
      (acc, record) => {
        const name = record.handlerName!;
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

  return {
    total: records.length,
    statusStats,
    typeStats,
    handlerStats,
  };
};
