import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Registration, StatusHistory, Anomaly } from '@/types';
import { STATUS_META, ANOMALY_META } from '@/types';

const generateExportId = () => {
  const now = new Date();
  const dateStr = format(now, 'yyyyMMddHHmmss');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EXP-${dateStr}-${random}`;
};

function getStatusChain(histories: StatusHistory[]): string {
  const sorted = [...histories].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const statusLabels = sorted.map((h) => {
    const meta = (STATUS_META as any)[h.toStatus];
    return meta?.label || h.toStatus;
  });
  return statusLabels.join('→');
}

function getAnomalyTags(anomalies: Anomaly[]): string {
  const types = [...new Set(anomalies.map((a) => a.type))];
  return types.map((t) => `[${(ANOMALY_META as any)[t]?.shortLabel || t}]`).join('');
}

function getLastHistory(histories: StatusHistory[]): StatusHistory | null {
  if (histories.length === 0) return null;
  return [...histories].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

function getLastSwapReason(histories: StatusHistory[]): string {
  const swapHistory = [...histories]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .find((h) => h.toStatus === 'swapped');
  if (swapHistory && swapHistory.swapFrom && swapHistory.swapTo) {
    return `调换原因：${swapHistory.reason}；原作品：${swapHistory.swapFrom} → 新作品：${swapHistory.swapTo}`;
  }
  return '';
}

export interface ExportFilter {
  status?: string;
  hasAnomaly?: boolean;
  anomalyType?: string;
  searchText?: string;
}

export function exportToCSV(
  registrations: Registration[],
  histories: StatusHistory[],
  anomalies: Anomaly[],
  filter: ExportFilter,
  operator: string
): { csv: string; exportId: string; exportedAt: string } {
  const exportId = generateExportId();
  const exportedAt = new Date().toISOString();

  const headers = [
    '作品名称',
    '艺术家',
    '报名人',
    '联系方式',
    '当前状态',
    '展位',
    '备注',
    '最后变更人',
    '最后变更时间',
    '最后变更原因',
    '调换复核说明',
    '历史状态链',
    '异常标记',
    '数据来源',
    '记录ID',
    '导出编号',
    '导出时间',
    '导出人',
    '筛选条件',
  ];

  const filterCriteria = Object.entries(filter)
    .filter(([, v]) => v !== undefined && v !== '' && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  const rows = registrations.map((reg) => {
    const regHistories = histories.filter((h) => h.registrationId === reg.id);
    const regAnomalies = anomalies.filter((a) => a.registrationId === reg.id);
    const lastHistory = getLastHistory(regHistories);
    const statusMeta = (STATUS_META as any)[reg.status];
    const swapReason = getLastSwapReason(regHistories);
    const sourceMap: Record<string, string> = {
      manual: '手动录入',
      import: '批量导入',
      correction: '人工更正',
    };

    return [
      reg.artworkName,
      reg.artist,
      reg.registrant,
      reg.contact,
      statusMeta?.label || reg.status,
      reg.location || '',
      reg.notes || '',
      lastHistory?.operator || '',
      lastHistory?.createdAt || reg.updatedAt,
      lastHistory?.reason || '',
      swapReason,
      getStatusChain(regHistories),
      getAnomalyTags(regAnomalies),
      sourceMap[reg.source] || reg.source,
      reg.id,
      exportId,
      exportedAt,
      operator,
      filterCriteria,
    ];
  });

  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCSV(String(cell))).join(',')),
  ].join('\n');

  const bom = '\uFEFF';
  return {
    csv: bom + csvContent,
    exportId,
    exportedAt,
  };
}

export function downloadCSV(csv: string, exportId: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `布展清单_${exportId}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAnomalyReport(
  anomalies: Anomaly[],
  registrations: Registration[],
  operator: string
): { csv: string; exportId: string } {
  const exportId = generateExportId();
  const exportedAt = new Date().toISOString();

  const headers = [
    '异常ID',
    '异常类型',
    '严重程度',
    '涉及作品',
    '艺术家',
    '涉及记录ID',
    '异常描述',
    '检测规则',
    '处理建议',
    '检测时间',
    '处理状态',
    '处理人',
    '处理时间',
    '导出编号',
    '导出时间',
    '导出人',
  ];

  const severityMap: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };

  const typeMap: Record<string, string> = {
    duplicate: '重复项',
    late_attachment: '晚到附件',
    missing_info: '信息缺失',
    conflict: '展位冲突',
    swap_record: '调换记录',
  };

  const rows = anomalies.map((a) => {
    const reg = registrations.find((r) => r.id === a.registrationId);
    return [
      a.id,
      typeMap[a.type] || a.type,
      severityMap[a.severity] || a.severity,
      reg?.artworkName || '',
      reg?.artist || '',
      a.registrationId,
      a.description,
      a.rule,
      a.suggestion,
      a.detectedAt,
      a.resolvedAt ? '已处理' : '待处理',
      a.resolver || '',
      a.resolvedAt || '',
      exportId,
      exportedAt,
      operator,
    ];
  });

  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCSV(String(cell))).join(',')),
  ].join('\n');

  const bom = '\uFEFF';
  return {
    csv: bom + csvContent,
    exportId,
  };
}
