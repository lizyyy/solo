const chalk = require('chalk');
import * as path from 'path';
import {
  DriftReport,
  NullabilityDiff,
  AffectedQuery,
  FailurePath,
  ExitCode,
  ReportStatistics,
} from './types';
import { getRuleByChangeType, formatTypeChange } from './nullability-rules';
import { writeFile, ensureDir } from './utils';

export function generateReport(
  changes: NullabilityDiff[],
  affectedQueries: AffectedQuery[],
  failurePaths: FailurePath[],
  options: {
    oldSchemaHash: string;
    newSchemaHash: string;
    clientVersion?: string;
    queriesScanned: number;
    fieldsScanned: number;
  }
): DriftReport {
  const statistics = calculateStatistics(changes, affectedQueries.length, options.queriesScanned, options.fieldsScanned);
  const exitCode = determineExitCode(changes);

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      oldSchemaHash: options.oldSchemaHash,
      newSchemaHash: options.newSchemaHash,
      clientVersion: options.clientVersion,
    },
    schemaDiff: {
      totalFieldsChecked: options.fieldsScanned,
      fieldsAdded: 0,
      fieldsRemoved: changes.filter((c) => c.changeType === 'FIELD_REMOVED').length,
      typesAdded: 0,
      typesRemoved: 0,
      nullabilityChangesCount: changes.length,
    },
    nullabilityChanges: changes,
    affectedQueries,
    failurePaths,
    statistics,
    exitCode,
  };
}

function calculateStatistics(
  changes: NullabilityDiff[],
  queriesAffected: number,
  queriesScanned: number,
  fieldsScanned: number
): ReportStatistics {
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const change of changes) {
    const rule = getRuleByChangeType(change.changeType);
    if (rule) {
      switch (rule.severity) {
        case 'CRITICAL':
          criticalCount++;
          break;
        case 'HIGH':
          highCount++;
          break;
        case 'MEDIUM':
          mediumCount++;
          break;
        case 'LOW':
          lowCount++;
          break;
      }
    }
  }

  return {
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    queriesScanned,
    queriesAffected,
    fieldsScanned,
  };
}

function determineExitCode(changes: NullabilityDiff[]): ExitCode {
  let hasCritical = false;
  let hasHigh = false;

  for (const change of changes) {
    const rule = getRuleByChangeType(change.changeType);
    if (rule) {
      if (rule.severity === 'CRITICAL') hasCritical = true;
      if (rule.severity === 'HIGH') hasHigh = true;
    }
  }

  if (hasCritical) return ExitCode.CRITICAL_ISSUES;
  if (hasHigh) return ExitCode.HIGH_ISSUES;
  return ExitCode.SUCCESS;
}

