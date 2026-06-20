import type { SparePart, ExceptionCheckResult } from '@/types';

export function checkFormula(sp: SparePart): string | null {
  if (typeof sp.req_qty !== 'number' || Number.isNaN(sp.req_qty) ||
      typeof sp.act_qty !== 'number' || Number.isNaN(sp.act_qty) ||
      typeof sp.price !== 'number' || Number.isNaN(sp.price)) {
    return '公式异常：数值类型错误，无法计算金额';
  }
  if (sp.req_qty < 0) return '公式异常：申报数量不能为负数';
  if (sp.act_qty < 0) return '公式异常：出库数量不能为负数';
  if (sp.price < 0)     return '公式异常：单价不能为负数';
  return null;
}

type UnitRule = [RegExp, string[]];
const UNIT_RULES: UnitRule[] = [
  [/螺栓/,          ['个']],
  [/密封|密封圈|圈/, ['个', '套']],
  [/油管|管|软管/,   ['米']],
  [/油脂|黄油|油/,   ['公斤']],
  [/焊丝|焊条|线/,   ['卷']],
];

export function checkUnit(sp: SparePart): string | null {
  if (!sp.unit) return '异常：未填写单位';
  for (const [pattern, validUnits] of UNIT_RULES) {
    if (pattern.test(sp.part_name) && !validUnits.includes(sp.unit)) {
      return `单位异常：${sp.part_name} 应使用 ${validUnits.join('/')}，当前为「${sp.unit}」`;
    }
  }
  return null;
}

export function checkThreshold(sp: SparePart): string | null {
  if (sp.req_qty == null || Number.isNaN(sp.req_qty)) return '异常：申报数量为空';
  if (sp.req_qty > 1000) return '阈值异常：申报数量超过上限 1000';
  if (sp.price > 100000 && sp.req_qty > 10) {
    return '阈值异常：高值备件（单价 > 10 万）单次申报不得超过 10 件';
  }
  if (/主轴承/.test(sp.part_name) && sp.req_qty > 2) {
    return '阈值异常：主轴承单次申报不得超过 2 个';
  }
  if (sp.req_qty > 0 && sp.act_qty > sp.req_qty * 1.5) {
    return `阈值异常：出库量(${sp.act_qty}) 超过申报量(${sp.req_qty}) 的 150%`;
  }
  return null;
}

export function runAllChecks(sp: SparePart): ExceptionCheckResult {
  return {
    formula: checkFormula(sp),
    unit: checkUnit(sp),
    threshold: checkThreshold(sp),
  };
}

export function hasException(result: ExceptionCheckResult): boolean {
  return result.formula !== null || result.unit !== null || result.threshold !== null;
}

export function summarizeExceptions(result: ExceptionCheckResult): string[] {
  return [result.formula, result.unit, result.threshold].filter(
    (x): x is string => x !== null,
  );
}
