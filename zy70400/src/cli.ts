import { Command } from 'commander';
import chalk from 'chalk';
import { queryCommand, listBatches } from './commands/query';
import { previewBatchProcess, executeBatchProcess, correctRecord } from './commands/batch';
import { exportRecords, showRecordDetail } from './commands/export';

const program = new Command();

program
  .name('rsa')
  .description('返回样本归档命令行工具')
  .version('1.0.0');

program
  .command('query')
  .description('查询记录（支持按批次、状态、关键词等过滤）')
  .option('-b, --batch <batchId>', '批次号')
  .option('-s, --status <status>', '状态: success/abnormal/pending/manually_corrected')
  .option('-a, --abnormal <type>', '异常类型: field_truncated/data_missing/format_error/duplicate')
  .option('--start <date>', '开始日期 (ISO格式)')
  .option('--end <date>', '结束日期 (ISO格式)')
  .option('-k, --keyword <keyword>', '关键词搜索')
  .action((options) => {
    queryCommand(options);
  });

program
  .command('batches')
  .description('列出所有批次')
  .action(() => {
    listBatches();
  });

program
  .command('preview <batchId>')
  .description('预览批量处理')
  .action(async (batchId) => {
    await previewBatchProcess(batchId);
  });

program
  .command('process <batchId>')
  .description('执行批量处理（含确认步骤）')
  .action(async (batchId) => {
    await executeBatchProcess(batchId);
  });

program
  .command('correct <recordId>')
  .description('人工修正记录')
  .action(async (recordId) => {
    await correctRecord(recordId);
  });

program
  .command('export')
  .description('导出记录')
  .option('-b, --batch <batchId>', '批次号')
  .option('-f, --format <format>', '导出格式: json/csv (默认: json)')
  .option('--abnormal-only', '仅导出异常记录')
  .action((options) => {
    exportRecords(options);
  });

program
  .command('detail <recordId>')
  .description('查看记录详情')
  .action((recordId) => {
    showRecordDetail(recordId);
  });

program
  .command('seed')
  .description('生成测试数据')
  .action(() => {
    require('./seed-data');
  });

program
  .command('test')
  .description('运行自检脚本')
  .action(() => {
    require('./self-test');
  });

console.log(chalk.blue.bold('\n╔══════════════════════════════════════╗'));
console.log(chalk.blue.bold('║     返回样本归档命令行工具 (RSA)     ║'));
console.log(chalk.blue.bold('╚══════════════════════════════════════╝\n'));

program.parseAsync(process.argv).catch(err => {
  console.error(chalk.red('执行出错:'), err);
  process.exit(1);
});
