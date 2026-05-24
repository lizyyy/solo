import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { AnalysisReport, ContrastResult } from './types';
import { formatRatio, getLevelLabel } from './wcag-contrast';

export function generateTerminalOutput(report: AnalysisReport, verbose: boolean = false): string {
  const lines: string[] = [];
  
  lines.push(chalk.bold.blue('\n╔══════════════════════════════════════════════════════════════╗'));
  lines.push(chalk.bold.blue('║') + chalk.bold.white('              CSS Token 对比度分析报告                       ') + chalk.bold.blue('║'));
  lines.push(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝\n'));
  
  lines.push(chalk.bold('📊 摘要'));
  lines.push(chalk.gray('━'.repeat(60)));
  lines.push(`  总组合数: ${chalk.cyan(report.summary.totalPairs.toString())}`);
  lines.push(`  ✅ 通过: ${chalk.green(report.summary.passed.toString())}`);
  lines.push(`  ❌ 失败: ${chalk.red(report.summary.failed.toString())}`);
  lines.push(`  ⚠️  警告: ${chalk.yellow(report.summary.warning.toString())}`);
  const passRateColor = report.summary.passRate >= 80 ? chalk.green : report.summary.passRate >= 50 ? chalk.yellow : chalk.red;
  lines.push(`  📈 通过率: ${passRateColor(report.summary.passRate + '%')}`);
  lines.push('');
  
  if (report.summary.failed > 0) {
    lines.push(chalk.bold.red('❌ 失败的组合'));
    lines.push(chalk.gray('━'.repeat(60)));
    
    const failedResults = report.results.filter(r => !r.passes);
    
    for (const result of failedResults.slice(0, 20)) {
      lines.push(formatResultLine(result, false));
      
      if (verbose) {
        lines.push(formatVerboseResult(result));
      }
    }
    
    if (failedResults.length > 20) {
      lines.push(chalk.gray(`  ... 还有 ${failedResults.length - 20} 个失败的组合，请查看完整报告`));
    }
    lines.push('');
  }
  
  if (report.unresolvedTokens.length > 0) {
    lines.push(chalk.bold.yellow('⚠️  无法处理的记录'));
    lines.push(chalk.gray('━'.repeat(60)));
    
    for (const token of report.unresolvedTokens) {
      const location = token.filePath 
        ? chalk.gray(` (${path.basename(token.filePath)}:${token.line || '?'})`)
        : '';
      lines.push(`  ${chalk.yellow(token.name)}: ${token.reason}${location}`);
    }
    lines.push('');
  }
  
  if (verbose && report.summary.passed > 0) {
    lines.push(chalk.bold.green('✅ 通过的组合'));
    lines.push(chalk.gray('━'.repeat(60)));
    
    const passedResults = report.results.filter(r => r.passes);
    
    for (const result of passedResults.slice(0, 10)) {
      lines.push(formatResultLine(result, true));
    }
    
    if (passedResults.length > 10) {
      lines.push(chalk.gray(`  ... 还有 ${passedResults.length - 10} 个通过的组合`));
    }
    lines.push('');
  }
  
  lines.push(chalk.bold('📋 WCAG 等级说明'));
  lines.push(chalk.gray('━'.repeat(60)));
  lines.push(`  ${chalk.green('AAA')}: 7:1 以上 (增强对比度)`);
  lines.push(`  ${chalk.green('AA')}: 4.5:1 以上 (正常文本最小要求)`);
  lines.push(`  ${chalk.yellow('AA Large')}: 3:1 以上 (大文本最小要求)`);
  lines.push(`  ${chalk.red('FAIL')}: 低于阈值`);
  lines.push('');
  
  return lines.join('\n');
}

function formatResultLine(result: ContrastResult, passed: boolean): string {
  const level = getLevelLabel(result.passes, result.contrastRatio, result.threshold);
  const levelColor = level === 'AAA' || level === 'AA' ? chalk.green : level === 'AA Large' ? chalk.yellow : chalk.red;
  
  const fgColor = result.calculation.foregroundWithAlphaBlend || result.calculation.foregroundHex;
  const bgColor = result.calculation.backgroundHex;
  
  const pairInfo = result.pair.component 
    ? `${chalk.magenta(result.pair.component)}${result.pair.variant ? chalk.gray(`.${result.pair.variant}`) : ''}`
    : chalk.cyan(result.pair.foreground.name);
  
  return `  ${levelColor(level.padEnd(6))} ${formatRatio(result.contrastRatio).padEnd(10)} ${pairInfo} ${chalk.gray('on')} ${chalk.cyan(result.pair.background.name)} ${chalk.gray(`${fgColor} on ${bgColor}`)}`;
}

function formatVerboseResult(result: ContrastResult): string {
  const lines: string[] = [];
  
  lines.push(`    ${chalk.gray('Token 详情:')}`);
  
  if (result.pair.foreground.aliasChain) {
    lines.push(`      ${chalk.gray('前景色别名链:')} ${result.pair.foreground.aliasChain.join(' → ')}`);
  }
  if (result.pair.background.aliasChain) {
    lines.push(`      ${chalk.gray('背景色别名链:')} ${result.pair.background.aliasChain.join(' → ')}`);
  }
  
  lines.push(`      ${chalk.gray('原始值:')} ${result.calculation.foregroundHex} (前景), ${result.calculation.backgroundHex} (背景)`);
  
  if (result.calculation.foregroundWithAlphaBlend && result.calculation.foregroundWithAlphaBlend !== result.calculation.foregroundHex) {
    lines.push(`      ${chalk.gray('混合后:')} ${result.calculation.foregroundWithAlphaBlend}`);
  }
  
  lines.push(`      ${chalk.gray('亮度:')} ${result.calculation.luminanceForeground} (前景), ${result.calculation.luminanceBackground} (背景)`);
  
  if (result.notes.length > 0) {
    for (const note of result.notes) {
      lines.push(`      ${chalk.yellow('ℹ')} ${note}`);
    }
  }
  
  if (result.pair.foreground.filePath && result.pair.foreground.line) {
    lines.push(`      ${chalk.gray('位置:')} ${path.basename(result.pair.foreground.filePath)}:${result.pair.foreground.line}`);
  }
  
  return lines.map(l => '    ' + l).join('\n');
}

export function generateJsonReport(report: AnalysisReport, outputDir: string): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filePath = path.join(outputDir, 'contrast-report.json');
  const jsonData = JSON.stringify(report, null, 2);
  fs.writeFileSync(filePath, jsonData, 'utf-8');
  
  return filePath;
}

