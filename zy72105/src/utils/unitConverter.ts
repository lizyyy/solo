import type { Unit, UnitConversion } from '../types';

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const dBmTodB = (dBm: number): number => {
  const P_REF = 1e-12;
  const power = Math.pow(10, dBm / 10) / 1000;
  const pressure = Math.sqrt(power * 400 * Math.PI);
  return 20 * Math.log10(pressure / 20e-6);
};

const dBToDBm = (dB: number): number => {
  const pressure = 20e-6 * Math.pow(10, dB / 20);
  const power = (pressure * pressure) / (400 * Math.PI);
  return 10 * Math.log10(power * 1000);
};

const aWeighting = (frequency: number): number => {
  const f2 = frequency * frequency;
  const f4 = f2 * f2;
  const numerator = 12194 * 12194 * f4;
  const denominator =
    (f2 + 20.6 * 20.6) *
    Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) *
    (f2 + 12194 * 12194);
  return 20 * Math.log10(numerator / denominator) + 2.0;
};

const conversionMatrix: Record<Unit, Partial<Record<Unit, (value: number, freq?: number) => number>>> = {
  dB: {
    dBA: (dB, freq = 1000) => dB + aWeighting(freq),
    dBm: (dB) => dBToDBm(dB),
  },
  dBA: {
    dB: (dBA, freq = 1000) => dBA - aWeighting(freq),
  },
  dBm: {
    dB: (dBm) => dBmTodB(dBm),
    dBA: (dBm, freq = 1000) => dBmTodB(dBm) + aWeighting(freq),
  },
  Hz: {
    kHz: (hz) => hz / 1000,
    RPM: (hz) => hz * 60,
  },
  kHz: {
    Hz: (khz) => khz * 1000,
    RPM: (khz) => khz * 60000,
  },
  RPM: {
    Hz: (rpm) => rpm / 60,
    kHz: (rpm) => rpm / 60000,
  },
  'm/s': {
    'km/h': (ms) => ms * 3.6,
  },
  'km/h': {
    'm/s': (kmh) => kmh / 3.6,
  },
  m: {
    km: (m) => m / 1000,
  },
  km: {
    m: (km) => km * 1000,
  },
  kg: {
    g: (kg) => kg * 1000,
  },
  g: {
    kg: (g) => g / 1000,
  },
  N: {},
  Pa: {},
};

const formulaDescriptions: Record<string, string> = {
  'dB->dBA': 'L_A = L_p + A(f), A(f)为A计权频率修正值',
  'dBA->dB': 'L_p = L_A - A(f), A(f)为A计权频率修正值',
  'dBm->dB': 'dB = 20*log10(sqrt(10^(dBm/10)/1000 * 400π) / 20μPa)',
  'dB->dBm': 'dBm = 10*log10((20μPa * 10^(dB/20))² / (400π) * 1000)',
  'Hz->kHz': 'kHz = Hz / 1000',
  'kHz->Hz': 'Hz = kHz × 1000',
  'Hz->RPM': 'RPM = Hz × 60',
  'RPM->Hz': 'Hz = RPM / 60',
  'kHz->RPM': 'RPM = kHz × 60000',
  'RPM->kHz': 'kHz = RPM / 60000',
  'm/s->km/h': 'km/h = m/s × 3.6',
  'km/h->m/s': 'm/s = km/h / 3.6',
  'm->km': 'km = m / 1000',
  'km->m': 'm = km × 1000',
  'kg->g': 'g = kg × 1000',
  'g->kg': 'kg = g / 1000',
};

export const canConvert = (fromUnit: Unit, toUnit: Unit): boolean => {
  if (fromUnit === toUnit) return true;
  return !!conversionMatrix[fromUnit]?.[toUnit];
};

export const getAvailableConversions = (unit: Unit): Unit[] => {
  const conversions = conversionMatrix[unit];
  if (!conversions) return [unit];
  return [unit, ...(Object.keys(conversions) as Unit[])];
};

export const convertUnit = (
  value: number,
  fromUnit: Unit,
  toUnit: Unit,
  frequency?: number
): UnitConversion => {
  if (fromUnit === toUnit) {
    return {
      id: generateId(),
      fromValue: value,
      fromUnit,
      toValue: value,
      toUnit,
      formula: '单位相同，无需转换',
      timestamp: Date.now(),
    };
  }

  const convertFn = conversionMatrix[fromUnit]?.[toUnit];
  if (!convertFn) {
    throw new Error(`无法从 ${fromUnit} 转换到 ${toUnit}`);
  }

  const toValue = convertFn(value, frequency);
  const formulaKey = `${fromUnit}->${toUnit}`;

  return {
    id: generateId(),
    fromValue: value,
    fromUnit,
    toValue: Number(toValue.toFixed(4)),
    toUnit,
    formula: formulaDescriptions[formulaKey] || `${fromUnit} → ${toUnit}`,
    timestamp: Date.now(),
  };
};

export const getUnitCategory = (unit: Unit): string => {
  const categories: Record<string, Unit[]> = {
    声级: ['dB', 'dBA', 'dBm'],
    频率: ['Hz', 'kHz', 'RPM'],
    速度: ['m/s', 'km/h'],
    长度: ['m', 'km'],
    质量: ['kg', 'g'],
    力: ['N'],
    压力: ['Pa'],
  };

  for (const [category, units] of Object.entries(categories)) {
    if (units.includes(unit)) return category;
  }
  return '其他';
};
