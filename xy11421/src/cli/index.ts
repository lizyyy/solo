import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { initDatabase, getDbPath, closeDatabase } from '../database';
import { findUserByUsername, defaultUsers } from '../config/users';
import { canPerformAction, getPermission } from '../config/roles';
import { importData, getImportBatches } from '../services/import';
import { getDirtyRecords, getDirtyStats, fixDirtyRecord } from '../services/dirtyCheck';
import { getAllHistory, getHistoryBySource, printHistoryDiff } from '../services/history';
import { analyzeCarReturns, getCarDetail, getResponsiblePersonStats } from '../services/carReturn';
import { exportData, exportFailedRecords } from '../services/export';
import { SourceType, User, UserRole } from '../types';

const program = new Command();

let currentUser: User | null = null;

export function setCurrentUser(username: string): void {
  const user = findUserByUsername(username);
  if (!user) {
    console.log(chalk.red(`用户不存在: ${username}`));
    console.log(chalk.yellow('可用用户:'));
    defaultUsers.forEach(u => console.log(`  ${u.username} - ${u.name}`));
    process.exit(1);
  }
  currentUser = user;
}

export function getCurrentUser(): User {
  if (!currentUser) {
    console.log(chalk.red('请先使用 --user 参数指定用户'));
    process.exit(1);
  }
  return currentUser;
}

export function checkPermission(action: string): void {
  const user = getCurrentUser();
  if (!canPerformAction(user.role, action)) {
    console.log(chalk.red(`权限不足: 用户 ${user.name} (${user.role}) 无法执行 ${action} 操作`));
    process.exit(1);
  }
}

program
  .name('car-inspect')
  .description('二手车整备多源导入巡检工具')
  .version('1.0.0')
  .option('-u, --user <username>', '指定操作用户', 'wang_super');

program
  .command('init')
  .description('初始化数据库')
  .action(async () => {
    const user = getCurrentUser();
    checkPermission('init');

    console.log(chalk.blue('正在初始化数据库...'));
    await initDatabase();
    console.log(chalk.green(`数据库已初始化: ${getDbPath()}`));
    console.log(chalk.yellow(`当前用户: ${user.name} (${user.role})`));
  });

