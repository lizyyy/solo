import * as XLSX from 'xlsx';
import type { Settlement, ImportResult, ImportStrategy, Transaction, RefundRequest, ApprovalEmail } from '../types';
import { generateBatchNo, now, parseDate } from './date';
import { parseAmount } from './amount';
import { validateSettlementData } from './validator';

export function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function transformToSettlements(rawData: any[]): { settlements: Settlement[]; errors: string[] } {
  const settlements: Settlement[] = [];
  const errors: string[] = [];

  rawData.forEach((row, idx) => {
    try {
      const id = (row['批次号'] || row['id'] || '').toString().trim() || generateBatchNo();
      const merchantName = (row['商户名称'] || row['merchantName'] || '').toString().trim();
      const amountStr = (row['清分金额'] || row['amount'] || '0').toString();
      const amount = parseAmount(amountStr);
      const source = (row['来源'] || row['source'] || 'system_import').toString().trim();
      const dataCaliber = (row['数据口径'] || row['dataCaliber'] || '2026年标准口径').toString().trim();

      const transaction: Transaction | null = row['交易流水号']
        ? {
            id: `trans-${Date.now()}-${idx}`,
            transNo: row['交易流水号'].toString().trim(),
            transTime: row['交易时间']?.toString().trim() || now(),
            amount: parseAmount(row['交易金额']?.toString() || '0'),
            channel: row['支付渠道']?.toString().trim() || '微信支付',
            memo: row['附言']?.toString().trim() || '',
          }
        : null;

      const refund: RefundRequest | null = row['退款申请单号']
        ? {
            id: `refund-${Date.now()}-${idx}`,
            requestNo: row['退款申请单号'].toString().trim(),
            requestTime: row['申请时间']?.toString().trim() || now(),
            amount: parseAmount(row['申请金额']?.toString() || '0'),
            reason: row['退款原因']?.toString().trim() || '',
            applicant: row['申请人']?.toString().trim() || '',
          }
        : null;

      const email: ApprovalEmail | null = row['邮件主题']
        ? {
            id: `email-${Date.now()}-${idx}`,
            subject: row['邮件主题'].toString().trim(),
            sender: row['发件人']?.toString().trim() || '',
            receiver: row['收件人']?.toString().trim() || '',
            sentAt: row['发送时间']?.toString().trim() || now(),
            content: row['邮件内容']?.toString().trim() || '',
          }
        : null;

      const settlement: Settlement = {
        id,
        merchantName,
        amount,
        status: 'pending',
        source: source as any,
        dataCaliber,
        createdAt: now(),
        updatedAt: now(),
        operator: '',
        transactions: transaction ? [transaction] : [],
        refundRequests: refund ? [refund] : [],
        approvalEmails: email ? [email] : [],
        notes: [],
        operationLogs: [],
      };

      const validation = validateSettlementData(settlement);
      if (validation.some(v => v.severity === 'error' && v.field === 'amount' && v.message.includes('不能为负'))) {
        errors.push(`第${idx + 2}行：清分金额不能为负，已跳过`);
        return;
      }

      settlements.push(settlement);
    } catch (e) {
      errors.push(`第${idx + 2}行：数据解析失败 - ${(e as Error).message}`);
    }
  });

  return { settlements, errors };
}

export function processImport(
  newSettlements: Settlement[],
  existingSettlements: Settlement[],
  strategy: ImportStrategy
): { result: ImportResult; finalSettlements: Settlement[] } {
  const existingMap = new Map(existingSettlements.map(s => [s.id, s]));
  const finalSettlements = [...existingSettlements];
  const result: ImportResult = {
    total: newSettlements.length,
    success: 0,
    skipped: 0,
    updated: 0,
    conflict: 0,
    errors: [],
  };

  newSettlements.forEach(ns => {
    const existing = existingMap.get(ns.id);

    if (!existing) {
      finalSettlements.push(ns);
      result.success++;
      return;
    }

    switch (strategy) {
      case 'skip':
        result.skipped++;
        result.errors.push(`批次号 ${ns.id} 已存在，已跳过`);
        break;

      case 'update': {
        const idx = finalSettlements.findIndex(s => s.id === ns.id);
        if (idx !== -1) {
          const updated: Settlement = {
            ...ns,
            createdAt: existing.createdAt,
            operationLogs: [
              ...existing.operationLogs,
              {
                id: `log-${Date.now()}`,
                action: '数据更新',
                operator: '系统导入',
                operatedAt: now(),
                reason: '导入更新覆盖',
                fromStatus: existing.status,
                toStatus: existing.status,
              },
            ],
          };
          finalSettlements[idx] = updated;
          result.updated++;
        }
        break;
      }

      case 'conflict': {
        const idx = finalSettlements.findIndex(s => s.id === ns.id);
        if (idx !== -1) {
          finalSettlements[idx] = {
            ...finalSettlements[idx],
            status: 'conflict',
            operationLogs: [
              ...finalSettlements[idx].operationLogs,
              {
                id: `log-${Date.now()}`,
                action: '冲突标记',
                operator: '系统导入',
                operatedAt: now(),
                reason: '重复导入，标记待人工处理',
                fromStatus: finalSettlements[idx].status,
                toStatus: 'conflict',
              },
            ],
          };
          result.conflict++;
        }
        break;
      }
    }
  });

  return { result, finalSettlements };
}

export function exportToExcel(settlements: Settlement[], filterStatus?: string): void {
  const wb = XLSX.utils.book_new();

  const exportData = (list: Settlement[], status: string) => {
    return list
      .filter(s => !status || status === 'all' || s.status === status)
      .map(s => ({
        批次号: s.id,
        商户名称: s.merchantName,
        清分金额: s.amount,
        原始金额: s.originalAmount || '',
        状态: statusLabel(s.status),
        来源: sourceLabel(s.source),
        数据口径: s.dataCaliber,
        创建时间: s.createdAt,
        处理时间: s.updatedAt,
        操作人: s.operator,
        调整原因: s.adjustmentReason || '',
        收款流水号: s.transactions.map(t => t.transNo).join('; '),
        退款申请号: s.refundRequests.map(r => r.requestNo).join('; '),
        审批邮件主题: s.approvalEmails.map(e => e.subject).join('; '),
      }));
  };

  if (filterStatus && filterStatus !== 'all') {
    const data = exportData(settlements, filterStatus);
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, statusLabel(filterStatus as any));
  } else {
    ['confirmed', 'need_material', 'manual_adjust'].forEach(status => {
      const data = exportData(settlements, status);
      if (data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, statusLabel(status as any));
      }
    });
  }

  const fileName = `社区团购佣金清分_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待审核',
    confirmed: '已确认',
    need_material: '待补材料',
    manual_adjust: '人工改判',
    conflict: '冲突待处理',
  };
  return map[status] || status;
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    system_import: '系统导入',
    manual_entry: '手工录入',
    historical_reconciliation: '月底对账表补录',
  };
  return map[source] || source;
}
