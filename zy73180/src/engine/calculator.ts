import type { CalculationResult, CalculationParams } from '@/types';

export function evaluateFormula(formula: string, variables: Record<string, number>): number | null {
  try {
    const varNames = Object.keys(variables);
    const varValues = Object.values(variables);

    const sanitizedFormula = formula
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\bmax\b/g, 'Math.max')
      .replace(/\bmin\b/g, 'Math.min')
      .replace(/\bpow\b/g, 'Math.pow')
      .replace(/\bexp\b/g, 'Math.exp')
      .replace(/\blog\b/g, 'Math.log')
      .replace(/\blog10\b/g, 'Math.log10')
      .replace(/\bceil\b/g, 'Math.ceil')
      .replace(/\bfloor\b/g, 'Math.floor')
      .replace(/\bround\b/g, 'Math.round');

    const fn = new Function(...varNames, `return ${sanitizedFormula};`);
    const result = fn(...varValues);

    if (typeof result !== 'number' || !isFinite(result)) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

export function extractVariablesFromData(
  data: Record<string, any>,
  formula: string
): Record<string, number> {
  const variables: Record<string, number> = {};

  const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const matches = formula.match(varPattern) || [];

  const mathFunctions = new Set([
    'sqrt', 'abs', 'max', 'min', 'pow', 'exp', 'log', 'log10',
    'ceil', 'floor', 'round', 'Math', 'PI', 'E'
  ]);

  for (const match of matches) {
    if (mathFunctions.has(match)) continue;
    if (match === 'Math') continue;

    const value = data[match];
    if (value !== undefined && value !== null) {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        variables[match] = numValue;
      }
    }
  }

  return variables;
}

export function calculateRecord(
  data: Record<string, any>,
  params: CalculationParams
): CalculationResult {
  const variables = extractVariablesFromData(data, params.formula);

  const hasAllRequiredVars = params.formula
    .match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)
    ?.filter(v => {
      const mathFunctions = ['sqrt', 'abs', 'max', 'min', 'pow', 'exp', 'log', 'log10', 'ceil', 'floor', 'round', 'Math', 'PI', 'E'];
      return !mathFunctions.includes(v) && v !== 'Math';
    })
    .every(v => v in variables);

  if (!hasAllRequiredVars) {
    return {
      value: null,
      unit: data.unit || null,
      formula: params.formula,
      variables,
      success: false,
      errorMessage: '缺少必要的计算变量',
    };
  }

  const value = evaluateFormula(params.formula, variables);

  if (value === null) {
    return {
      value: null,
      unit: data.unit || null,
      formula: params.formula,
      variables,
      success: false,
      errorMessage: '公式计算失败',
    };
  }

  return {
    value,
    unit: data.unit || null,
    formula: params.formula,
    variables,
    success: true,
  };
}

export function checkUnitCompleteness(
  data: Record<string, any>,
  requiredFields: string[]
): { complete: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    }
  }

  return {
    complete: missingFields.length === 0,
    missingFields,
  };
}

export function isBoundarySample(
  value: number,
  allValues: number[],
  params: CalculationParams
): { isBoundary: boolean; reason?: string } {
  const reasons: string[] = [];

  if (params.boundaryConfig.minValue !== undefined && value < params.boundaryConfig.minValue) {
    reasons.push(`低于最小值阈值 ${params.boundaryConfig.minValue}`);
  }

  if (params.boundaryConfig.maxValue !== undefined && value > params.boundaryConfig.maxValue) {
    reasons.push(`高于最大值阈值 ${params.boundaryConfig.maxValue}`);
  }

  const validValues = allValues.filter(v => isFinite(v));
  if (validValues.length > 0 && params.boundaryConfig.percentileThreshold) {
    const sorted = [...validValues].sort((a, b) => a - b);
    const threshold = params.boundaryConfig.percentileThreshold;

    const lowIndex = Math.floor(sorted.length * threshold);
    const highIndex = Math.ceil(sorted.length * (1 - threshold));

    if (value <= sorted[lowIndex]) {
      reasons.push(`处于数据分布底部 ${(threshold * 100).toFixed(0)}%`);
    }
    if (value >= sorted[highIndex]) {
      reasons.push(`处于数据分布顶部 ${(threshold * 100).toFixed(0)}%`);
    }
  }

  if (params.boundaryConfig.sampleSizeThreshold && allValues.length < params.boundaryConfig.sampleSizeThreshold) {
    reasons.push(`样本量不足（${allValues.length} < ${params.boundaryConfig.sampleSizeThreshold}），结果需谨慎对待`);
  }

  return {
    isBoundary: reasons.length > 0,
    reason: reasons.length > 0 ? reasons.join('；') : undefined,
  };
}

export function isBadData(data: Record<string, any>): { isBad: boolean; reason?: string } {
  const value = data.value;

  if (value === undefined || value === null) {
    return { isBad: true, reason: '数值字段为空' };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return { isBad: true, reason: '数值字段为空字符串' };
    }
    if (isNaN(Number(trimmed))) {
      return { isBad: true, reason: `无法解析为数字："${value}"` };
    }
  }

  if (typeof value !== 'number' && typeof value !== 'string') {
    return { isBad: true, reason: `数值类型错误：${typeof value}` };
  }

  return { isBad: false };
}

export function generateSuggestion(
  type: 'unit_missing' | 'boundary_sample' | 'bad_data' | 'calculation_error',
  data: Record<string, any>,
  missingFields?: string[],
  boundaryReason?: string,
  errorMessage?: string
): string {
  switch (type) {
    case 'unit_missing':
      return `缺少单位字段：${missingFields?.join('、') || '未知'}。建议补充完整单位信息后重新验算，确保计算结果的物理意义明确。`;

    case 'boundary_sample':
      return `边界样本：${boundaryReason || '处于数据边界'}。建议：1）检查原始数据是否录入正确；2）确认该样本是否属于特殊情况；3）边界样本少时需谨慎外推结论。`;

    case 'bad_data':
      return `数据质量问题：${errorMessage || '无法识别的数值'}。建议核对历史答案原始记录，确认数据格式和内容是否正确。`;

    case 'calculation_error':
      return `计算异常：${errorMessage || '公式执行失败'}。建议检查公式配置是否正确，确认所有变量都有有效的数值。`;

    default:
      return '请人工复核该条记录。';
  }
}
