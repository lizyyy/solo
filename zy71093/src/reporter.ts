import * as yaml from 'js-yaml';
import * as diff from 'diff';
import chalk from 'chalk';
import { ExpansionResult, ReportData, CliOptions } from './types';
import { toYamlString } from './expander';
import * as fs from 'fs';
import * as path from 'path';

const VERSION = '1.0.0';

export function generateReport(
  result: ExpansionResult,
  inputFile: string,
  originalContent: string
): ReportData {
  const originalYaml = result.original ? toYamlString(result.original) : '';
  const expandedYaml = result.expanded ? toYamlString(result.expanded) : '';

  const patch = diff.createPatch('yaml', originalYaml, expandedYaml, 'original', 'expanded');

  return {
    meta: {
      inputFile,
      timestamp: new Date().toISOString(),
      version: VERSION,
    },
    summary: {
      totalAnchors: result.anchors.filter(a => a.sourceType === 'anchor').length,
      totalAliases: result.anchors.filter(a => a.sourceType === 'alias').length,
      totalMergeKeys: result.mergeKeys.length,
      totalOverrides: result.overrides.length,
      warnings: result.warnings.length,
      errors: result.errors.length,
      hasCycle: result.cycleDetected,
    },
    anchors: result.anchors,
    mergeKeys: result.mergeKeys,
    overrides: result.overrides,
    expandedYaml,
    originalYaml,
    diff: patch,
  };
}

