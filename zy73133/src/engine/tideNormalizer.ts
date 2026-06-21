import type { NormalizedTide, TideUnit } from './types';

const FEET_TO_METERS = 0.3048;
const CM_TO_METERS = 0.01;

const UNIT_ALIASES: Record<TideUnit, string[]> = {
  m: ['m', 'meter', 'meters', 'metre', 'metres', '米', '公尺'],
  cm: ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres', '厘米', '公分'],
  ft: ['ft', 'feet', 'foot', '英尺', '呎'],
  unknown: [],
};

function detectUnit(rawUnit: string): { unit: TideUnit; raw: string } {
  if (rawUnit == null) return { unit: 'unknown', raw: '' };
  const cleaned = String(rawUnit).trim().toLowerCase();
  if (!cleaned) return { unit: 'unknown', raw: rawUnit };

  for (const unit of Object.keys(UNIT_ALIASES) as TideUnit[]) {
    if (UNIT_ALIASES[unit].some((a) => a.toLowerCase() === cleaned)) {
      return { unit, raw: rawUnit };
    }
  }
  for (const unit of Object.keys(UNIT_ALIASES) as TideUnit[]) {
    for (const alias of UNIT_ALIASES[unit]) {
      if (alias.toLowerCase() && cleaned.includes(alias.toLowerCase())) {
        return { unit, raw: rawUnit };
      }
    }
  }
  return { unit: 'unknown', raw: rawUnit };
}

interface Extracted {
  value: number | null;
  unit: TideUnit;
  unitRaw: string;
  notes: string[];
}

function extractValueAndUnit(rawValue: string, rawUnit: string): Extracted {
  const notes: string[] = [];
  const originalValueRaw = (rawValue ?? '').trim();
  const combined = `${rawValue ?? ''} ${rawUnit ?? ''}`.trim();

  let detectedUnit: TideUnit = 'unknown';
  let unitRaw = '';
  if (rawUnit) {
    const det = detectUnit(rawUnit);
    detectedUnit = det.unit;
    unitRaw = det.raw;
  }

  let valueMatch = originalValueRaw.match(/(-?\d+\.?\d*)/);
  if (!valueMatch) valueMatch = combined.match(/(-?\d+\.?\d*)/);

  if (!valueMatch) {
    return { value: null, unit: detectedUnit, unitRaw, notes: [`无法从 '${combined}' 中提取数值`] };
  }

  const rawNumeric = parseFloat(valueMatch[1]);
  if (Number.isNaN(rawNumeric)) {
    return { value: null, unit: detectedUnit, unitRaw, notes: [`数值解析失败: ${valueMatch[1]}`] };
  }

  if (detectedUnit === 'unknown') {
    const unitFromCombined = combined.match(/(m|cm|ft|米|厘米|公分|英尺|呎)/i);
    if (unitFromCombined) {
      const det = detectUnit(unitFromCombined[1]);
      if (det.unit !== 'unknown') {
        detectedUnit = det.unit;
        notes.push(`从数值串中识别单位: ${unitFromCombined[1]}`);
        unitRaw = unitFromCombined[1];
      }
    }
  }

  return {
    value: rawNumeric,
    unit: detectedUnit,
    unitRaw: unitRaw || rawUnit || '',
    notes,
  };
}

export function normalizeTide(rawValue: string, rawUnit: string): NormalizedTide {
  const { value: rawNumeric, unit: detectedUnit, unitRaw, notes } = extractValueAndUnit(rawValue, rawUnit);

  if (rawNumeric == null) {
    return {
      valueMeters: null,
      originalValue: rawValue ?? '',
      originalUnit: 'unknown',
      originalUnitRaw: rawUnit ?? '',
      normalizeNotes: notes,
    };
  }

  let valueM = rawNumeric;
  if (detectedUnit === 'm') {
    // keep as meters
  } else if (detectedUnit === 'cm') {
    valueM = rawNumeric * CM_TO_METERS;
    notes.push(`厘米转米: ${rawNumeric} cm × ${CM_TO_METERS} = ${valueM} m`);
  } else if (detectedUnit === 'ft') {
    valueM = rawNumeric * FEET_TO_METERS;
    notes.push(`英尺转米: ${rawNumeric} ft × ${FEET_TO_METERS} = ${valueM.toFixed(4)} m`);
  } else {
    notes.push(
      `单位未识别，保留原始数值 ${rawNumeric}，按米处理（需人工复核）。原始单位字符串: '${rawUnit || '(空)'}'`,
    );
  }

  return {
    valueMeters: Math.round(valueM * 1e6) / 1e6,
    originalValue: rawValue ?? '',
    originalUnit: detectedUnit,
    originalUnitRaw: unitRaw || rawUnit || '',
    normalizeNotes: notes,
  };
}

export function tideToOriginalString(tide: NormalizedTide | null): string {
  if (!tide) return 'N/A';
  if (tide.originalUnit === 'unknown') {
    return tide.originalValue ? `${tide.originalValue} (单位未知)` : 'N/A';
  }
  const unitDisplay: Record<TideUnit, string> = { m: 'm', cm: 'cm', ft: 'ft', unknown: tide.originalUnitRaw };
  return `${tide.originalValue} ${unitDisplay[tide.originalUnit]}`.trim();
}
