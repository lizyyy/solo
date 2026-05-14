import { Report, BatchValidationResult, HandoverItem } from '../types';
import { store } from '../store';
import { ruleEngine } from '../engine/rule-engine';

export class ReportGenerator {
  async generateBatchReport(
    batchId: string,
    items: HandoverItem[],
    ruleVersion?: string
  ): Promise<Report> {
    const startTime = new Date();
    const beforeSnapshot = store.getValidationResult(batchId);

    const { passed, failed, allResults } = ruleEngine.evaluateBatch(items, ruleVersion);
    const endTime = new Date();
    const executionTimeMs = endTime.getTime() - startTime.getTime();

    const afterSnapshot: BatchValidationResult = {
      batchId,
      ruleVersion: ruleVersion || 'latest',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      executionTimeMs,
      totalItems: items.length,
      passedCount: passed.length,
      failedCount: failed.length,
      results: allResults,
    };

    store.saveValidationResult(afterSnapshot);

    const anomalies = failed
      .filter((r) => r.message.includes('时区') || r.message.includes('timezone'))
      .map((r) => r.itemId);

    const nextSteps = this.generateNextSteps(afterSnapshot);

    const report: Report = {
      id: store.generateId(),
      batchId,
      ruleVersion: ruleVersion || 'latest',
      generatedAt: new Date().toISOString(),
      beforeSnapshot: beforeSnapshot || null,
      afterSnapshot,
      executionTimeMs,
      nextSteps,
      anomalies,
    };

    store.saveReport(report);
    return report;
  }

  private generateNextSteps(result: BatchValidationResult): string[] {
    const steps: string[] = [];

    if (result.failedCount > 0) {
      steps.push(`处理 ${result.failedCount} 个未通过的包`);
    }

    const needReview = result.results.filter((r) => r.message.includes('审核'));
    if (needReview.length > 0) {
      steps.push(`安排人工审核 ${needReview.length} 个包`);
    }

    const timezoneIssues = result.results.filter((r) =>
      r.message.includes('时区')
    );
    if (timezoneIssues.length > 0) {
      steps.push(`调查 ${timezoneIssues.length} 个时区异常的提交来源`);
    }

    if (steps.length === 0) {
      steps.push('所有包均通过检查，可以发布');
    }

    steps.push('归档本次校验结果');
    steps.push('更新规则知识库');

    return steps;
  }

  compareRuleVersions(
    items: HandoverItem[],
    oldVersion: string,
    newVersion: string
  ): {
    oldResults: BatchValidationResult;
    newResults: BatchValidationResult;
    differences: {
      itemId: string;
      packageName: string;
      oldStatus: string;
      newStatus: string;
      change: string;
    }[];
  } {
    const oldEval = ruleEngine.evaluateBatch(items, oldVersion);
    const newEval = ruleEngine.evaluateBatch(items, newVersion);

    const differences: {
      itemId: string;
      packageName: string;
      oldStatus: string;
      newStatus: string;
      change: string;
    }[] = [];

    const itemIds = new Set([
      ...oldEval.allResults.map((r) => r.itemId),
      ...newEval.allResults.map((r) => r.itemId),
    ]);

    for (const itemId of itemIds) {
      const oldResult = oldEval.allResults.find((r) => r.itemId === itemId);
      const newResult = newEval.allResults.find((r) => r.itemId === itemId);

      if (oldResult && newResult && oldResult.passed !== newResult.passed) {
        differences.push({
          itemId,
          packageName: oldResult.packageName,
          oldStatus: oldResult.passed ? '通过' : '未通过',
          newStatus: newResult.passed ? '通过' : '未通过',
          change: `${oldResult.message} → ${newResult.message}`,
        });
      }
    }

    return {
      oldResults: {
        batchId: 'compare-old',
        ruleVersion: oldVersion,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        executionTimeMs: 0,
        totalItems: items.length,
        passedCount: oldEval.passed.length,
        failedCount: oldEval.failed.length,
        results: oldEval.allResults,
      },
      newResults: {
        batchId: 'compare-new',
        ruleVersion: newVersion,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        executionTimeMs: 0,
        totalItems: items.length,
        passedCount: newEval.passed.length,
        failedCount: newEval.failed.length,
        results: newEval.allResults,
      },
      differences,
    };
  }
}

export const reportGenerator = new ReportGenerator();
