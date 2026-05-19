import { Command } from 'commander';
import path from 'path';
import { initDatabase } from './database';
import { importCSV, importJSON, getImportErrors, resolveImportError } from './importService';
import {
  getPendingReviews,
  reviewInspection,
  batchReview,
  getUnacknowledgedAlerts,
  acknowledgeAlert,
  batchAcknowledgeAlerts
} from './reviewService';
import { generateStatistics, formatReport, exportInspectionsToCSV, exportAlertsToCSV, saveTextReport } from './reportService';

const program = new Command();

async function main() {
  await initDatabase();

  program
    .name('pump-room-system')
    .description('地下泵房巡检管理系统')
    .version('1.0.0');

  program
    .command('import:csv')
    .description('导入巡检记录CSV文件')
    .argument('<filePath>', 'CSV文件路径')
    .action(async (filePath) => {
      try {
        const result = await importCSV(path.resolve(filePath));
        console.log(`成功导入 ${result.success.length} 条巡检记录`);
        if (result.failed.length > 0) {
          console.log(`\n失败 ${result.failed.length} 条记录:`);
          result.failed.forEach(f => {
            console.log(`  第${f.rowNumber}行: ${f.error}`);
            console.log(`    建议: ${f.suggestion}`);
          });
          console.log(`\n失败记录已保存到数据库，可使用 npm run status errors 查看`);
        }
      } catch (error) {
        console.error('导入失败:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('import:json')
    .description('导入传感器告警JSON文件')
    .argument('<filePath>', 'JSON文件路径')
    .action(async (filePath) => {
      try {
        const result = await importJSON(path.resolve(filePath));
        console.log(`成功导入 ${result.success.length} 条告警记录`);
        if (result.failed.length > 0) {
          console.log(`\n失败 ${result.failed.length} 条记录:`);
          result.failed.forEach(f => {
            console.log(`  第${f.rowNumber}条: ${f.error}`);
            console.log(`    建议: ${f.suggestion}`);
          });
          console.log(`\n失败记录已保存到数据库，可使用 npm run status errors 查看`);
        }
      } catch (error) {
        console.error('导入失败:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('review')
    .description('复核巡检记录')
    .argument('<id>', '记录ID或多个ID用逗号分隔')
    .requiredOption('-r, --reviewer <name>', '复核人姓名')
    .option('-s, --status <status>', '设置状态: pending/reviewed/resolved')
    .action(async (id, options) => {
      try {
        const ids = id.split(',').map((i: string) => parseInt(i.trim())).filter((i: number) => !isNaN(i));
        const status = options.status || 'reviewed';

        if (ids.length === 1) {
          const success = await reviewInspection(ids[0], options.reviewer, status as any);
          if (success) {
            console.log(`记录 ${ids[0]} 复核成功，状态已设置为 ${status}`);
          } else {
            console.log(`记录 ${ids[0]} 不存在`);
            process.exit(1);
          }
        } else {
          const result = await batchReview(ids, options.reviewer, status as any);
          console.log(`成功复核 ${result.success.length} 条记录`);
          if (result.failed.length > 0) {
            console.log(`失败 ${result.failed.length} 条记录:`);
            result.failed.forEach(f => {
              console.log(`  ID ${f.data}: ${f.error}`);
            });
          }
        }
      } catch (error) {
        console.error('复核失败:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('acknowledge')
    .description('确认传感器告警')
    .argument('<id>', '告警ID或多个ID用逗号分隔')
    .requiredOption('-r, --reviewer <name>', '确认人姓名')
    .action(async (id, options) => {
      try {
        const ids = id.split(',').map((i: string) => parseInt(i.trim())).filter((i: number) => !isNaN(i));

        if (ids.length === 1) {
          const success = await acknowledgeAlert(ids[0], options.reviewer);
          if (success) {
            console.log(`告警 ${ids[0]} 确认成功`);
          } else {
            console.log(`告警 ${ids[0]} 不存在`);
            process.exit(1);
          }
        } else {
          const result = await batchAcknowledgeAlerts(ids, options.reviewer);
          console.log(`成功确认 ${result.success.length} 条告警`);
          if (result.failed.length > 0) {
            console.log(`失败 ${result.failed.length} 条告警:`);
            result.failed.forEach(f => {
              console.log(`  ID ${f.data}: ${f.error}`);
            });
          }
        }
      } catch (error) {
        console.error('确认失败:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('export')
    .description('导出数据')
    .argument('<type>', '导出类型: inspections/alerts')
    .argument('<filePath>', '输出文件路径')
    .option('-s, --status <status>', '筛选状态 (仅用于inspections)')
    .action(async (type, filePath, options) => {
      try {
        const resolvedPath = path.resolve(filePath);
        let count: number;

        if (type === 'inspections') {
          count = await exportInspectionsToCSV(resolvedPath, options.status as any);
          console.log(`已导出 ${count} 条巡检记录到: ${resolvedPath}`);
        } else if (type === 'alerts') {
          count = await exportAlertsToCSV(resolvedPath, options.status as any);
          console.log(`已导出 ${count} 条告警记录到: ${resolvedPath}`);
        } else {
          console.error('未知的导出类型，请使用: inspections 或 alerts');
          process.exit(1);
        }
      } catch (error) {
        console.error('导出失败:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('report')
    .description('生成统计报告')
    .option('-o, --output <file>', '输出文件路径')
    .option('-s, --start <date>', '开始日期')
    .option('-e, --end <date>', '结束日期')
    .action(async (options) => {
      try {
        const stats = await generateStatistics(options.start, options.end);
        const report = formatReport(stats);
        console.log(report);

        if (options.output) {
          const resolvedPath = path.resolve(options.output);
          saveTextReport(resolvedPath, report);
          console.log(`\n报告已保存到: ${resolvedPath}`);
        }
      } catch (error) {
        console.error('生成报告失败:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  const statusCmd = program.command('status').description('查看状态');

  statusCmd
    .command('pending')
    .description('查看待复核的巡检记录')
    .action(async () => {
      const records = await getPendingReviews();
      if (records.length === 0) {
        console.log('没有待复核的巡检记录');
        return;
      }
      console.log(`共有 ${records.length} 条待复核的巡检记录:\n`);
      records.forEach(r => {
        console.log(`ID: ${r.id}`);
        console.log(`  日期: ${r.inspectionDate}`);
        console.log(`  巡检人: ${r.inspector}`);
        console.log(`  设备: ${r.equipmentName} (${r.location})`);
        console.log(`  状态: ${r.status}`);
        console.log('---');
      });
    });

  statusCmd
    .command('alerts')
    .description('查看未确认的告警')
    .action(async () => {
      const alerts = await getUnacknowledgedAlerts();
      if (alerts.length === 0) {
        console.log('没有未确认的告警');
        return;
      }
      console.log(`共有 ${alerts.length} 条未确认的告警:\n`);
      alerts.forEach(a => {
        console.log(`ID: ${a.id}`);
        console.log(`  时间: ${a.alertTime}`);
        console.log(`  传感器: ${a.sensorId} (${a.sensorType})`);
        console.log(`  位置: ${a.location}`);
        console.log(`  级别: ${a.alertLevel}`);
        console.log(`  数值: ${a.value} (阈值: ${a.threshold})`);
        console.log('---');
      });
    });

  statusCmd
    .command('errors')
    .description('查看导入错误')
    .option('-a, --all', '显示所有错误（包括已解决的）')
    .action(async (options) => {
      const errors = await getImportErrors(!options.all);
      if (errors.length === 0) {
        console.log('没有导入错误');
        return;
      }
      console.log(`共有 ${errors.length} 条导入错误:\n`);
      errors.forEach(e => {
        console.log(`ID: ${e.id}`);
        console.log(`  文件: ${e.sourceFile} (第 ${e.rowNumber} 行)`);
        console.log(`  错误: ${e.errorMessage}`);
        console.log(`  建议: ${e.suggestion}`);
        console.log(`  原始数据: ${e.rawData}`);
        console.log('---');
      });
    });

  statusCmd
    .command('resolve-error')
    .description('标记导入错误为已解决')
    .argument('<id>', '错误ID')
    .action(async (id) => {
      const success = await resolveImportError(parseInt(id));
      if (success) {
        console.log(`错误 ${id} 已标记为已解决`);
      } else {
        console.log(`错误 ${id} 不存在`);
        process.exit(1);
      }
    });

  statusCmd
    .command('summary')
    .description('查看系统概要')
    .action(async () => {
      const pending = await getPendingReviews();
      const alerts = await getUnacknowledgedAlerts();
      const errors = await getImportErrors(true);

      console.log('='.repeat(50));
      console.log('地下泵房巡检系统 - 状态概要');
      console.log('='.repeat(50));
      console.log(`待复核巡检记录: ${pending.length} 条`);
      console.log(`未确认传感器告警: ${alerts.length} 条`);
      console.log(`未解决导入错误: ${errors.length} 条`);
      console.log('='.repeat(50));

      if (pending.length + alerts.length + errors.length > 0) {
        console.log('\n需要处理的事项:');
        if (pending.length > 0) console.log('  - 运行 npm run status pending 查看待复核记录');
        if (alerts.length > 0) console.log('  - 运行 npm run status alerts 查看未确认告警');
        if (errors.length > 0) console.log('  - 运行 npm run status errors 查看导入错误');
      }
    });

  await program.parseAsync(process.argv);
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
