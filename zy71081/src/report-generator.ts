import * as fs from 'fs';
import * as path from 'path';
import chalk = require('chalk');
import {
  DiagnosticReport,
  SamplingResult,
  SamplingDecision,
  Trace,
  BudgetStats,
  CLIOptions
} from './types';

export class ReportGenerator {
  private options: CLIOptions;
  private verbose: boolean;
  private quiet: boolean;

  constructor(options: CLIOptions) {
    this.options = options;
    this.verbose = options.verbose;
    this.quiet = options.quiet;
  }

  public generateReport(
    configValidation: DiagnosticReport['configValidation'],
    traceAnalysis: DiagnosticReport['traceAnalysis'],
    samplingResults: SamplingResult[],
    budgetStats: BudgetStats,
    traces: Trace[]
  ): DiagnosticReport {
    const byService: DiagnosticReport['samplingResults']['byService'] = {};
    const byRule: DiagnosticReport['samplingResults']['byRule'] = {};

    let sampled = 0;
    let dropped = 0;
    let recordOnly = 0;

    for (const result of samplingResults) {
      const trace = traces.find(t => t.traceId === result.traceId);

      for (const service of trace?.serviceNames || ['unknown']) {
        if (!byService[service]) {
          byService[service] = { total: 0, sampled: 0, dropped: 0, sampledPercentage: 0 };
        }
        byService[service].total++;
        if (result.finalDecision === SamplingDecision.RECORD_AND_SAMPLE) {
          byService[service].sampled++;
        } else if (result.finalDecision === SamplingDecision.DROP) {
          byService[service].dropped++;
        }
      }

      const ruleName = result.matchedRule?.name || 'default';
      if (!byRule[ruleName]) {
        byRule[ruleName] = { matched: 0, sampled: 0, dropped: 0, budgetExhausted: 0 };
      }
      byRule[ruleName].matched++;
      if (result.finalDecision === SamplingDecision.RECORD_AND_SAMPLE) {
        byRule[ruleName].sampled++;
      } else if (result.finalDecision === SamplingDecision.DROP) {
        byRule[ruleName].dropped++;
      }
      if (result.budgetExhausted) {
        byRule[ruleName].budgetExhausted++;
      }

      if (result.finalDecision === SamplingDecision.RECORD_AND_SAMPLE) {
        sampled++;
      } else if (result.finalDecision === SamplingDecision.DROP) {
        dropped++;
      } else if (result.finalDecision === SamplingDecision.RECORD_ONLY) {
        recordOnly++;
      }
    }

    for (const service of Object.keys(byService)) {
      const stats = byService[service];
      stats.sampledPercentage = stats.total > 0 ? (stats.sampled / stats.total) * 100 : 0;
    }

    const totalEvaluated = samplingResults.length;
    const conclusions = this.analyzeRootCauses(samplingResults, traceAnalysis, budgetStats);

    const report: DiagnosticReport = {
      metadata: {
        generatedAt: new Date().toISOString(),
        toolVersion: '1.0.0',
        inputConfig: {
          configFile: this.options.config,
          traceFile: this.options.traces,
          serviceName: this.options.service,
          budgetThreshold: this.options.budget,
          outputDir: this.options.output
        }
      },
      configValidation,
      traceAnalysis,
      samplingResults: {
        summary: {
          totalEvaluated,
          sampled,
          dropped,
          recordOnly,
          sampledPercentage: totalEvaluated > 0 ? (sampled / totalEvaluated) * 100 : 0,
          droppedPercentage: totalEvaluated > 0 ? (dropped / totalEvaluated) * 100 : 0
        },
        byService,
        byRule,
        details: this.verbose ? samplingResults : samplingResults.slice(0, 100)
      },
      budgetAnalysis: budgetStats,
      conclusions
    };

    return report;
  }