export function printTerminalReport(report: DriftReport, verbose: boolean = false): void {
  const line = '='.repeat(60);
  const thinLine = '-'.repeat(60);

  console.log('\n' + chalk.bold.blue(line));
  console.log(chalk.bold.blue('  GraphQL 空值漂移检测报告'));
  console.log(chalk.bold.blue(line) + '\n');

  console.log(chalk.gray(`生成时间: ${report.metadata.generatedAt}`));
  console.log(chalk.gray(`Schema 版本: ${report.metadata.oldSchemaHash.slice(0, 8)} → ${report.metadata.newSchemaHash.slice(0, 8)}`));
  if (report.metadata.clientVersion) {
    console.log(chalk.gray(`客户端版本: ${report.metadata.clientVersion}`));
  }
  console.log();

  console.log(chalk.bold('📊 检测统计'));
  console.log(thinLine);
  const stats = report.statistics;
  console.log(`  扫描字段数: ${stats.fieldsScanned}`);
  console.log(`  扫描查询数: ${stats.queriesScanned}`);
  console.log(`  受影响查询: ${stats.queriesAffected}`);
  console.log();
  console.log(`  ${chalk.red.bold('CRITICAL')}: ${stats.criticalCount}`);
  console.log(`  ${chalk.yellow.bold('HIGH')}: ${stats.highCount}`);
  console.log(`  ${chalk.blue.bold('MEDIUM')}: ${stats.mediumCount}`);
  console.log(`  ${chalk.gray.bold('LOW')}: ${stats.lowCount}`);
  console.log();

  if (report.nullabilityChanges.length > 0) {
    console.log(chalk.bold('⚠️  空值变更详情'));
    console.log(thinLine);

    for (const change of report.nullabilityChanges) {
      const rule = getRuleByChangeType(change.changeType);
      const severityColor = getSeverityColor(rule?.severity || 'LOW');

      console.log(`\n  ${severityColor(`[${rule?.code || 'UNKNOWN'}] ${change.fieldPath}`)}`);
      console.log(`    变更类型: ${change.description}`);
      console.log(`    类型变化: ${formatTypeChange(change.oldType, change.newType)}`);

      if (verbose) {
        console.log(`    影响说明: ${rule?.clientImpact || '未知'}`);
        console.log(`    修复建议: ${rule?.fixPriority || '未知'}`);
      }
    }
    console.log();
  }

  if (report.affectedQueries.length > 0) {
    console.log(chalk.bold('🔍 受影响的查询'));
    console.log(thinLine);

    for (const query of report.affectedQueries) {
      console.log(`\n  📄 ${chalk.cyan(query.operationType)} ${chalk.bold(query.operationName)}`);
      console.log(`     文件: ${query.documentPath}`);

      for (const field of query.affectedFields) {
        console.log(`     ⚠️  ${field.queryPath}`);
        console.log(`        建议: ${field.fallbackRecommendation}`);
      }
    }
    console.log();
  }

  if (report.failurePaths.length > 0) {
    console.log(chalk.bold('🚨 失败路径导出'));
    console.log(thinLine);

    for (const failure of report.failurePaths) {
      const rule = getRuleByChangeType(failure.changeType);
      const severityColor = getSeverityColor(rule?.severity || 'LOW');

      console.log(`\n  ${severityColor(failure.path)}`);
      console.log(`    根因: ${failure.rootCause}`);
      console.log(`    建议: ${failure.recommendedAction}`);

      if (failure.queryOperations.length > 0) {
        console.log(`    影响的查询:`);
        for (const op of failure.queryOperations.slice(0, verbose ? undefined : 3)) {
          console.log(`      - ${op}`);
        }
        if (!verbose && failure.queryOperations.length > 3) {
          console.log(`      ... 还有 ${failure.queryOperations.length - 3} 个查询 (使用 -v 查看全部)`);
        }
      }
    }
    console.log();
  }

  console.log(chalk.bold('📋 退出码说明'));
  console.log(thinLine);
  console.log(`  退出码: ${report.exitCode} - ${getExitCodeDescription(report.exitCode)}`);
  console.log();

  if (report.exitCode !== ExitCode.SUCCESS) {
    console.log(chalk.red.bold('❌ 检测到需要修复的空值漂移问题\n'));
  } else {
    console.log(chalk.green.bold('✅ 未检测到破坏性的空值变更\n'));
  }
}

function getSeverityColor(severity: string): any {
  switch (severity) {
    case 'CRITICAL':
      return chalk.red.bold;
    case 'HIGH':
      return chalk.yellow.bold;
    case 'MEDIUM':
      return chalk.blue.bold;
    default:
      return chalk.gray.bold;
  }
}

function getExitCodeDescription(code: ExitCode): string {
  switch (code) {
    case ExitCode.SUCCESS:
      return '成功 - 无破坏性变更';
    case ExitCode.CRITICAL_ISSUES:
      return '发现严重问题 - 字段被移除或有CRITICAL级变更';
    case ExitCode.HIGH_ISSUES:
      return '发现高危问题 - 存在HIGH级空值变更';
    case ExitCode.INPUT_ERROR:
      return '输入错误 - 参数校验失败';
    case ExitCode.SCHEMA_PARSE_ERROR:
      return 'Schema解析错误';
    case ExitCode.QUERY_PARSE_ERROR:
      return '查询解析错误';
    case ExitCode.MISSING_HISTORY:
      return '缺少历史快照';
    case ExitCode.SELF_TEST_FAILED:
      return '自检失败';
    default:
      return '未知状态';
  }
}

