import type {
  Hall,
  ReflectSurface,
  SoundSource,
  SeatZone,
  FrequencyPoint,
  FrequencyCoverage,
  AnomalyRecord,
  ImpactAssessment,
  Scheme,
} from '@/utils/types';

const hall: Hall = {
  id: 'hall-1',
  name: '交响乐厅A（易错样例）',
  width: 24,
  depth: 40,
  height: 14,
  wallBounds: [-12, 12, 0, 14, -20, 20],
};

const surfaces: ReflectSurface[] = [
  {
    id: 'surface-A1',
    hallId: 'hall-1',
    name: '反射板A1',
    angle: 15,
    position: [-6, 10.5, -8],
    size: [6, 3],
    normal: [0, 1, 0],
  },
  {
    id: 'surface-B3',
    hallId: 'hall-1',
    name: '反射板B3',
    angle: 55,
    position: [-8, 11, 5],
    size: [6, 3],
    normal: [0, 1, 0],
  },
  {
    id: 'surface-D1',
    hallId: 'hall-1',
    name: '反射板D1',
    angle: 30,
    position: [0, 5, 15],
    size: [8, 4],
    normal: [0, 1, 0],
  },
  {
    id: 'surface-A2',
    hallId: 'hall-1',
    name: '反射板A2',
    angle: 20,
    position: [6, 10.5, -8],
    size: [6, 3],
    normal: [0, 1, 0],
  },
];

const sources: SoundSource[] = [
  {
    id: 'source-1',
    hallId: 'hall-1',
    name: '舞台主声源',
    position: [0, 1.5, -15],
  },
];

const zones: SeatZone[] = [
  {
    id: 'zone-O1',
    hallId: 'hall-1',
    name: '池座O1',
    bounds: {
      min: [-10, 0, -12],
      max: [10, 0.6, 0],
    },
    zoneType: 'orchestra',
  },
  {
    id: 'zone-M1',
    hallId: 'hall-1',
    name: '楼座M1',
    bounds: {
      min: [-8, 2, 2],
      max: [8, 2.6, 10],
    },
    zoneType: 'mezzanine',
  },
  {
    id: 'zone-B1',
    hallId: 'hall-1',
    name: '后座B1',
    bounds: {
      min: [-6, 3, 12],
      max: [6, 3.6, 18],
    },
    zoneType: 'balcony',
  },
  {
    id: 'zone-V1',
    hallId: 'hall-1',
    name: 'VIP区',
    bounds: {
      min: [-4, 0, -14],
      max: [4, 0.6, -10],
    },
    zoneType: 'vip',
  },
];

const STANDARD_FREQUENCIES = [125, 250, 500, 1000, 2000, 4000];
const pathIds = [
  'path-source-1-surface-A1-zone-O1',
  'path-source-1-surface-A1-zone-M1',
  'path-source-1-surface-A1-zone-B1',
  'path-source-1-surface-A1-zone-V1',
  'path-source-1-surface-B3-zone-O1',
  'path-source-1-surface-B3-zone-M1',
  'path-source-1-surface-B3-zone-B1',
  'path-source-1-surface-B3-zone-V1',
  'path-source-1-surface-D1-zone-O1',
  'path-source-1-surface-D1-zone-M1',
  'path-source-1-surface-D1-zone-B1',
  'path-source-1-surface-D1-zone-V1',
  'path-source-1-surface-A2-zone-O1',
  'path-source-1-surface-A2-zone-M1',
  'path-source-1-surface-A2-zone-B1',
  'path-source-1-surface-A2-zone-V1',
  'path-source-1-surface-A1-C3-X',
];

const frequencyPoints: FrequencyPoint[] = [];
for (const pathId of pathIds) {
  for (const freq of STANDARD_FREQUENCIES) {
    if (pathId.includes('surface-A1') && freq === 2000) {
      continue;
    }
    const baseSpl = 70 + Math.random() * 20;
    const freqFactor = freq >= 2000 ? 0.9 : 1;
    frequencyPoints.push({
      id: `fp-${pathId}-${freq}`,
      pathId,
      frequency: freq,
      spl: Math.round(baseSpl * freqFactor * 10) / 10,
    });
  }
}