  private analyzeRootCauses(
    samplingResults: SamplingResult[],
    traceAnalysis: DiagnosticReport['traceAnalysis'],
    budgetStats: BudgetStats
  ): DiagnosticReport['conclusions'] {
    const rootCauses: DiagnosticReport['conclusions']['rootCauses'] = [];
    const recommendations: string[] = [];

    const droppedTraces = samplingResults.filter(r => r.finalDecision === SamplingDecision.DROP);
    const totalDropped = droppedTraces.length;

    const budgetDropped = samplingResults.filter(r => r.droppedDueToBudget);
    if (budgetDropped.length > 0) {
      rootCauses.push({
        type: 'budget_exhausted',
        description: `有 ${budgetDropped.length} 条 trace 因预算耗尽被丢弃`,
        severity: budgetDropped.length / samplingResults.length > 0.1 ? 'high' : 'medium',
        affectedTraces: budgetDropped.length,
        recommendation: '增加全局或规则级别的每秒采样预算，或调整采样率以减少流量'
      });
      recommendations.push('检查采样预算配置，考虑增加预算或降低采样率');
    }

    const caseIssues = samplingResults.filter(r => r.caseAdjustments.length > 0);
    if (caseIssues.length > 0 || traceAnalysis.fieldCaseIssues.length > 0) {
      const affected = Math.max(caseIssues.length, traceAnalysis.fieldCaseIssues.reduce((sum, i) => sum + i.occurrences, 0));
      rootCauses.push({
        type: 'case_mismatch',
        description: `发现字段大小写不一致问题，可能导致规则匹配失败`,
        severity: 'medium',
        affectedTraces: caseIssues.length,
        recommendation: '统一字段命名规范，或在配置中设置 caseSensitive: false'
      });
      recommendations.push('检查字段大小写一致性，建议使用统一的命名规范');
    }

    if (traceAnalysis.missingFields.length > 0) {
      rootCauses.push({
        type: 'missing_fields',
        description: `trace 数据中缺少字段: ${traceAnalysis.missingFields.join(', ')}`,
        severity: 'high',
        affectedTraces: traceAnalysis.totalTraces,
        recommendation: '确保所有 span 都包含必要的字段，特别是 serviceName 和关键属性'
      });
      recommendations.push('检查 instrumentation 配置，确保上报所有必要字段');
    }

    const noRuleMatch = samplingResults.filter(r => !r.matchedRule);
    if (noRuleMatch.length > 0) {
      const defaultDropped = noRuleMatch.filter(r => r.finalDecision === SamplingDecision.DROP);
      if (defaultDropped.length > 0) {
        rootCauses.push({
          type: 'rule_mismatch',
          description: `${noRuleMatch.length} 条 trace 未匹配任何采样规则，使用默认策略`,
          severity: defaultDropped.length / samplingResults.length > 0.2 ? 'high' : 'medium',
          affectedTraces: noRuleMatch.length,
          recommendation: '检查采样规则是否覆盖了所有服务，或调整默认采样策略'
        });
        recommendations.push('添加覆盖更多服务的采样规则，或调整默认采样率');
      }
    }

    const lowSamplingRatio = samplingResults.filter(r => r.matchedRule && r.matchedRule.samplingRatio < 0.1);
    if (lowSamplingRatio.length > 0 && totalDropped > 0) {
      const ratioDropped = lowSamplingRatio.filter(r => r.finalDecision === SamplingDecision.DROP && !r.droppedDueToBudget);
      if (ratioDropped.length > 0) {
        rootCauses.push({
          type: 'sampling_ratio',
          description: `部分规则的采样率过低 (< 10%)，导致 ${ratioDropped.length} 条 trace 因随机采样被丢弃`,
          severity: 'low',
          affectedTraces: ratioDropped.length,
          recommendation: '如果需要更高的采样覆盖率，考虑提高关键服务的采样率'
        });
      }
    }

    if (rootCauses.length === 0) {
      recommendations.push('采样配置运行正常，建议定期监控采样率和预算使用情况');
    }

    return {
      rootCauses: rootCauses.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      recommendations
    };
  }

