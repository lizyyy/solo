#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { processOrders } from './processor.js';
import { generateReports } from './reporter.js';
import { validateInputFiles } from './validator.js';
import { loadConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
  .name('order-split')
  .description('社群订单分账CLI工具')
  .version('1.0.0')
  .option('-o, --orders <path>', '订单数据文件路径 (CSV/JSON)', './data/orders.csv')
  .option('-l, --leaders <path>', '团长数据文件路径 (CSV/JSON)', './data/leaders.csv')
  .option('-r, --refunds <path>', '退款数据文件路径 (CSV/JSON)', './data/refunds.csv')
  .option('-c, --commission <path>', '佣金配置文件路径 (JSON)', './data/commission.json')
  .option('-O, --output <dir>', '输出目录', './output')
  .option('--append', '追加模式：不覆盖已有报告，追加新数据')
  .option('--force', '强制模式：覆盖已有报告文件')
  .option('--format <formats>', '输出格式，逗号分隔: terminal,json,csv,report', 'terminal,json,csv,report')
  .option('--quiet', '静默模式，仅输出错误和关键信息')
  .action(async (options) => {
    try {
      const config = loadConfig(options);
      
      if (!config.quiet) {
        console.log(chalk.blue('\n╔════════════════════════════════════════╗'));
        console.log(chalk.blue('║       社群订单分账 CLI 工具 v1.0       ║'));
        console.log(chalk.blue('╚════════════════════════════════════════╝\n'));
      }

      const absolutePaths = {
        orders: resolve(config.orders),
        leaders: resolve(config.leaders),
        refunds: resolve(config.refunds),
        commission: resolve(config.commission),
        output: resolve(config.output)
      };

      if (!config.quiet) {
        console.log(chalk.gray('输入文件路径：'));
        console.log(chalk.gray(`  订单: ${absolutePaths.orders}`));
        console.log(chalk.gray(`  团长: ${absolutePaths.leaders}`));
        console.log(chalk.gray(`  退款: ${absolutePaths.refunds}`));
        console.log(chalk.gray(`  佣金: ${absolutePaths.commission}`));
        console.log(chalk.gray(`  输出: ${absolutePaths.output}\n`));
      }

      if (!fs.existsSync(absolutePaths.output)) {
        fs.mkdirSync(absolutePaths.output, { recursive: true });
        if (!config.quiet) {
          console.log(chalk.yellow(`创建输出目录: ${absolutePaths.output}`));
        }
      }

      if (!config.quiet) {
        console.log(chalk.cyan('正在校验输入文件...'));
      }
      
      const validation = validateInputFiles(absolutePaths);
      
      if (!validation.valid) {
        console.error(chalk.red('\n✗ 输入文件校验失败：'));
        validation.errors.forEach(err => {
          console.error(chalk.red(`  • ${err}`));
        });
        process.exit(1);
      }

      if (!config.quiet) {
        console.log(chalk.green('✓ 输入文件校验通过\n'));
        console.log(chalk.cyan('正在处理分账数据...'));
      }

      const result = await processOrders(absolutePaths, config);

      if (!config.quiet) {
        console.log(chalk.green('✓ 分账处理完成\n'));
      }

      await generateReports(result, absolutePaths.output, config);

      if (!config.quiet) {
        console.log(chalk.green('\n✓ 所有报告已生成完成！'));
        console.log(chalk.gray(`输出目录: ${absolutePaths.output}\n`));
      }

    } catch (error) {
      console.error(chalk.red('\n✗ 程序执行出错：'));
      console.error(chalk.red(`  ${error.message}`));
      if (program.opts().debug) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program.parse();
