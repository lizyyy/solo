import { format as dateFnsFormat, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { FundRedemption, Material, MaterialType, ConflictInfo, Stats, RedemptionStatus, FilterOptions } from '@/types';
import { STATUS_LABELS, MATERIAL_TYPE_LABELS, CSV_HEADERS, OPERATOR } from '@/data/constants';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string, pattern: string = 'yyyy-MM-dd'): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return dateFnsFormat(date, pattern, { locale: zhCN });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  return formatDate(dateStr, 'yyyy-MM-dd HH:mm:ss');
}

export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
  } catch {
    return dateStr;
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function getStatusLabel(status: RedemptionStatus): string {
  return STATUS_LABELS[status] || status;
}

export function getMaterialTypeLabel(type: string): string {
  return MATERIAL_TYPE_LABELS[type as keyof typeof MATERIAL_TYPE_LABELS] || type;
}

export function getMaterialByType(materials: Material[], type: string): Material | undefined {
  return materials.find(m => m.type === type);
}

export function checkMissingMaterials(materials: Material[]): string[] {
  const required: MaterialType[] = ['receipt', 'refund'];
  const existing = materials.map(m => m.type);
  return required.filter(r => !existing.includes(r));
}

export function hasAllMaterials(materials: Material[]): boolean {
  return checkMissingMaterials(materials).length === 0;
}

export function getMaterialStatusText(materials: Material[]): string {
  const missing = checkMissingMaterials(materials);
  if (missing.length === 0) return '材料齐全';
  const missingLabels = missing.map(m => getMaterialTypeLabel(m));
  return `缺${missingLabels.join('、')}`;
}

export function detectConflicts(materials: Material[]): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const email = getMaterialByType(materials, 'email');
  const importData = getMaterialByType(materials, 'import');
  const receipt = getMaterialByType(materials, 'receipt');
  const refund = getMaterialByType(materials, 'refund');

  const allAmounts = [email, importData, receipt, refund]
    .filter(Boolean)
    .map(m => ({ type: m!.type, amount: m!.amount, label: getMaterialTypeLabel(m!.type) }));

  if (allAmounts.length >= 2) {
    const amounts = allAmounts.map(a => a.amount);
    const max = Math.max(...amounts);
    const min = Math.min(...amounts);
    if (max - min > 0.01) {
      const emailAmount = email ? formatCurrency(email.amount) : '-';
      const importAmount = importData ? formatCurrency(importData.amount) : '-';
      conflicts.push({
        type: 'amount',
        field: '金额',
        emailValue: emailAmount,
        importValue: importAmount,
        diff: formatCurrency(max - min),
        suggestion: `多份材料金额不一致（${allAmounts.map(a => `${a.label}:${formatCurrency(a.amount)}`).join('，')}），建议与渠道确认实际到账金额后再处理`,
      });
    }
  }

  const allDates = [email, importData, receipt, refund]
    .filter(Boolean)
    .map(m => ({ type: m!.type, date: m!.date, label: getMaterialTypeLabel(m!.type) }));

  if (allDates.length >= 2) {
    const uniqueDates = [...new Set(allDates.map(d => d.date))];
    if (uniqueDates.length > 1) {
      const emailDate = email ? formatDate(email.date) : '-';
      const importDate = importData ? formatDate(importData.date) : '-';
      conflicts.push({
        type: 'date',
        field: '日期',
        emailValue: emailDate,
        importValue: importDate,
        diff: `存在${uniqueDates.length}个不同日期`,
        suggestion: `多份材料日期不一致（${allDates.map(d => `${d.label}:${formatDate(d.date)}`).join('，')}），建议确认实际交易日期`,
      });
    }
  }

  return conflicts;
}

export function hasConflicts(materials: Material[]): boolean {
  return detectConflicts(materials).length > 0;
}

export function calculateStats(redemptions: FundRedemption[]): Stats {
  const stats: Stats = {
    confirmed: { count: 0, amount: 0 },
    pending: { count: 0, amount: 0 },
    manual: { count: 0, amount: 0 },
    total: { count: 0, amount: 0 },
  };

  redemptions.forEach(r => {
    stats.total.count++;
    stats.total.amount += r.applyAmount;
    if (r.status === 'confirmed') {
      stats.confirmed.count++;
      stats.confirmed.amount += r.applyAmount;
    } else if (r.status === 'pending') {
      stats.pending.count++;
      stats.pending.amount += r.applyAmount;
    } else if (r.status === 'manual') {
      stats.manual.count++;
      stats.manual.amount += r.applyAmount;
    }
  });

  return stats;
}

export function filterRedemptions(
  redemptions: FundRedemption[],
  filters: FilterOptions
): FundRedemption[] {
  return redemptions.filter(r => {
    if (filters.status !== 'all' && r.status !== filters.status) return false;
    
    if (filters.dateFrom && r.applyDate < filters.dateFrom) return false;
    if (filters.dateTo && r.applyDate > filters.dateTo) return false;
    
    if (filters.minAmount && r.applyAmount < parseFloat(filters.minAmount)) return false;
    if (filters.maxAmount && r.applyAmount > parseFloat(filters.maxAmount)) return false;
    
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      return (
        r.fundCode.toLowerCase().includes(keyword) ||
        r.fundName.toLowerCase().includes(keyword) ||
        r.applicant.toLowerCase().includes(keyword) ||
        r.queueReason.toLowerCase().includes(keyword)
      );
    }
    
    return true;
  });
}

function csvEscape(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(
  redemptions: FundRedemption[],
  status: RedemptionStatus | 'all',
  index: number = 1
): string {
  const filtered = status === 'all' 
    ? redemptions 
    : redemptions.filter(r => r.status === status);

  if (filtered.length === 0) return '';

  let csvContent = CSV_HEADERS.map(csvEscape).join(',') + '\n';

  filtered.forEach((r, i) => {
    const lastLog = r.operationLogs[r.operationLogs.length - 1];
    const row = [
      index + i,
      r.fundCode,
      r.fundName,
      r.applyAmount.toFixed(2),
      formatDate(r.applyDate),
      formatDate(r.expectArriveDate),
      r.applicant,
      getStatusLabel(r.status),
      r.queueReason,
      getMaterialStatusText(r.materials),
      lastLog?.operator || OPERATOR,
      lastLog ? formatDateTime(lastLog.createdAt) : formatDateTime(r.updatedAt),
      r.remarks.length,
    ];
    csvContent += row.map(csvEscape).join(',') + '\n';
  });

  return '\uFEFF' + csvContent;
}

export function downloadCSV(content: string, filename: string): void {
  if (!content) return;
  
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getExportFilename(status: RedemptionStatus | 'all'): string {
  const today = formatDate(new Date().toISOString(), 'yyyyMMdd');
  const statusLabel = status === 'all' ? '全部' : getStatusLabel(status);
  return `基金赎回预约排队_${statusLabel}_${today}.csv`;
}

export function getLastOperator(redemption: FundRedemption): string {
  const lastLog = redemption.operationLogs[redemption.operationLogs.length - 1];
  return lastLog?.operator || OPERATOR;
}

export function getLastOperationTime(redemption: FundRedemption): string {
  const lastLog = redemption.operationLogs[redemption.operationLogs.length - 1];
  return lastLog ? formatDateTime(lastLog.createdAt) : formatDateTime(redemption.updatedAt);
}
