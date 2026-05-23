#!/usr/bin/env node
import { Command } from 'commander';
import * as chalk from 'chalk';
import * as path from 'path';
import { DataSource, Role, FaultStatus, RecordStatus } from '../models/types';
import { importFromSource } from '../importers';
import { LedgerService } from '../services/ledgerService';
import { ExportService } from '../services/exportService';
import { store } from '../store/fileStore';

const program = new Command();

program
  .name('ledger')
  .description('充电桩巡检权限追责台账 CLI')
  .version('1.0.0');

const importCmd = program.command('import')
  .description('导入数据');

importCmd.command('alarm <file>')
  .description('导入桩端告警数据')
  .option('-o, --operator <name>', '操作员名称', 'system')
  .action(async (file, options) => {
    try {
      const result = await importFromSource(DataSource.PILE_ALARM, file, options.operator);
      printImportResult(result);
      process.exit(result.failed > 0 ? 1 : 0);
    } catch (e) {
      console.error(chalk.red(`错误: ${e instanceof Error ? e.message : String(e)}`));
      process.exit(1);
    }
  });

importCmd.command('inspection <file>')
  .description('导入巡检表数据')
  .option('-o, --operator <name>', '操作员名称', 'system')
  .action(async (file, options) => {
    try {
      const result = await importFromSource(DataSource.INSPECTION_FORM, file, options.operator);
      printImportResult(result);
      process.exit(result.failed > 0 ? 1 : 0);
    } catch (e) {
      console.error(chalk.red(`错误: ${e instanceof Error ? e.message : String(e)}`));
      process.exit(1);
    }
  });

importCmd.command('complaint <file>')
  .description('导入客服投诉单')
  .option('-o, --operator <name>', '操作员名称', 'system')
  .action(async (file, options) => {
    try {
      const result = await importFromSource(DataSource.CUSTOMER_COMPLAINT, file, options.operator);
      printImportResult(result);
      process.exit(result.failed > 0 ? 1 : 0);
    } catch (e) {
      console.error(chalk.red(`错误: ${e instanceof Error ? e.message : String(e)}`));
      process.exit(1);
    }
  });

function printImportResult(result: any) {
  console.log(chalk.green(`导入完成!`));
  console.log(`  总计: ${result.total}`);
  console.log(`  成功: ${chalk.green(result.success)}`);
  console.log(`  跳过: ${chalk.yellow(result.skipped)}`);
  console.log(`  失败: ${chalk.red(result.failed)}`);
  if (result.errors.length > 0) {
    console.log(chalk.red('\n错误详情:'));
    result.errors.forEach((err: any) => {
      console.log(`  行${err.row}: ${err.error}`);
    });
  }
}

const recordCmd = program.command('record')
  .description('台账记录操作');

recordCmd.command('list')
  .description('列出记录')
  .option('-s, --status <status>', '按状态筛选')
  .option('-a, --area <area>', '按区域筛选')
  .option('-p, --pile <pileId>', '按桩ID筛选')
  .action((options) => {
    const filter: any = {};
    if (options.status) filter.status = options.status;
    if (options.area) filter.area = options.area;
    if (options.pile) filter.pileId = options.pile;

    const records = LedgerService.listRecords(filter);
    console.log(`共 ${records.length} 条记录\n`);
    records.forEach(r => {
      const statusColor = r.status === RecordStatus.FROZEN ? chalk.green : 
                         r.status === RecordStatus.REJECTED ? chalk.red : chalk.yellow;
      console.log(`${chalk.gray(r.id.slice(0, 8))} 桩${r.pileId} ${statusColor(r.status)} ${r.faultType} ${chalk.gray(r.faultStartTime)}`);
    });
    process.exit(0);
  });

