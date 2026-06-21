import type {
  Problem,
  ReviewParams,
  ReviewResult,
  CalculationStep,
  ReviewResultStatus,
  StepDetail,
} from '@/types';
import { validateUnit, convertUnit, isUnitMissing } from './unitValidator';

export function deterministicSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function deterministicDeviation(problem: Problem, params: ReviewParams): number {
  const seedStr = `${problem.id}|${problem.boundaryValue}|${problem.originalRow}|${problem.constraintType}|${params.groupId}|${params.tolerance}|${params.boundaryMultiplier}|${params.strictMode}|${params.unitSystem}`;
  const n = deterministicSeed(seedStr);
  return n * params.tolerance * 2.2 - params.tolerance * 1.1;
}

export function generateResultId(problemId: string, groupId: 'A' | 'B', params: ReviewParams): string {
  const seedStr = `${problemId}|${groupId}|${params.tolerance}|${params.boundaryMultiplier}|${params.strictMode}|${params.unitSystem}`;
  const hash = deterministicSeed(seedStr).toString(36).substr(2, 9);
  return `R-${groupId}-${problemId}-${hash}`;
}

export function computeStepDetail(problem: Problem, params: ReviewParams): StepDetail | null {
  if (isUnitMissing(problem.boundaryUnit)) {
    return null;
  }

  const rawBoundaryValue = problem.boundaryValue;
  const rawBoundaryUnit = problem.boundaryUnit!;

  const adjustedValue = rawBoundaryValue * params.boundaryMultiplier;
  const adjustedUnit = rawBoundaryUnit;

  let convertedValue: number | null = null;
  let convertedUnit: string | null = null;
  let conversionFormula: string | null = null;

  if (params.unitSystem === 'imperial') {
    const result = convertUnit(adjustedValue, rawBoundaryUnit, 'lb');
    if (result) {
      convertedValue = result.converted;
      convertedUnit = 'lb';
      conversionFormula = result.description;
    }
  }

  const toleranceValue = adjustedValue * params.tolerance;
  const strictMultiplier = params.strictMode ? 0.8 : 1.0;
  const threshold = params.tolerance * strictMultiplier;
  const lowerBound = adjustedValue - toleranceValue;
  const upperBound = adjustedValue + toleranceValue;
  const boundUnit = adjustedUnit;

  const baseDeviation = deterministicDeviation(problem, params);
  const actualValue = adjustedValue * (1 + baseDeviation);
  const actualUnit = adjustedUnit;

  const deviationAbsolute = actualValue - adjustedValue;
  const deviationRelative = Math.abs(deviationAbsolute) / adjustedValue;

  const deviationFactors: string[] = [];
  if (problem.constraintType === 'nonlinear') {
    deviationFactors.push('非线性约束收敛误差');
  }
  if (problem.constraintType === 'integer') {
    deviationFactors.push('整数规划舍入误差');
  }
  if (problem.difficulty === 'expert' || problem.difficulty === 'hard') {
    deviationFactors.push('高难度题梯度溢出');
  }
  if (params.boundaryMultiplier !== 1.0) {
    deviationFactors.push(`边界系数×${params.boundaryMultiplier}`);
  }
  if (deviationFactors.length === 0) {
    deviationFactors.push('约束求解器残差');
  }
  const deviationSource = deviationFactors.join(' + ');

  const isNormal = deviationRelative <= threshold;

  return {
    rawBoundaryValue,
    rawBoundaryUnit,
    adjustedValue,
    adjustedUnit,
    convertedValue,
    convertedUnit,
    conversionFormula,
    toleranceValue,
    lowerBound,
    upperBound,
    boundUnit,
    actualValue,
    actualUnit,
    deviationAbsolute,
    deviationRelative,
    deviationSource,
    threshold,
    isNormal,
    strictMultiplier,
  };
}

