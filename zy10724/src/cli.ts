#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { FileReader } from './file-reader';
import { ReconciliationEngine } from './reconciliation-engine';
import { FileWriter } from './file-writer';

const program = new Command();

program
  .name('spr-reconcile')
  .description('备件返厂记录维修件状态对账 CLI 工具')
  .version('1.0.0')
  .requiredOption('--return-file <path>', '返厂单 CSV 文件路径')
  .requiredOption('--inventory-file <path>', '库存表 CSV 文件路径')
  .requiredOption('--inspection-file <path>', '检测结果 CSV 文件路径')
  .requiredOption('-o, --output <path>', '对账结果输出 CSV 文件路径')
  .option('-v, --verbose', '显示详细处理日志')
  .action(async (options) => {
    try {
      console.log(chalk.bold.blue('========================================'));
      console.log(chalk.bold.blue('    备件返厂记录维修件状态对账工具'));
      console.log(chalk.bold.blue('========================================'));
      console.log('');

      console.log(chalk.cyan('📂 正在读取数据文件...'));
      const returnOrders = await FileReader.readReturnOrders(options.returnFile);
      const inventoryItems = await FileReader.readInventory(options.inventoryFile);
      const inspectionResults = await FileReader.readInspectionResults(options.inspectionFile);

      console.log(chalk.green(`✅ 返厂单: ${returnOrders.length} 条记录`));
      console.log(chalk.green(`✅ 库存表: ${inventoryItems.length} 条记录`));
      console.log(chalk.green(`✅ 检测结果: ${inspectionResults.length} 条记录`));
      console.log('');

      console.log(chalk.cyan('🔍 正在执行对账逻辑...'));
      const engine = new ReconciliationEngine(returnOrders, inventoryItems, inspectionResults);
      const result = engine.reconcile();
      console.log('');

      if (options.verbose) {
        console.log(chalk.magenta('📝 详细处理日志:'));
        for (const log of result.detailedLogs) {
          console.log(log);
        }
        console.log('');
      }

      console.log(chalk.cyan('💾 正在导出对账结果...'));
      await FileWriter.writeReconciliationResult(result, options.output);
      console.log(chalk.green(`✅ 对账结果已导出到: ${options.output}`));
      console.log(chalk.green(`✅ 对账摘要已导出到: ${options.output.replace('.csv', '_摘要.txt')}`));
      console.log('');

      console.log(chalk.bold.green('✅ 备件返厂记录维修件状态对账完成!'));
      console.log('');
      console.log(chalk.yellow('📊 对账摘要:'));
      console.log(`   总记录数: ${result.summary.totalRecords}`);
      console.log(`   正常记录: ${result.summary.normalCount} ${chalk.green('✓')}`);
      console.log(`   异常记录: ${result.summary.abnormalCount} ${chalk.red('✗')}`);
      console.log('');
      console.log(chalk.yellow('📋 异常分类:'));
      console.log(`   拆件维修: ${result.summary.breakdown.dismantleRepair} 条`);
      console.log(`   检测驳回: ${result.summary.breakdown.inspectionRejected} 条`);
      console.log(`   承运商丢件: ${result.summary.breakdown.carrierLost} 条`);
      console.log(`   状态不一致: ${result.summary.breakdown.statusMismatch} 条`);
      console.log(`   库存缺失: ${result.summary.breakdown.inventoryMissing} 条`);
      console.log(`   检测缺失: ${result.summary.breakdown.inspectionMissing} 条`);
      console.log('');

    } catch (error) {
      console.error(chalk.bold.red('\n❌ 对账过程中发生错误:'));
      console.error(chalk.red((error as Error).message));
      console.error('');
      process.exit(1);
    }
  });

program.parse();
