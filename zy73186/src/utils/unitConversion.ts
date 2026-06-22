import type { UnitConversion } from '../types';

interface UnitDefinition {
  name: string;
  symbol: string;
  category: string;
  toBase: number;
  fromBase: number;
}

const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  'm': { name: '米', symbol: 'm', category: 'length', toBase: 1, fromBase: 1 },
  'cm': { name: '厘米', symbol: 'cm', category: 'length', toBase: 0.01, fromBase: 100 },
  'mm': { name: '毫米', symbol: 'mm', category: 'length', toBase: 0.001, fromBase: 1000 },
  'km': { name: '千米', symbol: 'km', category: 'length', toBase: 1000, fromBase: 0.001 },
  'μm': { name: '微米', symbol: 'μm', category: 'length', toBase: 1e-6, fromBase: 1e6 },
  'nm': { name: '纳米', symbol: 'nm', category: 'length', toBase: 1e-9, fromBase: 1e9 },
  'kg': { name: '千克', symbol: 'kg', category: 'mass', toBase: 1, fromBase: 1 },
  'g': { name: '克', symbol: 'g', category: 'mass', toBase: 0.001, fromBase: 1000 },
  'mg': { name: '毫克', symbol: 'mg', category: 'mass', toBase: 1e-6, fromBase: 1e6 },
  't': { name: '吨', symbol: 't', category: 'mass', toBase: 1000, fromBase: 0.001 },
  's': { name: '秒', symbol: 's', category: 'time', toBase: 1, fromBase: 1 },
  'min': { name: '分钟', symbol: 'min', category: 'time', toBase: 60, fromBase: 1 / 60 },
  'h': { name: '小时', symbol: 'h', category: 'time', toBase: 3600, fromBase: 1 / 3600 },
  'ms': { name: '毫秒', symbol: 'ms', category: 'time', toBase: 0.001, fromBase: 1000 },
  'μs': { name: '微秒', symbol: 'μs', category: 'time', toBase: 1e-6, fromBase: 1e6 },
  'm/s': { name: '米每秒', symbol: 'm/s', category: 'velocity', toBase: 1, fromBase: 1 },
  'km/h': { name: '千米每小时', symbol: 'km/h', category: 'velocity', toBase: 1000 / 3600, fromBase: 3600 / 1000 },
  'cm/s': { name: '厘米每秒', symbol: 'cm/s', category: 'velocity', toBase: 0.01, fromBase: 100 },
  'm/s²': { name: '米每二次方秒', symbol: 'm/s²', category: 'acceleration', toBase: 1, fromBase: 1 },
  'N': { name: '牛顿', symbol: 'N', category: 'force', toBase: 1, fromBase: 1 },
  'kgf': { name: '千克力', symbol: 'kgf', category: 'force', toBase: 9.80665, fromBase: 1 / 9.80665 },
  'J': { name: '焦耳', symbol: 'J', category: 'energy', toBase: 1, fromBase: 1 },
  'kJ': { name: '千焦', symbol: 'kJ', category: 'energy', toBase: 1000, fromBase: 0.001 },
  'cal': { name: '卡路里', symbol: 'cal', category: 'energy', toBase: 4.184, fromBase: 1 / 4.184 },
  'kcal': { name: '千卡', symbol: 'kcal', category: 'energy', toBase: 4184, fromBase: 1 / 4184 },
  'Pa': { name: '帕斯卡', symbol: 'Pa', category: 'pressure', toBase: 1, fromBase: 1 },
  'kPa': { name: '千帕', symbol: 'kPa', category: 'pressure', toBase: 1000, fromBase: 0.001 },
  'MPa': { name: '兆帕', symbol: 'MPa', category: 'pressure', toBase: 1e6, fromBase: 1e-6 },
  'atm': { name: '标准大气压', symbol: 'atm', category: 'pressure', toBase: 101325, fromBase: 1 / 101325 },
  'mmHg': { name: '毫米汞柱', symbol: 'mmHg', category: 'pressure', toBase: 133.322, fromBase: 1 / 133.322 },
  '°C': { name: '摄氏度', symbol: '°C', category: 'temperature', toBase: 1, fromBase: 1 },
  'K': { name: '开尔文', symbol: 'K', category: 'temperature', toBase: 1, fromBase: 1 },
  '°F': { name: '华氏度', symbol: '°F', category: 'temperature', toBase: 1, fromBase: 1 },
  'rad': { name: '弧度', symbol: 'rad', category: 'angle', toBase: 1, fromBase: 1 },
  '°': { name: '度', symbol: '°', category: 'angle', toBase: Math.PI / 180, fromBase: 180 / Math.PI },
  'm²': { name: '平方米', symbol: 'm²', category: 'area', toBase: 1, fromBase: 1 },
  'cm²': { name: '平方厘米', symbol: 'cm²', category: 'area', toBase: 0.0001, fromBase: 10000 },
  'mm²': { name: '平方毫米', symbol: 'mm²', category: 'area', toBase: 1e-6, fromBase: 1e6 },
  'km²': { name: '平方千米', symbol: 'km²', category: 'area', toBase: 1e6, fromBase: 1e-6 },
  'ha': { name: '公顷', symbol: 'ha', category: 'area', toBase: 10000, fromBase: 0.0001 },
  'V': { name: '伏特', symbol: 'V', category: 'voltage', toBase: 1, fromBase: 1 },
  'kV': { name: '千伏', symbol: 'kV', category: 'voltage', toBase: 1000, fromBase: 0.001 },
  'mV': { name: '毫伏', symbol: 'mV', category: 'voltage', toBase: 0.001, fromBase: 1000 },
  'A': { name: '安培', symbol: 'A', category: 'current', toBase: 1, fromBase: 1 },
  'mA': { name: '毫安', symbol: 'mA', category: 'current', toBase: 0.001, fromBase: 1000 },
  'kA': { name: '千安', symbol: 'kA', category: 'current', toBase: 1000, fromBase: 0.001 },
  'Ω': { name: '欧姆', symbol: 'Ω', category: 'resistance', toBase: 1, fromBase: 1 },
  'kΩ': { name: '千欧', symbol: 'kΩ', category: 'resistance', toBase: 1000, fromBase: 0.001 },
  'MΩ': { name: '兆欧', symbol: 'MΩ', category: 'resistance', toBase: 1e6, fromBase: 1e-6 },
  'W': { name: '瓦特', symbol: 'W', category: 'power', toBase: 1, fromBase: 1 },
  'kW': { name: '千瓦', symbol: 'kW', category: 'power', toBase: 1000, fromBase: 0.001 },
  'MW': { name: '兆瓦', symbol: 'MW', category: 'power', toBase: 1e6, fromBase: 1e-6 },
  'T': { name: '特斯拉', symbol: 'T', category: 'magnetic_field', toBase: 1, fromBase: 1 },
  'mT': { name: '毫特斯拉', symbol: 'mT', category: 'magnetic_field', toBase: 0.001, fromBase: 1000 },
  'G': { name: '高斯', symbol: 'G', category: 'magnetic_field', toBase: 1e-4, fromBase: 10000 },
  'N/m': { name: '牛顿每米', symbol: 'N/m', category: 'spring_constant', toBase: 1, fromBase: 1 },
  'kN/m': { name: '千牛每米', symbol: 'kN/m', category: 'spring_constant', toBase: 1000, fromBase: 0.001 },
  '匝': { name: '匝', symbol: '匝', category: 'count', toBase: 1, fromBase: 1 },
  'rad/s': { name: '弧度每秒', symbol: 'rad/s', category: 'angular_velocity', toBase: 1, fromBase: 1 },
  'rpm': { name: '转每分钟', symbol: 'rpm', category: 'angular_velocity', toBase: Math.PI / 30, fromBase: 30 / Math.PI },
};