recordCmd.command('show <id>')
  .description('查看记录详情')
  .option('-r, --role <role>', '角色视图', Role.AREA_MANAGER)
  .action((id, options) => {
    const details = ExportService.getRecordForView(id, options.role);
    if (!details) {
      console.log(chalk.red('记录不存在'));
      process.exit(1);
    }
    
    console.log(chalk.bold('\n=== 记录详情 ==='));
    console.log(`ID: ${details.record.id}`);
    console.log(`桩ID: ${details.record.pileId}`);
    console.log(`状态: ${details.record.status}`);
    console.log(`故障状态: ${details.record.faultStatus}`);
    console.log(`故障类型: ${details.record.faultType}`);
    console.log(`描述: ${details.record.faultDescription}`);
    console.log(`开始时间: ${details.record.faultStartTime}`);
    console.log(`结束时间: ${details.record.faultEndTime || '-'}`);
    console.log(`故障时长: ${details.record.faultDuration} 分钟`);
    console.log(`处理人: ${details.record.handler || '-'}`);
    console.log(`区域: ${details.record.area || '-'}`);
    console.log(`证据数量: ${details.evidences.length}`);
    console.log(`版本: ${details.record.version}`);
    
    if (details.diffSummary && details.diffSummary.length > 0) {
      console.log(chalk.bold('\n=== 人工变更记录 ==='));
      details.diffSummary.forEach((d: any) => {
        console.log(`  ${chalk.yellow(d.field)}: ${d.oldValue} -> ${d.newValue}`);
        console.log(`    原因: ${d.reason}`);
        console.log(`    操作人: ${d.changedBy} ${chalk.gray(d.changedAt)}`);
      });
    }
    
    if (details.evidences.length > 0) {
      console.log(chalk.bold('\n=== 证据链 ==='));
      details.evidences.forEach((e: any, i: number) => {
        console.log(`  ${i + 1}. [${e.sourceType}] ${e.sourceFile}:${e.sourceRow}`);
        console.log(`     导入人: ${e.importedBy} ${chalk.gray(e.importedAt)}`);
      });
    }
    
    process.exit(0);
  });

recordCmd.command('submit <id>')
  .description('提交记录')
  .option('-o, --operator <name>', '操作员', 'system')
  .option('-r, --role <role>', '角色', Role.TEAM_LEADER)
  .action((id, options) => {
    try {
      LedgerService.submitRecord(id, options.operator, options.role);
      console.log(chalk.green('提交成功'));
      process.exit(0);
    } catch (e) {
      console.error(chalk.red(`错误: ${e instanceof Error ? e.message : String(e)}`));
      process.exit(1);
    }
  });

recordCmd.command('reject <id> <reason>')
  .description('驳回记录')
  .option('-o, --operator <name>', '操作员', 'system')
  .option('-r, --role <role>', '角色', Role.AREA_MANAGER)
  .action((id, reason, options) => {
    try {
      LedgerService.rejectRecord(id, options.operator, options.role, reason);
      console.log(chalk.green('驳回成功'));
      process.exit(0);
    } catch (e) {
      console.error(chalk.red(`错误: ${e instanceof Error ? e.message : String(e)}`));
      process.exit(1);
    }
  });

recordCmd.command('confirm <id>')
  .description('二次确认')
  .option('-o, --operator <name>', '操作员', 'system')
  .option('-r, --role <role>', '角色', Role.AREA_MANAGER)
  .action((id, options) => {
    try {
      LedgerService.secondaryConfirm(id, options.operator, options.role);
      console.log(chalk.green('二次确认成功'));
      process.exit(0);
    } catch (e) {
      console.error(chalk.red(`错误: ${e instanceof Error ? e.message : String(e)}`));
      process.exit(1);
    }
  });

recordCmd.command('freeze <id> <reason>')
  .description('冻结记录（导出前）')
  .option('-o, --operator <name>', '操作员', 'system')
  .option('-r, --role <role>', '角色', Role.AREA_MANAGER)
  .action((id, reason, options) => {
    try {
      LedgerService.freezeRecord(id, options.operator, options.role, reason);
      console.log(chalk.green('冻结成功'));
      process.exit(0);
    } catch (e) {
      console.error(chalk.red(`错误: ${e instanceof Error ? e.message : String(e)}`));
      process.exit(1);
    }
  });

recordCmd.command('withdraw <id> <reason>')
  .description('撤回至草稿')
  .option('-o, --operator <name>', '操作员', 'system')
  .option('-r, --role <role>', '角色', Role.TEAM_LEADER)
  .action((id, reason, options) => {
    try {
      LedgerService.withdrawToDraft(id, options.operator, options.role, reason);
      console.log(chalk.green('撤回成功'));
      process.exit(0);
    } catch (e) {
      console.error(chalk.red(`错误: ${e instanceof Error ? e.message : String(e)}`));
      process.exit(1);
    }
  });

recordCmd.command('update <id> <reason>')
  .description('人工改判（JSON格式更新）')
  .option('-o, --operator <name>', '操作员', 'system')
  .option('-r, --role <role>', '角色', Role.ADMIN)
  .option('-u, --updates <json>', '更新内容 JSON')
  .action((id, reason, options) => {
    try {
      const updates = JSON.parse(options.updates);
      LedgerService.manualUpdate(id, options.operator, options.role, updates, reason);
      console.log(chalk.green('更新成功'));
      process.exit(0);
    } catch (e) {
      console.error(chalk.red(`错误: ${e instanceof Error ? e.message : String(e)}`));
      process.exit(1);
    }
  });

