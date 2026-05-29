import * as fs from 'fs';
import * as path from 'path';
import { DriftReport, DiffDetail, ExportOptions, DiffSeverity } from './types';
import { interpreter } from './diffInterpreter';

export class ReportExporter {
  export(report: DriftReport, options: ExportOptions): string {
    const outputPath = path.resolve(options.outputPath);
    const dir = path.dirname(outputPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let content: string;

    switch (options.format) {
      case 'json':
        content = this.exportJson(report, options);
        break;
      case 'markdown':
        content = this.exportMarkdown(report, options);
        break;
      default:
        throw new Error(`不支持的导出格式: ${options.format}`);
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }

  private exportJson(report: DriftReport, options: ExportOptions): string {
    const exportData = this.prepareExportData(report, options);
    return JSON.stringify(exportData, null, 2);
  }

  private prepareExportData(report: DriftReport, options: ExportOptions): Record<string, unknown> {
    const diffsForExport = report.diffs.map(diff => {
      const interpreted = interpreter.interpret(diff);
      const result: Record<string, unknown> = {
        key: diff.key,
        type: diff.type,
        severity: diff.severity,
        environment: diff.environment,
        explanation: diff.explanation,
        requiresManualReview: diff.requiresManualReview,
        interpretation: {
          summary: interpreted.summary,
          impact: interpreted.impact,
          rootCause: interpreted.rootCause,
          priority: interpreted.priority,
        },
      };

      if (options.includeSuggestions) {
        result.suggestedActions = interpreted.suggestedActions;
      }

      if (options.includeMaskedValues) {
        if (diff.baselineValue !== undefined) {
          result.baselineValue = this.maskValue(diff.baselineValue);
        }
        if (diff.targetValue !== undefined) {
          result.targetValue = this.maskValue(diff.targetValue);
        }
      }

      if (diff.relatedChangeId) {
        result.relatedChangeId = diff.relatedChangeId;
      }

      if (diff.falsePositiveReason) {
        result.falsePositiveReason = diff.falsePositiveReason;
      }

      return result;
    });

    const groupedBySeverity = this.groupBySeverity(report.diffs);
    const groupedByEnvironment = this.groupByEnvironment(report.diffs);
    const groupedByType = this.groupByType(report.diffs);

    return {
      id: report.id,
      generatedAt: report.generatedAt,
      baselineEnvironment: report.baselineEnvironment,
      targetEnvironments: report.targetEnvironments,
      summary: {
        totalDiffs: report.totalDiffs,
        criticalDiffs: report.criticalDiffs,
        warningDiffs: report.warningDiffs,
        infoDiffs: report.infoDiffs,
        falsePositives: report.falsePositives,
        requiresManualReview: report.requiresManualReview,
      },
      groupedBySeverity,
      groupedByEnvironment,
      groupedByType,
      manualReviewRequired: diffsForExport.filter(d => d.requiresManualReview === true),
      diffs: diffsForExport,
    };
  }

  private maskValue(value: unknown): unknown {
    if (typeof value === 'string' && value.length > 8) {
      return value.substring(0, 4) + '...' + value.substring(value.length - 4);
    }
    return value;
  }

  private exportMarkdown(report: DriftReport, options: ExportOptions): string {
    let md = `# 配置漂移检查报告\n\n`;
    md += `> 生成时间: ${report.generatedAt}\n\n`;
    md += `> 报告ID: \`${report.id}\`\n\n`;
    md += `## 基本信息\n\n`;
    md += `- **基线环境**: \`${report.baselineEnvironment}\`\n`;
    md += `- **目标环境**: ${report.targetEnvironments.map(e => `\`${e}\``).join(', ')}\n\n`;

    md += `## 统计摘要\n\n`;
    md += `| 严重级别 | 数量 | 处理优先级 |\n`;
    md += `|---------|------|----------|\n`;
    md += `| 🔴 严重 | ${report.criticalDiffs} | 立即处理 |\n`;
    md += `| 🟡 警告 | ${report.warningDiffs} | 尽快处理 |\n`;
    md += `| 🔵 信息 | ${report.infoDiffs} | 计划处理 |\n`;
    md += `| ⚪ 误报 | ${report.falsePositives} | 无需处理 |\n`;
    md += `| ⚠️ 需人工处理 | **${report.requiresManualReview}** | **必须处理** |\n`;
    md += `| 📋 总计 | **${report.totalDiffs}** | - |\n\n`;

    if (report.requiresManualReview > 0) {
      md += `> ⚠️ **有 ${report.requiresManualReview} 项差异需要人工审核，请优先处理**\n\n`;
    }

    const manualItems = report.diffs.filter(d => d.requiresManualReview);
    if (manualItems.length > 0) {
      md += `## 需要人工处理的项\n\n`;
      md += `| 序号 | 配置项 | 环境 | 类型 | 严重度 | 说明 |\n`;
      md += `|-----|--------|------|------|--------|------|\n`;
      manualItems.forEach((diff, index) => {
        md += `| ${index + 1} | \`${diff.key}\` | ${diff.environment} | ${diff.type} | ${this.getSeverityLabel(diff.severity)} | ${diff.explanation} |\n`;
      });
      md += `\n`;
    }

    md += `## 详细差异分析\n\n`;

    const groupedByEnv = this.groupByEnvironment(report.diffs);
    for (const [env, diffs] of Object.entries(groupedByEnv)) {
      md += `### 环境: \`${env}\`\n\n`;
      md += `共 ${diffs.length} 个差异\n\n`;

      for (const diff of diffs) {
        md += this.formatDiffMarkdown(diff, options);
      }
    }

    if (options.includeMaskedValues && report.maskedContent) {
      md += `## 遮蔽后的配置内容\n\n`;
      md += `<details>\n`;
      md += `<summary>点击展开查看遮蔽后的配置</summary>\n\n`;
      for (const [env, content] of Object.entries(report.maskedContent)) {
        md += `### ${env}\n\n`;
        md += `\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\`\n\n`;
      }
      md += `</details>\n\n`;
    }

    md += `---\n\n`;
    md += `*此报告由 Config Drift Checker 自动生成*\n`;

    return md;
  }

