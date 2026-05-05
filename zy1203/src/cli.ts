#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import initCommand from './commands/init';
import simulateCommand from './commands/simulate';
import analyzeCommand from './commands/analyze';
import exportCommand from './commands/export';

const program = new Command();

program
  .name('mq-stress')
  .description('本地消息队列压测复盘 CLI - 演练削峰填谷和消费故障')
  .version('1.0.0');

program
  .command('init')
  .description('初始化项目，生成样例配置文件')
  .option('--seed <seed>', '随机种子值')
  .action(async (options) => {
    try {
      await initCommand(options);
      console.log(chalk.green('\n✓ 初始化完成！'));
      console.log(chalk.gray('  使用 mq-stress simulate 开始模拟'));
    } catch (error) {
      console.error(chalk.red('\n✗ 初始化失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('simulate')
  .description('运行消息队列模拟')
  .option('-p, --plan <file>', '队列计划配置文件', 'queue-plan.yaml')
  .option('--producers <file>', '生产者配置文件', 'producers.jsonl')
  .option('--consumers <file>', '消费者配置文件', 'consumers.yaml')
  .option('--seed <seed>', '随机种子值')
  .option('--db <file>', 'SQLite 数据库文件', 'mq-stress.db')
  .action(async (options) => {
    try {
      const result = await simulateCommand(options);
      console.log(chalk.green(`\n✓ 模拟完成！运行ID: ${result.runId}`));
      console.log(chalk.gray('  使用 mq-stress analyze 分析结果'));
    } catch (error) {
      console.error(chalk.red('\n✗ 模拟失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('分析模拟结果')
  .option('--run-id <id>', '指定运行ID（默认使用最近一次）')
  .option('--db <file>', 'SQLite 数据库文件', 'mq-stress.db')
  .action(async (options) => {
    try {
      await analyzeCommand(options);
    } catch (error) {
      console.error(chalk.red('\n✗ 分析失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出模拟报告')
  .option('--run-id <id>', '指定运行ID（默认使用最近一次）')
  .option('--db <file>', 'SQLite 数据库文件', 'mq-stress.db')
  .option('--format <type>', '输出格式: markdown|json', 'markdown')
  .option('-o, --output <file>', '输出文件路径')
  .action(async (options) => {
    try {
      const outputPath = await exportCommand(options);
      console.log(chalk.green(`\n✓ 导出完成！文件: ${outputPath}`));
    } catch (error) {
      console.error(chalk.red('\n✗ 导出失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);