recordCmd.command('diff <id>')
  .description('查看变更历史')
  .action((id) => {
    const changes = LedgerService.getChangeDiff(id);
    if (changes.length === 0) {
      console.log('暂无变更记录');
      process.exit(0);
    }
    
    console.log(chalk.bold('\n=== 变更历史 ===\n'));
    changes.forEach(c => {
      const manualTag = c.isManualOverride ? chalk.red('[人工]') : '';
      console.log(`${manualTag} ${chalk.yellow(c.field)}: ${c.oldValue} -> ${c.newValue}`);
      console.log(`  原因: ${c.changeReason}`);
      console.log(`  操作人: ${c.changedBy} ${chalk.gray(c.changedAt)}\n`);
    });
    process.exit(0);
  });

program.command('report')
  .description('生成报告')
  .option('-a, --area <area>', '区域筛选')
  .action((options) => {
    const filter: any = {};
    if (options.area) filter.area = options.area;
    
    const report = ExportService.generateReport(filter);
    
    console.log(chalk.bold('=== 台账报告 ===\n'));
    console.log(chalk.bold('摘要:'));
    console.log(`  总记录数: ${report.summary.total}`);
    console.log(`  总故障时长: ${report.summary.totalDuration} 分钟`);
    console.log(`  人工修改: ${report.summary.manuallyModified} 条`);
    console.log(`\n  按状态分布:`);
    Object.entries(report.summary.byStatus).forEach(([k, v]) => {
      console.log(`    ${k}: ${v}`);
    });
    
    console.log(chalk.bold('\nTOP 故障类型:'));
    report.topFaults.forEach((f: any, i: number) => {
      console.log(`  ${i + 1}. ${f.type}: ${f.count}次, 累计${f.duration}分钟`);
    });
    
    if (report.changes.length > 0) {
      console.log(chalk.bold('\n人工变更记录:'));
      report.changes.slice(0, 5).forEach(c => {
        console.log(`  ${c.recordId.slice(0, 8)} ${c.field}: ${c.reason}`);
      });
    }
    
    process.exit(0);
  });

const exportCmd = program.command('export')
  .description('导出数据');

exportCmd.command('json')
  .description('导出为 JSON')
  .option('-o, --output <dir>', '输出目录', './data/exported')
  .option('-a, --anonymize', '脱敏导出')
  .option('-e, --evidence', '包含证据链')
  .option('-c, --changelogs', '包含变更日志')
  .action((options) => {
    const filePath = ExportService.exportToFile({
      format: 'json',
      anonymize: options.anonymize || false,
      includeEvidence: options.evidence || false,
      includeChangeLogs: options.changelogs || false
    }, path.resolve(options.output));
    
    console.log(chalk.green(`导出成功: ${filePath}`));
    process.exit(0);
  });

exportCmd.command('csv')
  .description('导出为 CSV')
  .option('-o, --output <dir>', '输出目录', './data/exported')
  .option('-a, --anonymize', '脱敏导出')
  .action((options) => {
    const filePath = ExportService.exportToFile({
      format: 'csv',
      anonymize: options.anonymize || false,
      includeEvidence: false,
      includeChangeLogs: false
    }, path.resolve(options.output));
    
    console.log(chalk.green(`导出成功: ${filePath}`));
    process.exit(0);
  });

program.command('stats')
  .description('查看统计信息')
  .option('-a, --area <area>', '区域筛选')
  .action((options) => {
    const filter: any = {};
    if (options.area) filter.area = options.area;
    
    const stats = LedgerService.getStatistics(filter);
    
    console.log(chalk.bold('=== 统计信息 ===\n'));
    console.log(`总记录: ${stats.total}`);
    console.log(`总故障时长: ${stats.totalDuration} 分钟`);
    
    console.log('\n按区域统计:');
    Object.entries(stats.byArea).forEach(([area, data]: [string, any]) => {
      console.log(`  ${area}: ${data.count}条, ${data.duration}分钟`);
    });
    
    process.exit(0);
  });

program.command('workflow <id>')
  .description('执行完整工作流: 提交->确认->冻结')
  .option('-o, --operator <name>', '操作员', 'system')
  .action(async (id, options) => {
    try {
      console.log(chalk.gray('1. 提交记录...'));
      LedgerService.submitRecord(id, options.operator, Role.TEAM_LEADER);
      
      console.log(chalk.gray('2. 二次确认...'));
      LedgerService.secondaryConfirm(id, options.operator, Role.AREA_MANAGER);
      
      console.log(chalk.gray('3. 冻结...'));
      LedgerService.freezeRecord(id, options.operator, Role.AREA_MANAGER, '月报导出前冻结');
      
      console.log(chalk.green('工作流完成! 记录已冻结可导出'));
      process.exit(0);
    } catch (e) {
      console.error(chalk.red(`错误: ${e instanceof Error ? e.message : String(e)}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
