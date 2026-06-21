import type { ReportVersion, SedimentRecord, ReportParams } from '@/types';
import { calculateSedimentLevel } from '@/utils/sediment';

const paramsV1: ReportParams = {
  sedimentThreshold: 0.5,
  depthUnit: 'meter',
  coordinateFormat: 'decimal',
  includeAnomaly: false,
  dataSources: ['buoy'],
  baselineDepth: 12.5,
};

const paramsV2: ReportParams = {
  sedimentThreshold: 0.5,
  depthUnit: 'meter',
  coordinateFormat: 'decimal',
  includeAnomaly: true,
  dataSources: ['buoy', 'remoteSensing'],
  baselineDepth: 12.0,
};

const paramsV3: ReportParams = {
  sedimentThreshold: 0.3,
  depthUnit: 'meter',
  coordinateFormat: 'dms',
  includeAnomaly: true,
  dataSources: ['buoy', 'remoteSensing'],
  baselineDepth: 12.0,
};

export const mockVersions: ReportVersion[] = [
  {
    id: 'v3',
    name: '2026年6月第3次汇总',
    remark: '调整淤积阈值至0.3米，输出格式改为度分秒，补充3#浮标后补说明，新增7#8#浮标与遥感D区云遮挡记录',
    createdAt: '2026-06-17 15:42:18',
    operator: '老何',
    params: paramsV3,
    recordCount: 12,
    normalCount: 9,
    anomalyCount: 3,
    cloudCoverCount: 1,
  },
  {
    id: 'v2',
    name: '2026年6月第2次汇总',
    remark: '加入遥感数据，基准水深调为12.0米，淤积阈值0.5米，包含异常',
    createdAt: '2026-06-12 10:15:33',
    operator: '老何',
    params: paramsV2,
    recordCount: 10,
    normalCount: 8,
    anomalyCount: 2,
    cloudCoverCount: 1,
  },
  {
    id: 'v1',
    name: '2026年6月第1次汇总',
    remark: '初始版本，仅浮标数据，基准水深12.5米，不含异常记录',
    createdAt: '2026-06-05 09:08:47',
    operator: '老何',
    params: paramsV1,
    recordCount: 6,
    normalCount: 6,
    anomalyCount: 0,
    cloudCoverCount: 0,
  },
];

const makeBuoy = (
  id: string,
  versionId: string,
  options: {
    rawLat: string;
    rawLng: string;
    lat: number;
    lng: number;
    time: string;
    baseline: number;
    measured: number | undefined;
    format: 'decimal' | 'dms' | 'dm';
    remark?: string;
    isNormal?: boolean;
    anomalyType?: 'none' | 'cloudCover' | 'missingData' | 'outOfRange';
    anomalyDetail?: string;
    threshold: number;
  }
): SedimentRecord => {
  const sediment =
    options.measured !== undefined ? options.baseline - options.measured : 0;
  const level = calculateSedimentLevel(sediment, options.threshold);
  const isNormal = options.isNormal ?? options.measured !== undefined;
  return {
    id,
    versionId,
    rawLatitude: options.rawLat,
    rawLongitude: options.rawLng,
    latitude: options.lat,
    longitude: options.lng,
    timestamp: options.time,
    source: 'buoy',
    sedimentDepth: sediment,
    sedimentLevel: isNormal ? level : 'normal',
    isNormal,
    anomalyType: options.anomalyType ?? (isNormal ? 'none' : 'missingData'),
    anomalyDetail: options.anomalyDetail,
    coordinateFormatDetected: options.format,
    baselineDepth: options.baseline,
    measuredDepth: options.measured,
    remark: options.remark,
  };
};