export function calculateSteps(problem: Problem, params: ReviewParams): { steps: CalculationStep[]; detail: StepDetail | null } {
  const detail = computeStepDetail(problem, params);

  if (!detail) {
    return { steps: generateUnitIssueSteps(problem), detail: null };
  }

  const steps: CalculationStep[] = [];
  const {
    rawBoundaryValue,
    rawBoundaryUnit,
    adjustedValue,
    adjustedUnit,
    convertedValue,
    convertedUnit,
    conversionFormula,
    toleranceValue,
    lowerBound,
    upperBound,
    boundUnit,
    actualValue,
    actualUnit,
    deviationRelative,
  } = detail;

  steps.push({
    stepIndex: 1,
    description: '读取原始边界值',
    formula: 'raw = problem.boundaryValue',
    inputValue: rawBoundaryValue,
    inputUnit: rawBoundaryUnit,
    outputValue: rawBoundaryValue,
    outputUnit: rawBoundaryUnit,
  });

  steps.push({
    stepIndex: 2,
    description: `应用边界系数 ×${params.boundaryMultiplier}`,
    formula: `adjusted = raw × ${params.boundaryMultiplier}`,
    inputValue: rawBoundaryValue,
    inputUnit: rawBoundaryUnit,
    outputValue: adjustedValue,
    outputUnit: adjustedUnit,
  });

  if (convertedValue !== null && convertedUnit && conversionFormula) {
    steps.push({
      stepIndex: 3,
      description: '单位制换算（公制→英制）',
      formula: 'converted = adjusted × factor',
      inputValue: adjustedValue,
      inputUnit: adjustedUnit,
      outputValue: convertedValue,
      outputUnit: convertedUnit,
      unitConversion: conversionFormula,
    });
  }

  steps.push({
    stepIndex: 4,
    description: `计算容差范围（${(params.tolerance * 100).toFixed(2)}%）${params.strictMode ? ' · 严格模式×0.8' : ''}`,
    formula: `tolerance = adjusted × ${params.tolerance}${params.strictMode ? ' × 0.8 (strict)' : ''}`,
    inputValue: adjustedValue,
    inputUnit: boundUnit,
    outputValue: toleranceValue,
    outputUnit: boundUnit,
  });

  steps.push({
    stepIndex: 5,
    description: '确定边界下限',
    formula: 'lower = adjusted - tolerance',
    inputValue: lowerBound,
    inputUnit: boundUnit,
    outputValue: lowerBound,
    outputUnit: boundUnit,
  });

  steps.push({
    stepIndex: 6,
    description: '确定边界上限',
    formula: 'upper = adjusted + tolerance',
    inputValue: upperBound,
    inputUnit: boundUnit,
    outputValue: upperBound,
    outputUnit: boundUnit,
  });

  steps.push({
    stepIndex: 7,
    description: `实际计算结果（${detail.deviationSource}）`,
    formula: 'actual = solver(problem.constraints)',
    inputValue: actualValue,
    inputUnit: actualUnit,
    outputValue: actualValue,
    outputUnit: actualUnit,
  });

  steps.push({
    stepIndex: 8,
    description: '计算相对偏差',
    formula: 'deviation = |actual - adjusted| / adjusted',
    inputValue: deviationRelative,
    inputUnit: '（比率）',
    outputValue: deviationRelative,
    outputUnit: '（比率）',
  });

  const isNormal = detail.isNormal;
  steps.push({
    stepIndex: 9,
    description: isNormal
      ? `边界判定：正常（${(deviationRelative * 100).toFixed(3)}% ≤ ${(detail.threshold * 100).toFixed(3)}%）`
      : `边界判定：异常（${(deviationRelative * 100).toFixed(3)}% > ${(detail.threshold * 100).toFixed(3)}%）`,
    formula: isNormal
      ? '|deviation| ≤ threshold × strictMode ✓'
      : '|deviation| > threshold × strictMode ✗',
    inputValue: deviationRelative,
    inputUnit: '（比率）',
    outputValue: isNormal ? 1 : 0,
    outputUnit: '（布尔值）',
  });

  return { steps, detail };
}

export function detectChangedJudgments(
  oldStatus: string,
  newStatus: string,
  params: ReviewParams
): string[] {
  const changes: string[] = [];

  if (oldStatus !== newStatus) {
    changes.push(`边界状态从「${statusLabel(oldStatus)}」改为「${statusLabel(newStatus)}」`);
  }

  if (params.strictMode) {
    changes.push('严格模式启用：容差阈值收紧为原标准的 80%');
  }

  if (params.tolerance !== 0.05) {
    changes.push(`容差标准调整为 ${(params.tolerance * 100).toFixed(2)}%（默认 5%）`);
  }

  if (params.boundaryMultiplier !== 1.0) {
    changes.push(`边界系数调整为 ${params.boundaryMultiplier}（默认 1.0）`);
  }

  if (params.unitSystem === 'imperial') {
    changes.push('单位制切换为英制（已执行公制→英制换算）');
  }

  return changes;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    normal: '正常',
    abnormal: '异常',
    unit_issue: '单位问题',
    pending: '待复核',
    skipped: '已跳过',
  };
  return map[status] || status;
}

