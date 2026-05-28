import { Bill, AuditLog } from '@/types/bill';
import * as XLSX from 'xlsx';
import { getStatusLabel } from './billStateMachine';
import { getExceptionTypeLabel, getSeverityLabel } from './exceptionDetector';

export type ExportFormat = 'xlsx' | 'csv';

export interface ExportOptions {
  includeDirtyData?: boolean;
  includeExceptions?: boolean;
  includeStatusHistory?: boolean;
  dateRange?: { start: string; end: string };
}

const generateAuditLog = (
  action: string,
  operator: string,
  details: string,
  billId?: string,
  billNo?: string
): AuditLog => ({
  id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  billId,
  billNo,
  action,
  operator,
  timestamp: new Date().toISOString(),
  details,
});

export const addAuditLogEntry = (
  auditLogs: AuditLog[],
  entry: Omit<AuditLog, 'id' | 'timestamp'>
): AuditLog[] => {
  return [
    ...auditLogs,
    generateAuditLog(entry.action, entry.operator, entry.details, entry.billId, entry.billNo),
  ];
};

const billsToExportData = (bills: Bill[], options: ExportOptions) => {
  let exportBills = bills;
  
  if (!options.includeDirtyData) {
    exportBills = bills.filter(b => !b.isDirty);
  }
  
  if (options.dateRange) {
    const { start, end } = options.dateRange;
    exportBills = exportBills.filter(b => {
      return b.maturityDate >= start && b.maturityDate <= end;
    });
  }
  
  return exportBills.map(bill => ({
    '票据编号': bill.billNo,
    '质押状态': bill.pledgeStatus,
    '系统状态': getStatusLabel(bill.status),
    '到期日': bill.maturityDate,
    '原始到期日': bill.originalMaturityDate || '',
    '保证金': bill.margin,
    '计算占用': bill.calculatedOccupancy || bill.margin,
    '释放申请': bill.releaseApplication || '',
    '占用报告': bill.occupancyReport || '',
    '来源文件': bill.sourceFile,
    '是否脏数据': bill.isDirty ? '是' : '否',
    '脏数据原因': bill.dirtyReason || '',
    '未确认异常数': bill.exceptions.filter(e => !e.confirmed).length,
    '创建时间': bill.createdAt,
    '更新时间': bill.updatedAt,
    '备注': bill.remarks || '',
  }));
};

const exceptionsToExportData = (bills: Bill[]) => {
  return bills.flatMap(bill => 
    bill.exceptions.map(exc => ({
      '票据编号': bill.billNo,
      '异常类型': getExceptionTypeLabel(exc.type),
      '严重程度': getSeverityLabel(exc.severity),
      '异常消息': exc.message,
      '检测时间': exc.detectedAt,
      '是否已确认': exc.confirmed ? '是' : '否',
      '确认人': exc.confirmedBy || '',
      '确认时间': exc.confirmedAt || '',
      '详细说明': exc.explanation || '',
    }))
  );
};

const statusHistoryToExportData = (bills: Bill[]) => {
  return bills.flatMap(bill => 
    bill.statusHistory.map(hist => ({
      '票据编号': bill.billNo,
      '状态': getStatusLabel(hist.status),
      '变更时间': hist.timestamp,
      '操作人': hist.operator,
      '变更原因': hist.reason,
      '详细信息': hist.details || '',
    }))
  );
};

const auditLogsToExportData = (auditLogs: AuditLog[]) => {
  return auditLogs.map(log => ({
    '操作时间': log.timestamp,
    '操作类型': log.action,
    '操作人': log.operator,
    '关联票据编号': log.billNo || '',
    '详细信息': log.details,
    'IP地址': log.ip || '',
  }));
};

export const exportToExcel = (
  bills: Bill[],
  auditLogs: AuditLog[],
  options: ExportOptions = {}
): Blob => {
  const workbook = XLSX.utils.book_new();
  
  const billsData = billsToExportData(bills, options);
  const billsSheet = XLSX.utils.json_to_sheet(billsData);
  XLSX.utils.book_append_sheet(workbook, billsSheet, '票据列表');
  
  if (options.includeExceptions) {
    const exceptionsData = exceptionsToExportData(bills);
    const exceptionsSheet = XLSX.utils.json_to_sheet(exceptionsData);
    XLSX.utils.book_append_sheet(workbook, exceptionsSheet, '异常记录');
  }
  
  if (options.includeStatusHistory) {
    const historyData = statusHistoryToExportData(bills);
    const historySheet = XLSX.utils.json_to_sheet(historyData);
    XLSX.utils.book_append_sheet(workbook, historySheet, '状态历史');
  }
  
  const auditData = auditLogsToExportData(auditLogs);
  const auditSheet = XLSX.utils.json_to_sheet(auditData);
  XLSX.utils.book_append_sheet(workbook, auditSheet, '审计日志');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const exportToCSV = (
  bills: Bill[],
  options: ExportOptions = {}
): Blob => {
  const billsData = billsToExportData(bills, options);
  const csv = XLSX.utils.json_to_sheet(billsData);
  const csvString = XLSX.utils.sheet_to_csv(csv);
  return new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8' });
};

export const downloadFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generateExportFileName = (prefix: string, format: ExportFormat): string => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  return `${prefix}_${dateStr}_${timeStr}.${format}`;
};
