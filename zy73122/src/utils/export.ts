import type { BuoyRecord } from '../types';

export function exportToCSV(records: BuoyRecord[]): void {
  const headers = [
    '浮标编号',
    '记录时间',
    '纬度(十进)',
    '经度(十进)',
    '纬度(船上格式)',
    '经度(船上格式)',
    '海况等级',
    '波高(m)',
    '风速(m/s)',
    '状态',
    '是否异常',
    '是否边界样本',
    '是否云遮挡',
    '人工备注',
    '记录本页码',
    '计算口径版本',
  ];

  const statusMap: Record<string, string> = {
    pending: '待复核',
    reviewed: '已复核',
    anomaly: '异常',
    boundary: '边界样本',
  };

  const rows = records.map(r => [
    r.buoyId,
    r.recordTime,
    r.latitude.toFixed(4),
    r.longitude.toFixed(4),
    r.rawLogEntry.latRaw,
    r.rawLogEntry.lonRaw,
    r.seaState,
    r.waveHeight,
    r.windSpeed,
    statusMap[r.status] || r.status,
    r.isAnomaly ? '是' : '否',
    r.isBoundary ? '是' : '否',
    r.isCloudOccluded ? '是' : '否',
    r.manualRemark || '',
    r.rawLogEntry.logPage,
    r.calculationCriteria.version,
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `浮标海况标注_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToGeoJSON(records: BuoyRecord[]): void {
  const geojson = {
    type: 'FeatureCollection',
    features: records.map(r => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [r.longitude, r.latitude],
      },
      properties: {
        buoyId: r.buoyId,
        recordTime: r.recordTime,
        seaState: r.seaState,
        waveHeight: r.waveHeight,
        windSpeed: r.windSpeed,
        status: r.status,
        isAnomaly: r.isAnomaly,
        isBoundary: r.isBoundary,
        isCloudOccluded: r.isCloudOccluded,
        latRaw: r.rawLogEntry.latRaw,
        lonRaw: r.rawLogEntry.lonRaw,
        manualRemark: r.manualRemark || '',
      },
    })),
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `浮标海况空间数据_${new Date().toISOString().slice(0, 10)}.geojson`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
