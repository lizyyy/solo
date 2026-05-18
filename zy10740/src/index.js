#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { runAudit } = require('./audit');
const { loadRules } = require('./rules');

const program = new Command();

program
  .name('trial-tenant-audit')
  .description('试用租户清单延期审批巡检 CLI - 处理导出文件，生成可复核报告')
  .version('1.0.0');

program
  .requiredOption('-i, --input <path>', '输入目录路径，包含导出的CSV文件')
  .requiredOption('-r, --rules <file>', '规则配置文件路径')
  .requiredOption('-o, --output <dir>', '输出目录路径')
  .option('-d, --dry-run', '试运行模式，不写入输出文件')
  .option('-f, --force', '覆盖已存在的输出文件')
  .action(async (options) => {
    try {
      console.log(chalk.cyan('='.repeat(60)));
      console.log(chalk.cyan.bold('  试用租户清单延期审批巡检 CLI'));
      console.log(chalk.cyan('='.repeat(60)));
      console.log('');

      const inputPath = path.resolve(options.input);
      const rulesPath = path.resolve(options.rules);
      const outputDir = path.resolve(options.output);

      console.log(chalk.blue('配置信息:'));
      console.log(`  输入目录: ${inputPath}`);
      console.log(`  规则文件: ${rulesPath}`);
      console.log(`  输出目录: ${outputDir}`);
      console.log(`  试运行: ${options.dryRun ? '是' : '否'}`);
      console.log(`  覆盖模式: ${options.force ? '是' : '否'}`);
      console.log('');

      if (!await fs.pathExists(inputPath)) {
        console.error(chalk.red(`错误: 输入目录不存在: ${inputPath}`));
        process.exit(1);
      }

      if (!await fs.pathExists(rulesPath)) {
        console.error(chalk.red(`错误: 规则文件不存在: ${rulesPath}`));
        process.exit(1);
      }

      const outputExists = await fs.pathExists(outputDir);
      if (outputExists && !options.force && !options.dryRun) {
        console.error(chalk.red(`错误: 输出目录已存在，使用 -f 或 --force 覆盖: ${outputDir}`));
        process.exit(1);
      }

      const rules = await loadRules(rulesPath);
      console.log(chalk.green('✓ 规则配置加载成功'));
      console.log('');

      await runAudit(inputPath, rules, outputDir, {
        dryRun: options.dryRun,
        force: options.force
      });

      console.log('');
      console.log(chalk.green.bold('✓ 巡检完成!'));
      console.log(chalk.cyan('='.repeat(60)));

    } catch (error) {
      console.error(chalk.red(`执行失败: ${error.message}`));
      console.error(error.stack);
      process.exit(1);
    }
  });

program.parse(process.argv);
