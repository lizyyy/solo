#!/usr/bin/env node

import { Command } from 'commander';
import { DriftDetector } from './drift-detector';
import { ReportGenerator } from './report-generator';
import { CliOptions } from './types';
import path from 'path';
import chalk from 'chalk';

const program = new Command();

program
  .name('scaffold-drift')
  .description('检测仓库与脚手架模板的漂移')
  .version('1.0.0');

program
  .command('check', { isDefault: true })
  .description('检测仓库脚手架漂移')
  .requiredOption('-r, --repo <path>', '仓库目录路径')
  .requiredOption('-t, --template <path>', '模板目录路径')
  .option('-o, --output <path>', '报告输出目录', './drift-reports')
  .option('-f, --format <format>', '输出格式: json|markdown|both', 'both')
  .option('-d, --detail', '显示详细差异', false)
  .option('-p, --preview', '生成修复预览', true)
  .action(async (options) => {
    try {
      const cliOptions: CliOptions = {
        repo: path.resolve(options.repo),
        template: path.resolve(options.template),
        output: path.resolve(options.output),
        format: options.format as any,
        detail: options.detail,
        preview: options.preview
      };

      console.log(chalk.cyan('🔍 开始检测脚手架漂移...\n'));
      console.log(`  仓库: ${cliOptions.repo}`);
      console.log(`  模板: ${cliOptions.template}\n`);

      const detector = new DriftDetector();
      const report = await detector.detect(cliOptions);

      const reportGenerator = new ReportGenerator();
      reportGenerator.printConsoleSummary(report);

      if (cliOptions.format === 'json' || cliOptions.format === 'both') {
        await reportGenerator.generateJsonReport(report, cliOptions.output);
      }

      if (cliOptions.format === 'markdown' || cliOptions.format === 'both') {
        await reportGenerator.generateMarkdownReport(report, cliOptions.output);
      }

      if (report.summary.totalDrifts > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (error: any) {
      console.error(chalk.red('\n❌ 检测失败:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(2);
    }
  });

program
  .command('init')
  .description('在当前目录初始化模板清单')
  .option('-n, --name <name>', '模板名称', 'custom-scaffold')
  .option('-V, --template-version <version>', '模板版本', '1.0.0')
  .action(async (options) => {
    try {
      const fs = await import('fs-extra');
      const manifestPath = path.resolve('./scaffold-manifest.json');
      
      if (await fs.pathExists(manifestPath)) {
        console.log(chalk.yellow('⚠️  模板清单已存在:'), manifestPath);
        return;
      }

      const manifest = {
        name: options.name,
        version: options.templateVersion,
        files: [
          {
            path: 'package.json',
            required: true,
            checkContent: false
          },
          {
            path: '.gitignore',
            required: true,
            checkContent: true
          },
          {
            path: 'README.md',
            required: false,
            checkContent: false
          }
        ],
        configs: [
          {
            path: 'tsconfig.json',
            type: 'json',
            required: true,
            keys: ['compilerOptions.target', 'compilerOptions.module']
          },
          {
            path: '.env.example',
            type: 'env',
            required: false
          }
        ]
      };

      await fs.writeJson(manifestPath, manifest, { spaces: 2 });
      console.log(chalk.green('✓ 模板清单已创建:'), manifestPath);
      console.log(chalk.gray('\n请编辑 scaffold-manifest.json 配置需要检查的文件和配置项。'));
    } catch (error: any) {
      console.error(chalk.red('\n❌ 初始化失败:'), error.message);
      process.exit(2);
    }
  });

program.parse(process.argv);
