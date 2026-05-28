import type { StringParams, LinearDensityUnit } from './tensionCalc';

export interface TuningPreset {
  name: string;
  nameCN: string;
  strings: { note: string; frequency: number }[];
}

export const TUNING_PRESETS: TuningPreset[] = [
  {
    name: 'Standard',
    nameCN: '标准调弦 EADGBE',
    strings: [
      { note: 'E4', frequency: 329.63 },
      { note: 'B3', frequency: 246.94 },
      { note: 'G3', frequency: 196.00 },
      { note: 'D3', frequency: 146.83 },
      { note: 'A2', frequency: 110.00 },
      { note: 'E2', frequency: 82.41 },
    ],
  },
  {
    name: 'Drop D',
    nameCN: 'Drop D',
    strings: [
      { note: 'E4', frequency: 329.63 },
      { note: 'B3', frequency: 246.94 },
      { note: 'G3', frequency: 196.00 },
      { note: 'D3', frequency: 146.83 },
      { note: 'A2', frequency: 110.00 },
      { note: 'D2', frequency: 73.42 },
    ],
  },
  {
    name: 'DADGAD',
    nameCN: 'DADGAD',
    strings: [
      { note: 'D4', frequency: 293.66 },
      { note: 'A3', frequency: 220.00 },
      { note: 'G3', frequency: 196.00 },
      { note: 'D3', frequency: 146.83 },
      { note: 'A2', frequency: 110.00 },
      { note: 'D2', frequency: 73.42 },
    ],
  },
  {
    name: 'Open G',
    nameCN: 'Open G',
    strings: [
      { note: 'D4', frequency: 293.66 },
      { note: 'B3', frequency: 246.94 },
      { note: 'G3', frequency: 196.00 },
      { note: 'D3', frequency: 146.83 },
      { note: 'G2', frequency: 98.00 },
      { note: 'D2', frequency: 73.42 },
    ],
  },
  {
    name: 'Open D',
    nameCN: 'Open D',
    strings: [
      { note: 'D4', frequency: 293.66 },
      { note: 'A3', frequency: 220.00 },
      { note: 'F#3', frequency: 185.00 },
      { note: 'D3', frequency: 146.83 },
      { note: 'A2', frequency: 110.00 },
      { note: 'D2', frequency: 73.42 },
    ],
  },
];

const STRING_NAMES = ['1弦', '2弦', '3弦', '4弦', '5弦', '6弦'];

export function createDefaultStrings(scaleLength: number = 648): StringParams[] {
  const preset = TUNING_PRESETS[0];
  const defaultDensities = [0.40, 0.70, 1.10, 1.50, 2.30, 3.90];
  const defaultGauges = [0.25, 0.33, 0.43, 0.53, 0.68, 0.86];
  return preset.strings.map((s, i) => ({
    id: i + 1,
    name: STRING_NAMES[i],
    scaleLength,
    targetNote: s.note,
    frequency: s.frequency,
    linearDensity: defaultDensities[i],
    linearDensityUnit: 'g/m' as LinearDensityUnit,
    gauge: defaultGauges[i],
    rawInputs: {
      scaleLength: String(scaleLength),
      frequency: String(s.frequency),
      linearDensity: String(defaultDensities[i]),
      gauge: String(defaultGauges[i]),
    },
  }));
}

export interface SampleCase {
  name: string;
  description: string;
  expectedAnomaly: string;
  strings: StringParams[];
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    name: '标准吉他 EADGBE',
    description: '6弦标准调弦，648mm弦长，典型钢弦参数',
    expectedAnomaly: '无异常',
    strings: createDefaultStrings(648),
  },
  {
    name: '频率错八度',
    description: '第1弦E4误录为E3(82.4Hz)，频率低了一个八度',
    expectedAnomaly: '频率错八度警告',
    strings: (() => {
      const strings = createDefaultStrings(648);
      strings[0] = {
        ...strings[0],
        targetNote: 'E4',
        frequency: 82.41,
        rawInputs: { ...strings[0].rawInputs, frequency: '82.41' },
      };
      return strings;
    })(),
  },
  {
    name: '线密度单位错误',
    description: '线密度输入0.0004而非0.4(误将kg/m值填入g/m字段)',
    expectedAnomaly: '线密度单位疑似错误',
    strings: (() => {
      const strings = createDefaultStrings(648);
      strings[0] = {
        ...strings[0],
        linearDensity: 0.0004,
        linearDensityUnit: 'g/m',
        rawInputs: { ...strings[0].rawInputs, linearDensity: '0.0004' },
      };
      return strings;
    })(),
  },
  {
    name: '总张力超限',
    description: '6弦均使用高张力规格，总张力超过1000N',
    expectedAnomaly: '总张力危险警告',
    strings: (() => {
      const strings = createDefaultStrings(648);
      const heavyDensities = [1.20, 2.10, 3.30, 4.50, 6.90, 11.7];
      const heavyGauges = [0.42, 0.50, 0.60, 0.72, 0.92, 1.20];
      return strings.map((s, i) => ({
        ...s,
        linearDensity: heavyDensities[i],
        gauge: heavyGauges[i],
        rawInputs: {
          ...s.rawInputs,
          linearDensity: String(heavyDensities[i]),
          gauge: String(heavyGauges[i]),
        },
      }));
    })(),
  },
  {
    name: '低张力尼龙弦',
    description: '古典吉他尼龙弦，总张力仅约350N，在安全范围内',
    expectedAnomaly: '无异常(安全范围)',
    strings: (() => {
      const preset = TUNING_PRESETS[0];
      const nylonDensities = [0.55, 0.75, 1.05, 1.30, 1.70, 2.30];
      const nylonGauges = [0.70, 0.80, 1.00, 1.10, 1.30, 1.50];
      return preset.strings.map((s, i) => ({
        id: i + 1,
        name: STRING_NAMES[i],
        scaleLength: 650,
        targetNote: s.note,
        frequency: s.frequency,
        linearDensity: nylonDensities[i],
        linearDensityUnit: 'g/m' as LinearDensityUnit,
        gauge: nylonGauges[i],
        rawInputs: {
          scaleLength: '650',
          frequency: String(s.frequency),
          linearDensity: String(nylonDensities[i]),
          gauge: String(nylonGauges[i]),
        },
      }));
    })(),
  },
  {
    name: 'Drop D 对比',
    description: '第6弦降至D2，其余不变，与标准调弦对比',
    expectedAnomaly: '与标准调弦对比差异',
    strings: (() => {
      const strings = createDefaultStrings(648);
      strings[5] = {
        ...strings[5],
        targetNote: 'D2',
        frequency: 73.42,
        rawInputs: { ...strings[5].rawInputs, frequency: '73.42' },
      };
      return strings;
    })(),
  },
];

export const STRING_COLORS = [
  '#60A5FA',
  '#34D399',
  '#FBBF24',
  '#FB923C',
  '#F87171',
  '#C084FC',
];

export const ANOMALY_SEVERITY_COLORS = {
  info: '#3B82F6',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const;
