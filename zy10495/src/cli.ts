#!/usr/bin/env node

import { Command, Option } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { CLIOptions } from './types.js';
import { runCheck, getExitCode } from './checker.js';
import { printTerminalSummary, generateReports } from './report-generator.js';

const program = new Command();

async function validateFile(filePath: string): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error(`路径不是文件: ${filePath}`);
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!['.json', '.yaml', '.yml'].includes(ext)) {
      throw new Error(`不支持的文件格式: ${ext}。仅支持 .json, .yaml, .yml`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`文件不存在: ${filePath}`);
    }
    throw error;
  }
}

async function main() {
  program
    .name('i18n-check')
    .description('检查多语言翻译文件中的占位符一致性')
    .version('1.0.0');

  program
    .argument('<source>', '源语言翻译文件路径 (基准文件)')
    .option('-l, --source-lang <lang>', '源语言代码，例如: en, zh-CN', 'en')
    .option('-t, --target-langs <langs...>', '要检查的目标语言代码列表，例如: zh-CN ja')
    .option('-o, --output-dir <dir>', '报告输出目录', './i18n-report')
    .option('-p, --pattern <pattern>', '翻译文件匹配模式', '**/*.{json,yaml,yml}')
    .option('-f, --format <format>', '输出报告格式: json, markdown, html, all', 'all')
    .option('--no-fail-on-error', '发现错误时不返回非零退出码')
    .option('-v, --verbose', '显示详细信息')
    .action(async (source: string, options) => {
      try {
        const sourcePath = path.resolve(source);
        await validateFile(sourcePath);

        const validFormats = ['json', 'markdown', 'html', 'all'];
        if (!validFormats.includes(options.format)) {
          throw new Error(`无效的输出格式: ${options.format}。可选值: ${validFormats.join(', ')}`);
        }

        const cliOptions: CLIOptions = {
          source: sourcePath,
          sourceLang: options.sourceLang,
          targetLangs: options.targetLangs,
          outputDir: path.resolve(options.outputDir),
          pattern: options.pattern,
          failOnError: options.failOnError,
          format: options.format,
          verbose: options.verbose,
        };

        if (options.verbose) {
          console.log(chalk.gray('配置参数:'));
          console.log(chalk.gray(JSON.stringify(cliOptions, null, 2)));
          console.log();
        }

        console.log(chalk.cyan('开始检查翻译文件占位符...\n'));

        const report = await runCheck(cliOptions);

        printTerminalSummary(report, options.verbose);

        const outputFiles = await generateReports(report, cliOptions);

        console.log(chalk.bold('报告已生成:'));
        if (outputFiles.json) {
          console.log(`  - JSON: ${outputFiles.json}`);
        }
        if (outputFiles.markdown) {
          console.log(`  - Markdown: ${outputFiles.markdown}`);
        }
        if (outputFiles.html) {
          console.log(`  - HTML: ${outputFiles.html}`);
        }
        console.log();

        const exitCode = getExitCode(report, options.failOnError);
        process.exit(exitCode);
      } catch (error) {
        console.error(chalk.red.bold('\n❌ 错误:'));
        console.error(chalk.red(`  ${(error as Error).message}\n`));
        if (program.opts().verbose) {
          console.error((error as Error).stack);
        }
        process.exit(1);
      }
    });

  program.addHelpText(
    'after',
    `
示例:
  $ i18n-check ./locales/en.json -l en -t zh-CN ja -o ./report
  $ i18n-check ./i18n/en.yaml -l en --format html --no-fail-on-error

支持的占位符格式:
  - {name}      花括号
  - {{name}}    双花括号
  - $name       美元符号
  - %name%      百分号
  - :name       冒号
`
  );

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(chalk.red('致命错误:'), error);
  process.exit(1);
});