const TEMPERATURE_CONVERSIONS: Record<string, (value: number) => number> = {
  '°C->K': (v) => v + 273.15,
  'K->°C': (v) => v - 273.15,
  '°F->°C': (v) => (v - 32) * 5 / 9,
  '°C->°F': (v) => v * 9 / 5 + 32,
  '°F->K': (v) => (v - 32) * 5 / 9 + 273.15,
  'K->°F': (v) => (v - 273.15) * 9 / 5 + 32,
};

export function getUnitConversionFactor(fromUnit: string, toUnit: string): number | null {
  const fromDef = UNIT_DEFINITIONS[fromUnit];
  const toDef = UNIT_DEFINITIONS[toUnit];

  if (!fromDef || !toDef) return null;
  if (fromDef.category !== toDef.category) return null;
  if (fromDef.category === 'temperature') return null;

  return fromDef.toBase * toDef.fromBase;
}

export function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string
): { value: number; factor: number; formula: string } | null {
  const tempKey = `${fromUnit}->${toUnit}`;
  if (TEMPERATURE_CONVERSIONS[tempKey]) {
    const result = TEMPERATURE_CONVERSIONS[tempKey](value);
    const formula = getTemperatureFormula(fromUnit, toUnit);
    return { value: result, factor: 1, formula };
  }

  const factor = getUnitConversionFactor(fromUnit, toUnit);
  if (factor === null) return null;

  const result = value * factor;
  const formula = `${value} ${fromUnit} × ${factor} = ${result} ${toUnit}`;

  return { value: result, factor, formula };
}

function getTemperatureFormula(fromUnit: string, toUnit: string): string {
  switch (`${fromUnit}->${toUnit}`) {
    case '°C->K':
      return 'T(K) = T(°C) + 273.15';
    case 'K->°C':
      return 'T(°C) = T(K) - 273.15';
    case '°F->°C':
      return 'T(°C) = (T(°F) - 32) × 5/9';
    case '°C->°F':
      return 'T(°F) = T(°C) × 9/5 + 32';
    case '°F->K':
      return 'T(K) = (T(°F) - 32) × 5/9 + 273.15';
    case 'K->°F':
      return 'T(°F) = (T(K) - 273.15) × 9/5 + 32';
    default:
      return '';
  }
}

export function createUnitConversion(
  value: number,
  fromUnit: string,
  toUnit: string
): UnitConversion | null {
  const conversion = convertUnit(value, fromUnit, toUnit);
  if (!conversion) return null;

  return {
    originalUnit: fromUnit,
    targetUnit: toUnit,
    conversionFactor: conversion.factor,
    intermediateValue: conversion.value,
    formula: conversion.formula,
  };
}

export function getAvailableUnits(): string[] {
  return Object.keys(UNIT_DEFINITIONS);
}

export function getUnitCategory(unit: string): string | null {
  return UNIT_DEFINITIONS[unit]?.category || null;
}

export function getUnitName(unit: string): string | null {
  return UNIT_DEFINITIONS[unit]?.name || null;
}
