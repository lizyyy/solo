import Papa from 'papaparse';
import type { GuaranteeRecord, OperationLog } from '../types';
import type { QueryFilters } from './recordService';
import { queryRecords, getOperationLogs, getStatusLabel, getSourceLabel } from './recordService';

interface ExportRow {
  记录ID: number;
  保证函编号: string;
  客户名称: string;
  金额: number;
  币种: string;
  来源: string;
  来源参考: string;
  当前状态: string;
  待处理原因: string;
  复核原因: string;
  当前处理人: string;
  创建人: string;
  创建时间: string;
  更新时间: string;
  版本: number;
  是否重复: string;
  重复关联ID: string;
  备注: string;
  操作历史: string;
  最新操作: string;
  最新操作人: string;
  最新操作时间: string;
  最新操作原因: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatOperationLogs(logs: OperationLog[]): string {
  return logs.map(log => {
    const time = formatDate(log.createdAt);
    const reason = log.reason ? `（原因：${log.reason}）` : '';
    return `[${time}] ${log.operator} ${log.operation}${reason}`;
  }).join(' | ');
}

export async function exportToCSV(filters: QueryFilters = {}, includeHistory: boolean = true): Promise<string> {
  const { records } = queryRecords(filters, 1, 10000);
  
  const rows: ExportRow[] = [];
  
  for (const record of records) {
    const logs = includeHistory ? getOperationLogs(record.id) : [];
    const latestLog = logs[0];
    
    rows.push({
      记录ID: record.id,
      保证函编号: record.guaranteeNo,
      客户名称: record.customerName,
      金额: record.amount,
      币种: record.currency,
      来源: getSourceLabel(record.source),
      来源参考: record.sourceRef || '',
      当前状态: getStatusLabel(record.status),
      待处理原因: record.pendingReason || '',
      复核原因: record.reviewReason || '',
      当前处理人: record.currentOperator,
      创建人: record.createdBy,
      创建时间: formatDate(record.createdAt),
      更新时间: formatDate(record.updatedAt),
      版本: record.version,
      是否重复: record.isDuplicate ? '是' : '否',
      重复关联ID: record.duplicateWith ? `#${record.duplicateWith}` : '',
      备注: record.remark || '',
      操作历史: includeHistory ? formatOperationLogs(logs) : '',
      最新操作: latestLog?.operation || '',
      最新操作人: latestLog?.operator || '',
      最新操作时间: latestLog ? formatDate(latestLog.createdAt) : '',
      最新操作原因: latestLog?.reason || ''
    });
  }
  
  const csv = Papa.unparse(rows, {
    quotes: true
  });
  
  const BOM = '\uFEFF';
  return BOM + csv;
}

export function generateReviewList(records: GuaranteeRecord[]): string {
  const now = new Date().toLocaleString('zh-CN');
  let content = `保证函额度排队 - 复核清单\n`;
  content += `导出时间：${now}\n`;
  content += `记录总数：${records.length}\n`;
  content += `${'='.repeat(80)}\n\n`;
  
  records.forEach((record, index) => {
    content += `【${index + 1}】记录ID: #${record.id}\n`;
    content += `    保证函编号: ${record.guaranteeNo}\n`;
    content += `    客户名称: ${record.customerName}\n`;
    content += `    金额: ${record.currency} ${record.amount.toLocaleString()}\n`;
    content += `    来源: ${getSourceLabel(record.source)}${record.sourceRef ? ` (${record.sourceRef})` : ''}\n`;
    content += `    当前状态: ${getStatusLabel(record.status)}\n`;
    
    if (record.pendingReason) {
      content += `    待处理原因: ${record.pendingReason}\n`;
    }
    if (record.reviewReason) {
      content += `    复核原因: ${record.reviewReason}\n`;
    }
    if (record.isDuplicate) {
      content += `    注意: 疑似重复记录，关联ID #${record.duplicateWith}\n`;
    }
    
    content += `    当前处理人: ${record.currentOperator}\n`;
    content += `    创建时间: ${formatDate(record.createdAt)}\n`;
    content += `\n`;
  });
  
  content += `${'='.repeat(80)}\n`;
  content += `说明：\n`;
  content += `- 待处理(pending)：需要处理的新记录\n`;
  content += `- 待复核(disputed)：系统检测到重复授信，需要人工确认\n`;
  content += `- 已通过(approved)：审核通过\n`;
  content += `- 已驳回(rejected)：审核驳回\n`;
  content += `- 已撤回(withdrawn)：已撤回修正\n`;
  content += `\n`;
  content += `下一班处理提示：\n`;
  content += `1. 优先处理【待复核】记录，确认是否为重复授信\n`;
  content += `2. 处理【待处理】记录，参考待处理原因\n`;
  content += `3. 每条记录的操作历史可在系统中查看详情\n`;
  
  return content;
}

export function getStatistics(records: GuaranteeRecord[]): Record<string, any> {
  const stats: Record<string, any> = {
    total: records.length,
    byStatus: {} as Record<string, { count: number; label: string }>,
    bySource: {} as Record<string, { count: number; label: string }>,
    duplicates: 0,
    pendingTotal: 0,
    disputedTotal: 0
  };
  
  records.forEach(record => {
    const statusLabel = getStatusLabel(record.status);
    const sourceLabel = getSourceLabel(record.source);
    
    if (!stats.byStatus[record.status]) {
      stats.byStatus[record.status] = { count: 0, label: statusLabel };
    }
    stats.byStatus[record.status].count++;
    
    if (!stats.bySource[record.source]) {
      stats.bySource[record.source] = { count: 0, label: sourceLabel };
    }
    stats.bySource[record.source].count++;
    
    if (record.isDuplicate) stats.duplicates++;
    if (record.status === 'pending') stats.pendingTotal++;
    if (record.status === 'disputed') stats.disputedTotal++;
  });
  
  return stats;
}
