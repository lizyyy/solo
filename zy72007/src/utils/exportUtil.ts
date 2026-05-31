import * as XLSX from 'xlsx';
import { InvestmentRecord, RecordStatus, RecordStatusLabel, OperationTypeLabel } from '../types';

interface ExportRow {
  投资者姓名: string;
  投资金额: string;
  当前状态: string;
  处理人: string;
  材料数量: number;
  创建时间: string;
  最后更新: string;
  处理历史摘要: string;
}

export function exportToExcel(records: InvestmentRecord[]): void {
  const confirmedRecords = records.filter(r => r.status === RecordStatus.CONFIRMED);
  const pendingRecords = records.filter(r => r.status === RecordStatus.PENDING_MATERIAL);
  const adjustedRecords = records.filter(r => r.status === RecordStatus.MANUAL_ADJUSTED);

  const wb = XLSX.utils.book_new();

  const toExportRow = (r: InvestmentRecord): ExportRow => ({
    投资者姓名: r.investorName,
    投资金额: `¥${r.amount.toLocaleString()}`,
    当前状态: RecordStatusLabel[r.status],
    处理人: r.handler,
    材料数量: r.materials.length,
    创建时间: r.createdAt,
    最后更新: r.updatedAt,
    处理历史摘要: r.operationLogs.map(log => 
      `${log.createdAt.slice(5, 16)} ${OperationTypeLabel[log.type]}(${log.operator}): ${log.diffNote}`
    ).join('; '),
  });

  if (confirmedRecords.length > 0) {
    const ws1 = XLSX.utils.json_to_sheet(confirmedRecords.map(toExportRow));
    ws1['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 8 },
      { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, '已确认');
  }

  if (pendingRecords.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(pendingRecords.map(toExportRow));
    ws2['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 8 },
      { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, '待补材料');
  }

  if (adjustedRecords.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(adjustedRecords.map(toExportRow));
    ws3['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 8 },
      { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, ws3, '人工改判');
  }

  const summarySheet = XLSX.utils.json_to_sheet([
    { 统计项: '已确认金额', 数值: `¥${confirmedRecords.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}` },
    { 统计项: '已确认笔数', 数值: confirmedRecords.length },
    { 统计项: '待补材料笔数', 数值: pendingRecords.length },
    { 统计项: '人工改判笔数', 数值: adjustedRecords.length },
    { 统计项: '导出时间', 数值: new Date().toLocaleString('zh-CN') },
  ]);
  summarySheet['!cols'] = [{ wch: 15 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, '统计汇总');

  XLSX.writeFile(wb, `私募投资者回访留痕_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
