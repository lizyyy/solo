import { Plan, PlanComparison, PlanSummary, ComparisonDifference, ValidationResult } from '../types';
import { validationService } from './validationService';

export const comparisonService = {
  compare(planA: Plan, planB: Plan): PlanComparison {
    const resultsA = validationService.validate(planA);
    const resultsB = validationService.validate(planB);

    const summaryA = this.createPlanSummary(planA, resultsA);
    const summaryB = this.createPlanSummary(planB, resultsB);

    const differences: ComparisonDifference[] = [];

    differences.push({
      category: '布局',
      metric: '总展位数',
      planAValue: summaryA.totalBooths,
      planBValue: summaryB.totalBooths,
      winner: summaryA.totalBooths > summaryB.totalBooths ? 'A' : summaryA.totalBooths < summaryB.totalBooths ? 'B' : 'none'
    });

    differences.push({
      category: '用电',
      metric: '总功率需求 (W)',
      planAValue: summaryA.totalPowerDemand,
      planBValue: summaryB.totalPowerDemand,
      winner: summaryA.totalPowerDemand < summaryB.totalPowerDemand ? 'A' : summaryA.totalPowerDemand > summaryB.totalPowerDemand ? 'B' : 'none'
    });

    differences.push({
      category: '风险',
      metric: '严重问题数',
      planAValue: summaryA.criticalCount,
      planBValue: summaryB.criticalCount,
      winner: summaryA.criticalCount < summaryB.criticalCount ? 'A' : summaryA.criticalCount > summaryB.criticalCount ? 'B' : 'none'
    });

    differences.push({
      category: '风险',
      metric: '高优先级问题数',
      planAValue: summaryA.highCount,
      planBValue: summaryB.highCount,
      winner: summaryA.highCount < summaryB.highCount ? 'A' : summaryA.highCount > summaryB.highCount ? 'B' : 'none'
    });

    differences.push({
      category: '风险',
      metric: '总问题数',
      planAValue: summaryA.totalValidationErrors,
      planBValue: summaryB.totalValidationErrors,
      winner: summaryA.totalValidationErrors < summaryB.totalValidationErrors ? 'A' : summaryA.totalValidationErrors > summaryB.totalValidationErrors ? 'B' : 'none'
    });

    const recommendations = this.generateRecommendations(planA, planB, resultsA, resultsB, summaryA, summaryB);

    return {
      planA: summaryA,
      planB: summaryB,
      differences,
      recommendations
    };
  },

  createPlanSummary(plan: Plan, results: ValidationResult[]): PlanSummary {
    const failedResults = results.filter(r => !r.passed);

    return {
      id: plan.id,
      name: plan.name,
      totalBooths: plan.booths.length,
      totalPowerDemand: plan.booths.reduce((sum, b) => sum + b.powerDemand, 0),
      totalValidationErrors: failedResults.length,
      criticalCount: failedResults.filter(r => r.riskLevel === 'critical').length,
      highCount: failedResults.filter(r => r.riskLevel === 'high').length,
      mediumCount: failedResults.filter(r => r.riskLevel === 'medium').length,
      lowCount: failedResults.filter(r => r.riskLevel === 'low').length
    };
  },

  generateRecommendations(
    planA: Plan,
    planB: Plan,
    resultsA: ValidationResult[],
    resultsB: ValidationResult[],
    summaryA: PlanSummary,
    summaryB: PlanSummary
  ): string[] {
    const recommendations: string[] = [];

    if (summaryA.totalValidationErrors < summaryB.totalValidationErrors) {
      recommendations.push(`方案 A ("${planA.name}") 整体风险更低，问题总数较少 (${summaryA.totalValidationErrors} vs ${summaryB.totalValidationErrors})。`);
    } else if (summaryA.totalValidationErrors > summaryB.totalValidationErrors) {
      recommendations.push(`方案 B ("${planB.name}") 整体风险更低，问题总数较少 (${summaryB.totalValidationErrors} vs ${summaryA.totalValidationErrors})。`);
    }

    if (summaryA.criticalCount < summaryB.criticalCount) {
      recommendations.push(`方案 A 没有严重安全问题，而方案 B 有 ${summaryB.criticalCount} 个严重问题需要优先处理。`);
    } else if (summaryA.criticalCount > summaryB.criticalCount) {
      recommendations.push(`方案 B 没有严重安全问题，而方案 A 有 ${summaryA.criticalCount} 个严重问题需要优先处理。`);
    }

    if (summaryA.totalPowerDemand < summaryB.totalPowerDemand) {
      const diff = summaryB.totalPowerDemand - summaryA.totalPowerDemand;
      recommendations.push(`方案 A 的总功率需求较低，比方案 B 节省 ${diff.toLocaleString()} W。`);
    } else if (summaryA.totalPowerDemand > summaryB.totalPowerDemand) {
      const diff = summaryA.totalPowerDemand - summaryB.totalPowerDemand;
      recommendations.push(`方案 B 的总功率需求较低，比方案 A 节省 ${diff.toLocaleString()} W。`);
    }

    const uniqueRulesA = new Set(resultsA.filter(r => !r.passed).map(r => r.ruleId));
    const uniqueRulesB = new Set(resultsB.filter(r => !r.passed).map(r => r.ruleId));

    const rulesOnlyInA = [...uniqueRulesA].filter(r => !uniqueRulesB.has(r));
    const rulesOnlyInB = [...uniqueRulesB].filter(r => !uniqueRulesA.has(r));

    if (rulesOnlyInA.length > 0) {
      recommendations.push(`方案 A 特有的问题类型: ${rulesOnlyInA.join(', ')}。`);
    }
    if (rulesOnlyInB.length > 0) {
      recommendations.push(`方案 B 特有的问题类型: ${rulesOnlyInB.join(', ')}。`);
    }

    if (recommendations.length === 0) {
      recommendations.push('两个方案在关键指标上表现相近，建议根据具体需求选择。');
    }

    return recommendations;
  }
};