export function printTerminalSummary(report: ReportData, verbose: boolean): void {
  const { meta, summary } = report;

  console.log('\n' + chalk.cyan('═'.repeat(60)));
  console.log(chalk.cyan.bold('  YAML Anchor 展开报告'));
  console.log(chalk.cyan('═'.repeat(60)));
  console.log(chalk.gray(`  输入文件: ${meta.inputFile}`));
  console.log(chalk.gray(`  生成时间: ${meta.timestamp}`));
  console.log(chalk.cyan('─'.repeat(60)) + '\n');

  console.log(chalk.bold('📊 摘要信息'));
  console.log(chalk.gray('─'.repeat(40)));
  printSummaryItem('Anchor 定义', summary.totalAnchors, summary.totalAnchors > 0);
  printSummaryItem('Alias 引用', summary.totalAliases, summary.totalAliases > 0);
  printSummaryItem('Merge Key', summary.totalMergeKeys, summary.totalMergeKeys > 0);
  printSummaryItem('环境覆盖', summary.totalOverrides, summary.totalOverrides > 0);
  printSummaryItem('警告', summary.warnings, summary.warnings > 0, chalk.yellow);
  printSummaryItem('错误', summary.errors, summary.errors > 0, chalk.red);
  printSummaryItem('循环引用', summary.hasCycle ? '是' : '否', summary.hasCycle, chalk.red);
  console.log('');

  if (verbose) {
    if (report.anchors.length > 0) {
      console.log(chalk.bold('🔗 Anchor 详情'));
      console.log(chalk.gray('─'.repeat(40)));
      for (const anchor of report.anchors) {
        const color = anchor.sourceType === 'anchor' ? chalk.green : chalk.blue;
        console.log(color(`  [${anchor.sourceType}] ${anchor.name}`));
        if (anchor.path) {
          console.log(chalk.gray(`    位置: ${anchor.path}`));
        }
        if (anchor.referencedBy.length > 0) {
          console.log(chalk.gray(`    引用: ${anchor.referencedBy.join(', ')}`));
        }
        console.log('');
      }
    }

    if (report.mergeKeys.length > 0) {
      console.log(chalk.bold('🔀 Merge Key 详情'));
      console.log(chalk.gray('─'.repeat(40)));
      for (const mk of report.mergeKeys) {
        console.log(chalk.magenta(`  位置: ${mk.path}`));
        if (mk.sources.length > 0) {
          console.log(chalk.gray(`    来源: ${mk.sources.join(', ')}`));
        }
        console.log(chalk.gray(`    合并键: ${mk.mergedKeys.join(', ')}`));
        console.log('');
      }
    }

    if (report.overrides.length > 0) {
      console.log(chalk.bold('⚙️  覆盖链详情'));
      console.log(chalk.gray('─'.repeat(40)));
      const sortedOverrides = [...report.overrides].sort((a, b) => a.order - b.order);
      for (const ov of sortedOverrides) {
        console.log(chalk.yellow(`  [${ov.order}] ${ov.path}`));
        console.log(chalk.gray(`    来源: ${ov.source}`));
        console.log(chalk.gray(`    原值: ${JSON.stringify(ov.oldValue)}`));
        console.log(chalk.gray(`    新值: ${JSON.stringify(ov.newValue)}`));
        console.log('');
      }
    }
  }

  console.log(chalk.bold('📄 展开结果'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(report.expandedYaml);

  console.log(chalk.cyan('═'.repeat(60)) + '\n');
}

function printSummaryItem(
  label: string,
  value: number | string,
  highlight: boolean,
  colorFn: (str: string) => string = chalk.green
): void {
  const labelStr = label.padEnd(14);
  const valueStr = String(value);
  if (highlight) {
    console.log(`  ${labelStr}: ${colorFn(valueStr)}`);
  } else {
    console.log(`  ${labelStr}: ${chalk.gray(valueStr)}`);
  }
}

export function writeJsonReport(report: ReportData, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
}

export function writeMarkdownReport(report: ReportData, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const md = generateMarkdown(report);
  fs.writeFileSync(outputPath, md, 'utf8');
}

function generateMarkdown(report: ReportData): string {
  const { meta, summary } = report;
  const lines: string[] = [];

  lines.push('# YAML Anchor 展开报告');
  lines.push('');
  lines.push(`- **输入文件**: ${meta.inputFile}`);
  lines.push(`- **生成时间**: ${meta.timestamp}`);
  lines.push(`- **工具版本**: ${meta.version}`);
  lines.push('');

  lines.push('## 摘要');
  lines.push('');
  lines.push('| 项目 | 数量 | 状态 |');
  lines.push('|------|------|------|');
  lines.push(`| Anchor 定义 | ${summary.totalAnchors} | ${summary.totalAnchors > 0 ? '✅' : '-'} |`);
  lines.push(`| Alias 引用 | ${summary.totalAliases} | ${summary.totalAliases > 0 ? '✅' : '-'} |`);
  lines.push(`| Merge Key | ${summary.totalMergeKeys} | ${summary.totalMergeKeys > 0 ? '✅' : '-'} |`);
  lines.push(`| 环境覆盖 | ${summary.totalOverrides} | ${summary.totalOverrides > 0 ? '✅' : '-'} |`);
  lines.push(`| 警告 | ${summary.warnings} | ${summary.warnings > 0 ? '⚠️' : '✅'} |`);
  lines.push(`| 错误 | ${summary.errors} | ${summary.errors > 0 ? '❌' : '✅'} |`);
  lines.push(`| 循环引用 | ${summary.hasCycle ? '是' : '否'} | ${summary.hasCycle ? '❌' : '✅'} |`);
  lines.push('');

  if (report.anchors.length > 0) {
    lines.push('## Anchor 详情');
    lines.push('');
    lines.push('| 名称 | 类型 | 位置 | 引用位置 |');
    lines.push('|------|------|------|----------|');
    for (const anchor of report.anchors) {
      lines.push(
        `| ${anchor.name} | ${anchor.sourceType} | ${anchor.path || '-'} | ${anchor.referencedBy.join(', ') || '-'} |`
      );
    }
    lines.push('');
  }

  if (report.mergeKeys.length > 0) {
    lines.push('## Merge Key 详情');
    lines.push('');
    lines.push('| 位置 | 来源 | 合并键 |');
    lines.push('|------|------|--------|');
    for (const mk of report.mergeKeys) {
      lines.push(`| ${mk.path} | ${mk.sources.join(', ') || '-'} | ${mk.mergedKeys.join(', ')} |`);
    }
    lines.push('');
  }

  if (report.overrides.length > 0) {
    lines.push('## 覆盖链详情');
    lines.push('');
    lines.push('| 序号 | 路径 | 来源文件 | 原值 | 新值 |');
    lines.push('|------|------|----------|------|------|');
    const sorted = [...report.overrides].sort((a, b) => a.order - b.order);
    for (const ov of sorted) {
      lines.push(
        `| ${ov.order} | ${ov.path} | ${ov.source} | \`${JSON.stringify(ov.oldValue)}\` | \`${JSON.stringify(ov.newValue)}\` |`
      );
    }
    lines.push('');
  }

  lines.push('## 展开后的 YAML');
  lines.push('');
  lines.push('```yaml');
  lines.push(report.expandedYaml.trim());
  lines.push('```');
  lines.push('');

  if (report.diff) {
    lines.push('## 差异对比');
    lines.push('');
    lines.push('```diff');
    lines.push(report.diff.trim());
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

export function writeExpandedYaml(report: ReportData, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, report.expandedYaml, 'utf8');
}

export function ensureOutputDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

export function getOutputPaths(
  inputFile: string,
  outputDir?: string,
  output?: string
): {
  yaml: string;
  json: string;
  markdown: string;
} {
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const dir = outputDir || path.dirname(inputFile);

  if (output) {
    const ext = path.extname(output);
    const base = output.replace(ext, '');
    return {
      yaml: output,
      json: `${base}.json`,
      markdown: `${base}.md`,
    };
  }

  return {
    yaml: path.join(dir, `${baseName}.expanded.yaml`),
    json: path.join(dir, `${baseName}.report.json`),
    markdown: path.join(dir, `${baseName}.report.md`),
  };
}
