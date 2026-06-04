import type { UnitConversion, CaliberHistory } from '@/types';
import { getCaliberByDate, getLatestCaliber } from '@/data/caliberHistory';
import { caliberHistory } from '@/data/caliberHistory';

export interface ConversionResult {
  convertedValue: number;
  conversionFactor: number;
  caliberVersion: string;
  effectiveDate: string;
  historyReference: string;
  description: string;
}

export const convertUnit = (
  value: number,
  fromUnit: string,
  toUnit: string,
  recordDate?: string
): ConversionResult => {
  if (fromUnit === toUnit) {
    return {
      convertedValue: value,
      conversionFactor: 1.0,
      caliberVersion: 'v1.0',
      effectiveDate: '2024-01-15',
      historyReference: '单位一致，无需换算',
      description: `${value}${fromUnit} = ${value}${toUnit}`,
    };
  }

  const caliber = recordDate
    ? getCaliberByDate(fromUnit, toUnit, recordDate)
    : getLatestCaliber(fromUnit, toUnit);

  if (!caliber) {
    throw new Error(`未找到 ${fromUnit} 到 ${toUnit} 的换算口径`);
  }

  const convertedValue = value * caliber.conversionFactor;

  return {
    convertedValue,
    conversionFactor: caliber.conversionFactor,
    caliberVersion: caliber.version,
    effectiveDate: caliber.effectiveDate,
    historyReference: caliber.description,
    description: `${value}${fromUnit} × ${caliber.conversionFactor} = ${convertedValue}${toUnit}`,
  };
};

export const createConversionRecord = (
  recordId: string,
  value: number,
  fromUnit: string,
  toUnit: string,
  recordDate?: string
): UnitConversion => {
  const result = convertUnit(value, fromUnit, toUnit, recordDate);
  return {
    id: `CONV-${Date.now()}`,
    recordId,
    fromUnit,
    toUnit,
    conversionFactor: result.conversionFactor,
    caliberVersion: result.caliberVersion,
    effectiveDate: result.effectiveDate,
    historyReference: result.historyReference,
    description: result.description,
  };
};

export const getCaliberHistoryForUnit = (
  fromUnit: string,
  toUnit: string
): CaliberHistory[] => {
  return caliberHistory
    .filter(c => c.fromUnit === fromUnit && c.toUnit === toUnit)
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
};

export const formatConversionDisplay = (
  originalValue: number,
  originalUnit: string,
  cleanedValue: number,
  cleanedUnit: string,
  conversionFactor: number
): string => {
  return `${originalValue} ${originalUnit} × ${conversionFactor} = ${cleanedValue} ${cleanedUnit}`;
};

export const getUnitDisplayName = (unit: string): string => {
  const unitNames: Record<string, string> = {
    'με': '微应变',
    'mm/mm': '应变（mm/mm）',
    '%': '百分比应变',
    'kN': '千牛',
    'MPa': '兆帕',
  };
  return unitNames[unit] || unit;
};

export const compareWithHistory = (
  currentConversion: UnitConversion,
  historicalRecords: UnitConversion[]
): { isConsistent: boolean; differences: string[] } => {
  const differences: string[] = [];

  historicalRecords.forEach(historical => {
    if (
      historical.fromUnit === currentConversion.fromUnit &&
      historical.toUnit === currentConversion.toUnit &&
      historical.conversionFactor !== currentConversion.conversionFactor
    ) {
      differences.push(
        `与记录 ${historical.recordId} 口径不一致：` +
        `当前版本 ${currentConversion.caliberVersion} (系数 ${currentConversion.conversionFactor})，` +
        `历史版本 ${historical.caliberVersion} (系数 ${historical.conversionFactor})`
      );
    }
  });

  return {
    isConsistent: differences.length === 0,
    differences,
  };
};
