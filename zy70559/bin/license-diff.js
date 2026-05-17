#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const LicenseDiff = require('../src/index.js');

const program = new Command();

program
  .name('license-diff')
  .description('NPM许可证差异CLI工具 - 对比依赖升级后的许可证变化')
  .version('1.0.0');

program
  .command('compare')
  .description('对比两个 lockfile 的许可证差异')
  .argument('<old-lockfile>', '旧的 lockfile 路径')
  .argument('<new-lockfile>', '新的 lockfile 路径')
  .option('-j, --json', '输出 JSON 格式报告')
  .option('-m, --markdown', '输出 Markdown 格式报告')
  .option('-o, --output <path>', '输出文件路径')
  .option('--risk-only', '仅显示有风险的包')
  .option('--show-errors', '显示解析错误详情')
  .action((oldPath, newPath, options) => {
    try {
      const licenseDiff = new LicenseDiff();
      const oldAbsPath = path.resolve(oldPath);
      const newAbsPath = path.resolve(newPath);

      const result = licenseDiff.run(oldAbsPath, newAbsPath, options);

      if (options.output) {
        console.log(chalk.green(`报告已生成: ${options.output}`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ 执行失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('parse')
  .description('解析单个 lockfile 并提取许可证信息')
  .argument('<lockfile>', 'lockfile 路径')
  .option('-j, --json', '输出 JSON 格式')
  .action((filePath, options) => {
    try {
      const licenseDiff = new LicenseDiff();
      const absPath = path.resolve(filePath);
      const result = licenseDiff.parseLockfile(absPath);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.cyan(`解析完成，共找到 ${result.packages.length} 个包`));
        console.log(chalk.gray(`使用 --json 查看详情`));
      }
    } catch (error) {
      console.error(chalk.red('❌ 解析失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('risk-check')
  .description('检查单个 lockfile 的许可证风险')
  .argument('<lockfile>', 'lockfile 路径')
  .action((filePath) => {
    try {
      const licenseDiff = new LicenseDiff();
      const absPath = path.resolve(filePath);
      const lockData = licenseDiff.parseLockfile(absPath);

      const risks = { high: [], medium: [], low: [], unknown: [] };
      lockData.packages.forEach(pkg => {
        if (pkg.normalizedLicense) {
          const risk = pkg.normalizedLicense.risk;
          if (risks[risk]) risks[risk].push(pkg);
        }
      });

      console.log(chalk.cyan('风险统计:\n'));
      console.log(chalk.red(`🔴 高风险: ${risks.high.length}`));
      console.log(chalk.yellow(`🟡 中风险: ${risks.medium.length}`));
      console.log(chalk.green(`🟢 低风险: ${risks.low.length}`));
      console.log(chalk.gray(`⚪ 未知: ${risks.unknown.length}`));

      if (risks.high.length > 0) {
        console.log('\n' + chalk.red('高风险包列表:'));
        risks.high.forEach(pkg => {
          console.log(`  - ${pkg.name}@${pkg.version} (${pkg.license})`);
        });
      }
    } catch (error) {
      console.error(chalk.red('❌ 检查失败:'), error.message);
      process.exit(1);
    }
  });

program.parse();