const makeRemote = (
  id: string,
  versionId: string,
  options: {
    rawLat: string;
    rawLng: string;
    lat: number;
    lng: number;
    time: string;
    sediment: number;
    cloudRate: number;
    threshold: number;
    remark?: string;
    isNormal?: boolean;
    anomalyType?: 'none' | 'cloudCover' | 'missingData' | 'outOfRange';
    anomalyDetail?: string;
    format: 'decimal' | 'dms' | 'dm';
  }
): SedimentRecord => {
  const level = calculateSedimentLevel(options.sediment, options.threshold);
  const cloudCover = options.cloudRate >= 0.5;
  const isNormal = options.isNormal ?? !cloudCover;
  return {
    id,
    versionId,
    rawLatitude: options.rawLat,
    rawLongitude: options.rawLng,
    latitude: options.lat,
    longitude: options.lng,
    timestamp: options.time,
    source: 'remoteSensing',
    sedimentDepth: isNormal ? options.sediment : 0,
    sedimentLevel: isNormal ? level : 'normal',
    isNormal,
    anomalyType: options.anomalyType ?? (cloudCover ? 'cloudCover' : 'none'),
    anomalyDetail:
      options.anomalyDetail ??
      (cloudCover
        ? `云覆盖率${(options.cloudRate * 100).toFixed(0)}%，数据不可靠，已标记为异常`
        : undefined),
    coordinateFormatDetected: options.format,
    cloudCoverRate: options.cloudRate,
    remark: options.remark,
  };
};

const t1 = '2026-06-16 08:30:00';
const t2 = '2026-06-16 09:15:00';
const t3 = '2026-06-16 10:00:00';
const t4 = '2026-06-16 11:20:00';
const t5 = '2026-06-16 13:45:00';
const t6 = '2026-06-16 14:30:00';
const t7 = '2026-06-15 10:00:00';
const t8 = '2026-06-16 07:55:00';
const t9 = '2026-06-16 12:10:00';

export const mockRecordsV1: SedimentRecord[] = [
  makeBuoy('rec-001', 'v1', {
    rawLat: '38.912345', rawLng: '117.876543', lat: 38.912345, lng: 117.876543,
    time: t1, baseline: 12.5, measured: 11.68, format: 'decimal', threshold: 0.5,
    remark: '1#浮标，数据正常（首次采集）',
  }),
  makeBuoy('rec-002', 'v1', {
    rawLat: '38°54\'26.5"N', rawLng: '117°23\'15.8"E', lat: 38.907361, lng: 117.387722,
    time: t2, baseline: 12.5, measured: 11.25, format: 'dms', threshold: 0.5,
    remark: '2#浮标，度分秒格式原始数据',
  }),
  makeBuoy('rec-003', 'v1', {
    rawLat: '38°55.5\'N', rawLng: '117°45.2\'E', lat: 38.925, lng: 117.753333,
    time: t3, baseline: 12.5, measured: 12.05, format: 'dm', threshold: 0.5,
  }),
  makeBuoy('rec-004', 'v1', {
    rawLat: '39.023456', rawLng: '118.123456', lat: 39.023456, lng: 118.123456,
    time: t4, baseline: 12.5, measured: 12.32, format: 'decimal', threshold: 0.5,
    remark: '4#浮标，航道入口处',
  }),
  makeBuoy('rec-005', 'v1', {
    rawLat: '38.876543', rawLng: '117.654321', lat: 38.876543, lng: 117.654321,
    time: t5, baseline: 12.5, measured: 11.78, format: 'decimal', threshold: 0.5,
    remark: '5#浮标，锚地区域',
  }),
  makeBuoy('rec-006', 'v1', {
    rawLat: '38°49\'30.0"N', rawLng: '117°55\'0.0"E', lat: 38.825, lng: 117.916667,
    time: t6, baseline: 12.5, measured: 11.87, format: 'dms', threshold: 0.5,
    remark: '6#浮标',
  }),
];

