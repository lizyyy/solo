import type { InspectionRecord } from '../../shared/types';
import { RecordStatus, RecordType } from '../../shared/types';

export const DEMO_PHOTO_NOS = [
  'PHOTO-2026-001',
  'PHOTO-2026-002',
  'PHOTO-2026-003',
];

export const DEMO_CAD_LAYERS: Record<string, string> = {
  'REC-001': 'LAYER-CHARGE-A',
  'REC-002': 'LAYER-CHARGE-B',
  'REC-003': 'LAYER-CHARGE-C-OLD',
};

export const DEMO_CORRECTED_LENGTHS: Record<string, number> = {
  'REC-002': 1025.75,
};

export function createInitialRecords(): InspectionRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'REC-001',
      photoNo: '',
      cadLayerName: '',
      routeLength: null,
      originalLength: null,
      correctedLength: null,
      status: RecordStatus.PENDING,
      recordType: RecordType.SMOOTH,
      caliber: '2026版新口径',
      lengthRecalculated: false,
      hasManualCorrection: false,
      hasRerun: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'REC-002',
      photoNo: '',
      cadLayerName: '',
      routeLength: null,
      originalLength: null,
      correctedLength: null,
      status: RecordStatus.PENDING,
      recordType: RecordType.SUPPLEMENT_NO_RECALC,
      caliber: '2026版新口径',
      lengthRecalculated: false,
      hasManualCorrection: true,
      hasRerun: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'REC-003',
      photoNo: '',
      cadLayerName: '',
      routeLength: null,
      originalLength: null,
      correctedLength: null,
      status: RecordStatus.PENDING,
      recordType: RecordType.OLD_CALIBER_FILL,
      caliber: '2026版新口径',
      lengthRecalculated: false,
      hasManualCorrection: false,
      hasRerun: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export const RECORD_DESCRIPTIONS: Record<string, string> = {
  'REC-001': '导入→计算→补录CAD→导出，全程顺利',
  'REC-002': '补录路线但未重新计算长度，标注待复核',
  'REC-003': '从CAD图层名补入旧口径2023版数据',
};
