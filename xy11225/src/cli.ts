import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { storage } from './storage';
import { ruleEngine } from './rules';
import { FaultType, RecordStatus, FilterOptions, ProcessingResult } from './types';
import { exportReport } from './exporter';

const program = new Command();

program
  .name('bso')
  .description('换电运营值班员台账管理CLI工具')
  .version('1.0.0');

program
  .command('stats')
  .description('查看系统统计信息')
  .action(() => {
    const stats = storage.getStatistics();
    console.log(chalk.bold('\n📊 系统统计信息'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`总记录数: ${chalk.cyan(stats.totalRecords)}`);
    console.log(`待处理记录: ${chalk.yellow(stats.pendingRecords)}`);
    console.log(`已解决记录: ${chalk.green(stats.resolvedRecords)}`);
    console.log(`离线柜子数: ${chalk.red(stats.offlineCabinets)}`);
    console.log(`批量操作数: ${chalk.magenta(stats.totalBatches)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });

program
  .command('add')
  .description('添加故障记录')
  .requiredOption('-c, --cabinet <id>', '柜子ID')
  .requiredOption('-t, --type <type>', `故障类型: ${Object.values(FaultType).join(' | ')}`)
  .requiredOption('-d, --desc <description>', '故障描述')
  .requiredOption('-r, --reporter <name>', '上报人')
  .option('-h, --handler <name>', '处理人')
  .action((options) => {
    if (!Object.values(FaultType).includes(options.type)) {
      console.log(chalk.red(`❌ 无效的故障类型。可选值: ${Object.values(FaultType).join(', ')}`));
      return;
    }

    const record = storage.addRecord({
      cabinetId: options.cabinet,
      faultType: options.type,
      description: options.desc,
      reporter: options.reporter,
      handler: options.handler,
      status: RecordStatus.PENDING,
      isOffline: storage.isCabinetOffline(options.cabinet)
    });

    const result = ruleEngine.processRecord(record);

    console.log(chalk.bold('\n📝 处理结果'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`记录ID: ${chalk.cyan(result.record.id.slice(0, 8))}`);
    console.log(`柜子: ${chalk.cyan(result.record.cabinetId)}`);
    console.log(`故障类型: ${chalk.yellow(result.record.faultType)}`);
    console.log(`处理结果: ${result.overallResult === ProcessingResult.ALLOWED ? chalk.green(result.overallResult) : chalk.red(result.overallResult)}`);
    console.log(`原因: ${chalk.gray(result.reason)}`);
    if (result.mergedTo) {
      console.log(`合并到: ${chalk.magenta(result.mergedTo.slice(0, 8))}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });

program
  .command('list')
  .description('列出故障记录')
  .option('-h, --handler <name>', '按处理人筛选')
  .option('-c, --cabinet <id>', '按柜子ID筛选')
  .option('-s, --status <status>', `按状态筛选: ${Object.values(RecordStatus).join(' | ')}`)
  .option('-t, --type <type>', `按故障类型筛选: ${Object.values(FaultType).join(' | ')}`)
  .option('--start <date>', '开始日期 (YYYY-MM-DD)')
  .option('--end <date>', '结束日期 (YYYY-MM-DD)')
  .option('-l, --limit <number>', '显示数量限制', '20')
  .action((options) => {
    const filter: FilterOptions = {};
    if (options.handler) filter.handler = options.handler;
    if (options.cabinet) filter.cabinetId = options.cabinet;
    if (options.status) filter.status = options.status;
    if (options.type) filter.faultType = options.type;
    if (options.start) filter.startDate = options.start;
    if (options.end) filter.endDate = options.end;

    let records = storage.getRecords(filter);
    const limit = parseInt(options.limit);
    if (limit > 0 && records.length > limit) {
      records = records.slice(0, limit);
    }

    const table = new Table({
      head: ['ID', '柜子', '故障类型', '状态', '上报人', '处理人', '处理结果', '创建时间'],
      colWidths: [12, 10, 14, 10, 10, 10, 10, 20]
    });

    records.forEach(r => {
      const resultColor = r.processingResult === ProcessingResult.ALLOWED ? chalk.green : chalk.red;
      table.push([
        r.id.slice(0, 8),
        r.cabinetId,
        r.faultType,
        r.status,
        r.reporter,
        r.handler || '-',
        r.processingResult ? resultColor(r.processingResult) : '-',
        new Date(r.createdAt).toLocaleString('zh-CN')
      ]);
    });

    console.log(chalk.bold(`\n📋 故障记录列表 (共 ${storage.getRecords(filter).length} 条)`));
    console.log(table.toString());
    console.log();
  });

program
  .command('view <id>')
  .description('查看记录详情')
  .action((id) => {
    const record = storage.getRecord(id);
    if (!record) {
      console.log(chalk.red(`❌ 未找到记录: ${id}`));
      return;
    }

    console.log(chalk.bold('\n📋 记录详情'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`记录ID: ${chalk.cyan(record.id)}`);
    console.log(`柜子ID: ${chalk.cyan(record.cabinetId)}`);
    console.log(`故障类型: ${chalk.yellow(record.faultType)}`);
    console.log(`故障描述: ${chalk.gray(record.description)}`);
    console.log(`上报人: ${chalk.magenta(record.reporter)}`);
    console.log(`处理人: ${chalk.magenta(record.handler || '-')}`);
    console.log(`状态: ${chalk.blue(record.status)}`);
    console.log(`柜子状态: ${record.isOffline ? chalk.red('离线') : chalk.green('在线')}`);
    console.log(`处理结果: ${record.processingResult ? (record.processingResult === ProcessingResult.ALLOWED ? chalk.green(record.processingResult) : chalk.red(record.processingResult)) : '-'}`);
    console.log(`处理原因: ${chalk.gray(record.processingReason || '-')}`);
    console.log(`创建时间: ${new Date(record.createdAt).toLocaleString('zh-CN')}`);
    console.log(`更新时间: ${new Date(record.updatedAt).toLocaleString('zh-CN')}`);
    if (record.mergedFrom && record.mergedFrom.length > 0) {
      console.log(`合并自: ${chalk.magenta(record.mergedFrom.map(id => id.slice(0, 8)).join(', '))}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });

program
  .command('resolve <id>')
  .description('标记记录为已解决')
  .requiredOption('-h, --handler <name>', '处理人')
  .action((id, options) => {
    const record = storage.getRecord(id);
    if (!record) {
      console.log(chalk.red(`❌ 未找到记录: ${id}`));
      return;
    }

    const updated = storage.updateRecord(id, {
      status: RecordStatus.RESOLVED,
      handler: options.handler,
      resolvedAt: new Date().toISOString()
    });

    if (updated) {
      console.log(chalk.green(`✅ 记录 ${id.slice(0, 8)} 已标记为已解决`));
    }
  });

program
  .command('cabinet')
  .description('柜子管理')
  .command('offline <id>')
  .description('标记柜子为离线')
  .action((id) => {
    storage.setCabinetOffline(id, true);
    console.log(chalk.red(`🔴 柜子 ${id} 已标记为离线`));
  });

program
  .command('cabinet')
  .command('online <id>')
  .description('标记柜子为在线')
  .action((id) => {
    storage.setCabinetOffline(id, false);
    console.log(chalk.green(`🟢 柜子 ${id} 已标记为在线`));
  });

program
  .command('import')
  .description('批量导入JSON文件')
  .requiredOption('-f, --file <path>', 'JSON文件路径')
  .option('--retry <batchId>', '重试失败的记录')
  .action(async (options) => {
    const { batchImport, retryFailed } = await import('./batch');
    
    if (options.retry) {
      const result = retryFailed(options.retry);
      printBatchResult(result);
    } else {
      const result = batchImport(options.file);
      printBatchResult(result);
    }
  });

function printBatchResult(result: any): void {
    console.log(chalk.bold('\n📦 批量操作结果'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`批次ID: ${chalk.cyan(result.batchId.slice(0, 8))}`);
    console.log(`总数: ${chalk.gray(result.total)}`);
    console.log(`成功: ${chalk.green(result.successCount)}`);
    console.log(`失败: ${chalk.red(result.failureCount)}`);
    
    if (result.successes.length > 0) {
      console.log(`成功记录: ${chalk.green(result.successes.map((id: string) => id.slice(0, 8)).join(', '))}`);
    }
    
    if (result.failures.length > 0) {
      console.log('\n失败详情:');
      result.failures.forEach((f: any, i: number) => {
        console.log(`  ${i + 1}. ${f.recordId ? `记录 ${f.recordId.slice(0, 8)}: ` : ''}${chalk.red(f.error)}`);
      });
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

program
  .command('export')
  .description('导出报告')
  .requiredOption('-f, --file <path>', '输出文件路径 (CSV)')
  .option('-h, --handler <name>', '按处理人筛选')
  .option('-c, --cabinet <id>', '按柜子ID筛选')
  .option('-s, --status <status>', `按状态筛选: ${Object.values(RecordStatus).join(' | ')}`)
  .option('-t, --type <type>', `按故障类型筛选: ${Object.values(FaultType).join(' | ')}`)
  .option('--start <date>', '开始日期 (YYYY-MM-DD)')
  .option('--end <date>', '结束日期 (YYYY-MM-DD)')
  .action(async (options) => {
    const filter: FilterOptions = {};
    if (options.handler) filter.handler = options.handler;
    if (options.cabinet) filter.cabinetId = options.cabinet;
    if (options.status) filter.status = options.status;
    if (options.type) filter.faultType = options.type;
    if (options.start) filter.startDate = options.start;
    if (options.end) filter.endDate = options.end;

    const records = storage.getRecords(filter);
    await exportReport(records, options.file);
    
    console.log(chalk.green(`✅ 报告已导出到 ${options.file} (共 ${records.length} 条记录)`));
  });

program
  .command('batch <id>')
  .description('查看批量操作结果')
  .action((id) => {
    const batch = storage.getBatchResult(id);
    if (!batch) {
      console.log(chalk.red(`❌ 未找到批次: ${id}`));
      return;
    }
    printBatchResult(batch);
  });

export function runCLI(): void {
  program.parse();
}