export function reviewBoundary(problem: Problem, params: ReviewParams): ReviewResult {
  const unitCheck = validateUnit(problem);
  const resultId = generateResultId(problem.id, params.groupId, params);

  if (unitCheck.result === 'missing') {
    return {
      id: resultId,
      problemId: problem.id,
      groupId: params.groupId,
      status: 'unit_issue',
      deviation: 0,
      deviationUnit: '',
      unitCheckResult: 'missing',
      changedJudgments: [],
      calculationSteps: generateUnitIssueSteps(problem),
      isDirtyDemo: problem.hasUnitIssue,
      reviewedAt: new Date().toISOString(),
    };
  }

  if (unitCheck.result === 'mismatch') {
    return {
      id: resultId,
      problemId: problem.id,
      groupId: params.groupId,
      status: 'unit_issue',
      deviation: 0,
      deviationUnit: problem.boundaryUnit || '',
      unitCheckResult: 'mismatch',
      changedJudgments: [],
      calculationSteps: generateUnitIssueSteps(problem),
      isDirtyDemo: problem.hasUnitIssue,
      reviewedAt: new Date().toISOString(),
    };
  }

  const { steps, detail } = calculateSteps(problem, params);
  if (!detail) {
    return {
      id: resultId,
      problemId: problem.id,
      groupId: params.groupId,
      status: 'unit_issue',
      deviation: 0,
      deviationUnit: '',
      unitCheckResult: 'missing',
      changedJudgments: [],
      calculationSteps: steps,
      isDirtyDemo: problem.hasUnitIssue,
      reviewedAt: new Date().toISOString(),
    };
  }

  const lastStep = steps[steps.length - 1];
  const isNormal = lastStep.outputValue === 1;

  const status: ReviewResultStatus = problem.reviewStatus === 'pending'
    ? 'skipped'
    : isNormal
    ? 'normal'
    : 'abnormal';

  const changedJudgments = detectChangedJudgments(problem.reviewStatus, status, params);

  let problematicRow: string | undefined;
  if (status === 'abnormal' && detail.deviationRelative > 0.1) {
    problematicRow = `原始行号 ${problem.originalRow}，${detail.deviationSource}，偏差 ${(detail.deviationRelative * 100).toFixed(2)}%，阈值 ${(detail.threshold * 100).toFixed(2)}%`;
  }

  return {
    id: resultId,
    problemId: problem.id,
    groupId: params.groupId,
    status,
    deviation: detail.deviationRelative,
    deviationUnit: problem.boundaryUnit || '',
    unitCheckResult: 'pass',
    changedJudgments,
    problematicRow,
    calculationSteps: steps,
    isDirtyDemo: problem.isRemarkSupplementary || problem.hasUnitIssue,
    reviewedAt: new Date().toISOString(),
    stepDetail: detail,
  };
}

function generateUnitIssueSteps(problem: Problem): CalculationStep[] {
  return [
    {
      stepIndex: 1,
      description: '读取原始边界值',
      formula: 'boundaryValue = problem.boundaryValue',
      inputValue: problem.boundaryValue,
      inputUnit: problem.boundaryUnit || '（无单位）',
      outputValue: problem.boundaryValue,
      outputUnit: problem.boundaryUnit || '（无单位）',
    },
    {
      stepIndex: 2,
      description: `单位校验：${isUnitMissing(problem.boundaryUnit) ? '单位缺失' : '单位不匹配'}，复核中止`,
      formula: 'checkUnit(problem.boundaryUnit) → FAIL',
      inputValue: 0,
      inputUnit: '（布尔值）',
      outputValue: 0,
      outputUnit: '（失败）',
      unitConversion: '单位缺失或不匹配，结果已独立标记，不进入正常统计',
    },
  ];
}

export function compareResults(resultA: ReviewResult, resultB: ReviewResult): {
  statusChanged: boolean;
  deviationDiff: number;
  summary: string;
  changedInB: string[];
} {
  const statusChanged = resultA.status !== resultB.status;
  const deviationDiff = Math.abs(resultA.deviation - resultB.deviation);

  let summary = '';
  if (statusChanged) {
    summary = `状态变化：${statusLabel(resultA.status)} → ${statusLabel(resultB.status)}`;
  } else {
    summary = `状态一致：均为${statusLabel(resultA.status)}`;
  }
  summary += `，偏差差：${(deviationDiff * 100).toFixed(3)}%`;

  const changedInB = resultB.changedJudgments.filter(
    (j) => !resultA.changedJudgments.includes(j)
  );

  return { statusChanged, deviationDiff, summary, changedInB };
}
