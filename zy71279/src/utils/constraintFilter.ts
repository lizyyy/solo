import type { ErrorAnalysis, PrintEstimation, ConstraintCheck, Constraint, EstimationTask, DetailedError } from '@/types';
import { generateUUID } from './math';

export const defaultConstraints: Constraint[] = [
  {
    name: '最大误差阈值',
    description: '简化后模型的最大几何误差不能超过设定阈值',
    threshold: 0.5,
    severity: 'error',
    check: (analysis: ErrorAnalysis) => ({
      passed: analysis.maxError <= analysis.maxError,
      actual: analysis.maxError
    })
  },
  {
    name: '平均误差阈值',
    description: '简化后模型的平均几何误差应控制在合理范围',
    threshold: 0.1,
    severity: 'warning',
    check: (analysis: ErrorAnalysis) => ({
      passed: analysis.meanError <= 0.1,
      actual: analysis.meanError
    })
  },
  {
    name: '法线一致性',
    description: '模型法线方向应保持一致，避免渲染和打印错误',
    threshold: 0,
    severity: 'error',
    check: (analysis: ErrorAnalysis) => ({
      passed: !analysis.hasNormalFlip,
      actual: analysis.normalFlipCount
    })
  },
  {
    name: '模型封闭性',
    description: '3D打印模型应避免孔洞，防止切片错误',
    threshold: 0,
    severity: 'warning',
    check: (analysis: ErrorAnalysis) => ({
      passed: !analysis.hasHoles,
      actual: analysis.holeCount
    })
  },
  {
    name: '打印时间限制',
    description: '单次打印时间不宜过长',
    threshold: 24,
    severity: 'warning',
    check: (_analysis: ErrorAnalysis, printEst: PrintEstimation) => ({
      passed: printEst.printTimeHours <= 24,
      actual: printEst.printTimeHours
    })
  },
  {
    name: '材料成本限制',
    description: '材料成本应控制在预算范围内',
    threshold: 100,
    severity: 'info',
    check: (_analysis: ErrorAnalysis, printEst: PrintEstimation) => ({
      passed: printEst.materialCost <= 100,
      actual: printEst.materialCost
    })
  },
  {
    name: '误差离散度',
    description: '误差标准差应较小，说明误差分布均匀',
    threshold: 0.2,
    severity: 'warning',
    check: (analysis: ErrorAnalysis) => ({
      passed: analysis.stdDeviation <= 0.2,
      actual: analysis.stdDeviation
    })
  }
];

export class ConstraintFilter {
  private constraints: Constraint[];

  constructor(constraints: Constraint[] = defaultConstraints) {
    this.constraints = constraints;
  }

  addConstraint(constraint: Constraint): void {
    this.constraints.push(constraint);
  }

  removeConstraint(name: string): void {
    this.constraints = this.constraints.filter(c => c.name !== name);
  }

  updateConstraint(name: string, updates: Partial<Constraint>): void {
    const index = this.constraints.findIndex(c => c.name === name);
    if (index !== -1) {
      this.constraints[index] = { ...this.constraints[index], ...updates };
    }
  }

  getConstraints(): Constraint[] {
    return [...this.constraints];
  }

  validate(
    analysis: ErrorAnalysis,
    printEst: PrintEstimation,
    customThresholds?: Map<string, number>
  ): ConstraintCheck[] {
    const results: ConstraintCheck[] = [];

    for (const constraint of this.constraints) {
      const threshold = customThresholds?.get(constraint.name) ?? constraint.threshold;
      const { passed, actual } = constraint.check(analysis, printEst);

      const effectiveCheck: Constraint['check'] = () => ({
        passed: actual <= threshold,
        actual
      });

      const { passed: finalPassed } = effectiveCheck(analysis, printEst);

      let details = '';
      if (constraint.name.includes('误差') || constraint.name.includes('时间') || constraint.name.includes('成本')) {
        details = `实际值: ${actual.toFixed(4)}，允许值: ${threshold.toFixed(4)}`;
      } else if (constraint.name.includes('法线') || constraint.name.includes('封闭性')) {
        details = finalPassed ? '检查通过' : `检测到 ${actual} 处问题`;
      } else {
        details = `实际值: ${actual}，阈值: ${threshold}`;
      }

      results.push({
        id: generateUUID(),
        taskId: analysis.taskId,
        constraintName: constraint.name,
        passed: finalPassed,
        details,
        actualValue: actual,
        allowedValue: threshold,
        severity: constraint.severity
      });
    }

    return results;
  }

