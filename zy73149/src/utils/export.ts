import type { SedimentRecord, FilterState, ExportOptions, ReportVersion } from '@/types';
import { formatLatLng } from './coordinate';
import { formatDepth, getSedimentLevelLabel } from './sediment';

export function exportToCSV(
  records: SedimentRecord[],
  version: ReportVersion,
  options: ExportOptions,
  filter?: FilterState
): string {
  const headers = [
    'ID',
    '时间',
    '来源',
    '纬度',
    '经度',
    '淤积深度',
    '淤积等级',
    '是否正常',
    '异常类型',
    '备注',
  ];

  if (options.includeRawData) {
    headers.push('原始纬度', '原始经度');
  }

  if (options.embedFilter && filter) {
    const filterStr = encodeFilterState(filter);
    headers.push(`筛选条件: ${filterStr}`);
  }

  const rows = records.map((r) => {
    const row = [
      r.id,
      r.timestamp,
      r.source === 'buoy' ? '浮标' : '遥感',
      formatLatLng(r.latitude, r.longitude, version.params.coordinateFormat).split(', ')[0],
      formatLatLng(r.latitude, r.longitude, version.params.coordinateFormat).split(', ')[1],
      formatDepth(r.sedimentDepth, version.params.depthUnit),
      getSedimentLevelLabel(r.sedimentLevel),
      r.isNormal ? '是' : '否',
      getAnomalyTypeLabel(r.anomalyType),
      r.remark || '',
    ];

    if (options.includeRawData) {
      row.push(r.rawLatitude, r.rawLongitude);
    }

    return row;
  });

  let csv = '\uFEFF';

  csv += `# 港湾淤积报告汇总\n`;
  csv += `# 版本: ${version.name}\n`;
  csv += `# 生成时间: ${version.createdAt}\n`;
  csv += `# 操作人: ${version.operator}\n`;
  csv += `# 备注: ${version.remark}\n`;
  csv += `\n`;

  csv += headers.join(',') + '\n';
  csv += rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

  return csv;
}

export function exportToJSON(
  records: SedimentRecord[],
  version: ReportVersion,
  options: ExportOptions,
  filter?: FilterState
): string {
  const data = {
    exportInfo: {
      system: '港湾淤积报告汇总系统',
      exportTime: new Date().toISOString(),
      version: {
        id: version.id,
        name: version.name,
        createdAt: version.createdAt,
        operator: version.operator,
        remark: version.remark,
        params: version.params,
      },
    },
    filter: options.embedFilter ? filter : null,
    records: options.includeRawData
      ? records
      : records.map(({ rawLatitude, rawLongitude, rawData, ...rest }) => rest),
  };

  return JSON.stringify(data, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function encodeFilterState(filter: FilterState): string {
  return btoa(encodeURIComponent(JSON.stringify(filter)));
}

export function decodeFilterState(encoded: string): FilterState | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded)));
  } catch {
    return null;
  }
}

function getAnomalyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    none: '无',
    cloudCover: '云遮挡',
    missingData: '数据缺失',
    outOfRange: '超出范围',
  };
  return labels[type] || type;
}

export function getSourceLabel(source: 'buoy' | 'remoteSensing'): string {
  return source === 'buoy' ? '浮标' : '遥感';
}
