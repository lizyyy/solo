import type { BuoyRecord } from '../types';
import { formatLatitude, formatLongitude } from './coordinate';

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

export function generateSampleRecords(): BuoyRecord[] {
  const now = new Date();
  const records: BuoyRecord[] = [];

  const buoyData = [
    { id: 'FY-001', lat: 30.25, lon: 122.5, latRaw: "30°15'N", lonRaw: "122°30'E" },
    { id: 'FY-002', lat: 31.08, lon: 123.2, latRaw: "31°05'N", lonRaw: "123°12'E" },
    { id: 'FY-003', lat: 29.75, lon: 122.0, latRaw: "29°45'N", lonRaw: "122°00'E" },
    { id: 'FY-004', lat: 30.83, lon: 121.67, latRaw: "30°50'N", lonRaw: "121°40'E" },
    { id: 'FY-005', lat: 32.17, lon: 124.0, latRaw: "32°10'N", lonRaw: "124°00'E" },
  ];

  const seaStates = [2, 3, 4, 5, 3, 6, 2, 4, 3, 5, 7, 3];
  const statuses: BuoyRecord['status'][] = ['reviewed', 'pending', 'anomaly', 'boundary', 'reviewed'];

  for (let i = 0; i < 12; i++) {
    const buoy = buoyData[i % buoyData.length];
    const dayOffset = Math.floor(i / buoyData.length);
    const recordDate = new Date(now);
    recordDate.setDate(recordDate.getDate() - dayOffset);
    recordDate.setHours(6 + (i % 4) * 3, 0, 0, 0);

    const isAnomaly = i === 2 || i === 7;
    const isBoundary = i === 5;
    const isCloudOccluded = i === 9;

    records.push({
      id: `rec-${i + 1}`,
      buoyId: buoy.id,
      recordTime: recordDate.toISOString(),
      latitude: buoy.lat + (Math.random() - 0.5) * 0.1,
      longitude: buoy.lon + (Math.random() - 0.5) * 0.1,
      rawLogEntry: {
        latRaw: buoy.latRaw,
        lonRaw: buoy.lonRaw,
        logPage: `第${Math.floor(i / 4) + 12}页`,
        logDate: recordDate.toISOString().slice(0, 10),
        notes: isBoundary ? '靠近观测区边界，需特别注意' : undefined,
      },
      seaState: isAnomaly ? 8 : seaStates[i],
      waveHeight: (isAnomaly ? 6.5 : 0.5 + seaStates[i] * 0.6),
      windSpeed: isAnomaly ? 18 : 4 + seaStates[i] * 1.5,
      status: isAnomaly ? 'anomaly' : (isBoundary ? 'boundary' : statuses[i % statuses.length]),
      isAnomaly,
      isBoundary,
      isCloudOccluded,
      manualRemark: i === 3 ? '人工复核确认：数据正常' : undefined,
      calculationCriteria: {
        formula: '海况等级 = 0.8 × 波高 + 0.2 × 风速系数',
        threshold: 6.0,
        version: 'v2.3.1',
        calculatedAt: new Date(now.getTime() - 3600000).toISOString(),
      },
      createdAt: recordDate.toISOString(),
      updatedAt: recordDate.toISOString(),
    });
  }

  return records;
}

export function generateSampleMappings() {
  return [
    {
      id: 'map-1',
      buoyId: 'FY-001',
      rawFormat: '度分格式（带方向）',
      standardLat: 30.25,
      standardLon: 122.5,
      rawLatExample: "30°15'N",
      rawLonExample: "122°30'E",
      description: '船上使用度分制，北纬东经为正，除以60转换为十进制度',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'map-2',
      buoyId: 'FY-002',
      rawFormat: '中文度分格式',
      standardLat: 31.083,
      standardLon: 123.2,
      rawLatExample: '31度5分',
      rawLonExample: '123度12分',
      description: '中文描述格式，需提取数字并转换',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'map-3',
      buoyId: 'FY-005',
      rawFormat: '十进制度（无方向符号）',
      standardLat: 32.167,
      standardLon: 124.0,
      rawLatExample: '32.167',
      rawLonExample: '124.0',
      description: '直接使用十进制度，默认北纬东经',
      createdAt: new Date().toISOString(),
    },
  ];
}

export function generateCloudSuggestions() {
  return [
    {
      id: 'cloud-1',
      recordId: 'rec-10',
      suggestion: '该点遥感数据存在云遮挡，建议结合邻近浮标FY-002的数据进行插值修正，或等待下一批次无云影像复核。',
      severity: 'medium' as const,
      referenceDoc: '《海洋遥感数据云遮挡处理规范v1.2》第3.2节',
    },
  ];
}
