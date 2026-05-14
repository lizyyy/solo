import chalk from 'chalk';
import Table from 'cli-table3';
import { Storage } from '../storage';
import { ProcessingStatus, AbnormalType } from '../types';

export function queryCommand(options: any): void {
  const queryOptions: any = {};
  
  if (options.batch) queryOptions.batchId = options.batch;
  if (options.status) queryOptions.status = options.status;
  if (options.abnormal) queryOptions.abnormalType = options.abnormal;
  if (options.start) queryOptions.startDate = options.start;
  if (options.end) queryOptions.endDate = options.end;
  if (options.keyword) queryOptions.keyword = options.keyword;

  const records = Storage.queryRecords(queryOptions);
  const batches = Storage.getAllBatches();
  
  console.log(chalk.blue.bold(`\n查询结果: 共 ${records.length} 条记录\n`));

  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('批次号'),
      chalk.cyan('客户姓名'),
      chalk.cyan('客服'),
      chalk.cyan('状态'),
      chalk.cyan('异常类型'),
      chalk.cyan('摘要')
    ],
    colWidths: [12, 15, 12, 10, 12, 14, 30],
    wordWrap: true
  });

  records.forEach(record => {
    const statusColor = record.status === ProcessingStatus.SUCCESS ? chalk.green :
                        record.status === ProcessingStatus.ABNORMAL ? chalk.red :
                        record.status === ProcessingStatus.MANUALLY_CORRECTED ? chalk.yellow :
                        chalk.gray;

    table.push([
      record.id.substring(0, 8),
      record.batchId,
      record.customerName,
      record.agentName,
      statusColor(record.status),
      record.abnormalType ? chalk.magenta(record.abnormalType) : '-',
      record.summary.substring(0, 25) + (record.summary.length > 25 ? '...' : '')
    ]);
  });

  console.log(table.toString());

  const stats = batches.filter(b => queryOptions.batchId ? b.batchId === queryOptions.batchId : true);
  console.log(chalk.blue.bold('\n批次统计:'));
  stats.forEach(batch => {
    console.log(chalk.white(`\n批次 ${chalk.bold(batch.batchId)} (${batch.batchName}):`));
    console.log(`  来源: ${batch.source}`);
    console.log(`  处理依据: ${batch.processingBasis}`);
    console.log(`  总计: ${batch.totalRecords}, 成功: ${chalk.green(batch.successCount)}, 异常: ${chalk.red(batch.abnormalCount)}, 待处理: ${chalk.yellow(batch.pendingCount)}, 已修正: ${chalk.cyan(batch.correctedCount)}`);
  });
}

export function listBatches(): void {
  const batches = Storage.getAllBatches();
  
  console.log(chalk.blue.bold('\n批次列表:\n'));
  
  const table = new Table({
    head: [
      chalk.cyan('批次号'),
      chalk.cyan('批次名称'),
      chalk.cyan('来源'),
      chalk.cyan('总计'),
      chalk.cyan('成功'),
      chalk.cyan('异常'),
      chalk.cyan('待处理'),
      chalk.cyan('已修正')
    ]
  });

  batches.forEach(batch => {
    table.push([
      batch.batchId,
      batch.batchName,
      batch.source,
      batch.totalRecords,
      chalk.green(batch.successCount),
      chalk.red(batch.abnormalCount),
      chalk.yellow(batch.pendingCount),
      chalk.cyan(batch.correctedCount)
    ]);
  });

  console.log(table.toString());
}