  public printTerminalSummary(report: DiagnosticReport): void {
    if (this.quiet) return;

    console.log('\n' + chalk.cyan('═'.repeat(80)));
    console.log(chalk.cyan.bold('  OpenTelemetry 采样诊断报告'));
    console.log(chalk.cyan('═'.repeat(80)) + '\n');

    console.log(chalk.bold('📊 概览'));
    console.log(chalk.gray('─'.repeat(40)));
    const summary = report.samplingResults.summary;
    console.log(`  评估 Trace 总数: ${chalk.white(summary.totalEvaluated)}`);
    console.log(`  采样通过: ${chalk.green(summary.sampled)} (${summary.sampledPercentage.toFixed(1)}%)`);
    console.log(`  被丢弃: ${chalk.red(summary.dropped)} (${summary.droppedPercentage.toFixed(1)}%)`);
    if (summary.recordOnly > 0) {
      console.log(`  仅记录: ${chalk.yellow(summary.recordOnly)}`);
    }
    console.log();

    if (report.configValidation.errors.length > 0) {
      console.log(chalk.red.bold('❌ 配置错误'));
      console.log(chalk.gray('─'.repeat(40)));
      for (const error of report.configValidation.errors) {
        console.log(`  ${chalk.red('•')} [${error.field}] ${error.message}`);
      }
      console.log();
    }

    if (report.configValidation.warnings.length > 0) {
      console.log(chalk.yellow.bold('⚠️  配置警告'));
      console.log(chalk.gray('─'.repeat(40)));
      for (const warning of report.configValidation.warnings) {
        console.log(`  ${chalk.yellow('•')} [${warning.field}] ${warning.message}`);
      }
      console.log();
    }

    if (report.conclusions.rootCauses.length > 0) {
      console.log(chalk.red.bold('🔍 根本原因分析'));
      console.log(chalk.gray('─'.repeat(40)));
      for (const cause of report.conclusions.rootCauses) {
        const severityColor = cause.severity === 'high' ? chalk.red :
                              cause.severity === 'medium' ? chalk.yellow : chalk.blue;
        console.log(`  ${severityColor('[' + cause.severity.toUpperCase() + ']')} ${cause.description}`);
        console.log(`    ${chalk.gray('建议:')} ${cause.recommendation}`);
      }
      console.log();
    }

    console.log(chalk.bold('📈 按服务统计'));
    console.log(chalk.gray('─'.repeat(40)));
    for (const [service, stats] of Object.entries(report.samplingResults.byService)) {
      const barLength = Math.round(stats.sampledPercentage / 5);
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      console.log(`  ${chalk.cyan(service.padEnd(30))} ${chalk.green(bar)} ${stats.sampledPercentage.toFixed(1)}% (${stats.sampled}/${stats.total})`);
    }
    console.log();

    if (report.budgetAnalysis.globalBudget || Object.keys(report.budgetAnalysis.ruleBudgets).length > 0) {
      console.log(chalk.bold('💰 预算使用情况'));
      console.log(chalk.gray('─'.repeat(40)));
      if (report.budgetAnalysis.globalBudget) {
        const gb = report.budgetAnalysis.globalBudget;
        const usedPercent = (gb.used / gb.limitPerSecond) * 100;
        console.log(`  全局预算: ${gb.used}/${gb.limitPerSecond} 次/秒 (${usedPercent.toFixed(1)}%)`);
        if (gb.exhausted) {
          console.log(`    ${chalk.red('⚠️  预算已耗尽!')}`);
        }
      }
      for (const [ruleName, budget] of Object.entries(report.budgetAnalysis.ruleBudgets)) {
        const usedPercent = (budget.used / budget.limitPerSecond) * 100;
        console.log(`  ${ruleName}: ${budget.used}/${budget.limitPerSecond} 次/秒 (${usedPercent.toFixed(1)}%)`);
        if (budget.exhausted) {
          console.log(`    ${chalk.red('⚠️  预算已耗尽!')}`);
        }
      }
      console.log();
    }

    console.log(chalk.bold('💡 建议'));
    console.log(chalk.gray('─'.repeat(40)));
    for (const [index, rec] of report.conclusions.recommendations.entries()) {
      console.log(`  ${chalk.blue((index + 1) + '.')} ${rec}`);
    }
    console.log();

    console.log(chalk.cyan('─'.repeat(80)));
    console.log(chalk.gray(`  报告生成于: ${report.metadata.generatedAt}`));
    if (this.options.format === 'json' || this.options.format === 'both') {
      console.log(chalk.gray(`  JSON 报告: ${path.join(this.options.output, 'report.json')}`));
    }
    if (this.options.format === 'markdown' || this.options.format === 'both') {
      console.log(chalk.gray(`  Markdown 报告: ${path.join(this.options.output, 'report.md')}`));
    }
    console.log(chalk.cyan('═'.repeat(80)) + '\n');
  }

