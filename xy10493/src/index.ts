#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { dataStore } from './data-store';
import { dataImporter } from './importer';
import { differenceCalculator } from './difference-calculator';
import { reviewAndAdjustmentService } from './review-adjustment';
import { reportGenerator } from './report-generator';
import { AuditSession, DifferenceType } from './types';

const program = new Command();

program
  .name('inventory-audit')
  .description('仓库盘点差异复核 CLI 工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化新的盘点会话')
  .requiredOption('-n, --name <name>', '盘点名称')
  .action((options: { name: string }) => {
    const existing = dataStore.getAllAuditSessions();
    const duplicate = existing.find(s => s.name === options.name);
    
    if (duplicate) {
      console.log(chalk.red(`错误: 已存在同名盘点 "${options.name}"`));
      console.log(chalk.yellow(`盘点 ID: ${duplicate.id}`));
      process.exit(1);
    }

    const session: AuditSession = {
      id: uuidv4(),
      name: options.name,
      status: 'importing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dataStore.saveAuditSession(session);
    console.log(chalk.green('✓ 盘点会话已创建'));
    console.log(chalk.cyan(`盘点名称: ${session.name}`));
    console.log(chalk.cyan(`盘点 ID: ${session.id}`));
    console.log(chalk.gray('请使用此 ID 进行后续操作'));
  });

program
  .command('list')
  .description('列出所有盘点会话')
  .action(() => {
    const sessions = dataStore.getAllAuditSessions();
    
    if (sessions.length === 0) {
      console.log(chalk.yellow('暂无盘点会话'));
      return;
    }

    console.log(chalk.cyan('='.repeat(80)));
    console.log(chalk.cyan('盘点会话列表'));
    console.log(chalk.cyan('='.repeat(80)));
    console.log(
      `${chalk.white('ID'.padEnd(38))} ${chalk.white('名称'.padEnd(25))} ` +
      `${chalk.white('状态'.padEnd(12))} ${chalk.white('创建时间'.padEnd(20))}`
    );
    console.log(chalk.cyan('-'.repeat(80)));

    const statusColors: Record<string, (s: string) => string> = {
      importing: chalk.yellow,
      calculated: chalk.blue,
      reviewing: chalk.magenta,
      adjusting: chalk.cyan,
      completed: chalk.green
    };

    const statusNames: Record<string, string> = {
      importing: '导入中',
      calculated: '已计算',
      reviewing: '复核中',
      adjusting: '调整中',
      completed: '已完成'
    };

    for (const session of sessions) {
      const statusColor = statusColors[session.status] || chalk.white;
      console.log(
        `${session.id.padEnd(38)} ${session.name.padEnd(25)} ` +
        `${statusColor(statusNames[session.status].padEnd(12))} ` +
        `${new Date(session.createdAt).toLocaleString('zh-CN').padEnd(20)}`
      );
    }
  });

program
  .command('import-book')
  .description('导入账面库存')
  .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
  .requiredOption('-f, --file <file>', 'CSV 文件路径')
  .action((options: { auditId: string; file: string }) => {
    const session = dataStore.getAuditSession(options.auditId);
    if (!session) {
      console.log(chalk.red(`错误: 盘点会话不存在: ${options.auditId}`));
      process.exit(1);
    }

    const existingDifferences = dataStore.getDifferences(options.auditId);
    if (existingDifferences.length > 0) {
      console.log(chalk.red('错误: 该盘点已完成差异计算，不能重复导入'));
      console.log(chalk.yellow('如需重新导入，请创建新的盘点会话'));
      process.exit(1);
    }

    try {
      const result = dataImporter.importBookInventory(options.file, options.auditId);
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`导入完成，但有 ${result.errors.length} 个警告:`));
        for (const err of result.errors) {
          console.log(chalk.yellow(`  - ${err.message}`));
        }
      }

      console.log(chalk.green(`✓ 账面库存导入成功: ${result.importedCount} 条记录`));
    } catch (error: any) {
      console.log(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('import-count')
  .description('导入实盘结果')
  .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
  .requiredOption('-f, --file <file>', 'CSV 文件路径')
  .action((options: { auditId: string; file: string }) => {
    const session = dataStore.getAuditSession(options.auditId);
    if (!session) {
      console.log(chalk.red(`错误: 盘点会话不存在: ${options.auditId}`));
      process.exit(1);
    }

    const existingDifferences = dataStore.getDifferences(options.auditId);
    if (existingDifferences.length > 0) {
      console.log(chalk.red('错误: 该盘点已完成差异计算，不能重复导入'));
      console.log(chalk.yellow('如需重新导入，请创建新的盘点会话'));
      process.exit(1);
    }

    try {
      const result = dataImporter.importActualCount(options.file, options.auditId);
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`导入完成，但有 ${result.errors.length} 个警告:`));
        for (const err of result.errors) {
          console.log(chalk.yellow(`  - ${err.message}`));
        }
      }

      console.log(chalk.green(`✓ 实盘结果导入成功: ${result.importedCount} 条记录`));
    } catch (error: any) {
      console.log(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('import-owners')
  .description('导入库位负责人')
  .requiredOption('-f, --file <file>', 'CSV 文件路径')
  .action((options: { file: string }) => {
    try {
      const result = dataImporter.importLocationOwners(options.file);
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`导入完成，但有 ${result.errors.length} 个警告:`));
        for (const err of result.errors) {
          console.log(chalk.yellow(`  - ${err.message}`));
        }
      }

      console.log(chalk.green(`✓ 库位负责人导入成功: ${result.importedCount} 条记录`));
    } catch (error: any) {
      console.log(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('calculate')
  .description('计算盘点差异')
  .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
  .action((options: { auditId: string }) => {
    const session = dataStore.getAuditSession(options.auditId);
    if (!session) {
      console.log(chalk.red(`错误: 盘点会话不存在: ${options.auditId}`));
      process.exit(1);
    }

    const existingDifferences = dataStore.getDifferences(options.auditId);
    if (existingDifferences.length > 0) {
      console.log(chalk.red('错误: 该盘点已完成差异计算，不能重复计算'));
      console.log(chalk.yellow('如需重新计算，请创建新的盘点会话'));
      process.exit(1);
    }

    const bookInventory = dataStore.getBookInventory(options.auditId);
    const actualCount = dataStore.getActualCount(options.auditId);

    if (bookInventory.length === 0) {
      console.log(chalk.red('错误: 请先导入账面库存'));
      process.exit(1);
    }

    if (actualCount.length === 0) {
      console.log(chalk.yellow('警告: 尚未导入实盘结果，将全部视为未盘'));
    }

    const result = differenceCalculator.calculateDifferences(options.auditId);

    if (!result.success) {
      for (const err of result.errors) {
        console.log(chalk.red(`错误: ${err.message}`));
      }
      process.exit(1);
    }

    console.log(chalk.green('✓ 差异计算完成'));
    console.log(chalk.cyan('='.repeat(50)));
    console.log(`总记录数: ${result.totalItems}`);
    console.log(`一致: ${result.matchedItems}`);
    console.log(`盘盈: ${result.profitItems}`);
    console.log(`盘亏: ${result.lossItems}`);
    console.log(`未盘: ${result.notCountedItems}`);
    console.log(`多盘: ${result.overCountedItems}`);
    console.log(chalk.cyan('='.repeat(50)));
  });

program
  .command('view')
  .description('查看库位差异')
  .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
  .option('-l, --location <location>', '按库位筛选')
  .option('-o, --owner <owner>', '按负责人筛选')
  .option('-t, --type <type>', '按差异类型筛选 (profit/loss/not_counted/over_counted/matched)')
  .option('-u, --unmatched', '仅显示不一致的记录')
  .action((options: { 
    auditId: string; 
    location?: string; 
    owner?: string; 
    type?: string;
    unmatched?: boolean 
  }) => {
    const session = dataStore.getAuditSession(options.auditId);
    if (!session) {
      console.log(chalk.red(`错误: 盘点会话不存在: ${options.auditId}`));
      process.exit(1);
    }

    let differences = dataStore.getDifferences(options.auditId);

    if (differences.length === 0) {
      console.log(chalk.yellow('该盘点尚未计算差异，请先运行 calculate 命令'));
      return;
    }

    if (options.location) {
      differences = differences.filter(d => d.location === options.location);
    }

    if (options.owner) {
      differences = differences.filter(d => d.owner === options.owner);
    }

    if (options.type) {
      differences = differences.filter(d => d.differenceType === options.type as DifferenceType);
    }

    if (options.unmatched) {
      differences = differences.filter(d => d.differenceType !== 'matched');
    }

    if (differences.length === 0) {
      console.log(chalk.yellow('没有找到符合条件的差异记录'));
      return;
    }

    const typeColors: Record<DifferenceType, (s: string) => string> = {
      matched: chalk.green,
      profit: chalk.cyan,
      loss: chalk.red,
      not_counted: chalk.magenta,
      over_counted: chalk.yellow
    };

    const typeNames: Record<DifferenceType, string> = {
      matched: '一致',
      profit: '盘盈',
      loss: '盘亏',
      not_counted: '未盘',
      over_counted: '多盘'
    };

    const statusNames: Record<string, string> = {
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回'
    };

    console.log(chalk.cyan('='.repeat(120)));
    console.log(chalk.cyan(`差异记录 (共 ${differences.length} 条)`));
    console.log(chalk.cyan('='.repeat(120)));
    console.log(
      `${chalk.white('库位'.padEnd(10))} ${chalk.white('SKU'.padEnd(15))} ` +
      `${chalk.white('账面'.padEnd(8))} ${chalk.white('实盘'.padEnd(8))} ` +
      `${chalk.white('差异'.padEnd(8))} ${chalk.white('类型'.padEnd(8))} ` +
      `${chalk.white('负责人'.padEnd(10))} ${chalk.white('状态'.padEnd(8))} ` +
      `${chalk.white('差异ID'.padEnd(36))}`
    );
    console.log(chalk.cyan('-'.repeat(120)));

    for (const d of differences) {
      const typeColor = typeColors[d.differenceType];
      console.log(
        `${d.location.padEnd(10)} ${d.sku.padEnd(15)} ` +
        `${String(d.bookQuantity).padEnd(8)} ${String(d.actualQuantity).padEnd(8)} ` +
        `${String(d.differenceQuantity).padEnd(8)} ` +
        `${typeColor(typeNames[d.differenceType].padEnd(8))} ` +
        `${d.owner.padEnd(10)} ${statusNames[d.approvalStatus].padEnd(8)} ` +
        `${d.id.padEnd(36)}`
      );
    }
  });

program
  .command('review')
  .description('登记复核原因')
  .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
  .requiredOption('-d, --difference-id <differenceId>', '差异 ID')
  .requiredOption('-r, --reason <reason>', '复核原因')
  .requiredOption('-b, --reviewed-by <reviewedBy>', '复核人')
  .action((options: { 
    auditId: string; 
    differenceId: string; 
    reason: string;
    reviewedBy: string 
  }) => {
    const result = reviewAndAdjustmentService.registerReviewReason(
      options.auditId,
      options.differenceId,
      options.reason,
      options.reviewedBy
    );

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      for (const err of result.errors) {
        console.log(chalk.red(`错误: ${err.message}`));
      }
      process.exit(1);
    }
  });

program
  .command('submit-adjustment')
  .description('提交调整')
  .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
  .requiredOption('-d, --difference-id <differenceId>', '差异 ID')
  .requiredOption('-q, --quantity <quantity>', '调整数量 (正数为增加，负数为减少)')
  .requiredOption('-b, --submitted-by <submittedBy>', '提交人')
  .action((options: { 
    auditId: string; 
    differenceId: string; 
    quantity: string;
    submittedBy: string 
  }) => {
    const adjustmentQty = parseInt(options.quantity, 10);
    
    if (isNaN(adjustmentQty)) {
      console.log(chalk.red('错误: 调整数量必须是有效数字'));
      process.exit(1);
    }

    const result = reviewAndAdjustmentService.submitAdjustment(
      options.auditId,
      options.differenceId,
      adjustmentQty,
      options.submittedBy
    );

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      for (const err of result.errors) {
        if (err.type === 'adjustment_exceeds_difference') {
          console.log(chalk.red(`错误: ${err.message}`));
          console.log(chalk.yellow(`  差异数量: ${err.details.differenceQuantity}`));
          console.log(chalk.yellow(`  调整数量: ${err.details.adjustmentQuantity}`));
        } else {
          console.log(chalk.red(`错误: ${err.message}`));
        }
      }
      process.exit(1);
    }
  });

program
  .command('approve')
  .description('审批通过调整')
  .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
  .requiredOption('-d, --difference-id <differenceId>', '差异 ID')
  .requiredOption('-b, --approved-by <approvedBy>', '审批人')
  .action((options: { 
    auditId: string; 
    differenceId: string; 
    approvedBy: string 
  }) => {
    const result = reviewAndAdjustmentService.approveAdjustment(
      options.auditId,
      options.differenceId,
      options.approvedBy
    );

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      for (const err of result.errors) {
        console.log(chalk.red(`错误: ${err.message}`));
      }
      process.exit(1);
    }
  });

program
  .command('reject')
  .description('审批驳回调整')
  .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
  .requiredOption('-d, --difference-id <differenceId>', '差异 ID')
  .requiredOption('-r, --reason <reason>', '驳回原因')
  .requiredOption('-b, --rejected-by <rejectedBy>', '驳回人')
  .action((options: { 
    auditId: string; 
    differenceId: string; 
    reason: string;
    rejectedBy: string 
  }) => {
    const result = reviewAndAdjustmentService.rejectAdjustment(
      options.auditId,
      options.differenceId,
      options.rejectedBy,
      options.reason
    );

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      for (const err of result.errors) {
        console.log(chalk.red(`错误: ${err.message}`));
      }
      process.exit(1);
    }
  });

