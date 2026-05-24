#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { ConfigParser } from './config-parser';
import { TraceParser } from './trace-parser';
import { SamplingEngine } from './sampling-engine';
import { ReportGenerator } from './report-generator';
import { CLIOptions, ExitCode, SamplingDecision, DiagnosticReport } from './types';
import chalk = require('chalk');

const program = new Command();

program
  .name('otel-sampling')
  .description('OpenTelemetry 采样诊断 CLI 工具')
  .version('1.0.0')
  .requiredOption('-c, --config <path>', '采样配置文件路径 (JSON)')
  .requiredOption('-t, --traces <path>', 'Trace 样本文件路径 (JSON)')
  .option('-s, --service <name>', '只分析指定服务的 trace')
  .option('-b, --budget <number>', '覆盖全局预算阈值 (每秒采样数)', (v) => parseInt(v, 10))
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-f, --format <format>', '输出格式: json, markdown, both', 'both')
  .option('-v, --verbose', '显示详细信息')
  .option('-q, --quiet', '静默模式，不输出终端摘要')
  .option('--seed <number>', '随机数种子 (用于可复现的采样结果)', (v) => parseInt(v, 10), 42)
  .option('--no-deterministic', '禁用确定性模式 (使用真实随机数)')
  .parse(process.argv);

const options = program.opts() as CLIOptions;

function validateOptions(options: CLIOptions): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!path.isAbsolute(options.config) && !options.config.startsWith('.')) {
    options.config = path.resolve(process.cwd(), options.config);
  }

  if (!path.isAbsolute(options.traces) && !options.traces.startsWith('.')) {
    options.traces = path.resolve(process.cwd(), options.traces);
  }

  if (!path.isAbsolute(options.output) && !options.output.startsWith('.')) {
    options.output = path.resolve(process.cwd(), options.output);
  }

  const validFormats = ['json', 'markdown', 'both'];
  if (!validFormats.includes(options.format)) {
    errors.push(`无效的输出格式: ${options.format}，必须是 ${validFormats.join(', ')} 之一`);
  }

  if (options.budget !== undefined && (isNaN(options.budget) || options.budget < 0)) {
    errors.push('预算阈值必须是非负数字');
  }

  return { valid: errors.length === 0, errors };
}

function calculateExitCode(
  report: DiagnosticReport,
  configValid: boolean
): ExitCode {
  if (!configValid || report.configValidation.errors.length > 0) {
    return ExitCode.VALIDATION_ERROR;
  }

  if (report.traceAnalysis.totalTraces === 0) {
    return ExitCode.INPUT_ERROR;
  }

  const budgetExhausted =
    (report.budgetAnalysis.globalBudget?.exhausted) ||
    Object.values(report.budgetAnalysis.ruleBudgets).some(b => b.exhausted);

  if (budgetExhausted) {
    return ExitCode.BUDGET_EXCEEDED;
  }

  const dropRate = report.samplingResults.summary.droppedPercentage;
  if (dropRate > 50) {
    return ExitCode.TRACES_DROPPED;
  }

  return ExitCode.SUCCESS;
}

async function main() {
  const validation = validateOptions(options);
  if (!validation.valid) {
    console.error(chalk.red('参数校验失败:'));
    for (const error of validation.errors) {
      console.error(chalk.red(`  • ${error}`));
    }
    process.exit(ExitCode.VALIDATION_ERROR);
  }

  if (!options.quiet) {
    console.log(chalk.cyan('\n🔍 开始分析采样配置...'));
  }

  const configParser = new ConfigParser();
  const config = configParser.parse(options.config);
  const configValid = configParser.isValid();

  const configValidation = {
    valid: configValid,
    errors: configParser.getErrors(),
    warnings: configParser.getWarnings()
  };

  if (!config) {
    console.error(chalk.red('\n❌ 配置解析失败，无法继续'));
    process.exit(ExitCode.VALIDATION_ERROR);
  }

  if (!options.quiet) {
    console.log(chalk.green(`  ✓ 配置解析完成，发现 ${config.rules.length} 条规则`));
    console.log(chalk.cyan('\n📂 解析 Trace 样本...'));
  }

  const traceParser = new TraceParser();
  const traceResult = traceParser.parse(options.traces, options.service);

  if (traceResult.errors.length > 0) {
    console.error(chalk.red('\n❌ Trace 解析失败:'));
    for (const error of traceResult.errors) {
      console.error(chalk.red(`  • [${error.field}] ${error.message}`));
    }
    process.exit(ExitCode.INPUT_ERROR);
  }

  const traceAnalysis = {
    totalTraces: traceResult.traces.length,
    totalSpans: traceResult.traces.reduce((sum, t) => sum + t.spans.length, 0),
    uniqueServices: [...new Set(traceResult.traces.flatMap(t => t.serviceNames))],
    missingFields: traceResult.missingFields,
    fieldCaseIssues: traceResult.fieldCaseIssues
  };

  if (!options.quiet) {
    console.log(chalk.green(`  ✓ 解析完成，发现 ${traceResult.traces.length} 条 trace, ${traceAnalysis.totalSpans} 个 span`));
    console.log(chalk.green(`  ✓ 涉及 ${traceAnalysis.uniqueServices.length} 个服务`));
    console.log(chalk.cyan('\n⚙️  执行采样规则匹配...'));
  }

  const samplingEngine = new SamplingEngine(
    config,
    options.budget,
    options.seed,
    options.deterministic
  );
  const samplingResults = traceResult.traces.map(trace => samplingEngine.evaluateTrace(trace));
  const budgetStats = samplingEngine.getBudgetStats();

  if (!options.quiet) {
    console.log(chalk.green(`  ✓ 匹配完成，评估 ${samplingResults.length} 条 trace`));
    console.log(chalk.cyan('\n📝 生成诊断报告...'));
  }

  const reportGenerator = new ReportGenerator(options);
  const report = reportGenerator.generateReport(
    configValidation,
    traceAnalysis,
    samplingResults,
    budgetStats,
    traceResult.traces
  );

  if (options.format === 'json' || options.format === 'both') {
    const jsonPath = reportGenerator.writeJsonReport(report);
    if (!options.quiet) {
      console.log(chalk.green(`  ✓ JSON 报告已写入: ${jsonPath}`));
    }
  }

  if (options.format === 'markdown' || options.format === 'both') {
    const mdPath = reportGenerator.writeMarkdownReport(report);
    if (!options.quiet) {
      console.log(chalk.green(`  ✓ Markdown 报告已写入: ${mdPath}`));
    }
  }

  reportGenerator.printTerminalSummary(report);

  const exitCode = calculateExitCode(report, configValid);
  process.exit(exitCode);
}

main().catch(error => {
  console.error(chalk.red('\n💥 未预期的错误:'), error);
  process.exit(ExitCode.PROCESSING_ERROR);
});
