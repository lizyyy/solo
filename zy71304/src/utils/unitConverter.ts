import type { Unit } from '../types';

const MM_TO_CM = 0.1;
const MM_TO_IN = 0.0393701;
const CM_TO_MM = 10;
const IN_TO_MM = 25.4;

export const convertToMm = (value: number, fromUnit: Unit): number => {
  switch (fromUnit) {
    case 'mm':
      return value;
    case 'cm':
      return value * CM_TO_MM;
    case 'in':
      return value * IN_TO_MM;
    default:
      return value;
  }
};

export const convertFromMm = (valueInMm: number, toUnit: Unit): number => {
  switch (toUnit) {
    case 'mm':
      return valueInMm;
    case 'cm':
      return valueInMm * MM_TO_CM;
    case 'in':
      return valueInMm * MM_TO_IN;
    default:
      return valueInMm;
  }
};

export const convertUnit = (value: number, fromUnit: Unit, toUnit: Unit): number => {
  if (fromUnit === toUnit) return value;
  const mmValue = convertToMm(value, fromUnit);
  return convertFromMm(mmValue, toUnit);
};

export const detectUnitMixed = (
  widthUnit: Unit,
  heightUnit: Unit,
  depthUnit: Unit,
): boolean => {
  const units = new Set([widthUnit, heightUnit, depthUnit]);
  return units.size > 1;
};

export const getUnitConversionTable = (
  width: number,
  widthUnit: Unit,
  height: number,
  heightUnit: Unit,
  depth: number,
  depthUnit: Unit,
) => {
  const units: Unit[] = ['mm', 'cm', 'in'];
  const unitLabels: Record<Unit, string> = {
    mm: '毫米(mm)',
    cm: '厘米(cm)',
    in: '英寸(in)',
  };

  return {
    width: units.map((unit) => ({
      unit,
      label: unitLabels[unit],
      value: convertUnit(width, widthUnit, unit),
      isOriginal: unit === widthUnit,
    })),
    height: units.map((unit) => ({
      unit,
      label: unitLabels[unit],
      value: convertUnit(height, heightUnit, unit),
      isOriginal: unit === heightUnit,
    })),
    depth: units.map((unit) => ({
      unit,
      label: unitLabels[unit],
      value: convertUnit(depth, depthUnit, unit),
      isOriginal: unit === depthUnit,
    })),
  };
};

export const normalizeToMm = (
  width: number,
  widthUnit: Unit,
  height: number,
  heightUnit: Unit,
  depth: number,
  depthUnit: Unit,
) => ({
  width: convertToMm(width, widthUnit),
  height: convertToMm(height, heightUnit),
  depth: convertToMm(depth, depthUnit),
});