program
  .command('pending')
  .description('查看待审批记录')
  .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
  .action((options: { auditId: string }) => {
    const pending = reviewAndAdjustmentService.getPendingApproval(options.auditId);

    if (pending.length === 0) {
      console.log(chalk.green('没有待审批的记录'));
      return;
    }

    console.log(chalk.yellow(`待审批记录 (共 ${pending.length} 条)`));
    console.log(chalk.cyan('='.repeat(100)));
    console.log(
      `${chalk.white('差异ID'.padEnd(36))} ${chalk.white('库位'.padEnd(10))} ` +
      `${chalk.white('SKU'.padEnd(15))} ${chalk.white('差异'.padEnd(8))} ` +
      `${chalk.white('调整'.padEnd(8))} ${chalk.white('提交人'.padEnd(10))}`
    );
    console.log(chalk.cyan('-'.repeat(100)));

    for (const d of pending) {
      console.log(
        `${d.id.padEnd(36)} ${d.location.padEnd(10)} ` +
        `${d.sku.padEnd(15)} ${String(d.differenceQuantity).padEnd(8)} ` +
        `${String(d.adjustmentQuantity || 0).padEnd(8)} ` +
        `${(d.reviewedBy || '-').padEnd(10)}`
      );
    }
  });

program
  .command('history')
  .description('查看调整历史')
  .option('-a, --audit-id <auditId>', '按盘点 ID 筛选')
  .action((options: { auditId?: string }) => {
    const history = reviewAndAdjustmentService.getAdjustmentHistory(options.auditId);

    if (history.length === 0) {
      console.log(chalk.yellow('暂无调整历史记录'));
      return;
    }

    console.log(chalk.cyan('='.repeat(100)));
    console.log(chalk.cyan('调整历史记录'));
    console.log(chalk.cyan('='.repeat(100)));
    console.log(
      `${chalk.white('时间'.padEnd(20))} ${chalk.white('库位'.padEnd(10))} ` +
      `${chalk.white('SKU'.padEnd(15))} ${chalk.white('调整前'.padEnd(8))} ` +
      `${chalk.white('调整后'.padEnd(8))} ${chalk.white('调整量'.padEnd(8))} ` +
      `${chalk.white('审批人'.padEnd(10))}`
    );
    console.log(chalk.cyan('-'.repeat(100)));

    for (const h of history) {
      console.log(
        `${new Date(h.approvedAt).toLocaleString('zh-CN').padEnd(20)} ` +
        `${h.location.padEnd(10)} ${h.sku.padEnd(15)} ` +
        `${String(h.oldQuantity).padEnd(8)} ${String(h.newQuantity).padEnd(8)} ` +
        `${String(h.adjustmentQuantity).padEnd(8)} ${h.approvedBy.padEnd(10)}`
      );
    }
  });

program
  .command('report')
  .description('生成盘点报告')
  .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
  .action((options: { auditId: string }) => {
    const session = dataStore.getAuditSession(options.auditId);
    if (!session) {
      console.log(chalk.red(`错误: 盘点会话不存在: ${options.auditId}`));
      process.exit(1);
    }

    try {
      const report = reportGenerator.generateReport(options.auditId);
      const display = reportGenerator.formatReportForDisplay(report);
      
      console.log(display);
      console.log('');
      console.log(chalk.green(`✓ 报告已生成并保存`));
    } catch (error: any) {
      console.log(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
