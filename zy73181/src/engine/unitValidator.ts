import type { UnitCheckResult, UnitConversion, Problem } from '@/types';

const unitConversions: UnitConversion[] = [
  { fromUnit: 'kg', toUnit: 'g', factor: 1000 },
  { fromUnit: 'g', toUnit: 'kg', factor: 0.001 },
  { fromUnit: 'm', toUnit: 'cm', factor: 100 },
  { fromUnit: 'cm', toUnit: 'm', factor: 0.01 },
  { fromUnit: 'km', toUnit: 'm', factor: 1000 },
  { fromUnit: 'm', toUnit: 'km', factor: 0.001 },
  { fromUnit: '小时', toUnit: '分钟', factor: 60 },
  { fromUnit: '分钟', toUnit: '小时', factor: 1 / 60 },
  { fromUnit: '元', toUnit: '万元', factor: 0.0001 },
  { fromUnit: '万元', toUnit: '元', factor: 10000 },
];

const knownUnits = ['kg', 'g', 'm', 'cm', 'km', '件', '个', '人', '台', '%', '元', '万元', '小时', '分钟', '单位/时', 'mse'];

export function isUnitMissing(unit: string | null | undefined): boolean {
  return unit === null || unit === undefined || unit.trim() === '';
}

export function isUnitKnown(unit: string): boolean {
  return knownUnits.includes(unit);
}

export function validateUnit(problem: Problem, targetUnit?: string): { result: UnitCheckResult; message: string } {
  if (isUnitMissing(problem.boundaryUnit)) {
    return {
      result: 'missing',
      message: '单位缺失：题目未标注边界值单位',
    };
  }

  if (!isUnitKnown(problem.boundaryUnit!)) {
    return {
      result: 'mismatch',
      message: `单位不匹配：未知单位"${problem.boundaryUnit}"`,
    };
  }

  if (targetUnit && problem.boundaryUnit !== targetUnit) {
    const canConvert = unitConversions.some(
      (c) => (c.fromUnit === problem.boundaryUnit && c.toUnit === targetUnit) ||
             (c.fromUnit === targetUnit && c.toUnit === problem.boundaryUnit!)
    );
    if (!canConvert) {
      return {
        result: 'mismatch',
        message: `单位不匹配：无法在"${problem.boundaryUnit}"和"${targetUnit}"之间换算`,
      };
    }
  }

  return {
    result: 'pass',
    message: '单位校验通过',
  };
}

export function convertUnit(value: number, fromUnit: string, toUnit: string): { converted: number; factor: number; description: string } | null {
  if (fromUnit === toUnit) {
    return { converted: value, factor: 1, description: '单位相同，无需换算' };
  }

  const direct = unitConversions.find((c) => c.fromUnit === fromUnit && c.toUnit === toUnit);
  if (direct) {
    return {
      converted: value * direct.factor,
      factor: direct.factor,
      description: `${fromUnit} → ${toUnit}，换算系数 ×${direct.factor}`,
    };
  }

  const reverse = unitConversions.find((c) => c.fromUnit === toUnit && c.toUnit === fromUnit);
  if (reverse) {
    const factor = 1 / reverse.factor;
    return {
      converted: value * factor,
      factor,
      description: `${fromUnit} → ${toUnit}，换算系数 ×${factor.toFixed(6)}`,
    };
  }

  return null;
}

export function getUnitCategory(unit: string): string {
  const weightUnits = ['kg', 'g', '吨'];
  const lengthUnits = ['m', 'cm', 'km', 'mm'];
  const timeUnits = ['小时', '分钟', '秒', '天'];
  const moneyUnits = ['元', '万元', '千元'];
  const countUnits = ['件', '个', '人', '台'];
  const rateUnits = ['%', '‰'];
  const throughputUnits = ['单位/时', '件/小时', '人/天'];

  if (weightUnits.includes(unit)) return '重量';
  if (lengthUnits.includes(unit)) return '长度';
  if (timeUnits.includes(unit)) return '时间';
  if (moneyUnits.includes(unit)) return '金额';
  if (countUnits.includes(unit)) return '数量';
  if (rateUnits.includes(unit)) return '比率';
  if (throughputUnits.includes(unit)) return '吞吐量';
  return '其他';
}
