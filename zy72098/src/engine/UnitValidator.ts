import type { UnitCheckResult } from '@/types';

export class UnitValidator {
  private unitMapping: Record<string, string[]> = {
    count: ['', '个', '个节点', '条', '个社区'],
    degree: ['度/节点', '度'],
    ratio: ['', '模块度'],
    weight: [''],
  };

  validateParameters(inputs: Record<string, unknown>): UnitCheckResult {
    const issues: string[] = [];

    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string') {
        if (this.containsUnit(value)) {
          issues.push(`${key}单位为"${value}"，预期应为纯数值`);
        }
      }

      if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
        issues.push(`关键输入参数${key}缺失`);
      }
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  }

  validateParamVersionConsistency(
    currentParams: Record<string, { unit: string }>,
    referenceParams: Record<string, { unit: string }>
  ): UnitCheckResult {
    const issues: string[] = [];

    for (const [key, param] of Object.entries(currentParams)) {
      const reference = referenceParams[key];
      if (reference && param.unit !== reference.unit) {
        if (param.unit && reference.unit) {
          issues.push(`${key}单位不一致：当前"${param.unit}" vs 参考"${reference.unit}"`);
        }
      }
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  }

  private containsUnit(value: string): boolean {
    const unitPatterns = ['个', '条', '度', '节点', '社区', '%'];
    return unitPatterns.some((pattern) => value.includes(pattern) && isNaN(parseFloat(value)));
  }

  extractUnit(value: string): { numericValue: number | null; unit: string } {
    const match = value.match(/^([\d.]+)\s*(.*)$/);
    if (match) {
      return {
        numericValue: parseFloat(match[1]),
        unit: match[2] || '',
      };
    }
    return { numericValue: null, unit: '' };
  }
}

export const unitValidator = new UnitValidator();
