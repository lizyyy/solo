import { LabRecord } from '../types';

const INDICATOR_META = {
  pH: { unit: '', range: [7.5, 8.6] as [number, number] },
  dissolvedOxygen: { unit: 'mg/L', range: [5.0, 10.0] as [number, number] },
  salinity: { unit: 'PSU', range: [28, 34] as [number, number] },
  temperature: { unit: '℃', range: [15, 28] as [number, number] },
  turbidity: { unit: 'NTU', range: [0, 50] as [number, number] },
  chlorophyllA: { unit: 'μg/L', range: [0.5, 15] as [number, number] },
  ammoniaNitrogen: { unit: 'mg/L', range: [0.01, 0.5] as [number, number] },
  activePhosphate: { unit: 'mg/L', range: [0.005, 0.1] as [number, number] }
};

const makeIndicators = (values: Record<string, number>) => {
  return Object.entries(values).map(([name, value]) => {
    const meta = INDICATOR_META[name as keyof typeof INDICATOR_META];
    return {
      name,
      value,
      unit: meta.unit,
      normalRange: meta.range
    };
  });
};

const ALL_MATERIALS = [
  '采样瓶标签',
  '现场记录表',
  'GPS定位记录',
  '水质检测原始数据',
  '样品交接单',
  '冷藏运输记录'
];

export const mockLabRecords: LabRecord[] = [
  {
    id: 'rec-001',
    bottleNo: 'B20260615-001',
    samplePoint: 'A1-东区外海',
    longitude: 121.4562,
    latitude: 30.7234,
    samplingDate: '2026-06-15',
    sourceTable: '2026年6月第2周实验室结果表.xlsx',
    indicators: makeIndicators({
      pH: 8.1,
      dissolvedOxygen: 7.2,
      salinity: 31.2,
      temperature: 22.5,
      turbidity: 18,
      chlorophyllA: 4.2,
      ammoniaNitrogen: 0.08,
      activePhosphate: 0.03
    }),
    materialCompleteness: ALL_MATERIALS,
    status: 'confirmed',
    detectedAnomalies: ['normal']
  },
  {
    id: 'rec-002',
    bottleNo: 'B20260615-002',
    samplePoint: 'A2-养殖区中心',
    longitude: 121.4721,
    latitude: 30.7189,
    samplingDate: '2026-06-15',
    sourceTable: '2026年6月第2周实验室结果表.xlsx',
    indicators: makeIndicators({
      pH: 6.2,
      dissolvedOxygen: 2.1,
      salinity: 42.8,
      temperature: 36.5,
      turbidity: 180,
      chlorophyllA: 58.3,
      ammoniaNitrogen: 1.95,
      activePhosphate: 0.48
    }),
    materialCompleteness: ALL_MATERIALS,
    status: 'pending',
    detectedAnomalies: ['outlier']
  },
  {
    id: 'rec-003',
    bottleNo: 'B20260615-002',
    samplePoint: 'B1-西区对照点',
    longitude: 121.4205,
    latitude: 30.7356,
    samplingDate: '2026-06-15',
    sourceTable: '2026年6月第2周实验室结果表.xlsx',
    indicators: makeIndicators({
      pH: 8.3,
      dissolvedOxygen: 6.8,
      salinity: 30.5,
      temperature: 21.8,
      turbidity: 25,
      chlorophyllA: 6.5,
      ammoniaNitrogen: 0.12,
      activePhosphate: 0.04
    }),
    materialCompleteness: ALL_MATERIALS,
    status: 'pending',
    detectedAnomalies: ['duplicate_bottle']
  },
  {
    id: 'rec-004',
    bottleNo: 'B20260615-004',
    samplePoint: 'B2-入海口',
    longitude: 121.3987,
    latitude: 30.7512,
    samplingDate: '2026-06-15',
    sourceTable: '2026年6月第2周实验室结果表.xlsx',
    indicators: makeIndicators({
      pH: 7.8,
      dissolvedOxygen: 5.5,
      salinity: 26.3,
      temperature: 24.1,
      turbidity: 85,
      chlorophyllA: 3.2,
      ammoniaNitrogen: 0.22,
      activePhosphate: 0.06
    }),
    materialCompleteness: ['采样瓶标签', '现场记录表', '水质检测原始数据'],
    materialMissing: ['GPS定位记录', '样品交接单', '冷藏运输记录'],
    status: 'returned',
    detectedAnomalies: ['incomplete_material']
  },
  {
    id: 'rec-005',
    bottleNo: 'B20260615-005',
    samplePoint: 'C1-深水网箱',
    longitude: 121.5034,
    latitude: 30.6987,
    samplingDate: '2026-06-15',
    sourceTable: '2026年6月第2周实验室结果表.xlsx',
    indicators: makeIndicators({
      pH: 8.0,
      dissolvedOxygen: 6.5,
      salinity: 32.1,
      temperature: 20.8,
      turbidity: 22,
      chlorophyllA: 3.8,
      ammoniaNitrogen: 0.06,
      activePhosphate: 0.02
    }),
    materialCompleteness: ALL_MATERIALS,
    status: 'pending',
    detectedAnomalies: ['outlier']
  },
  {
    id: 'rec-006',
    bottleNo: 'B20260615-006',
    samplePoint: 'C2-浅海贝藻区',
    longitude: 121.4876,
    latitude: 30.7045,
    samplingDate: '2026-06-15',
    sourceTable: '2026年6月第2周实验室结果表.xlsx',
    indicators: makeIndicators({
      pH: 7.9,
      dissolvedOxygen: 8.2,
      salinity: 30.8,
      temperature: 19.5,
      turbidity: 12,
      chlorophyllA: 2.5,
      ammoniaNitrogen: 0.03,
      activePhosphate: 0.01
    }),
    materialCompleteness: ALL_MATERIALS,
    status: 'confirmed',
    detectedAnomalies: ['normal']
  }
];
