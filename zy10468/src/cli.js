#!/usr/bin/env node

import { Command } from 'commander';
import { runAnalysis } from './analyzer.js';
import { runSelfCheck, cleanupTestDir } from './selfcheck.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('monobound')
  .description('Monorepo 边界检查工具 - 保护你的代码架构')
  .version('1.0.0');

program
  .command('check')
  .description('运行边界检查')
  .option('-c, --config <path>', '配置文件路径')
  .option('-o, --output-dir <path>', '报告输出目录')
  .option('--json', '仅输出 JSON 报告')
  .action(async (options) => {
    try {
      const result = await runAnalysis(options);

      if (!result.success) {
        if (result.errors) {
          console.error(chalk.red('❌ 配置错误:'));
          for (const err of result.errors) {
            console.error(chalk.red(`   - ${err}`));
          }
        }
        if (result.warnings) {
          for (const warn of result.warnings) {
            console.warn(chalk.yellow(`⚠️  ${warn}`));
          }
        }
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.reports.terminal) {
          console.log(result.reports.terminal);
        }
        if (result.reports.json) {
          console.log(chalk.cyan('📄 JSON 报告:'), result.reports.json);
        }
        if (result.reports.html) {
          console.log(chalk.cyan('🌐 HTML 报告:'), result.reports.html);
        }
      }

      if (result.summary.violationCount > 0 || result.summary.cycleCount > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ 运行失败:'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('selfcheck')
  .description('创建自检测试环境')
  .option('--run', '创建环境后自动运行检查')
  .option('--cleanup', '清理测试目录')
  .action(async (options) => {
    try {
      if (options.cleanup) {
        await cleanupTestDir();
        console.log(chalk.green('✅ 测试目录已清理'));
        return;
      }

      const selfCheckResult = await runSelfCheck();
      
      if (options.run) {
        console.log(chalk.cyan('🚀 自动运行边界检查...'));
        console.log('');
        
        const originalCwd = process.cwd();
        process.chdir(selfCheckResult.testDir);
        
        try {
          const result = await runAnalysis({});
          if (result.reports.terminal) {
            console.log(result.reports.terminal);
          }
        } finally {
          process.chdir(originalCwd);
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ 自检失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('初始化配置文件')
  .action(() => {
    const defaultConfig = {
      packages: ['packages/*', 'apps/*'],
      rules: {
        '@myorg/app-*': {
          allow: ['@myorg/*'],
        },
        '@myorg/*': {
          allow: ['@myorg/*'],
          deny: ['@myorg/app-*'],
        },
      },
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
      output: {
        dir: './monobound-reports',
        formats: ['terminal', 'json', 'html'],
      },
    };

    console.log(JSON.stringify(defaultConfig, null, 2));
    console.log('');
    console.log(chalk.cyan('💡 将上述内容保存到 .monoboundrc.json 文件中'));
  });

program.parse();