  private formatDiffMarkdown(diff: DiffDetail, options: ExportOptions): string {
    const interpreted = interpreter.interpret(diff);
    const severityLabel = this.getSeverityLabel(diff.severity);

    let md = `#### ${this.getSeverityEmoji(diff.severity)} \`${diff.key}\`\n\n`;

    md += `- **类型**: \`${diff.type}\`\n`;
    md += `- **严重度**: ${severityLabel}\n`;
    md += `- **优先级**: ${this.getPriorityLabel(interpreted.priority)}\n`;
    md += `- **环境**: \`${diff.environment}\`\n`;
    md += `- **需要人工审核**: ${diff.requiresManualReview ? '✅ 是' : '❌ 否'}\n\n`;

    md += `**说明**: ${diff.explanation}\n\n`;
    md += `**影响**: ${interpreted.impact}\n\n`;
    md += `**根因分析**: ${interpreted.rootCause}\n\n`;

    if (options.includeMaskedValues) {
      if (diff.baselineValue !== undefined) {
        md += `- **基线值**: \`${JSON.stringify(this.maskValue(diff.baselineValue))}\`\n`;
      }
      if (diff.targetValue !== undefined) {
        md += `- **目标值**: \`${JSON.stringify(this.maskValue(diff.targetValue))}\`\n`;
      }
      md += `\n`;
    }

    if (diff.falsePositiveReason) {
      md += `> ℹ️ **误报原因**: ${diff.falsePositiveReason}\n\n`;
    }

    if (diff.relatedChangeId) {
      md += `> 📝 **关联变更记录**: \`${diff.relatedChangeId}\`\n\n`;
    }

    if (options.includeSuggestions && interpreted.suggestedActions.length > 0) {
      md += `**建议操作**:\n\n`;
      interpreted.suggestedActions.forEach((action, i) => {
        md += `${i + 1}. ${action}\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;

    return md;
  }

  private groupBySeverity(diffs: DiffDetail[]): Record<DiffSeverity, number> {
    const result: Record<string, number> = {
      critical: 0,
      warning: 0,
      info: 0,
      false_positive: 0,
    };
    for (const diff of diffs) {
      result[diff.severity] = (result[diff.severity] || 0) + 1;
    }
    return result as Record<DiffSeverity, number>;
  }

  private groupByEnvironment(diffs: DiffDetail[]): Record<string, DiffDetail[]> {
    const result: Record<string, DiffDetail[]> = {};
    for (const diff of diffs) {
      const env = diff.environment || 'unknown';
      if (!result[env]) {
        result[env] = [];
      }
      result[env].push(diff);
    }
    return result;
  }

  private groupByType(diffs: DiffDetail[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const diff of diffs) {
      result[diff.type] = (result[diff.type] || 0) + 1;
    }
    return result;
  }

  private getSeverityLabel(severity: DiffSeverity): string {
    switch (severity) {
      case 'critical': return '🔴 严重';
      case 'warning': return '🟡 警告';
      case 'info': return '🔵 信息';
      case 'false_positive': return '⚪ 误报';
    }
  }

  private getSeverityEmoji(severity: DiffSeverity): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      case 'false_positive': return '⚪';
    }
  }

  private getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'immediate': return '🔴 立即处理';
      case 'soon': return '🟡 尽快处理';
      case 'scheduled': return '🔵 计划处理';
      case 'none': return '⚪ 无需处理';
      default: return priority;
    }
  }
}

export const reportExporter = new ReportExporter();
