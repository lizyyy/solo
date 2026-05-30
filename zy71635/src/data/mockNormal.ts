import type {
  Hall,
  ReflectSurface,
  SoundSource,
  SeatZone,
  FrequencyPoint,
  FrequencyCoverage,
  Scheme,
} from '@/utils/types';

const hall: Hall = {
  id: 'hall-1',
  name: '交响乐厅A',
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
    id: 'surface-A2',
    hallId: 'hall-1',
    name: '反射板A2',
    angle: 20,
    position: [0, 11, -6],
    size: [6, 3],
    normal: [0, 1, 0],
  },
  {
    id: 'surface-A3',
    hallId: 'hall-1',
    name: '反射板A3',
    angle: 25,
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
  'path-source-1-surface-A2-zone-O1',
  'path-source-1-surface-A2-zone-M1',
  'path-source-1-surface-A2-zone-B1',
  'path-source-1-surface-A2-zone-V1',
  'path-source-1-surface-A3-zone-O1',
  'path-source-1-surface-A3-zone-M1',
  'path-source-1-surface-A3-zone-B1',
  'path-source-1-surface-A3-zone-V1',
];

const frequencyPoints: FrequencyPoint[] = [];
for (const pathId of pathIds) {
  for (const freq of STANDARD_FREQUENCIES) {
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

const schemes: Scheme[] = [
  {
    id: 'scheme-A',
    name: '方案A 原始角度',
    surfaceAngles: {
      'surface-A1': 15,
      'surface-A2': 20,
      'surface-A3': 25,
    },
    sourcePosition: [0, 1.5, -15],
  },
  {
    id: 'scheme-B',
    name: '方案B 优化角度',
    surfaceAngles: {
      'surface-A1': 20,
      'surface-A2': 25,
      'surface-A3': 30,
    },
    sourcePosition: [0, 1.5, -15],
  },
];

export const mockNormal = {
  hall,
  surfaces,
  sources,
  zones,
  frequencyPoints,
  frequencyCoverages,
  schemes,
};
