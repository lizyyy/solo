import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Redemption, Batch } from '../types';

export function exportToExcel(
  redemptions: Redemption[],
  filename: string = '兑付清单'
): void {
  const data = redemptions.map(r => ({
    '卡号': r.cardNumber,
    '持卡人': r.cardHolderName,
    '联系电话': r.phone,
    '初始余额': r.initialBalance.toFixed(2),
    '当前余额': r.currentBalance.toFixed(2),
    '状态': getStatusText(r.status),
    '批次': r.batchId || '-',
    '有争议': r.hasDispute ? '是' : '否',
    '已冻结': r.isFrozen ? '是' : '否',
    '创建时间': r.createdAt,
    '更新时间': r.updatedAt,
    '创建人': r.createdBy
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '兑付清单');

  ws['!cols'] = [
    { wch: 15 },
    { wch: 10 },
    { wch: 13 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 }
  ];

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportToCSV(
  redemptions: Redemption[],
  filename: string = '兑付清单'
): void {
  const headers = ['卡号', '持卡人', '联系电话', '初始余额', '当前余额', '状态', '批次', '有争议', '已冻结', '创建时间', '更新时间', '创建人'];
  const rows = redemptions.map(r => [
    r.cardNumber,
    r.cardHolderName,
    r.phone,
    r.initialBalance.toFixed(2),
    r.currentBalance.toFixed(2),
    getStatusText(r.status),
    r.batchId || '-',
    r.hasDispute ? '是' : '否',
    r.isFrozen ? '是' : '否',
    r.createdAt,
    r.updatedAt,
    r.createdBy
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportBatchReport(
  batch: Batch,
  redemptions: Redemption[],
  filename: string
): void {
  const summaryData = [{
    '批次号': batch.batchNo,
    '批次名称': batch.name,
    '状态': getBatchStatusText(batch.status),
    '创建时间': batch.createTime,
    '执行时间': batch.executeTime || '-',
    '审核人': batch.auditor || '-',
    '总笔数': batch.totalCount,
    '总金额': batch.totalAmount.toFixed(2)
  }];

  const detailData = redemptions.map(r => ({
    '卡号': r.cardNumber,
    '持卡人': r.cardHolderName,
    '兑付金额': r.currentBalance.toFixed(2),
    '状态': getStatusText(r.status),
    '备注': r.hasDispute ? '有争议' : '-'
  }));

  const ws1 = XLSX.utils.json_to_sheet(summaryData);
  const ws2 = XLSX.utils.json_to_sheet(detailData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, '批次汇总');
  XLSX.utils.book_append_sheet(wb, ws2, '兑付明细');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    frozen: '已冻结',
    disputed: '有争议',
    cancelled: '已取消'
  };
  return statusMap[status] || status;
}

function getBatchStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    draft: '草稿',
    approved: '已审核',
    executing: '执行中',
    completed: '已完成'
  };
  return statusMap[status] || status;
}

export const EXPORT_RULES = {
  name: '数据导出规则',
  formats: ['Excel (.xlsx)', 'CSV (.csv)'],
  encoding: 'UTF-8 with BOM (for CSV)',
  filenamePattern: '{名称}_{YYYY-MM-DD}.{ext}',
  includedFields: {
    redemption: ['卡号', '持卡人', '联系电话', '初始余额', '当前余额', '状态', '批次', '有争议', '已冻结', '创建时间', '更新时间', '创建人'],
    batch: ['批次号', '批次名称', '状态', '创建时间', '执行时间', '审核人', '总笔数', '总金额']
  }
};