export const mockRecordsV2: SedimentRecord[] = [
  makeBuoy('rec-001', 'v2', {
    rawLat: '38.912345', rawLng: '117.876543', lat: 38.912345, lng: 117.876543,
    time: t1, baseline: 12.0, measured: 11.18, format: 'decimal', threshold: 0.5,
    remark: '1#浮标，数据正常',
  }),
  makeBuoy('rec-002', 'v2', {
    rawLat: '38°54\'26.5"N', rawLng: '117°23\'15.8"E', lat: 38.907361, lng: 117.387722,
    time: t2, baseline: 12.0, measured: 10.75, format: 'dms', threshold: 0.5,
    remark: '2#浮标，度分秒格式原始数据，基准水深已调为12.0米',
  }),
  makeBuoy('rec-003', 'v2', {
    rawLat: '38°55.5\'N', rawLng: '117°45.2\'E', lat: 38.925, lng: 117.753333,
    time: t3, baseline: 12.0, measured: 11.55, format: 'dm', threshold: 0.5,
    remark: '3#浮标，待维护后补测',
  }),
  makeBuoy('rec-004', 'v2', {
    rawLat: '39.023456', rawLng: '118.123456', lat: 39.023456, lng: 118.123456,
    time: t4, baseline: 12.0, measured: 11.82, format: 'decimal', threshold: 0.5,
    remark: '4#浮标，航道入口处',
  }),
  makeBuoy('rec-005', 'v2', {
    rawLat: '38.876543', rawLng: '117.654321', lat: 38.876543, lng: 117.654321,
    time: t5, baseline: 12.0, measured: 11.28, format: 'decimal', threshold: 0.5,
    remark: '5#浮标，锚地区域',
  }),
  makeBuoy('rec-006', 'v2', {
    rawLat: '38°49\'30.0"N', rawLng: '117°55\'0.0"E', lat: 38.825, lng: 117.916667,
    time: t6, baseline: 12.0, measured: 11.37, format: 'dms', threshold: 0.5,
    remark: '6#浮标',
  }),
  makeRemote('rec-007', 'v2', {
    rawLat: '38.955555', rawLng: '117.888888', lat: 38.955555, lng: 117.888888,
    time: t7, sediment: 0.95, cloudRate: 0.05, threshold: 0.5, format: 'decimal',
    remark: '遥感影像A区，云量5%，数据质量良好',
  }),
  makeRemote('rec-008', 'v2', {
    rawLat: '39°0\'12"N', rawLng: '117°30\'45"E', lat: 39.003333, lng: 117.5125,
    time: t7, sediment: 0.55, cloudRate: 0.12, threshold: 0.5, format: 'dms',
    remark: '遥感影像B区',
  }),
  makeRemote('rec-009', 'v2', {
    rawLat: '38.823456', rawLng: '117.765432', lat: 38.823456, lng: 117.765432,
    time: t7, sediment: 1.42, cloudRate: 0.08, threshold: 0.5, format: 'decimal',
    remark: '遥感影像C区，淤积略高，持续观察',
  }),
  makeRemote('rec-010', 'v2', {
    rawLat: '38.789012', rawLng: '117.901234', lat: 38.789012, lng: 117.901234,
    time: t7, sediment: 0.6, cloudRate: 0.75, threshold: 0.5, format: 'decimal',
    remark: '遥感影像D区，云层遮挡',
    anomalyType: 'cloudCover',
    isNormal: false,
  }),
];

