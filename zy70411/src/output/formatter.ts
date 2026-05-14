import { Report, BatchValidationResult, AnomalySample, HistoryRecord } from '../types';

export class OutputFormatter {
  toJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  reportToMarkdown(report: Report): string {
    const lines: string[] = [];

    lines.push(`# 内部包版本准入报告`);
    lines.push('');
    lines.push(`- **批次 ID**: ${report.batchId}`);
    lines.push(`- **规则版本**: ${report.ruleVersion}`);
    lines.push(`- **生成时间**: ${report.generatedAt}`);
    lines.push(`- **执行耗时**: ${report.executionTimeMs}ms`);
    lines.push('');

    lines.push(`## 校验结果对比`);
    lines.push('');

    if (report.beforeSnapshot) {
      lines.push(`### 之前的校验（规则版本: ${report.beforeSnapshot.ruleVersion}）`);
      lines.push(`- 总数: ${report.beforeSnapshot.totalItems}`);
      lines.push(`- 通过: ${report.beforeSnapshot.passedCount}`);
      lines.push(`- 未通过: ${report.beforeSnapshot.failedCount}`);
      lines.push('');
    }

    lines.push(`### 当前校验（规则版本: ${report.afterSnapshot.ruleVersion}）`);
    lines.push(`- 总数: ${report.afterSnapshot.totalItems}`);
    lines.push(`- 通过: ${report.afterSnapshot.passedCount}`);
    lines.push(`- 未通过: ${report.afterSnapshot.failedCount}`);
    lines.push('');

    lines.push(`## 详细校验结果`);
    lines.push('');
    lines.push(`| 包名 | 版本 | 状态 | 消息 |`);
    lines.push(`|------|------|------|------|`);

    for (const result of report.afterSnapshot.results) {
      const status = result.passed ? '✅ 通过' : '❌ 未通过';
      lines.push(
        `| ${result.packageName} | ${result.version} | ${status} | ${result.message} |`
      );
    }
    lines.push('');

    lines.push(`## 异常样本`);
    lines.push('');
    if (report.anomalies.length > 0) {
      lines.push(`- 发现 ${report.anomalies.length} 个异常样本`);
      lines.push(`- 异常 ID 列表: ${report.anomalies.join(', ')}`);
    } else {
      lines.push(`- 无异常样本`);
    }
    lines.push('');

    lines.push(`## 下一步建议`);
    lines.push('');
    for (const [index, step] of report.nextSteps.entries()) {
      lines.push(`${index + 1}. ${step}`);
    }

    return lines.join('\n');
  }

  anomaliesToMarkdown(anomalies: AnomalySample[]): string {
    const lines: string[] = [];

    lines.push(`# 异常样本详情`);
    lines.push('');

    for (const anomaly of anomalies) {
      lines.push(`## 异常 ID: ${anomaly.id}`);
      lines.push('');
      lines.push(`- **批次 ID**: ${anomaly.batchId}`);
      lines.push(`- **包 ID**: ${anomaly.itemId}`);
      lines.push(`- **类型**: ${anomaly.type}`);
      lines.push(`- **检测规则**: ${anomaly.detectedByRule}`);
      lines.push(`- **检测时间**: ${anomaly.detectedAt}`);
      lines.push(`- **状态**: ${anomaly.status}`);
      lines.push('');
      lines.push(`### 原始数据`);
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(anomaly.originalData, null, 2));
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  historyToMarkdown(records: HistoryRecord[]): string {
    const lines: string[] = [];

    lines.push(`# 历史修改记录`);
    lines.push('');

    for (const record of records) {
      lines.push(`## 修改 ID: ${record.id}`);
      lines.push('');
      lines.push(`- **资源类型**: ${record.resourceType}`);
      lines.push(`- **资源 ID**: ${record.resourceId}`);
      lines.push(`- **资源范围**: ${record.resourceScope}`);
      lines.push(`- **操作类型**: ${record.action}`);
      lines.push(`- **操作人**: ${record.operator}`);
      lines.push(`- **操作时间**: ${record.operatedAt}`);
      lines.push(`- **原因**: ${record.reason}`);
      lines.push('');

      if (record.before) {
        lines.push(`### 修改前`);
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(record.before, null, 2));
        lines.push('```');
        lines.push('');
      }

      if (record.after) {
        lines.push(`### 修改后`);
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(record.after, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  comparisonToMarkdown(comparison: {
    oldResults: BatchValidationResult;
    newResults: BatchValidationResult;
    differences: any[];
  }): string {
    const lines: string[] = [];

    lines.push(`# 规则版本对比报告`);
    lines.push('');
    lines.push(`- **旧规则版本**: ${comparison.oldResults.ruleVersion}`);
    lines.push(`- **新规则版本**: ${comparison.newResults.ruleVersion}`);
    lines.push('');

    lines.push(`## 结果对比`);
    lines.push('');
    lines.push(`| 指标 | 旧版本 | 新版本 | 变化 |`);
    lines.push(`|------|--------|--------|------|`);
    lines.push(
      `| 总数 | ${comparison.oldResults.totalItems} | ${comparison.newResults.totalItems} | - |`
    );
    lines.push(
      `| 通过 | ${comparison.oldResults.passedCount} | ${comparison.newResults.passedCount} | ${comparison.newResults.passedCount - comparison.oldResults.passedCount} |`
    );
    lines.push(
      `| 未通过 | ${comparison.oldResults.failedCount} | ${comparison.newResults.failedCount} | ${comparison.newResults.failedCount - comparison.oldResults.failedCount} |`
    );
    lines.push('');

    if (comparison.differences.length > 0) {
      lines.push(`## 状态变更明细`);
      lines.push('');
      lines.push(`| 包名 | 旧状态 | 新状态 | 变更说明 |`);
      lines.push(`|------|--------|--------|----------|`);

      for (const diff of comparison.differences) {
        lines.push(
          `| ${diff.packageName} | ${diff.oldStatus} | ${diff.newStatus} | ${diff.change} |`
        );
      }
    } else {
      lines.push(`## 状态变更明细`);
      lines.push('');
      lines.push(`- 无状态变更`);
    }

    return lines.join('\n');
  }
}

export const outputFormatter = new OutputFormatter();