export function writeJsonReport(report: DriftReport, outputDir: string): string {
  ensureDir(outputDir);
  const filePath = path.join(outputDir, 'null-drift-report.json');
  writeFile(filePath, JSON.stringify(report, null, 2));
  return filePath;
}

export function writeMarkdownReport(report: DriftReport, outputDir: string): string {
  ensureDir(outputDir);
  const filePath = path.join(outputDir, 'null-drift-report.md');
  const content = generateMarkdownContent(report);
  writeFile(filePath, content);
  return filePath;
}

function generateMarkdownContent(report: DriftReport): string {
  const lines: string[] = [];

  lines.push('# GraphQL 空值漂移检测报告');
  lines.push('');
  lines.push(`> 生成时间: ${report.metadata.generatedAt}`);
  lines.push('');

  lines.push('## 检测摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 扫描字段数 | ${report.statistics.fieldsScanned} |`);
  lines.push(`| 扫描查询数 | ${report.statistics.queriesScanned} |`);
  lines.push(`| 受影响查询 | ${report.statistics.queriesAffected} |`);
  lines.push(`| CRITICAL 问题 | ${report.statistics.criticalCount} |`);
  lines.push(`| HIGH 问题 | ${report.statistics.highCount} |`);
  lines.push(`| MEDIUM 问题 | ${report.statistics.mediumCount} |`);
  lines.push(`| LOW 问题 | ${report.statistics.lowCount} |`);
  lines.push('');

  if (report.nullabilityChanges.length > 0) {
    lines.push('## 空值变更详情');
    lines.push('');

    for (const change of report.nullabilityChanges) {
      const rule = getRuleByChangeType(change.changeType);
      lines.push(`### [${rule?.code || 'UNKNOWN'}] ${change.fieldPath}`);
      lines.push('');
      lines.push(`- **严重程度**: ${rule?.severity || 'UNKNOWN'}`);
      lines.push(`- **变更类型**: ${change.description}`);
      lines.push(`- **类型变化**: \`${formatTypeChange(change.oldType, change.newType)}\``);
      lines.push(`- **客户端影响**: ${rule?.clientImpact || '未知'}`);
      lines.push(`- **修复优先级**: ${rule?.fixPriority || '未知'}`);
      lines.push(`- **规则说明**: ${change.ruleExplanation}`);
      lines.push('');
    }
  }

  if (report.affectedQueries.length > 0) {
    lines.push('## 受影响的查询');
    lines.push('');

    for (const query of report.affectedQueries) {
      lines.push(`### ${query.operationType} ${query.operationName}`);
      lines.push('');
      lines.push(`- **文件**: \`${query.documentPath}\``);
      lines.push('');
      lines.push('| 查询路径 | Schema路径 | 变更类型 | 兜底建议 |');
      lines.push('|----------|------------|----------|----------|');

      for (const field of query.affectedFields) {
        lines.push(`| \`${field.queryPath}\` | \`${field.schemaPath}\` | ${field.changeType} | ${field.fallbackRecommendation} |`);
      }
      lines.push('');
    }
  }

  if (report.failurePaths.length > 0) {
    lines.push('## 失败路径导出');
    lines.push('');

    for (const failure of report.failurePaths) {
      const rule = getRuleByChangeType(failure.changeType);
      lines.push(`### ${failure.path}`);
      lines.push('');
      lines.push(`- **严重程度**: ${rule?.severity || 'UNKNOWN'}`);
      lines.push(`- **根因**: ${failure.rootCause}`);
      lines.push(`- **建议行动**: ${failure.recommendedAction}`);

      if (failure.queryOperations.length > 0) {
        lines.push('');
        lines.push('**影响的查询:**');
        lines.push('');
        for (const op of failure.queryOperations) {
          lines.push(`- ${op}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('## 退出码');
  lines.push('');
  lines.push(`- **退出码**: ${report.exitCode}`);
  lines.push(`- **说明**: ${getExitCodeDescription(report.exitCode)}`);
  lines.push('');

  if (report.exitCode !== ExitCode.SUCCESS) {
    lines.push('> ⚠️ **检测到需要修复的空值漂移问题，请在发布前处理**');
  } else {
    lines.push('> ✅ **未检测到破坏性的空值变更**');
  }

  return lines.join('\n');
}
