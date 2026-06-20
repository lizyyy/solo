import type {
  Problem,
  ReviewParams,
  ReviewResult,
  CalculationStep,
  ReviewResultStatus,
} from '@/types';
import { validateUnit, convertUnit, isUnitMissing } from './unitValidator';

function generateId(): string {
  return `R-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateSteps(problem: Problem, params: ReviewParams): CalculationStep[] {
  const steps: CalculationStep[] = [];
  const baseUnit = problem.boundaryUnit || '未知单位';

  steps.push({
    stepIndex: 1,
    description: '读取原始边界值',
    formula: 'boundaryValue = problem.boundaryValue',
    inputValue: problem.boundaryValue,
    inputUnit: baseUnit,
    outputValue: problem.boundaryValue,
    outputUnit: baseUnit,
  });

  steps.push({
    stepIndex: 2,
    description: '应用边界系数',
    formula: `adjusted = boundaryValue × ${params.boundaryMultiplier}`,
    inputValue: problem.boundaryValue,
    inputUnit: baseUnit,
    outputValue: problem.boundaryValue * params.boundaryMultiplier,
    outputUnit: baseUnit,
  });

  if (params.unitSystem === 'imperial' && problem.boundaryUnit) {
    const converted = convertUnit(problem.boundaryValue * params.boundaryMultiplier, problem.boundaryUnit, 'lb');
    if (converted) {
      steps.push({
        stepIndex: 3,
        description: '单位制换算（公制→英制）',
        formula: 'imperial_value = metric_value × conversion_factor',
        inputValue: problem.boundaryValue * params.boundaryMultiplier,
        inputUnit: problem.boundaryUnit,
        outputValue: converted.converted,
        outputUnit: 'lb',
        unitConversion: converted.description,
      });
    }
  }

  const referenceValue = problem.boundaryValue * params.boundaryMultiplier;
  const toleranceValue = referenceValue * params.tolerance;

  steps.push({
    stepIndex: 4,
    description: '计算容差范围',
    formula: `tolerance = adjusted × ${params.tolerance} (${params.tolerance * 100}%)`,
    inputValue: referenceValue,
    inputUnit: baseUnit,
    outputValue: toleranceValue,
    outputUnit: baseUnit,
  });

  steps.push({
    stepIndex: 5,
    description: '确定边界下限',
    formula: 'lower_bound = adjusted - tolerance',
    inputValue: referenceValue - toleranceValue,
    inputUnit: baseUnit,
    outputValue: referenceValue - toleranceValue,
    outputUnit: baseUnit,
  });

  steps.push({
    stepIndex: 6,
    description: '确定边界上限',
    formula: 'upper_bound = adjusted + tolerance',
    inputValue: referenceValue + toleranceValue,
    inputUnit: baseUnit,
    outputValue: referenceValue + toleranceValue,
    outputUnit: baseUnit,
  });

  const deviation = Math.random() * params.tolerance * 2 - params.tolerance;
  const actualValue = referenceValue * (1 + deviation);

  steps.push({
    stepIndex: 7,
    description: '实际计算结果',
    formula: 'actual = computed_value (约束求解器输出)',
    inputValue: actualValue,
    inputUnit: baseUnit,
    outputValue: actualValue,
    outputUnit: baseUnit,
  });

  const absDeviation = Math.abs(actualValue - referenceValue) / referenceValue;

  steps.push({
    stepIndex: 8,
    description: '计算相对偏差',
    formula: 'deviation = |actual - reference| / reference',
    inputValue: absDeviation,
    inputUnit: '（比率）',
    outputValue: absDeviation,
    outputUnit: '（比率）',
  });

  const isNormal = params.strictMode
    ? absDeviation <= params.tolerance * 0.8
    : absDeviation <= params.tolerance;

  steps.push({
    stepIndex: 9,
    description: isNormal ? '边界判定：正常' : '边界判定：异常',
    formula: isNormal ? 'deviation ≤ tolerance ✓' : 'deviation > tolerance ✗',
    inputValue: absDeviation,
    inputUnit: '（比率）',
    outputValue: isNormal ? 1 : 0,
    outputUnit: '（布尔值）',
  });

  return steps;
}

export function detectChangedJudgments(
  oldStatus: string,
  newStatus: string,
  params: ReviewParams
): string[] {
  const changes: string[] = [];

  if (oldStatus !== newStatus) {
    changes.push(`边界状态从"${statusLabel(oldStatus)}"改为"${statusLabel(newStatus)}"`);
  }

  if (params.strictMode) {
    changes.push('严格模式已启用，容差标准收紧至80%');
  }

  if (params.tolerance < 0.05) {
    changes.push(`容差标准调整为 ${(params.tolerance * 100).toFixed(1)}%`);
  }

  if (params.boundaryMultiplier !== 1.0) {
    changes.push(`边界系数调整为 ${params.boundaryMultiplier}`);
  }

  return changes;
}

function statusLabel(status: string): string {
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

  if (unitCheck.result === 'missing') {
    return {
      id: generateId(),
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
      id: generateId(),
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

  const steps = calculateSteps(problem, params);
  const lastStep = steps[steps.length - 1];
  const deviationStep = steps.find((s) => s.description.includes('相对偏差'));
  const isNormal = lastStep.outputValue === 1;

  const status: ReviewResultStatus = problem.reviewStatus === 'pending'
    ? 'skipped'
    : isNormal
    ? 'normal'
    : 'abnormal';

  const changedJudgments = detectChangedJudgments(
    problem.reviewStatus,
    status,
    params
  );

  let problematicRow: string | undefined;
  if (status === 'abnormal' && deviationStep && deviationStep.outputValue > 0.1) {
    problematicRow = `原始行号 ${problem.originalRow}，偏差 ${(deviationStep.outputValue * 100).toFixed(2)}%，超过容差较多`;
  }

  return {
    id: generateId(),
    problemId: problem.id,
    groupId: params.groupId,
    status,
    deviation: deviationStep ? deviationStep.outputValue : 0,
    deviationUnit: problem.boundaryUnit || '',
    unitCheckResult: 'pass',
    changedJudgments,
    problematicRow,
    calculationSteps: steps,
    isDirtyDemo: problem.isRemarkSupplementary || problem.hasUnitIssue,
    reviewedAt: new Date().toISOString(),
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
      description: '单位校验',
      formula: 'checkUnit(problem.boundaryUnit)',
      inputValue: 0,
      inputUnit: '（布尔值）',
      outputValue: 0,
      outputUnit: '（失败）',
      unitConversion: '单位缺失或不匹配，复核中止',
    },
  ];
}

export function compareResults(resultA: ReviewResult, resultB: ReviewResult): {
  statusChanged: boolean;
  deviationDiff: number;
  summary: string;
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

  return { statusChanged, deviationDiff, summary };
}