  public writeJsonReport(report: DiagnosticReport): string {
    const outputPath = path.join(this.options.output, 'report.json');
    this.ensureOutputDir();
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    return outputPath;
  }

  public writeMarkdownReport(report: DiagnosticReport): string {
    const outputPath = path.join(this.options.output, 'report.md');
    this.ensureOutputDir();

    const md = this.generateMarkdown(report);
    fs.writeFileSync(outputPath, md, 'utf-8');
    return outputPath;
  }

  private generateMarkdown(report: DiagnosticReport): string {
    const lines: string[] = [];

    lines.push('# OpenTelemetry 采样诊断报告');
    lines.push('');
    lines.push(`> 生成时间: ${report.metadata.generatedAt}`);
    lines.push(`> 工具版本: ${report.metadata.toolVersion}`);
    lines.push('');

    lines.push('## 输入配置');
    lines.push('');
    lines.push('| 配置项 | 值 |');
    lines.push('|--------|----|');
    lines.push(`| 配置文件 | \`${report.metadata.inputConfig.configFile || 'N/A'}\` |`);
    lines.push(`| Trace 文件 | \`${report.metadata.inputConfig.traceFile || 'N/A'}\` |`);
    lines.push(`| 目标服务 | \`${report.metadata.inputConfig.serviceName || '全部'}\` |`);
    lines.push(`| 预算阈值 | \`${report.metadata.inputConfig.budgetThreshold || '默认'}\` |`);
    lines.push('');

    lines.push('## 概览');
    lines.push('');
    const summary = report.samplingResults.summary;
    lines.push(`- **评估 Trace 总数**: ${summary.totalEvaluated}`);
    lines.push(`- **采样通过**: ${summary.sampled} (${summary.sampledPercentage.toFixed(1)}%)`);
    lines.push(`- **被丢弃**: ${summary.dropped} (${summary.droppedPercentage.toFixed(1)}%)`);
    if (summary.recordOnly > 0) {
      lines.push(`- **仅记录**: ${summary.recordOnly}`);
    }
    lines.push('');

    if (report.configValidation.errors.length > 0) {
      lines.push('## ❌ 配置错误');
      lines.push('');
      for (const error of report.configValidation.errors) {
        lines.push(`- **[${error.field}]**: ${error.message}`);
      }
      lines.push('');
    }

    if (report.configValidation.warnings.length > 0) {
      lines.push('## ⚠️ 配置警告');
      lines.push('');
      for (const warning of report.configValidation.warnings) {
        lines.push(`- **[${warning.field}]**: ${warning.message}`);
      }
      lines.push('');
    }

    lines.push('## 🔍 根本原因分析');
    lines.push('');
    if (report.conclusions.rootCauses.length > 0) {
      for (const cause of report.conclusions.rootCauses) {
        const severityBadge = cause.severity === 'high' ? '🔴 严重' :
                              cause.severity === 'medium' ? '🟡 中等' : '🔵 轻微';
        lines.push(`### ${severityBadge}: ${cause.type}`);
        lines.push('');
        lines.push(`- **描述**: ${cause.description}`);
        lines.push(`- **影响 Trace 数**: ${cause.affectedTraces}`);
        lines.push(`- **建议**: ${cause.recommendation}`);
        lines.push('');
      }
    } else {
      lines.push('未发现明显问题。');
      lines.push('');
    }

    lines.push('## 📈 按服务统计');
    lines.push('');
    lines.push('| 服务 | 总数 | 采样数 | 丢弃数 | 采样率 |');
    lines.push('|------|------|--------|--------|--------|');
    for (const [service, stats] of Object.entries(report.samplingResults.byService)) {
      lines.push(`| ${service} | ${stats.total} | ${stats.sampled} | ${stats.dropped} | ${stats.sampledPercentage.toFixed(1)}% |`);
    }
    lines.push('');

    lines.push('## 📋 按规则统计');
    lines.push('');
    lines.push('| 规则 | 匹配数 | 采样数 | 丢弃数 | 预算耗尽 |');
    lines.push('|------|--------|--------|--------|----------|');
    for (const [ruleName, stats] of Object.entries(report.samplingResults.byRule)) {
      lines.push(`| ${ruleName} | ${stats.matched} | ${stats.sampled} | ${stats.dropped} | ${stats.budgetExhausted} |`);
    }
    lines.push('');

    if (report.budgetAnalysis.globalBudget || Object.keys(report.budgetAnalysis.ruleBudgets).length > 0) {
      lines.push('## 💰 预算使用情况');
      lines.push('');
      if (report.budgetAnalysis.globalBudget) {
        const gb = report.budgetAnalysis.globalBudget;
        lines.push('### 全局预算');
        lines.push('');
        lines.push(`- **限制**: ${gb.limitPerSecond} 次/秒`);
        lines.push(`- **已用**: ${gb.used} 次/秒`);
        lines.push(`- **剩余**: ${gb.remaining} 次/秒`);
        lines.push(`- **状态**: ${gb.exhausted ? '❌ 已耗尽' : '✅ 正常'}`);
        lines.push('');
      }
      if (Object.keys(report.budgetAnalysis.ruleBudgets).length > 0) {
        lines.push('### 规则级预算');
        lines.push('');
        lines.push('| 规则 | 限制 | 已用 | 剩余 | 状态 |');
        lines.push('|------|------|------|------|------|');
        for (const [ruleName, budget] of Object.entries(report.budgetAnalysis.ruleBudgets)) {
          lines.push(`| ${ruleName} | ${budget.limitPerSecond} | ${budget.used} | ${budget.remaining} | ${budget.exhausted ? '❌ 耗尽' : '✅ 正常'} |`);
        }
        lines.push('');
      }
    }

    lines.push('## 💡 建议');
    lines.push('');
    for (const [index, rec] of report.conclusions.recommendations.entries()) {
      lines.push(`${index + 1}. ${rec}`);
    }
    lines.push('');

    if (report.traceAnalysis.fieldCaseIssues.length > 0) {
      lines.push('## 📝 字段大小写问题');
      lines.push('');
      for (const issue of report.traceAnalysis.fieldCaseIssues) {
        lines.push(`- **${issue.field}**: 发现 ${issue.occurrences} 次不一致`);
        lines.push(`  示例: ${issue.examples.join(', ')}`);
      }
      lines.push('');
    }

    if (this.verbose) {
      lines.push('## 📄 详细采样结果 (前 20 条)');
      lines.push('');
      lines.push('| Trace ID | 决策 | 匹配规则 | 采样率 | 随机数 | 预算耗尽 |');
      lines.push('|----------|------|----------|--------|--------|----------|');
      for (const result of report.samplingResults.details.slice(0, 20)) {
        const decisionEmoji = result.finalDecision === SamplingDecision.RECORD_AND_SAMPLE ? '✅' :
                              result.finalDecision === SamplingDecision.DROP ? '❌' : '📝';
        lines.push(`| \`${result.traceId.slice(0, 16)}...\` | ${decisionEmoji} ${result.finalDecision} | ${result.matchedRule?.name || '默认'} | ${(result.effectiveSamplingRatio * 100).toFixed(1)}% | ${result.randomNumber?.toFixed(4)} | ${result.budgetExhausted ? '是' : '否'} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.options.output)) {
      fs.mkdirSync(this.options.output, { recursive: true });
    }
  }
}
