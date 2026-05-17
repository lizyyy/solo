#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { FeatureFlagScanner } from './core/scanner';

const program = new Command();

program
  .name('ff-scan')
  .description('Feature Flag 死分支扫描工具 - 检测并清理功能开关下线后残留的死代码')
  .version('1.0.0');

program
  .command('scan')
  .description('扫描源码目录中的 Feature Flag 死分支')
  .requiredOption('-s, --source <dir>', '源码目录路径')
  .option('-f, --flags <file>', 'Feature Flag 清单文件 (JSON/CSV)')
  .option('-o, --output <dir>', '报告输出目录 (默认: ./reports)', './reports')
  .option('--patterns <patterns>', '文件匹配模式 (分号分隔)', '**/*.js;**/*.ts;**/*.jsx;**/*.tsx;**/*.py;**/*.java;**/*.go')
  .option('--exclude <patterns>', '排除目录模式 (分号分隔)', '**/node_modules/**;**/dist/**;**/build/**')
  .option('--html', '生成 HTML 格式报告')
  .option('--no-markdown', '不生成 Markdown 格式报告')
  .action(async (options) => {
    try {
      const filePatterns = options.patterns.split(';').map((p: string) => p.trim());
      const excludePatterns = options.exclude.split(';').map((p: string) => p.trim());

      const scanner = new FeatureFlagScanner();
      
      await scanner.scan({
        sourceDir: options.source,
        flagsFile: options.flags,
        outputDir: options.output,
        filePatterns,
        excludePatterns,
        generateHtml: options.html,
        generateMarkdown: options.markdown
      });

    } catch (error) {
      console.error('\n' + chalk.bold.red('❌ 扫描失败！'));
      console.error(chalk.red(error instanceof Error ? error.message : '未知错误'));
      
      if (error instanceof Error && error.stack) {
        console.error(chalk.gray('\n详细错误信息:\n' + error.stack));
      }
      
      process.exit(1);
    }
  });

program
  .command('init')
  .description('创建示例配置文件和开关清单')
  .action(() => {
    console.log(chalk.cyan('\n📦 Feature Flag 死分支扫描工具 - 初始化向导\n'));
    console.log(chalk.yellow('创建示例配置文件...'));
    console.log(chalk.gray('\n请手动创建以下文件:'));
    console.log(chalk.gray('\n1. feature-flags.json - Feature Flag 清单示例:'));
    console.log(chalk.white(`
[
  {
    "name": "FEATURE_NEW_CHECKOUT",
    "defaultValue": true,
    "description": "新结账流程开关"
  },
  {
    "name": "FEATURE_DARK_MODE",
    "defaultValue": false,
    "description": "深色模式开关"
  }
]
`));
    console.log(chalk.gray('\n2. 运行扫描命令示例:'));
    console.log(chalk.white('  ff-scan scan -s ./src -f feature-flags.json --html\n'));
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.bold.red('\n❌ 命令执行失败！'));
  console.error(chalk.red(error.message));
  process.exit(1);
});
