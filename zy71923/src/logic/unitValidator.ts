import type { SourceType, TimelineRecord, Artwork } from '../data/types';

const VALID_UNITS = ['cm', 'inch', 'mm', 'm'];
const DISPLAY_UNIT_MAP: Record<SourceType, string> = {
  lighting: '灯光记录',
  note: '策展备注',
  inventory: '作品清单',
};
const RESPONSIBLE_MAP: Record<SourceType, string> = {
  lighting: '灯光师',
  note: '策展团队',
  inventory: '艺术品登记员',
};

interface UnitValidationResult {
  hasError: boolean;
  source?: SourceType;
  expectedUnit: string;
  actualUnit: string;
  issueDescription: string;
  nextStep: string;
  responsiblePerson: string;
}

export function extractDimensionUnit(content: string): string | null {
  for (const unit of VALID_UNITS) {
    const regex = new RegExp(`\\d+\\s*[xX×]\\s*\\d+\\s*${unit}`, 'i');
    if (regex.test(content)) {
      return unit;
    }
  }
  for (const unit of VALID_UNITS) {
    if (content.toLowerCase().includes(unit)) {
      return unit;
    }
  }
  return null;
}

export function validateDimensionUnits(
  artwork: Artwork,
  allRecords: TimelineRecord[]
): UnitValidationResult {
  const artworkRecords = allRecords.filter(r => r.artworkId === artwork.id);
  
  const unitsBySource: Record<SourceType, string | null> = {
    lighting: null,
    note: null,
    inventory: null,
  };

  for (const record of artworkRecords) {
    const unit = extractDimensionUnit(record.content);
    if (unit) {
      unitsBySource[record.sourceType] = unit.toLowerCase();
    }
  }

  const inventoryUnit = unitsBySource.inventory;
  const lightingUnit = unitsBySource.lighting;
  const noteUnit = unitsBySource.note;

  const expectedUnit = inventoryUnit || 'cm';

  if (lightingUnit && lightingUnit !== expectedUnit) {
    return {
      hasError: true,
      source: 'lighting',
      expectedUnit,
      actualUnit: lightingUnit,
      issueDescription: `尺寸单位存在冲突：${DISPLAY_UNIT_MAP.lighting}标注为${lightingUnit}，${DISPLAY_UNIT_MAP.inventory}标注为${expectedUnit}。`,
      nextStep: `与${RESPONSIBLE_MAP.lighting}确认${artwork.code}的正确尺寸单位，确认后更新所有相关记录。`,
      responsiblePerson: RESPONSIBLE_MAP.lighting,
    };
  }

  if (noteUnit && noteUnit !== expectedUnit) {
    return {
      hasError: true,
      source: 'note',
      expectedUnit,
      actualUnit: noteUnit,
      issueDescription: `尺寸单位存在冲突：${DISPLAY_UNIT_MAP.note}标注为${noteUnit}，${DISPLAY_UNIT_MAP.inventory}标注为${expectedUnit}。`,
      nextStep: `与${RESPONSIBLE_MAP.note}确认${artwork.code}的正确尺寸单位，确定是否需要转换为公制后统一标准。`,
      responsiblePerson: RESPONSIBLE_MAP.note,
    };
  }

  if (lightingUnit && noteUnit && lightingUnit !== noteUnit) {
    return {
      hasError: true,
      source: 'lighting',
      expectedUnit: noteUnit,
      actualUnit: lightingUnit,
      issueDescription: `尺寸单位存在冲突：${DISPLAY_UNIT_MAP.lighting}标注为${lightingUnit}，${DISPLAY_UNIT_MAP.note}标注为${noteUnit}。`,
      nextStep: `同时联系${RESPONSIBLE_MAP.lighting}和${RESPONSIBLE_MAP.note}，三方确认正确尺寸单位。`,
      responsiblePerson: `${RESPONSIBLE_MAP.lighting} / ${RESPONSIBLE_MAP.note}`,
    };
  }

  return {
    hasError: false,
    expectedUnit,
    actualUnit: expectedUnit,
    issueDescription: `无单位冲突，各来源数据一致（${expectedUnit}）。`,
    nextStep: '无需处理。',
    responsiblePerson: '-',
  };
}

export function getUnitSourceDisplay(source: SourceType): string {
  return DISPLAY_UNIT_MAP[source];
}
