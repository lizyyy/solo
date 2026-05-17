#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const RegressionEngine = require('../src/engine');
const Reporter = require('../src/reporter');
const SelfTester = require('../src/self-test');

const program = new Command();

program
  .name('regex-regress')
  .description('正则规则回归测试CLI工具')
  .version('1.0.0');

program
  .command('run')
  .description('运行回归测试')
  .requiredOption('-r, --rules <path>', '规则文件路径 (JSON格式)')
  .requiredOption('-s, --samples <path>', '样本目录路径')
  .option('-e, --expected <path>', '预期标签文件路径 (JSON格式)')
  .option('-o, --output <path>', '输出目录路径', './regression-results')
  .option('-v, --verbose', '显示详细输出')
  .action(async (options) => {
    try {
      const engine = new RegressionEngine(options);
      const result = await engine.run();
      
      const reporter = new Reporter(options);
      await reporter.generateAll(result);
      
      console.log(chalk.green('\n✅ 回归测试完成!'));
      console.log(chalk.gray(`结果已输出到: ${path.resolve(options.output)}`));
    } catch (error) {
      console.error(chalk.red('\n❌ 运行失败:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('self-test')
  .description('运行自检，验证工具功能是否正常')
  .option('-v, --verbose', '显示详细输出')
  .action(async (options) => {
    try {
      const tester = new SelfTester(options);
      await tester.run();
      console.log(chalk.green('\n✅ 自检通过! 所有功能正常工作。'));
    } catch (error) {
      console.error(chalk.red('\n❌ 自检失败:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('init')
  .description('初始化示例配置和样本数据')
  .option('-d, --dir <path>', '目标目录', './regex-demo')
  .action(async (options) => {
    try {
      const tester = new SelfTester({});
      await tester.createDemoData(options.dir);
      console.log(chalk.green(`\n✅ 示例数据已创建在: ${path.resolve(options.dir)}`));
      console.log(chalk.gray('\n运行示例:'));
      console.log(chalk.cyan(`  regex-regress run -r ${options.dir}/rules.json -s ${options.dir}/samples -e ${options.dir}/expected.json`));
    } catch (error) {
      console.error(chalk.red('\n❌ 初始化失败:'), error.message);
      process.exit(1);
    }
  });

program.parse();
