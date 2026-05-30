import { PitchInfo, RiskLevel, StringSpec } from '../types';

export const PITCH_FREQUENCIES: Record<string, number> = {
  'C0': 16.35, 'C#0': 17.32, 'Db0': 17.32, 'D0': 18.35, 'D#0': 19.45, 'Eb0': 19.45,
  'E0': 20.60, 'F0': 21.83, 'F#0': 23.12, 'Gb0': 23.12, 'G0': 24.50, 'G#0': 25.96,
  'Ab0': 25.96, 'A0': 27.50, 'A#0': 29.14, 'Bb0': 29.14, 'B0': 30.87,
  'C1': 32.70, 'C#1': 34.65, 'Db1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'Eb1': 38.89,
  'E1': 41.20, 'F1': 43.65, 'F#1': 46.25, 'Gb1': 46.25, 'G1': 49.00, 'G#1': 51.91,
  'Ab1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'Bb1': 58.27, 'B1': 61.74,
  'C2': 65.41, 'C#2': 69.30, 'Db2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'Eb2': 77.78,
  'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'Gb2': 92.50, 'G2': 98.00, 'G#2': 103.83,
  'Ab2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'Bb2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'Db3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'Eb3': 155.56,
  'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'Gb3': 185.00, 'G3': 196.00, 'G#3': 207.65,
  'Ab3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'Bb3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'Db4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'Eb4': 311.13,
  'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'Gb4': 369.99, 'G4': 392.00, 'G#4': 415.30,
  'Ab4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'Bb4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'Db5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'Eb5': 622.25,
  'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'Gb5': 739.99, 'G5': 783.99, 'G#5': 830.61,
  'Ab5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'Bb5': 932.33, 'B5': 987.77,
  'C6': 1046.50,
};

export const STANDARD_TUNING: Record<string, string[]> = {
  guitar: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  violin: ['G3', 'D4', 'A4', 'E5'],
  bass: ['E1', 'A1', 'D2', 'G2'],
};

export const STRING_SPECS: Record<string, StringSpec> = {
  '0.009': { gauge: '0.009', material: 'steel', brand: '通用', linearDensity: 0.00039, maxTension: 120 },
  '0.010': { gauge: '0.010', material: 'steel', brand: '通用', linearDensity: 0.00048, maxTension: 140 },
  '0.011': { gauge: '0.011', material: 'steel', brand: '通用', linearDensity: 0.00058, maxTension: 160 },
  '0.012': { gauge: '0.012', material: 'steel', brand: '通用', linearDensity: 0.00069, maxTension: 180 },
  '0.013': { gauge: '0.013', material: 'steel', brand: '通用', linearDensity: 0.00081, maxTension: 200 },
  '0.014': { gauge: '0.014', material: 'steel', brand: '通用', linearDensity: 0.00094, maxTension: 220 },
  '0.016': { gauge: '0.016', material: 'steel', brand: '通用', linearDensity: 0.00123, maxTension: 250 },
  '0.020': { gauge: '0.020', material: 'steel', brand: '通用', linearDensity: 0.00192, maxTension: 300 },
  '0.024': { gauge: '0.024', material: 'steel', brand: '通用', linearDensity: 0.00276, maxTension: 380 },
  '0.028': { gauge: '0.028', material: 'steel', brand: '通用', linearDensity: 0.00376, maxTension: 450 },
  '0.032': { gauge: '0.032', material: 'steel', brand: '通用', linearDensity: 0.00492, maxTension: 520 },
  '0.036': { gauge: '0.036', material: 'steel', brand: '通用', linearDensity: 0.00623, maxTension: 600 },
  '0.042': { gauge: '0.042', material: 'steel', brand: '通用', linearDensity: 0.00847, maxTension: 700 },
  '0.046': { gauge: '0.046', material: 'steel', brand: '通用', linearDensity: 0.01015, maxTension: 800 },
  '0.052': { gauge: '0.052', material: 'steel', brand: '通用', linearDensity: 0.01295, maxTension: 950 },
  '0.059': { gauge: '0.059', material: 'steel', brand: '通用', linearDensity: 0.01667, maxTension: 1100 },
};

