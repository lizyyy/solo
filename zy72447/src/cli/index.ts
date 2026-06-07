#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { defaultStore, ReconciliationStore } from '../store';
import { importGroupSignupFile } from '../importers/group-signup';
import { importContractFile } from '../importers/contract-screenshot';
import { runReconciliation, confirmResult, rejectResult, rollbackResult } from '../core/reconciliation';
import { exportResultsToExcel, exportAuditLogToExcel } from '../exporters';
import * as path from 'path';

const program = new Command();

program
  .name('amdc')
  .description('音频母带交付核对系统')
  .version('1.0.0');

program
  .command('import-group')
  .description('导入排练群接龙文件')
  .argument('<file>', '接龙文件路径 (CSV/XLSX/TXT)')
  .option('-o, --operator <name>', '操作人', 'system')
  .option('-d, --data <file>', '数据文件路径')
  .action((file, options) => {
    try {
      const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
      const result = importGroupSignupFile(store, path.resolve(file), options.operator);
      console.log(chalk.green(`✓ 导入成功`));
      console.log(`  批次ID: ${chalk.cyan(result.batchId)}`);
      console.log(`  记录数: ${chalk.cyan(result.recordCount)}`);
    } catch (e: any) {
      console.error(chalk.red(`✗ 导入失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('import-contract')
  .description('导入合同页截图提取文件')
  .argument('<file>', '合同文件路径 (CSV/XLSX/TXT)')
  .option('-o, --operator <name>', '操作人', 'system')
  .option('-l, --late', '晚到材料，仅刷新相关明细')
  .option('-d, --data <file>', '数据文件路径')
  .action((file, options) => {
    try {
      const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
      const result = importContractFile(store, path.resolve(file), options.operator, options.late);
      console.log(chalk.green(`✓ 导入成功${options.late ? ' (晚到材料模式)' : ''}`));
      console.log(`  批次ID: ${chalk.cyan(result.batchId)}`);
      console.log(`  记录数: ${chalk.cyan(result.recordCount)}`);
      if (options.late) {
        console.log(chalk.yellow(`  提示: 请运行 amdc reconcile --late ${result.batchId} 进行增量核对`));
      }
    } catch (e: any) {
      console.error(chalk.red(`✗ 导入失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('reconcile')
  .description('执行核对')
  .option('-o, --operator <name>', '操作人', 'system')
  .option('-l, --late <batchId>', '晚到合同批次ID，仅增量核对')
  .option('-f, --force', '不保留已确认内容，全量重新核对')
  .option('-d, --data <file>', '数据文件路径')
  .action((options) => {
    try {
      const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
      const result = runReconciliation(store, options.operator, {
        lateContractBatchId: options.late,
        preserveConfirmed: !options.force
      });
      console.log(chalk.green(`✓ 核对完成`));
      console.log(`  新增: ${chalk.cyan(result.created)}`);
      console.log(`  更新: ${chalk.cyan(result.updated)}`);
      console.log(`  跳过(已确认): ${chalk.cyan(result.skipped)}`);
    } catch (e: any) {
      console.error(chalk.red(`✗ 核对失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('confirm')
  .description('确认一条核对结果')
  .argument('<resultId>', '结果ID')
  .option('-o, --operator <name>', '操作人', 'system')
  .option('-n, --notes <text>', '复核备注')
  .option('-d, --data <file>', '数据文件路径')
  .action((resultId, options) => {
    try {
      const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
      const result = confirmResult(store, resultId, options.operator, options.notes);
      if (!result) {
        console.error(chalk.red(`✗ 未找到结果: ${resultId}`));
        process.exit(1);
      }
      console.log(chalk.green(`✓ 已确认`));
      console.log(`  表演者: ${chalk.cyan(result.matchedPerformerName)}`);
      console.log(`  曲目: ${chalk.cyan(result.matchedSongName)}`);
    } catch (e: any) {
      console.error(chalk.red(`✗ 确认失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('reject')
  .description('驳回一条核对结果')
  .argument('<resultId>', '结果ID')
  .option('-o, --operator <name>', '操作人', 'system')
  .option('-n, --notes <text>', '驳回原因')
  .option('-d, --data <file>', '数据文件路径')
  .action((resultId, options) => {
    try {
      const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
      const result = rejectResult(store, resultId, options.operator, options.notes);
      if (!result) {
        console.error(chalk.red(`✗ 未找到结果: ${resultId}`));
        process.exit(1);
      }
      console.log(chalk.green(`✓ 已驳回`));
      console.log(`  表演者: ${chalk.cyan(result.matchedPerformerName)}`);
      console.log(`  曲目: ${chalk.cyan(result.matchedSongName)}`);
    } catch (e: any) {
      console.error(chalk.red(`✗ 驳回失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('rollback')
  .description('回滚一条核对结果（取消确认/驳回）')
  .argument('<resultId>', '结果ID')
  .option('-o, --operator <name>', '操作人', 'system')
  .option('-r, --reason <text>', '回滚原因')
  .option('-d, --data <file>', '数据文件路径')
  .action((resultId, options) => {
    try {
      const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
      const result = rollbackResult(store, resultId, options.operator, options.reason);
      if (!result) {
        console.error(chalk.red(`✗ 未找到结果: ${resultId}`));
        process.exit(1);
      }
      console.log(chalk.green(`✓ 已回滚`));
      console.log(`  当前状态: ${chalk.cyan(result.status)}`);
    } catch (e: any) {
      console.error(chalk.red(`✗ 回滚失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出核对明细')
  .argument('<output>', '输出文件路径 (.xlsx)')
  .option('-d, --data <file>', '数据文件路径')
  .action((output, options) => {
    try {
      const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
      const outPath = path.resolve(output);
      exportResultsToExcel(store, outPath);
      console.log(chalk.green(`✓ 导出成功`));
      console.log(`  文件: ${chalk.cyan(outPath)}`);
    } catch (e: any) {
      console.error(chalk.red(`✗ 导出失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('export-log')
  .description('导出操作日志（复盘用）')
  .argument('<output>', '输出文件路径 (.xlsx)')
  .option('-d, --data <file>', '数据文件路径')
  .action((output, options) => {
    try {
      const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
      const outPath = path.resolve(output);
      exportAuditLogToExcel(store, outPath);
      console.log(chalk.green(`✓ 日志导出成功`));
      console.log(`  文件: ${chalk.cyan(outPath)}`);
    } catch (e: any) {
      console.error(chalk.red(`✗ 导出失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('查看当前状态统计')
  .option('-d, --data <file>', '数据文件路径')
  .action((options) => {
    const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
    const state = store.getState();
    console.log(chalk.bold('当前状态'));
    console.log(`  接龙记录: ${chalk.cyan(state.groupRecords.length)}`);
    console.log(`  合同记录: ${chalk.cyan(state.contractRecords.length)}`);
    console.log(`  核对结果: ${chalk.cyan(state.results.length)}`);
    console.log(`  操作日志: ${chalk.cyan(state.logs.length)}`);
    console.log(`  导入批次: ${chalk.cyan(state.batches.length)}`);
    console.log(`  最后更新: ${chalk.gray(state.lastUpdated)}`);

    const byStatus = state.results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log();
    console.log(chalk.bold('按状态统计'));
    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`  ${status}: ${chalk.cyan(count)}`);
    }
  });

program
  .command('list')
  .description('列出核对结果')
  .option('-s, --status <status>', '按状态筛选')
  .option('-d, --data <file>', '数据文件路径')
  .action((options) => {
    const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
    const details = store.getResultsWithDetails();
    const filtered = options.status
      ? details.filter((d) => d.result.status === options.status)
      : details;

    console.log(chalk.bold(`核对结果 (${filtered.length} 条)`));
    console.log();
    for (const { result, groupRecord, contractRecord } of filtered) {
      const statusColor =
        result.status === 'confirmed'
          ? chalk.green
          : result.status === 'needs_review'
          ? chalk.yellow
          : result.status === 'rejected'
          ? chalk.red
          : chalk.gray;

      console.log(
        `${statusColor(result.id)}  ${statusColor(`[${result.status}]`).padEnd(20)} ${chalk.bold(
          result.matchedPerformerName || '(未知)'
        )} - ${result.matchedSongName || '(未知)'}`
      );
      if (result.reviewReasons.length > 0) {
        console.log(`  原因: ${chalk.yellow(result.reviewReasons.join(', '))}`);
      }
      if (groupRecord) {
        console.log(`  接龙行 #${groupRecord.originalRowNumber}: ${chalk.gray(groupRecord.rawContent.substring(0, 50))}`);
      }
      if (contractRecord) {
        console.log(`  合同: ${chalk.gray(contractRecord.rawContent.substring(0, 50))}`);
      }
      console.log();
    }
  });

program
  .command('reset')
  .description('重置所有数据（危险操作）')
  .option('-o, --operator <name>', '操作人', 'system')
  .option('-f, --force', '确认执行')
  .option('-d, --data <file>', '数据文件路径')
  .action((options) => {
    if (!options.force) {
      console.error(chalk.red('✗ 此操作会删除所有数据，请加 --force 确认'));
      process.exit(1);
    }
    const store = options.data ? new ReconciliationStore(path.resolve(options.data)) : defaultStore;
    store.resetState(options.operator);
    console.log(chalk.green('✓ 数据已重置'));
  });

program.parse(process.argv);