export const mockRecordsV3: SedimentRecord[] = [
  makeBuoy('rec-001', 'v3', {
    rawLat: '38.912345', rawLng: '117.876543', lat: 38.912345, lng: 117.876543,
    time: t1, baseline: 12.0, measured: 11.18, format: 'decimal', threshold: 0.3,
    remark: '1#浮标，数据正常（阈值已调至0.3米）',
  }),
  makeBuoy('rec-002', 'v3', {
    rawLat: '38°54\'26.5"N', rawLng: '117°23\'15.8"E', lat: 38.907361, lng: 117.387722,
    time: t2, baseline: 12.0, measured: 10.75, format: 'dms', threshold: 0.3,
    remark: '2#浮标，度分秒格式原始数据，淤积严重需疏浚',
  }),
  makeBuoy('rec-003', 'v3', {
    rawLat: '38°55.5\'N', rawLng: '117°45.2\'E', lat: 38.925, lng: 117.753333,
    time: t3, baseline: 12.0, measured: 11.55, format: 'dm', threshold: 0.3,
    remark: '3#浮标，原始数据缺水深，后补说明：6月14日维护后补测，数据仅供参考',
  }),
  makeBuoy('rec-004', 'v3', {
    rawLat: '39.023456', rawLng: '118.123456', lat: 39.023456, lng: 118.123456,
    time: t4, baseline: 12.0, measured: 11.82, format: 'decimal', threshold: 0.3,
    remark: '4#浮标，航道入口处',
  }),
  makeBuoy('rec-005', 'v3', {
    rawLat: '38.876543', rawLng: '117.654321', lat: 38.876543, lng: 117.654321,
    time: t5, baseline: 12.0, measured: 11.28, format: 'decimal', threshold: 0.3,
    remark: '5#浮标，锚地区域，中度淤积',
  }),
  makeBuoy('rec-006', 'v3', {
    rawLat: '38°49\'30.0"N', rawLng: '117°55\'0.0"E', lat: 38.825, lng: 117.916667,
    time: t6, baseline: 12.0, measured: 11.37, format: 'dms', threshold: 0.3,
    remark: '6#浮标',
  }),
  makeRemote('rec-007', 'v3', {
    rawLat: '38.955555', rawLng: '117.888888', lat: 38.955555, lng: 117.888888,
    time: t7, sediment: 0.95, cloudRate: 0.05, threshold: 0.3, format: 'decimal',
    remark: '遥感影像A区，云量5%，数据质量良好',
  }),
  makeRemote('rec-008', 'v3', {
    rawLat: '39°0\'12"N', rawLng: '117°30\'45"E', lat: 39.003333, lng: 117.5125,
    time: t7, sediment: 0.55, cloudRate: 0.12, threshold: 0.3, format: 'dms',
    remark: '遥感影像B区',
  }),
  makeRemote('rec-009', 'v3', {
    rawLat: '38.823456', rawLng: '117.765432', lat: 38.823456, lng: 117.765432,
    time: t7, sediment: 1.42, cloudRate: 0.08, threshold: 0.3, format: 'decimal',
    remark: '遥感影像C区，淤积严重，需重点关注',
  }),
  makeRemote('rec-010', 'v3', {
    rawLat: '38.789012', rawLng: '117.901234', lat: 38.789012, lng: 117.901234,
    time: t7, sediment: 0.6, cloudRate: 0.75, threshold: 0.3, format: 'decimal',
    remark: '遥感影像D区，云层遮挡严重，淤积深度为估算值，单独隔离展示',
    anomalyType: 'cloudCover',
    isNormal: false,
  }),
  makeBuoy('rec-011', 'v3', {
    rawLat: 'N 38° 52\' 18.5"', rawLng: 'E 117° 40\' 33.2"', lat: 38.871806, lng: 117.675889,
    time: t8, baseline: 12.0, measured: 11.68, format: 'dms', threshold: 0.3,
    remark: '7#浮标，经纬度格式带N/E前缀，6月新增站点',
  }),
  makeBuoy('rec-012', 'v3', {
    rawLat: '38,888889', rawLng: '117,555556', lat: 38.888889, lng: 117.555556,
    time: t9, baseline: 12.0, measured: undefined, format: 'decimal', threshold: 0.3,
    remark: '8#浮标，传感器故障，水深数据缺失',
    isNormal: false,
    anomalyType: 'missingData',
    anomalyDetail: '水深数据缺失，无法计算淤积深度',
  }),
];

export function getRecordsByVersion(versionId: string): SedimentRecord[] {
  switch (versionId) {
    case 'v3':
      return mockRecordsV3;
    case 'v2':
      return mockRecordsV2;
    case 'v1':
      return mockRecordsV1;
    default:
      return mockRecordsV3;
  }
}

export function getAllRecords(): SedimentRecord[] {
  return [...mockRecordsV3, ...mockRecordsV2, ...mockRecordsV1];
}

export function getVersionById(versionId: string): ReportVersion | undefined {
  return mockVersions.find((v) => v.id === versionId);
}