export function parsePitch(pitch: string): PitchInfo | null {
  const match = pitch.match(/^([A-G]#?b?)(\d)$/);
  if (!match) return null;
  
  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr);
  const frequency = PITCH_FREQUENCIES[pitch];
  
  if (!frequency) return null;
  
  return { note, octave, frequency };
}

export function getPitchFrequency(pitch: string): number | null {
  return PITCH_FREQUENCIES[pitch] || null;
}

export function convertLengthUnit(
  value: number,
  fromUnit: 'mm' | 'cm' | 'inch',
  toUnit: 'mm' | 'cm' | 'inch'
): number {
  const toMm: Record<string, number> = { mm: 1, cm: 10, inch: 25.4 };
  const fromMm: Record<string, number> = { mm: 1, cm: 0.1, inch: 1 / 25.4 };
  
  const mmValue = value * toMm[fromUnit];
  return mmValue * fromMm[toUnit];
}

export function lengthToMeters(value: number, unit: 'mm' | 'cm' | 'inch'): number {
  return convertLengthUnit(value, unit, 'mm') / 1000;
}

export function calculateTension(
  frequency: number,
  stringLength: number,
  lengthUnit: 'mm' | 'cm' | 'inch',
  linearDensity: number
): { tension: number; formula: string; details: string } {
  const L = lengthToMeters(stringLength, lengthUnit);
  const f = frequency;
  const mu = linearDensity;
  
  const tension = (f * f * 4 * L * L * mu) / 9.8;
  
  const formula = 'T = (f² × 4 × L² × μ) / 9.8';
  const details = `频率 f = ${f.toFixed(2)} Hz, 弦长 L = ${L.toFixed(4)} m, 线密度 μ = ${mu.toFixed(6)} kg/m`;
  
  return { tension, formula, details };
}

export function validatePitchMapping(
  pitch: string,
  stringNumber: number,
  instrumentType: string
): { valid: boolean; suggestedPitch?: string; reason: string } {
  const standardPitches = STANDARD_TUNING[instrumentType];
  
  if (!standardPitches) {
    return { valid: true, reason: '非标乐器类型，跳过标准音高校验' };
  }
  
  const stringIndex = stringNumber - 1;
  if (stringIndex < 0 || stringIndex >= standardPitches.length) {
    return { valid: true, reason: '弦号超出标准范围，跳过校验' };
  }
  
  const standardPitch = standardPitches[stringIndex];
  
  if (pitch === standardPitch) {
    return { valid: true, reason: `符合${instrumentType}第${stringNumber}弦标准音高` };
  }
  
  return {
    valid: false,
    suggestedPitch: standardPitch,
    reason: `音高不匹配：${instrumentType}第${stringNumber}弦标准音高应为 ${standardPitch}，当前为 ${pitch}`,
  };
}

export function validateStringLength(
  length: number,
  unit: 'mm' | 'cm' | 'inch',
  instrumentType: string
): { valid: boolean; suggestion?: string; reason: string } {
  const lengthMm = convertLengthUnit(length, unit, 'mm');
  
  const ranges: Record<string, [number, number]> = {
    guitar: [620, 670],
    violin: [320, 330],
    bass: [850, 870],
    piano: [100, 2000],
  };
  
  const [min, max] = ranges[instrumentType] || [100, 2000];
  
  if (lengthMm >= min && lengthMm <= max) {
    return {
      valid: true,
      reason: `弦长 ${lengthMm.toFixed(1)}mm 在 ${instrumentType} 正常范围 [${min}-${max}mm] 内`,
    };
  }
  
  return {
    valid: false,
    suggestion: `建议范围 ${min}-${max}mm`,
    reason: `弦长异常：${lengthMm.toFixed(1)}mm 超出 ${instrumentType} 正常范围 [${min}-${max}mm]，请检查单位是否正确`,
  };
}

export function assessRiskLevel(
  tension: number,
  maxTension: number,
  historicalBreaks: number = 0
): { level: RiskLevel; reason: string; evidence: string } {
  const ratio = tension / maxTension;
  let level: RiskLevel;
  let reason: string;
  
  if (ratio < 0.5) {
    level = 1;
    reason = '张力远低于安全上限，断弦风险极低';
  } else if (ratio < 0.7) {
    level = 2;
    reason = '张力在安全范围内，断弦风险较低';
  } else if (ratio < 0.85) {
    level = 3;
    reason = '张力接近安全上限，需关注调音过程';
  } else if (ratio < 0.95) {
    level = 4;
    reason = '张力较高，接近临界值，调音时需特别小心';
  } else {
    level = 5;
    reason = '张力超过或接近安全上限，断弦风险极高！';
  }
  
  if (historicalBreaks > 0) {
    level = Math.min(5, level + historicalBreaks) as RiskLevel;
    reason += `；该琴弦历史断弦 ${historicalBreaks} 次，风险等级上调`;
  }
  
  const evidence = `当前张力: ${tension.toFixed(2)}N, 最大安全张力: ${maxTension}N, 使用率: ${(ratio * 100).toFixed(1)}%, 历史断弦: ${historicalBreaks}次`;
  
  return { level, reason, evidence };
}

export function matchStringSpec(gauge: string): { spec: StringSpec | null; matched: boolean; reason: string } {
  const spec = STRING_SPECS[gauge];
  
  if (spec) {
    return {
      spec,
      matched: true,
      reason: `成功匹配规格 ${gauge}，线密度 ${spec.linearDensity.toFixed(6)} kg/m，最大张力 ${spec.maxTension}N`,
    };
  }
  
  const closestGauge = Object.keys(STRING_SPECS).reduce((a, b) => {
    return Math.abs(parseFloat(a) - parseFloat(gauge)) < Math.abs(parseFloat(b) - parseFloat(gauge)) ? a : b;
  });
  
  return {
    spec: STRING_SPECS[closestGauge],
    matched: false,
    reason: `未找到规格 ${gauge}，建议使用最接近的 ${closestGauge}`,
  };
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