export function generateMarkdownReport(report: AnalysisReport, outputDir: string): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filePath = path.join(outputDir, 'contrast-report.md');
  const content = generateMarkdownContent(report);
  fs.writeFileSync(filePath, content, 'utf-8');
  
  return filePath;
}

function generateMarkdownContent(report: AnalysisReport): string {
  const lines: string[] = [];
  
  lines.push('# CSS Token 对比度分析报告');
  lines.push('');
  lines.push(`生成时间: ${new Date(report.metadata.generatedAt).toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push('## 摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总组合数 | ${report.summary.totalPairs} |`);
  lines.push(`| ✅ 通过 | ${report.summary.passed} |`);
  lines.push(`| ❌ 失败 | ${report.summary.failed} |`);
  lines.push(`| ⚠️ 警告 | ${report.summary.warning} |`);
  lines.push(`| 📈 通过率 | ${report.summary.passRate}% |`);
  lines.push('');
  
  lines.push('## WCAG 阈值说明');
  lines.push('');
  lines.push('- **AA (正常文本)**: 4.5:1');
  lines.push('- **AA (大文本)**: 3:1');
  lines.push('- **AAA (正常文本)**: 7:1');
  lines.push('- **AAA (大文本)**: 4.5:1');
  lines.push('');
  
  if (report.summary.failed > 0) {
    lines.push('## ❌ 失败的组合');
    lines.push('');
    lines.push('| 等级 | 对比度 | 前景 Token | 背景 Token | 组件 | 颜色值 |');
    lines.push('|------|--------|------------|------------|------|--------|');
    
    for (const result of report.results.filter(r => !r.passes)) {
      const level = getLevelLabel(result.passes, result.contrastRatio, result.threshold);
      const fgColor = result.calculation.foregroundWithAlphaBlend || result.calculation.foregroundHex;
      const component = result.pair.component || '-';
      
      lines.push(`| ${level} | ${formatRatio(result.contrastRatio)} | \`${result.pair.foreground.name}\` | \`${result.pair.background.name}\` | ${component} | \`${fgColor}\` on \`${result.calculation.backgroundHex}\` |`);
    }
    lines.push('');
  }
  
  lines.push('## ✅ 通过的组合');
  lines.push('');
  lines.push('| 等级 | 对比度 | 前景 Token | 背景 Token | 组件 | 颜色值 |');
  lines.push('|------|--------|------------|------------|------|--------|');
  
  for (const result of report.results.filter(r => r.passes)) {
    const level = getLevelLabel(result.passes, result.contrastRatio, result.threshold);
    const fgColor = result.calculation.foregroundWithAlphaBlend || result.calculation.foregroundHex;
    const component = result.pair.component || '-';
    
    lines.push(`| ${level} | ${formatRatio(result.contrastRatio)} | \`${result.pair.foreground.name}\` | \`${result.pair.background.name}\` | ${component} | \`${fgColor}\` on \`${result.calculation.backgroundHex}\` |`);
  }
  lines.push('');
  
  lines.push('## 📝 计算详情');
  lines.push('');
  
  for (const result of report.results) {
    lines.push(`### ${result.pair.id}`);
    lines.push('');
    lines.push(`- **对比度**: ${formatRatio(result.contrastRatio)}`);
    lines.push(`- **WCAG 等级**: ${getLevelLabel(result.passes, result.contrastRatio, result.threshold)}`);
    lines.push(`- **阈值**: ${result.threshold}:1`);
    lines.push('');
    
    lines.push('#### 前景色');
    lines.push(`- Token: \`${result.pair.foreground.name}\``);
    lines.push(`- 原始值: \`${result.pair.foreground.value}\``);
    lines.push(`- 解析值: \`${result.pair.foreground.resolvedValue}\``);
    lines.push(`- HEX: \`${result.calculation.foregroundHex}\``);
    lines.push(`- 亮度: ${result.calculation.luminanceForeground}`);
    
    if (result.pair.foreground.aliasChain && result.pair.foreground.aliasChain.length > 1) {
      lines.push(`- 别名链: ${result.pair.foreground.aliasChain.map(t => `\`${t}\``).join(' → ')}`);
    }
    
    if (result.pair.foreground.filePath && result.pair.foreground.line) {
      lines.push(`- 位置: ${result.pair.foreground.filePath}:${result.pair.foreground.line}`);
    }
    lines.push('');
    
    lines.push('#### 背景色');
    lines.push(`- Token: \`${result.pair.background.name}\``);
    lines.push(`- 原始值: \`${result.pair.background.value}\``);
    lines.push(`- 解析值: \`${result.pair.background.resolvedValue}\``);
    lines.push(`- HEX: \`${result.calculation.backgroundHex}\``);
    lines.push(`- 亮度: ${result.calculation.luminanceBackground}`);
    
    if (result.pair.background.aliasChain && result.pair.background.aliasChain.length > 1) {
      lines.push(`- 别名链: ${result.pair.background.aliasChain.map(t => `\`${t}\``).join(' → ')}`);
    }
    
    if (result.pair.background.filePath && result.pair.background.line) {
      lines.push(`- 位置: ${result.pair.background.filePath}:${result.pair.background.line}`);
    }
    lines.push('');
    
    if (result.calculation.foregroundWithAlphaBlend && result.calculation.foregroundWithAlphaBlend !== result.calculation.foregroundHex) {
      lines.push('#### 透明度混合');
      lines.push(`- 混合后颜色: \`${result.calculation.foregroundWithAlphaBlend}\``);
      lines.push('');
    }
    
    if (result.notes.length > 0) {
      lines.push('#### 备注');
      for (const note of result.notes) {
        lines.push(`- ${note}`);
      }
      lines.push('');
    }
  }
  
  if (report.unresolvedTokens.length > 0) {
    lines.push('## ⚠️ 无法处理的记录');
    lines.push('');
    lines.push('| Token | 原因 | 位置 |');
    lines.push('|-------|------|------|');
    
    for (const token of report.unresolvedTokens) {
      const location = token.filePath 
        ? `${token.filePath}:${token.line || '?'}`
        : '-';
      lines.push(`| \`${token.name}\` | ${token.reason} | ${location} |`);
    }
    lines.push('');
  }
  
  lines.push('## 命令参数');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(report.metadata.options, null, 2));
  lines.push('```');
  lines.push('');
  
  return lines.join('\n');
}

export function printTerminalSummary(report: AnalysisReport, verbose: boolean = false): void {
  console.log(generateTerminalOutput(report, verbose));
}

export function generateAllReports(
  report: AnalysisReport,
  outputDir: string,
  formats: ('terminal' | 'json' | 'markdown')[]
): {
  terminal?: string;
  json?: string;
  markdown?: string;
} {
  const result: ReturnType<typeof generateAllReports> = {};
  
  if (formats.includes('terminal')) {
    result.terminal = 'console';
  }
  
  if (formats.includes('json')) {
    result.json = generateJsonReport(report, outputDir);
  }
  
  if (formats.includes('markdown')) {
    result.markdown = generateMarkdownReport(report, outputDir);
  }
  
  return result;
}