program
  .command('import <sourceType> <filePath>')
  .description('导入数据 (inspection|repair_quote|photo_list|shift_record|manual_price)')
  .option('--skip-check', '跳过脏数据检查')
  .action(async (sourceType: SourceType, filePath: string, options: { skipCheck?: boolean }) => {
    const user = getCurrentUser();
    checkPermission('import');

    if (!['inspection', 'repair_quote', 'photo_list', 'shift_record', 'manual_price'].includes(sourceType)) {
      console.log(chalk.red(`不支持的数据源类型: ${sourceType}`));
      process.exit(1);
    }

    console.log(chalk.blue(`正在导入 ${sourceType} 数据...`));
    console.log(chalk.gray(`文件: ${filePath}`));
    console.log(chalk.gray(`用户: ${user.name}`));

    try {
      const result = await importData({
        sourceType,
        filePath,
        userId: user.id,
        skipCheck: options.skipCheck
      });

      console.log(chalk.green('\n导入完成!'));
      console.log(`批次ID: ${result.batchId}`);
      console.log(`成功: ${chalk.green(String(result.success))}`);
      console.log(`失败: ${chalk.red(String(result.failed))}`);
      console.log(`脏记录: ${chalk.yellow(String(result.dirty))}`);

      if (result.failedRecords.length > 0) {
        console.log(chalk.red('\n失败记录:'));
        result.failedRecords.forEach(r => {
          console.log(`  第${r.row}行: ${r.reason}`);
        });
      }
    } catch (error: any) {
      console.log(chalk.red(`导入失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('check')
  .description('检查脏记录')
  .option('-t, --type <sourceType>', '按数据源类型过滤')
  .option('--pending', '只显示待修复的')
  .option('--fixed', '只显示已修复的')
  .action(async (options: { type?: SourceType; pending?: boolean; fixed?: boolean }) => {
    checkPermission('check');

    let isFixed: boolean | undefined;
    if (options.pending) isFixed = false;
    if (options.fixed) isFixed = true;

    const records = await getDirtyRecords(options.type, isFixed);
    const stats = await getDirtyStats();

    console.log(chalk.blue('\n=== 脏记录统计 ==='));
    console.log(`总数: ${stats.total}`);
    console.log(`已修复: ${chalk.green(String(stats.fixed))}`);
    console.log(`待修复: ${chalk.yellow(String(stats.pending))}`);
    console.log(`\n按类型分布:`);
    Object.entries(stats.byType).forEach(([type, count]) => {
      if (count > 0) console.log(`  ${type}: ${count}`);
    });

    if (records.length > 0) {
      console.log(chalk.blue('\n=== 脏记录列表 ==='));
      const table = new Table({
        head: ['ID', '类型', '脏类型', '字段', '描述', '状态'],
        colWidths: [38, 15, 18, 15, 40, 10]
      });

      records.forEach(r => {
        table.push([
          r.id!,
          r.sourceType,
          r.dirtyType,
          r.fieldName || '-',
          r.description.substring(0, 37) + (r.description.length > 37 ? '...' : ''),
          r.isFixed ? chalk.green('已修复') : chalk.yellow('待修复')
        ]);
      });

      console.log(table.toString());
    }
  });

program
  .command('fix <dirtyId> <fixedValue>')
  .description('修复脏记录')
  .action(async (dirtyId: string, fixedValue: string) => {
    const user = getCurrentUser();
    checkPermission('fix');

    const success = await fixDirtyRecord(dirtyId, fixedValue, user.id);
    if (success) {
      console.log(chalk.green('修复成功!'));
    } else {
      console.log(chalk.red('修复失败: 记录不存在'));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成报告')
  .option('--returns', '显示多次返厂车辆')
  .option('--persons', '显示责任人统计')
  .option('--car <vin>', '显示车辆详情')
  .action(async (options: { returns?: boolean; persons?: boolean; car?: string }) => {
    checkPermission('report');

    if (options.car) {
      const detail = await getCarDetail(options.car);
      console.log(chalk.blue(`\n=== 车辆详情: ${options.car} ===`));
      console.log(`车牌号: ${detail.plateNumber}`);
      console.log(chalk.yellow('\n汇总:'));
      Object.entries(detail.summary).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });
      return;
    }

    if (options.persons) {
      const stats = await getResponsiblePersonStats();
      console.log(chalk.blue('\n=== 责任人统计 ==='));
      const table = new Table({
        head: ['责任人', '经手车辆', '返厂车辆', '总成本'],
        colWidths: [20, 12, 12, 15]
      });
      stats.forEach(s => {
        table.push([s.person, s.carCount, s.returnCarCount, s.totalCost.toFixed(2)]);
      });
      console.log(table.toString());
      return;
    }

    const returns = await analyzeCarReturns(2);
    console.log(chalk.blue('\n=== 多次返厂车辆报告 ==='));
    if (returns.length === 0) {
      console.log(chalk.gray('暂无多次返厂记录'));
      return;
    }

    const table = new Table({
      head: ['VIN', '车牌号', '返厂次数', '首次日期', '末次日期', '总成本', '责任人'],
      colWidths: [20, 12, 10, 12, 12, 12, 25]
    });

    returns.forEach(r => {
      table.push([
        r.vin,
        r.plateNumber,
        r.returnCount,
        r.firstEntryDate,
        r.lastReturnDate,
        r.totalCost.toFixed(2),
        r.responsiblePersons.join(', ').substring(0, 22)
      ]);
    });

    console.log(table.toString());
  });

program
  .command('history')
  .description('查看历史记录')
  .option('--limit <n>', '显示数量', '50')
  .option('--source <type>', '按数据源类型')
  .option('--id <id>', '按源记录ID')
  .action(async (options: { limit: string; source?: SourceType; id?: string }) => {
    checkPermission('history');

    const limit = parseInt(options.limit);
    let records;

    if (options.id && options.source) {
      records = await getHistoryBySource(options.source, options.id);
    } else {
      records = await getAllHistory(limit);
    }

    if (records.length === 0) {
      console.log(chalk.gray('暂无历史记录'));
      return;
    }

    records.forEach(r => printHistoryDiff(r));
  });

program
  .command('export <outputPath>')
  .description('导出数据')
  .option('-t, --type <sourceType>', '按数据源类型')
  .option('-s, --status <status>', '按状态过滤')
  .option('-b, --batch <batchId>', '按批次导出')
  .option('--dirty', '包含脏记录')
  .option('--failed <batchId>', '导出指定批次失败记录')
  .action(async (outputPath: string, options: { type?: SourceType; status?: string; batch?: string; dirty?: boolean; failed?: string }) => {
    checkPermission('export');

    if (options.failed) {
      await exportFailedRecords(options.failed, outputPath);
      console.log(chalk.green(`失败记录已导出: ${outputPath}`));
      return;
    }

    await exportData({
      sourceType: options.type,
      status: options.status,
      batchId: options.batch,
      includeDirty: options.dirty,
      outputPath
    });

    console.log(chalk.green(`数据已导出: ${outputPath}`));
  });

program
  .command('whoami')
  .description('显示当前用户信息')
  .action(() => {
    const user = getCurrentUser();
    const perm = getPermission(user.role);
    console.log(chalk.blue('\n=== 用户信息 ==='));
    console.log(`用户名: ${user.username}`);
    console.log(`姓名: ${user.name}`);
    console.log(`角色: ${user.role}`);
    console.log(chalk.yellow('\n允许操作:'));
    perm.allowedActions.forEach(a => console.log(`  - ${a}`));
  });

program
  .command('users')
  .description('列出所有用户')
  .action(() => {
    console.log(chalk.blue('\n=== 用户列表 ==='));
    const table = new Table({
      head: ['用户名', '姓名', '角色'],
      colWidths: [20, 20, 15]
    });
    defaultUsers.forEach(u => {
      table.push([u.username, u.name, u.role]);
    });
    console.log(table.toString());
  });

program
  .command('batches')
  .description('查看导入批次')
  .option('-t, --type <sourceType>', '按类型过滤')
  .action(async (options: { type?: SourceType }) => {
    const batches = await getImportBatches(options.type);
    if (batches.length === 0) {
      console.log(chalk.gray('暂无导入批次'));
      return;
    }

    console.log(chalk.blue('\n=== 导入批次 ==='));
    const table = new Table({
      head: ['批次ID', '类型', '文件', '总数', '成功', '失败', '脏', '时间'],
      colWidths: [38, 15, 25, 8, 8, 8, 8, 20]
    });

    batches.forEach((b: any) => {
      table.push([
        b.id,
        b.sourceType,
        b.fileName.substring(0, 22) + (b.fileName.length > 22 ? '...' : ''),
        b.totalCount,
        b.successCount,
        b.failedCount,
        b.dirtyCount,
        b.importedAt
      ]);
    });

    console.log(table.toString());
  });

program.hook('preAction', (thisCommand, actionCommand) => {
  const opts = program.opts();
  setCurrentUser(opts.user);
});

program.hook('postAction', async () => {
  await closeDatabase();
});

export function runCli(argv: string[]): void {
  program.parseAsync(argv);
}
