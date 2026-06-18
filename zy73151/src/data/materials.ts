import type { Material, LabRecord } from '@/types';

const generateLabRecords = (materialId: string, version: number): LabRecord[] => {
  const baseRecords: Omit<LabRecord, 'id' | 'materialId' | 'sourceRow'>[] = [
    {
      stationId: 'S001',
      stationName: '东港牧场1号',
      sampleTime: '2026-06-15 08:30',
      resultTime: '2026-06-15 14:20',
      temperature: 22.5,
      salinity: 32.1,
      tideLevel: version === 1 ? 1.2 : 1.8,
      tideUnit: 'm',
      dissolvedOxygen: 7.8,
      ph: 8.1,
    },
    {
      stationId: 'S002',
      stationName: '东港牧场2号',
      sampleTime: '2026-06-15 09:15',
      resultTime: '2026-06-15 15:00',
      temperature: 21.8,
      salinity: 31.9,
      tideLevel: version === 1 ? 125 : 1.5,
      tideUnit: version === 1 ? 'cm' : 'm',
      dissolvedOxygen: 7.5,
      ph: 8.0,
    },
    {
      stationId: 'S003',
      stationName: '南湾监测点',
      sampleTime: '2026-06-15 10:00',
      resultTime: '2026-06-16 09:30',
      temperature: 23.1,
      salinity: 33.2,
      tideLevel: 2.1,
      tideUnit: 'm',
      dissolvedOxygen: 6.9,
      ph: 7.9,
    },
    {
      stationId: 'S004',
      stationName: '西礁养殖区',
      sampleTime: '2026-06-15 11:20',
      resultTime: '2026-06-15 16:45',
      temperature: 20.5,
      salinity: 30.8,
      tideLevel: 1.6,
      tideUnit: 'm',
      dissolvedOxygen: 8.2,
      ph: 8.2,
    },
    {
      stationId: 'S005',
      stationName: '北滩采样点',
      sampleTime: '2026-06-15 07:45',
      resultTime: '2026-06-15 13:10',
      temperature: 19.8,
      salinity: 29.5,
      tideLevel: 0.8,
      tideUnit: 'm',
      dissolvedOxygen: 8.5,
      ph: 8.3,
    },
    {
      stationId: 'S006',
      stationName: '中央观测站',
      sampleTime: '2026-06-15 12:00',
      resultTime: '2026-06-15 17:30',
      temperature: 22.0,
      salinity: 32.0,
      tideLevel: 1.9,
      tideUnit: 'm',
      dissolvedOxygen: 7.2,
      ph: 8.0,
    },
    {
      stationId: 'S007',
      stationName: '东南浅海',
      sampleTime: '2026-06-15 10:45',
      resultTime: '2026-06-15 16:00',
      temperature: 24.2,
      salinity: 33.8,
      tideLevel: 0.9,
      tideUnit: 'm',
      dissolvedOxygen: 6.5,
      ph: 7.8,
    },
    {
      stationId: 'S008',
      stationName: '西北深水区',
      sampleTime: '2026-06-15 08:00',
      resultTime: '2026-06-15 14:00',
      temperature: 18.5,
      salinity: 34.1,
      tideLevel: 3.2,
      tideUnit: 'm',
      dissolvedOxygen: 9.1,
      ph: 8.4,
    },
  ];

  if (version >= 2) {
    const idx = baseRecords.findIndex(r => r.stationId === 'S003');
    if (idx !== -1) {
      baseRecords[idx].dissolvedOxygen = 5.8;
      baseRecords[idx].temperature = 24.5;
    }
  }

  return baseRecords.map((record, index) => ({
    ...record,
    id: `${materialId}-rec-${index + 1}`,
    materialId,
    sourceRow: index + 2,
  }));
};

const labRecordsV1 = generateLabRecords('mat-001', 1);
const labRecordsV2 = generateLabRecords('mat-002', 2);
const labRecordsV3 = generateLabRecords('mat-003', 3);

export const materials: Material[] = [
  {
    id: 'mat-001',
    name: '2026年6月海洋牧场水质监测报告',
    source: 'lab_result',
    version: 1,
    uploadTime: '2026-06-16 09:00:00',
    content: '第一版实验室结果，包含8个监测点位的水质数据。',
    parsedData: labRecordsV1,
    isLatest: false,
    description: '原始实验室检测结果',
  },
  {
    id: 'mat-002',
    name: '2026年6月海洋牧场水质监测报告（修订版）',
    source: 'lab_result',
    version: 2,
    uploadTime: '2026-06-17 14:30:00',
    content: '第二版修订，修正了南湾监测点的溶解氧数据。',
    parsedData: labRecordsV2,
    isLatest: false,
    description: '实验室修订版本',
  },
  {
    id: 'mat-003',
    name: '晚到附件：东港2号站补测数据',
    source: 'late_attachment',
    version: 3,
    uploadTime: '2026-06-17 18:45:00',
    content: '晚到的补充数据，东港牧场2号站重新检测潮位数据，统一单位为米。',
    parsedData: labRecordsV3,
    isLatest: true,
    description: '晚到附件-补充检测',
  },
  {
    id: 'mat-004',
    name: '口头说明：南湾数据异常原因',
    source: 'verbal_note',
    version: 1,
    uploadTime: '2026-06-17 19:20:00',
    content: '阿乔口头说明：南湾监测点溶解氧偏低是因为近期赤潮影响，已确认非检测错误。',
    parsedData: [],
    isLatest: true,
    description: '口头补充说明',
  },
];

export const getAllLabRecords = (): LabRecord[] => {
  return materials.flatMap(m => m.parsedData);
};