const frequencyCoverages: FrequencyCoverage[] = [];
const zoneIds = ['zone-O1', 'zone-M1', 'zone-B1', 'zone-V1'];
for (const zoneId of zoneIds) {
  for (const freq of STANDARD_FREQUENCIES) {
    const baseCoverage = zoneId === 'zone-V1' ? 85 : zoneId === 'zone-O1' ? 80 : zoneId === 'zone-M1' ? 70 : 60;
    const freqFactor = freq >= 2000 ? 0.85 : 1;
    frequencyCoverages.push({
      id: `cov-${zoneId}-${freq}`,
      zoneId,
      frequency: freq,
      coveragePercent: Math.round(baseCoverage * freqFactor),
      avgSPL: Math.round((65 + Math.random() * 15) * 10) / 10,
    });
  }
}

const anomalies: AnomalyRecord[] = [
  {
    id: 'anomaly-wall-surface-B3',
    type: 'SURFACE_THROUGH_WALL',
    severity: 'critical',
    sourceType: 'ReflectSurface',
    sourceId: 'surface-B3',
    description: '反射板B3在角度55°时，法线延伸超出厅堂北墙',
    status: 'pending',
    traceChain: [
      { entity: 'Hall', id: 'hall-1', label: '交响乐厅A（易错样例）' },
      { entity: 'ReflectSurface', id: 'surface-B3', label: '反射板B3' },
    ],
  },
  {
    id: 'anomaly-zone-C3-X',
    type: 'ZONE_MAPPING_ERROR',
    sourceType: 'SeatZone',
    sourceId: 'C3-X',
    description: '座区C3在频率500Hz下映射到不存在的座区编号C3-X',
    status: 'pending',
    severity: 'warning',
    traceChain: [
      { entity: 'Hall', id: 'hall-1', label: '交响乐厅A（易错样例）' },
      { entity: 'SeatZone', id: 'C3-X', label: 'C3-X' },
    ],
  },
  {
    id: 'anomaly-freq-surface-A1-2000',
    type: 'FREQUENCY_MISSING',
    severity: 'warning',
    sourceType: 'FrequencyPoint',
    sourceId: 'surface-A1-2000',
    description: '反射面A1在2000Hz频段无反射数据',
    status: 'pending',
    traceChain: [
      { entity: 'Hall', id: 'hall-1', label: '交响乐厅A（易错样例）' },
      { entity: 'ReflectSurface', id: 'surface-A1', label: '反射板A1' },
      { entity: 'FrequencyPoint', id: 'surface-A1-2000', label: '2000Hz' },
    ],
  },
  {
    id: 'anomaly-wall-surface-D1',
    type: 'SURFACE_THROUGH_WALL',
    severity: 'critical',
    sourceType: 'ReflectSurface',
    sourceId: 'surface-D1',
    description: '反射板D1角度30°时，下边缘穿入观众席0.8m',
    status: 'pending',
    traceChain: [
      { entity: 'Hall', id: 'hall-1', label: '交响乐厅A（易错样例）' },
      { entity: 'ReflectSurface', id: 'surface-D1', label: '反射板D1' },
    ],
  },
];

const impacts: ImpactAssessment[] = [
  {
    id: 'impact-wall-B3',
    anomalyId: 'anomaly-wall-surface-B3',
    budgetImpact: 'high',
    scheduleImpact: 'medium',
    rosterImpact: 'none',
    detail: '需重新加工反射板支架，预计增加¥12万；工期延迟3天',
  },
  {
    id: 'impact-zone-C3-X',
    anomalyId: 'anomaly-zone-C3-X',
    budgetImpact: 'none',
    scheduleImpact: 'low',
    rosterImpact: 'none',
    detail: '需人工核对座区图纸，预计延迟1天',
  },
  {
    id: 'impact-freq-A1-2000',
    anomalyId: 'anomaly-freq-surface-A1-2000',
    budgetImpact: 'none',
    scheduleImpact: 'none',
    rosterImpact: 'medium',
    detail: '高频覆盖缺失可能影响VIP区（A排1-3座）听觉体验评估',
  },
  {
    id: 'impact-wall-D1',
    anomalyId: 'anomaly-wall-surface-D1',
    budgetImpact: 'high',
    scheduleImpact: 'high',
    rosterImpact: 'none',
    detail: '安全隐患，必须修正，预计增加¥8万；工期延迟5天',
  },
];

const schemes: Scheme[] = [
  {
    id: 'scheme-error',
    name: '易错样例方案',
    surfaceAngles: {
      'surface-A1': 15,
      'surface-B3': 55,
      'surface-D1': 30,
      'surface-A2': 20,
    },
    sourcePosition: [0, 1.5, -15],
  },
];

export const mockErrorProne = {
  hall,
  surfaces,
  sources,
  zones,
  frequencyPoints,
  frequencyCoverages,
  anomalies,
  impacts,
  schemes,
};
