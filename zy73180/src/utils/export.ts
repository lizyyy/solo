import type { AnomalyRecord, AnomalyFilter, CalculationRun } from '@/types';
import { ANOMALY_TYPE_LABELS, STATUS_LABELS } from '@/types';

export function filterAnomalies(anomalies: AnomalyRecord[], filter: AnomalyFilter): AnomalyRecord[] {
  return anomalies.filter(anomaly => {
    if (filter.types.length > 0 && !filter.types.includes(anomaly.type)) {
      return false;
    }

    if (filter.statuses.length > 0 && !filter.statuses.includes(anomaly.status)) {
      return false;
    }

    if (filter.sources.length > 0 && !filter.sources.includes(anomaly.sourceInfo.source)) {
      return false;
    }

    if (filter.searchKeyword) {
      const keyword = filter.searchKeyword.toLowerCase();
      const searchText = [
        anomaly.rawSnapshot[Object.keys(anomaly.rawSnapshot)[0]]?.toString() || '',
        anomaly.rawSnapshot[Object.keys(anomaly.rawSnapshot)[1]]?.toString() || '',
        ANOMALY_TYPE_LABELS[anomaly.type],
        STATUS_LABELS[anomaly.status],
        anomaly.suggestion || '',
      ].join(' ').toLowerCase();

      if (!searchText.includes(keyword)) {
        return false;
      }
    }

    return true;
  });
}

export function groupAnomaliesByType(anomalies: AnomalyRecord[]): Record<string, AnomalyRecord[]> {
  const groups: Record<string, AnomalyRecord[]> = {
    unit_missing: [],
    boundary_sample: [],
    bad_data: [],
    calculation_error: [],
  };

  for (const anomaly of anomalies) {
    if (!groups[anomaly.type]) {
      groups[anomaly.type] = [];
    }
    groups[anomaly.type].push(anomaly);
  }

  return groups;
}

function escapeCsv(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportAnomaliesToCsv(
  anomalies: AnomalyRecord[],
  filter: AnomalyFilter,
  run: CalculationRun
): string {
  const filterMeta = [
    `# 约束规划批量验算 - 异常队列导出`,
    `# 运行名称: ${run.name}`,
    `# 运行时间: ${run.createdAt}`,
    `# 总记录数: ${run.totalCount}`,
    `# 异常记录数: ${run.anomalyCount}`,
    `# 筛选口径:`,
    `#   异常类型: ${filter.types.length ? filter.types.map(t => ANOMALY_TYPE_LABELS[t]).join('、') : '全部'}`,
    `#   处理状态: ${filter.statuses.length ? filter.statuses.map(s => STATUS_LABELS[s]).join('、') : '全部'}`,
    `#   数据来源: ${filter.sources.length ? filter.sources.join('、') : '全部'}`,
    `#   搜索关键词: ${filter.searchKeyword || '无'}`,
    `# 导出记录数: ${anomalies.length}`,
    ``,
  ].join('\n');

  const headers = [
    '异常ID',
    '原始记录ID',
    '数据来源',
    '来源批次',
    '原始行号',
    '异常类型',
    '处理状态',
    '计算值',
    '单位',
    '公式',
    '是否边界样本',
    '边界原因',
    '缺失单位字段',
    '处理建议',
    '原始记录快照',
    '检测时间',
  ];

  const rows = anomalies.map(a => [
    a.id,
    a.answerId,
    a.sourceInfo.source,
    a.sourceInfo.sourceBatch,
    a.sourceInfo.originalRowIndex,
    ANOMALY_TYPE_LABELS[a.type],
    STATUS_LABELS[a.status],
    a.calculation.value?.toFixed(4) ?? '',
    a.calculation.unit ?? '',
    a.calculation.formula,
    a.isBoundary ? '是' : '否',
    a.boundaryReason ?? '',
    a.unitMissingFields?.join('、') ?? '',
    a.suggestion ?? '',
    JSON.stringify(a.rawSnapshot),
    a.detectedAt,
  ].map(escapeCsv).join(','));

  return filterMeta + headers.join(',') + '\n' + rows.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