  validateWithErrors(
    analysis: ErrorAnalysis,
    printEst: PrintEstimation,
    qualityErrors: DetailedError[],
    customThresholds?: Map<string, number>
  ): { checks: ConstraintCheck[]; allErrors: DetailedError[] } {
    const checks = this.validate(analysis, printEst, customThresholds);

    const constraintErrors: DetailedError[] = checks
      .filter(c => !c.passed)
      .map(c => ({
        type: 'other' as const,
        severity: c.severity,
        message: `约束不满足: ${c.constraintName}`,
        details: {
          constraintName: c.constraintName,
          actualValue: c.actualValue,
          allowedValue: c.allowedValue,
          details: c.details
        }
      }));

    return {
      checks,
      allErrors: [...qualityErrors, ...constraintErrors]
    };
  }

  filterTasks(
    tasks: EstimationTask[],
    filters: {
      status?: string[];
      materialId?: string;
      dateRange?: { start: Date; end: Date };
      errorRange?: { min: number; max: number };
      faceCountRange?: { min: number; max: number };
      algorithm?: string[];
      hasWarnings?: boolean;
      hasErrors?: boolean;
    }
  ): EstimationTask[] {
    return tasks.filter(task => {
      if (filters.status && !filters.status.includes(task.status)) {
        return false;
      }

      if (filters.materialId && task.materialId !== filters.materialId) {
        return false;
      }

      if (filters.dateRange) {
        const taskDate = new Date(task.createdAt);
        if (taskDate < filters.dateRange.start || taskDate > filters.dateRange.end) {
          return false;
        }
      }

      if (filters.errorRange) {
        if (task.errorThreshold < filters.errorRange.min || task.errorThreshold > filters.errorRange.max) {
          return false;
        }
      }

      if (filters.faceCountRange) {
        if (task.simplifiedFaces < filters.faceCountRange.min || task.simplifiedFaces > filters.faceCountRange.max) {
          return false;
        }
      }

      if (filters.algorithm && !filters.algorithm.includes(task.algorithm)) {
        return false;
      }

      return true;
    });
  }

  getOverallStatus(checks: ConstraintCheck[]): 'pass' | 'warning' | 'fail' {
    const failed = checks.filter(c => !c.passed);
    if (failed.length === 0) return 'pass';

    const hasError = failed.some(c => c.severity === 'error');
    if (hasError) return 'fail';

    return 'warning';
  }

  getSummary(checks: ConstraintCheck[]): {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    warnings: number;
    infos: number;
  } {
    const failed = checks.filter(c => !c.passed);
    return {
      total: checks.length,
      passed: checks.filter(c => c.passed).length,
      failed: failed.length,
      errors: failed.filter(c => c.severity === 'error').length,
      warnings: failed.filter(c => c.severity === 'warning').length,
      infos: failed.filter(c => c.severity === 'info').length
    };
  }
}

export function formatConstraintChecks(checks: ConstraintCheck[]): string {
  const lines: string[] = [];
  lines.push('=== 约束检查结果 ===');

  for (const check of checks) {
    const status = check.passed ? '✓' : '✗';
    const severity = check.passed ? '' : `[${check.severity.toUpperCase()}]`;
    lines.push(`${status} ${severity} ${check.constraintName}: ${check.details}`);
  }

  return lines.join('\n');
}
