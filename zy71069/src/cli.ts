#!/usr/bin/env node

import { Command, Option } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { CliOptions } from './types';
import { analyzeTokens, analyzeSingleColorPair } from './analyzer';
import { generateAllReports, printTerminalSummary } from './reporter';
import { WCAG_THRESHOLDS } from './wcag-contrast';

const program = new Command();

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateOptions(options: CliOptions): ValidationResult {
  const errors: string[] = [];
  
  if (!options.tokens && !options.foreground) {
    errors.push('必须指定 --tokens 参数或使用 --foreground/--background 直接指定颜色');
  }
  
  if (options.tokens && !fs.existsSync(options.tokens)) {
    errors.push(`Token 文件不存在: ${options.tokens}`);
  }
  
  if (options.pairs && !fs.existsSync(options.pairs)) {
    errors.push(`组件配对文件不存在: ${options.pairs}`);
  }
  
  if (options.threshold < 1 || options.threshold > 21) {
    errors.push('阈值必须在 1-21 之间');
  }
  
  if ((options.foreground && !options.background) || (!options.foreground && options.background)) {
    errors.push('--foreground 和 --background 必须同时指定');
  }
  
  if (!fs.existsSync(options.outputDir)) {
    try {
      fs.mkdirSync(options.outputDir, { recursive: true });
    } catch {
      errors.push(`无法创建输出目录: ${options.outputDir}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function parseFormats(value: string): ('terminal' | 'json' | 'markdown')[] {
  const items = value.split(',').map(item => item.trim().toLowerCase());
  const validFormats: ('terminal' | 'json' | 'markdown')[] = [];
  
  for (const item of items) {
    if (item === 'terminal' || item === 'json' || item === 'markdown') {
      validFormats.push(item);
    } else {
      console.warn(chalk.yellow(`警告: 未知格式 "${item}"，已忽略`));
    }
  }
  
  return validFormats.length > 0 ? validFormats : ['terminal', 'json', 'markdown'];
}

program
  .name('ctk-contrast')
  .description('CSS Token 对比度检查 CLI 工具 - 检查设计系统 token 组合的 WCAG 可访问性')
  .version('1.0.0')
  .option('-t, --tokens <path>', 'Design Token JSON 文件路径')
  .option('-p, --pairs <path>', '组件用法配对 JSON 文件路径')
  .option('-o, --output-dir <path>', '输出目录', './contrast-report')
  .option('-T, --threshold <number>', '对比度阈值 (默认: 4.5，对应 WCAG AA)', 
    (value) => parseFloat(value), WCAG_THRESHOLDS.AA_NORMAL)
  .addOption(new Option('-m, --mode <mode>', '颜色模式')
    .choices(['light', 'dark', 'both'])
    .default('both'))
  .addOption(new Option('-f, --formats <formats>', '输出格式，逗号分隔 (terminal,json,markdown)')
    .argParser(parseFormats))
  .option('-v, --verbose', '详细输出')
  .option('--foreground <token-or-color>', '直接指定前景色 token 或颜色值')
  .option('--background <token-or-color>', '直接指定背景色 token 或颜色值')
  .addHelpText('after', `

示例:
  # 分析设计系统中所有 token 组合
  ctk-contrast --tokens ./tokens.json

  # 分析指定的组件用法配对
  ctk-contrast --tokens ./tokens.json --pairs ./component-pairs.json

  # 检查单个颜色组合
  ctk-contrast --foreground "#333333" --background "#ffffff"

  # 使用更高的 AAA 标准阈值
  ctk-contrast --tokens ./tokens.json --threshold 7

  # 只输出 Markdown 报告
  ctk-contrast --tokens ./tokens.json --formats markdown

退出码:
  0 - 所有检查通过
  1 - 有对比度检查失败
  2 - 命令执行错误
`);

async function main() {
  program.parse();
  
  const options = program.opts() as CliOptions;
  
  if (!options.formats || options.formats.length === 0) {
    options.formats = ['terminal', 'json', 'markdown'];
  }
  
  if (typeof options.formats === 'string') {
    options.formats = parseFormats(options.formats);
  }
  
  if (options.foreground && options.background && !options.tokens) {
    const result = analyzeSingleColorPair(options.foreground, options.background, options.threshold);
    
    if (!result) {
      console.error(chalk.red('错误: 无法解析颜色值'));
      process.exit(2);
    }
    
    console.log('');
    console.log(chalk.bold('🎨 直接颜色对比度分析'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(`  前景色: ${chalk.cyan(options.foreground)}`);
    console.log(`  背景色: ${chalk.cyan(options.background)}`);
    
    if (result.notes.length > 0) {
      for (const note of result.notes) {
        console.log(`  ${chalk.yellow('ℹ')} ${note}`);
      }
    }
    
    console.log(`  对比度: ${chalk.bold(result.contrastRatio.toFixed(2))}:1`);
    console.log(`  阈值: ${options.threshold}:1`);
    console.log('');
    
    const level = result.passes 
      ? chalk.green('✅ 通过') 
      : chalk.red('❌ 失败');
    console.log(`  结果: ${level}`);
    console.log('');
    
    console.log(chalk.bold('WCAG 等级:'));
    console.log(`  AA (正常文本): ${result.wcagLevel.aaNormal ? chalk.green('✅ 通过') : chalk.red('❌ 失败')}`);
    console.log(`  AA (大文本): ${result.wcagLevel.aaLarge ? chalk.green('✅ 通过') : chalk.red('❌ 失败')}`);
    console.log(`  AAA (正常文本): ${result.wcagLevel.aaaNormal ? chalk.green('✅ 通过') : chalk.red('❌ 失败')}`);
    console.log(`  AAA (大文本): ${result.wcagLevel.aaaLarge ? chalk.green('✅ 通过') : chalk.red('❌ 失败')}`);
    console.log('');
    
    process.exit(result.passes ? 0 : 1);
  }
  
  const validation = validateOptions(options);
  
  if (!validation.valid) {
    console.error(chalk.red('参数错误:'));
    for (const error of validation.errors) {
      console.error(chalk.red(`  ❌ ${error}`));
    }
    console.error('');
    program.help();
    process.exit(2);
  }
  
  try {
    const { report, exitCode } = analyzeTokens(options);
    
    if (options.formats.includes('terminal')) {
      printTerminalSummary(report, options.verbose);
    }
    
    const reportFiles = generateAllReports(
      report, 
      options.outputDir, 
      options.formats.filter(f => f !== 'terminal')
    );
    
    if (Object.keys(reportFiles).length > 0) {
      console.log(chalk.bold('📄 报告文件:'));
      console.log(chalk.gray('━'.repeat(60)));
      
      if (reportFiles.json) {
        console.log(`  ${chalk.cyan('JSON')}: ${path.resolve(reportFiles.json)}`);
      }
      if (reportFiles.markdown) {
        console.log(`  ${chalk.cyan('Markdown')}: ${path.resolve(reportFiles.markdown)}`);
      }
      console.log('');
    }
    
    if (options.verbose) {
      console.log(chalk.bold('🔍 解析的 Token 列表:'));
      console.log(chalk.gray('━'.repeat(60)));
      for (const [name, token] of Object.entries(report.tokenMap)) {
        console.log(`  ${chalk.cyan(name)}: ${token.hex}`);
        if (token.aliasChain && token.aliasChain.length > 1) {
          console.log(`    ${chalk.gray('别名链:')} ${token.aliasChain.join(' → ')}`);
        }
      }
      console.log('');
    }
    
    process.exit(exitCode);
  } catch (error) {
    console.error(chalk.red('执行错误:'));
    console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(2);
  }
}

main().catch(error => {
  console.error(chalk.red('致命错误:'), error);
  process.exit(2);
});
