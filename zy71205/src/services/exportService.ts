import * as XLSX from 'xlsx';
import type {
  MatchRecord,
  BankTransaction,
  Voucher,
  Invoice,
  ProcessBatch,
  ExportConfig,
} from '../types';
import { dbOperations } from '../db';

export const generateExportData = async (
  batchId: string,
  _config: ExportConfig
): Promise<{
  matchRecords: MatchRecord[];
  transactions: BankTransaction[];
  vouchers: Voucher[];
  invoices: Invoice[];
  batch: ProcessBatch | undefined;
}> => {
  const batch = await dbOperations.batches.get(batchId);
  const matchRecords = await dbOperations.matchRecords.getByBatch(batchId);
  const transactions = await dbOperations.transactions.getByBatch(batchId);
  const vouchers = await dbOperations.vouchers.getByBatch(batchId);
  const invoices = await dbOperations.invoices.getByBatch(batchId);

  return { batch, matchRecords, transactions, vouchers, invoices };
};

export const exportToExcel = async (
  batchId: string,
  config: ExportConfig,
  fileName?: string
): Promise<void> => {
  const { batch, matchRecords, transactions, vouchers, invoices } = await generateExportData(batchId, config);

  const wb = XLSX.utils.book_new();

  if (config.sheets.includes('匹配结果')) {
    const matchData = matchRecords.map((record, index) => ({
      '序号': index + 1,
      '匹配ID': record.id.substring(0, 8),
      '匹配状态': record.status === 'matched' ? '已匹配' : 
                 record.status === 'pending' ? '待确认' :
                 record.status === 'confirmed' ? '已确认' :
                 record.status === 'rejected' ? '已拒绝' :
                 record.status === 'split' ? '已拆分' :
                 record.status === 'merged' ? '已合并' : '未匹配',
      '匹配方式': record.matchMethod === 'auto' ? '自动匹配' :
                  record.matchMethod === 'manual' ? '手动匹配' :
                  record.matchMethod === 'split' ? '拆分匹配' : '合并匹配',
      '匹配分数': record.matchScore,
      '流水号': transactions.filter(t => record.transactionIds.includes(t.id)).map(t => t.transactionNo).join('; '),
      '凭证号': vouchers.filter(v => record.voucherIds.includes(v.id)).map(v => v.voucherNo).join('; '),
      '流水摘要': transactions.filter(t => record.transactionIds.includes(t.id)).map(t => t.summary).join('; '),
      '凭证摘要': vouchers.filter(v => record.voucherIds.includes(v.id)).map(v => v.summary).join('; '),
      '借方金额': record.totalDebitAmount,
      '贷方金额': record.totalCreditAmount,
      '差额': record.amountDifference,
      '冲突数量': record.conflicts.length,
      '冲突详情': record.conflicts.map(c => c.description).join(' | '),
      '创建时间': new Date(record.createdAt).toLocaleString('zh-CN'),
      '确认时间': record.confirmedAt ? new Date(record.confirmedAt).toLocaleString('zh-CN') : '',
    }));

    const matchSheet = XLSX.utils.json_to_sheet(matchData);
    XLSX.utils.book_append_sheet(wb, matchSheet, '匹配结果');
  }

  if (config.includeRawData && config.sheets.includes('银行流水')) {
    const transactionData = transactions.map((t, index) => ({
      '序号': index + 1,
      '交易日期': t.transactionDate,
      '交易流水号': t.transactionNo,
      '摘要': t.summary,
      '借方金额': t.debitAmount,
      '贷方金额': t.creditAmount,
      '余额': t.balance,
      '对方户名': t.counterparty,
      '对方账号': t.counterpartyAccount,
      '备注': t.remark,
      '是否红冲': t.isRedFlush ? '是' : '否',
      '已匹配': t.matched ? '是' : '否',
    }));

    const transactionSheet = XLSX.utils.json_to_sheet(transactionData);
    XLSX.utils.book_append_sheet(wb, transactionSheet, '银行流水');
  }

  if (config.includeRawData && config.sheets.includes('凭证')) {
    const voucherData = vouchers.map((v, index) => ({
      '序号': index + 1,
      '凭证号': v.voucherNo,
      '凭证日期': v.voucherDate,
      '摘要': v.summary,
      '借方金额': v.debitAmount,
      '贷方金额': v.creditAmount,
      '科目代码': v.accountCode,
      '科目名称': v.accountName,
      '是否红冲': v.isRedFlush ? '是' : '否',
      '已匹配': v.matched ? '是' : '否',
    }));

    const voucherSheet = XLSX.utils.json_to_sheet(voucherData);
    XLSX.utils.book_append_sheet(wb, voucherSheet, '凭证');
  }

  if (config.includeRawData && config.sheets.includes('发票')) {
    const invoiceData = invoices.map((i, index) => ({
      '序号': index + 1,
      '发票号码': i.invoiceNo,
      '发票代码': i.invoiceCode,
      '开票日期': i.invoiceDate,
      '金额': i.amount,
      '税额': i.taxAmount,
      '价税合计': i.totalAmount,
      '对方名称': i.counterparty,
      '对方税号': i.counterpartyTaxNo,
      '已匹配': i.matched ? '是' : '否',
    }));

    const invoiceSheet = XLSX.utils.json_to_sheet(invoiceData);
    XLSX.utils.book_append_sheet(wb, invoiceSheet, '发票');
  }

  if (config.includeConflicts && config.sheets.includes('冲突明细')) {
    const conflictData: Record<string, unknown>[] = [];
    let conflictIndex = 1;

    matchRecords.forEach(record => {
      record.conflicts.forEach(conflict => {
        conflictData.push({
          '序号': conflictIndex++,
          '匹配ID': record.id.substring(0, 8),
          '冲突类型': conflict.type === 'same_summary' ? '摘要同名误配' :
                       conflict.type === 'amount_mismatch' ? '金额不匹配' :
                       conflict.type === 'red_flush_occupied' ? '红冲后原凭证仍被占用' : '凭证号重复',
          '严重程度': conflict.severity === 'high' ? '高' :
                       conflict.severity === 'medium' ? '中' : '低',
          '冲突描述': conflict.description,
          '是否已解决': conflict.resolved ? '是' : '否',
          '流水摘要': transactions
            .filter(t => record.transactionIds.includes(t.id))
            .map(t => t.summary).join('; '),
          '凭证摘要': vouchers
            .filter(v => record.voucherIds.includes(v.id))
            .map(v => v.summary).join('; '),
        });
      });
    });

    const conflictSheet = XLSX.utils.json_to_sheet(conflictData);
    XLSX.utils.book_append_sheet(wb, conflictSheet, '冲突明细');
  }

  if (config.includeMatchHistory && config.sheets.includes('操作日志')) {
    const historyData: Record<string, unknown>[] = [];
    let historyIndex = 1;

    matchRecords.forEach(record => {
      record.matchHistory.forEach(item => {
        historyData.push({
          '序号': historyIndex++,
          '匹配ID': record.id.substring(0, 8),
          '操作': item.action,
          '操作人': item.operator,
          '时间': new Date(item.timestamp).toLocaleString('zh-CN'),
          '详情': JSON.stringify(item.details),
        });
      });
    });

    const historySheet = XLSX.utils.json_to_sheet(historyData);
    XLSX.utils.book_append_sheet(wb, historySheet, '操作日志');
  }

  const exportFileName = fileName || `银企流水清洗报告_${batch?.name || batchId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  
  XLSX.writeFile(wb, exportFileName);
};

export const downloadExcel = (data: unknown[][], fileName: string): void => {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, fileName);
};
