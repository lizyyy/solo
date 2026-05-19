import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { importColorCsv } from './importers/csvImporter';
import { importOrderJson } from './importers/jsonImporter';
import { importReworkText } from './importers/textImporter';
import { reviewAll, reviewByBatchId, resolveBadRecord } from './services/reviewService';
import { exportData } from './services/exportService';
import { UserContext } from './models/types';

const program = new Command();

function getUserContext(options: { operator?: string; role?: string }): UserContext {
  return {
    operator: options.operator || '系统管理员',
    role: options.role || '管理员',
  };
}

function printImportResult(successCount: number, failedCount: number) {
  console.log('\n' + chalk.green('✓ 导入完成!'));
  console.log(chalk.blue(`  成功: ${successCount} 条`));
  console.log(chalk.red(`  失败: ${failedCount} 条`));
  if (failedCount > 0) {
    console.log(chalk.yellow('  坏记录已保留，可查看原始位置、失败原因和修改建议'));
  }
}

program
  .name('print-quality')
  .description('印刷车间品控数据管理系统')
  .version('1.0.0');

program
  .command('import:csv')
  .description('导入测色CSV数据')
  .argument('<file>', 'CSV文件路径')
  .option('-o, --operator <name>', '操作人姓名', '系统管理员')
  .option('-r, --role <role>', '角色', '管理员')
  .action(async (file, options) => {
    try {
      const userContext = getUserContext(options);
      const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      
      console.log(chalk.blue(`正在导入测色数据: ${filePath}`));
      
      const result = await importColorCsv(filePath, userContext);
      printImportResult(result.successRecords.length, result.badRecords.length);
    } catch (error) {
      console.error(chalk.red('导入失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('import:json')
  .description('导入订单JSON数据')
  .argument('<file>', 'JSON文件路径')
  .option('-o, --operator <name>', '操作人姓名', '系统管理员')
  .option('-r, --role <role>', '角色', '管理员')
  .action(async (file, options) => {
    try {
      const userContext = getUserContext(options);
      const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      
      console.log(chalk.blue(`正在导入订单数据: ${filePath}`));
      
      const result = await importOrderJson(filePath, userContext);
      printImportResult(result.successRecords.length, result.badRecords.length);
    } catch (error) {
      console.error(chalk.red('导入失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('import:text')
  .description('导入返工备注文本数据')
  .argument('<file>', '文本文件路径')
  .option('-o, --operator <name>', '操作人姓名', '系统管理员')
  .option('-r, --role <role>', '角色', '管理员')
  .action(async (file, options) => {
    try {
      const userContext = getUserContext(options);
      const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      
      console.log(chalk.blue(`正在导入返工数据: ${filePath}`));
      
      const result = await importReworkText(filePath, userContext);
      printImportResult(result.successRecords.length, result.badRecords.length);
    } catch (error) {
      console.error(chalk.red('导入失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('review')
  .description('复核数据')
  .option('-b, --batch <batchId>', '按批次号查询')
  .option('-o, --operator <name>', '操作人姓名', '系统管理员')
  .option('-r, --role <role>', '角色', '管理员')
  .action((options: { batch?: string; operator?: string; role?: string }) => {
    try {
      const userContext = getUserContext(options);
      
      if (options.batch) {
        console.log(chalk.blue(`查询批次: ${options.batch}`));
        const result = reviewByBatchId(options.batch, userContext);
        
        if (result.qualityRecord) {
          console.log('\n' + chalk.green('品控记录:'));
          console.log(`  批次号: ${result.qualityRecord.batchId}`);
          console.log(`  订单号: ${result.qualityRecord.orderId}`);
          console.log(`  Lab值: L=${result.qualityRecord.labValues.L.toFixed(2)}, a=${result.qualityRecord.labValues.a.toFixed(2)}, b=${result.qualityRecord.labValues.b.toFixed(2)}`);
          console.log(`  纸张批次: ${result.qualityRecord.paperBatch}`);
          console.log(`  操作人: ${result.qualityRecord.operator} (${result.qualityRecord.role})`);
          console.log(`  测量时间: ${new Date(result.qualityRecord.measuredAt).toLocaleString()}`);
        } else {
          console.log(chalk.yellow('未找到品控记录'));
        }
        
        if (result.reworkRecords.length > 0) {
          console.log('\n' + chalk.red('返工记录:'));
          result.reworkRecords.forEach((record, index) => {
            console.log(`  ${index + 1}. 返工原因: ${record.reason}`);
            console.log(`     解决方案: ${record.solution}`);
            console.log(`     操作人: ${record.operator} (${record.role})`);
            console.log(`     返工时间: ${new Date(record.reworkedAt).toLocaleString()}`);
          });
        } else {
          console.log(chalk.gray('无返工记录'));
        }
      } else {
        console.log(chalk.blue('复核所有数据'));
        const result = reviewAll(userContext);
        
        console.log('\n' + chalk.green('统计信息:'));
        console.log(`  品控记录总数: ${result.statistics.totalQualityRecords}`);
        console.log(`  返工记录总数: ${result.statistics.totalReworkRecords}`);
        console.log(`  待处理坏记录: ${result.statistics.pendingBadRecords}`);
        console.log(`  已处理坏记录: ${result.statistics.resolvedBadRecords}`);
        
        if (result.badRecords.length > 0) {
          console.log('\n' + chalk.yellow('坏记录列表:'));
          result.badRecords.forEach((record, index) => {
            console.log(`  ${index + 1}. 位置: ${record.originalPosition}`);
            console.log(`     原因: ${record.failureReason}`);
            console.log(`     建议: ${record.suggestions.join('; ')}`);
            console.log(`     状态: ${record.isResolved ? chalk.green('已解决') : chalk.red('待处理')}`);
          });
        }
      }
    } catch (error) {
      console.error(chalk.red('复核失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('resolve')
  .description('标记坏记录为已解决')
  .argument('<id>', '坏记录ID')
  .option('-o, --operator <name>', '操作人姓名', '系统管理员')
  .option('-r, --role <role>', '角色', '管理员')
  .action((id: string, options: { operator?: string; role?: string }) => {
    try {
      const userContext = getUserContext(options);
      const result = resolveBadRecord(id, userContext);
      
      if (result) {
        console.log(chalk.green('✓ 坏记录已标记为已解决'));
      } else {
        console.log(chalk.red('未找到该坏记录'));
      }
    } catch (error) {
      console.error(chalk.red('操作失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出数据')
  .option('-d, --dir <directory>', '输出目录', 'data/output')
  .option('-b, --include-bad', '包含坏记录')
  .option('-a, --include-audit', '包含审计日志')
  .option('-o, --operator <name>', '操作人姓名', '系统管理员')
  .option('-r, --role <role>', '角色', '管理员')
  .action((options: { dir?: string; includeBad?: boolean; includeAudit?: boolean; operator?: string; role?: string }) => {
    try {
      const userContext = getUserContext(options);
      
      console.log(chalk.blue('正在导出数据...'));
      
      const result = exportData(userContext, {
        outputDir: options.dir ? (path.isAbsolute(options.dir) ? options.dir : path.join(process.cwd(), options.dir)) : undefined,
        includeBadRecords: options.includeBad,
        includeAuditLogs: options.includeAudit,
      });
      
      console.log(chalk.green('✓ 导出完成!'));
      console.log(chalk.blue(`  品控记录: ${result.qualityRecordsPath}`));
      console.log(chalk.blue(`  返工记录: ${result.reworkRecordsPath}`));
      if (result.badRecordsPath) {
        console.log(chalk.blue(`  坏记录: ${result.badRecordsPath}`));
      }
      if (result.auditLogsPath) {
        console.log(chalk.blue(`  审计日志: ${result.auditLogsPath}`));
      }
      console.log(chalk.green(`  总记录数: ${result.totalRecords}`));
    } catch (error) {
      console.error(chalk.red('导出失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
