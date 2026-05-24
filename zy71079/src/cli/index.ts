#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { CliOptions, EXIT_CODES } from '../types';
import { validateOptions, normalizeOptions } from './options';
import { createScanner } from '../scanner';
import { createReporter } from '../reporter';

const program = new Command();

program
  .name('smcheck')
  .description('Sourcemap 泄漏检查 CLI 工具 - 扫描前端产物中的 sourcemap 安全问题')
  .version('1.0.0')
  .option('-d, --dist <path>', '构建产物目录 (如 dist/)')
  .option('-s, --sourcemap <path>', 'sourcemap 文件或目录')
  .option('-j, --js <path>', 'JS 文件或目录')
  .option('-p, --public-path <path>', '公开访问路径 (如 https://example.com/static/)', '/')
  .option('-e, --exceptions <path>', '例外规则 JSON 文件路径')
  .option('-o, --output <path>', '报告输出目录/前缀', './sourcemap-report')
  .option('--no-fail-on-leak', '发现泄漏时不返回非零退出码')
  .option('-v, --verbose', '显示详细输出')
  .option('-q, --quiet', '静默模式，只输出错误')
  .action(async (options: Partial<CliOptions>) => {
    try {
      const validation = validateOptions(options);

      if (!validation.valid) {
        console.error(chalk.red('❌ 参数验证失败:'));
        for (const error of validation.errors) {
          console.error(chalk.red(`  - ${error}`));
        }
        process.exit(EXIT_CODES.INVALID_OPTIONS);
      }

      if (validation.warnings.length > 0 && !options.quiet) {
        console.warn(chalk.yellow('⚠️  警告:'));
        for (const warning of validation.warnings) {
          console.warn(chalk.yellow(`  - ${warning}`));
        }
        console.log('');
      }

      const normalizedOptions = normalizeOptions(options);

      if (!normalizedOptions.quiet) {
        console.log(chalk.blue('🔍 开始扫描 sourcemap 泄漏...'));
      }

      const scanner = await createScanner(normalizedOptions);
      const report = await scanner.scan();

      const reporter = createReporter(report, normalizedOptions);
      reporter.printSummary();

      await reporter.writeJsonReport();
      await reporter.writeMarkdownReport();

      const exitCode = reporter.getExitCode();
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red(`\n❌ 扫描失败: ${(error as Error).message}`));
      if (options.verbose) {
        console.error((error as Error).stack);
      }
      process.exit(EXIT_CODES.SCAN_ERROR);
    }
  });

program
  .command('init')
  .description('初始化例外规则文件模板')
  .option('-o, --output <path>', '输出文件路径', './smcheck-exceptions.json')
  .action(async (cmdOptions: { output: string }) => {
    const fs = await import('fs');
    const template = {
      $schema: 'https://example.com/smcheck-schema.json',
      description: 'Sourcemap 检查例外规则',
      exceptions: [
        {
          path: '**/vendor*.js',
          reason: '第三方库文件允许 sourcemap',
          expiresAt: '2025-12-31',
          createdAt: new Date().toISOString().split('T')[0],
          createdBy: 'security-team',
        },
      ],
    };

    try {
      await fs.promises.writeFile(
        cmdOptions.output,
        JSON.stringify(template, null, 2),
        'utf-8'
      );
      console.log(chalk.green(`✅ 例外规则模板已创建: ${cmdOptions.output}`));
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      console.error(chalk.red(`❌ 创建失败: ${(error as Error).message}`));
      process.exit(EXIT_CODES.SCAN_ERROR);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red(`❌ 未处理的错误: ${error.message}`));
  process.exit(EXIT_CODES.SCAN_ERROR);
});
