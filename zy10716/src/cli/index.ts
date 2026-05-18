#!/usr/bin/env node

import { Command } from 'commander';
import { ReconciliationService } from '../services/reconciliationService';
import * as path from 'path';

const program = new Command();

program
  .name('reconcile')
  .description('权益兑换流水兑换码冲正核对 CLI')
  .version('1.0.0')
  .requiredOption('-i, --input <dir>', '输入目录（包含权益兑换流水CSV文件）')
  .requiredOption('-o, --output <dir>', '输出目录（存放核对结果）')
  .option('-v, --verbose', '详细模式，显示每条记录的处理过程')
  .option('-f, --force', '强制覆盖已有结果文件，不进行幂等性检查')
  .action(async (options) => {
    try {
      const service = new ReconciliationService();
      service.setVerbose(options.verbose || false);

      const inputDir = path.resolve(options.input);
      const outputDir = path.resolve(options.output);

      console.log('权益兑换流水兑换码冲正核对 CLI 启动');
      console.log(`输入目录: ${inputDir}`);
      console.log(`输出目录: ${outputDir}`);
      console.log();

      const transactions = await service.readTransactionsFromDirectory(inputDir);

      if (transactions.length === 0) {
        console.log('未找到任何兑换流水记录，请检查输入目录。');
        process.exit(0);
      }

      const { results, summary } = service.reconcile(transactions);

      const outputFiles = await service.writeResults(results, summary, outputDir, options.force);

      service.printSummary(summary);

      console.log('输出文件:');
      console.log(`  冲正核对结果: ${outputFiles.resultFile}`);
      console.log(`  核对摘要: ${outputFiles.summaryFile}`);
      console.log(`  处理日志: ${outputFiles.logFile}`);
      console.log();

    } catch (error) {
      console.error('处理失败:', error);
      process.exit(1);
    }
  });

program.parse();
