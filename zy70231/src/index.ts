#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { Storage } from './store/storage';
import { ImportService } from './services/importService';
import { Scheduler } from './services/scheduler';
import { ExportService } from './services/exportService';

const program = new Command();

program
  .name('rw-schedule')
  .description('铁路检修天窗排程 CLI')
  .version('1.0.0');

const initStorage = (dbPath?: string) => {
  const storage = Storage.getInstance(dbPath);
  storage.load();
  return storage;
};

program
  .command('import <file>')
  .description('导入数据（支持重复导入自动去重）')
  .option('-d, --db <path>', '指定数据文件路径')
  .action((file: string, options: { db?: string }) => {
    try {
      const storage = initStorage(options.db);
      const importService = new ImportService(storage);
      const result = importService.importFromFile(file);
      
      console.log(chalk.green('\n✓ 导入完成'));
      console.log(chalk.white(`  新增记录: ${result.imported}`));
      console.log(chalk.white(`  更新记录: ${result.updated}`));
      console.log(chalk.white(`  跳过记录: ${result.skipped}`));
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`\n⚠  警告 (${result.errors.length}):`));
        result.errors.forEach(e => console.log(chalk.yellow(`  - ${e}`)));
      }

      const stats = importService.getImportStats();
      console.log(chalk.white('\n当前数据统计:'));
      console.log(chalk.white(`  工区: ${stats.workZones}`));
      console.log(chalk.white(`  封锁区段: ${stats.blockSections}`));
      console.log(chalk.white(`  资源: ${stats.resources}`));
      console.log(chalk.white(`  天窗计划: ${stats.maintenanceWindows}`));
      console.log(chalk.white(`  检修任务: ${stats.workTasks}`));
    } catch (error) {
      console.error(chalk.red(`\n✗ 导入失败: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('run')
  .description('运行排程（重跑时自动清理上次运行数据）')
  .option('-d, --db <path>', '指定数据文件路径')
  .option('--force', '强制重跑，即使之前已完成')
  .action((options: { db?: string; force?: boolean }) => {
    try {
      const storage = initStorage(options.db);
      const scheduler = new Scheduler(storage);

      const lastRun = storage.getLastRunState();
      if (lastRun && lastRun.status === 'completed' && !options.force) {
        console.log(chalk.cyan('\nℹ  上次排程已完成'));
        console.log(chalk.white(`  运行时间: ${new Date(lastRun.timestamp).toLocaleString('zh-CN')}`));
        console.log(chalk.white(`  已排程: ${lastRun.stats.scheduledTasks}/${lastRun.stats.totalTasks}`));
        console.log(chalk.white(`  冲突: ${lastRun.stats.conflicts}`));
        console.log(chalk.cyan('\n使用 --force 参数强制重跑'));
        return;
      }

      console.log(chalk.cyan('\n▶  开始排程...'));
      const result = scheduler.run();

      console.log(chalk.green('\n✓ 排程完成'));
      console.log(chalk.white(`  运行ID: ${result.runId}`));
      console.log(chalk.white(`  运行时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}`));
      console.log(chalk.white(`  天窗数量: ${result.stats.totalWindows}`));
      console.log(chalk.white(`  任务总数: ${result.stats.totalTasks}`));
      console.log(chalk.green(`  已排程: ${result.stats.scheduledTasks}/${result.stats.totalTasks}`));
      
      if (result.stats.conflicts > 0) {
        console.log(chalk.red(`  冲突: ${result.stats.conflicts}`));
        console.log(chalk.yellow('\n使用 "rw-schedule conflicts" 查看详细冲突信息'));
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ 排程失败: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('查看当前排程状态')
  .option('-d, --db <path>', '指定数据文件路径')
  .action((options: { db?: string }) => {
    const storage = initStorage(options.db);
    const scheduler = new Scheduler(storage);
    const exportService = new ExportService(storage);

    const stats = exportService.exportStats();
    const lastRun = storage.getLastRunState();

    console.log(chalk.cyan('\n═══ 排程状态 ═══'));
    if (lastRun) {
      console.log(chalk.white(`\n上次运行:`));
      console.log(chalk.white(`  时间: ${new Date(lastRun.timestamp).toLocaleString('zh-CN')}`));
      console.log(chalk.white(`  状态: ${lastRun.status === 'completed' ? chalk.green('已完成') : lastRun.status === 'running' ? chalk.yellow('运行中') : chalk.red('失败')}`));
      console.log(chalk.white(`  已排程: ${lastRun.stats.scheduledTasks}/${lastRun.stats.totalTasks}`));
    } else {
      console.log(chalk.yellow('\n尚未运行过排程'));
    }

    console.log(chalk.white('\n数据统计:'));
    console.log(chalk.white(`  工区: ${stats.workZones}`));
    console.log(chalk.white(`  封锁区段: ${stats.blockSections}`));
    console.log(chalk.white(`  资源: ${stats.resources}`));
    console.log(chalk.white(`  天窗计划: ${stats.windows}`));
    console.log(chalk.white(`  检修任务: ${stats.tasks}`));
    console.log(chalk.white(`  已排程任务: ${stats.scheduled}`));
    console.log(chalk[stats.conflicts > 0 ? 'red' : 'green'](`  冲突: ${stats.conflicts}`));

    const history = scheduler.getRunHistory().slice(0, 5);
    if (history.length > 0) {
      console.log(chalk.white('\n最近运行记录:'));
      history.forEach((h, i) => {
        const statusColor = h.status === 'completed' ? chalk.green : h.status === 'running' ? chalk.yellow : chalk.red;
        console.log(chalk.white(`  ${i + 1}. [${statusColor(h.status)}] ${new Date(h.timestamp).toLocaleString('zh-CN')} - ${h.stats.scheduledTasks}/${h.stats.totalTasks} 任务, ${h.stats.conflicts} 冲突`));
      });
    }
  });

program
  .command('conflicts')
  .description('查询异常冲突')
  .option('-d, --db <path>', '指定数据文件路径')
  .option('-t, --type <type>', '按冲突类型筛选 (time|resource|block|workzone)')
  .option('--severity <level>', '按严重程度筛选 (warning|error)')
  .action((options: { db?: string; type?: string; severity?: string }) => {
    const storage = initStorage(options.db);
    const scheduler = new Scheduler(storage);

    let conflicts = scheduler.getConflicts();

    if (options.type) {
      conflicts = conflicts.filter(c => c.type === options.type);
    }
    if (options.severity) {
      conflicts = conflicts.filter(c => c.severity === options.severity);
    }

    if (conflicts.length === 0) {
      console.log(chalk.green('\n✓ 无冲突'));
      return;
    }

    console.log(chalk.red(`\n✗ 发现 ${conflicts.length} 个冲突:\n`));

    const typeNames: Record<string, string> = {
      time: '时间冲突',
      resource: '资源冲突',
      block: '区段冲突',
      workzone: '工区冲突',
    };

    conflicts.forEach((c, i) => {
      const severityColor = c.severity === 'error' ? chalk.red : chalk.yellow;
      console.log(chalk.white(`${i + 1}. [${severityColor(c.severity.toUpperCase())}] ${typeNames[c.type] || c.type}`));
      console.log(chalk.white(`   ${c.description}`));
      console.log(chalk.white(`   影响任务: ${c.affectedTasks.join(', ')}\n`));
    });
  });

program
  .command('schedule')
  .description('查看排程结果')
  .option('-d, --db <path>', '指定数据文件路径')
  .option('-w, --workzone <id>', '按工区筛选')
  .option('--date <date>', '按日期筛选 (YYYY-MM-DD)')
  .action((options: { db?: string; workzone?: string; date?: string }) => {
    const storage = initStorage(options.db);
    const scheduler = new Scheduler(storage);

    let tasks = scheduler.getScheduledTasks();

    if (options.workzone) {
      tasks = tasks.filter(t => t.workZoneId === options.workzone);
    }

    if (options.date) {
      tasks = tasks.filter(t => {
        const window = storage.db.maintenanceWindows.get(t.windowId);
        return window?.date === options.date;
      });
    }

    if (tasks.length === 0) {
      console.log(chalk.yellow('\n⚠  没有找到匹配的排程任务'));
      return;
    }

    console.log(chalk.cyan(`\n═══ 排程结果 (${tasks.length} 项) ═══\n`));

    tasks.sort((a, b) => {
      const wa = storage.db.maintenanceWindows.get(a.windowId);
      const wb = storage.db.maintenanceWindows.get(b.windowId);
      if (!wa || !wb) return 0;
      if (wa.date !== wb.date) return wa.date.localeCompare(wb.date);
      return a.assignedTime.start.localeCompare(b.assignedTime.start);
    });

    for (const task of tasks) {
      const window = storage.db.maintenanceWindows.get(task.windowId);
      const workTask = storage.db.workTasks.get(task.taskId);
      const workZone = storage.db.workZones.get(task.workZoneId);

      console.log(chalk.white(`📋 ${workTask?.title || '未知任务'}`));
      console.log(chalk.white(`   工区: ${workZone?.name || task.workZoneId}`));
      console.log(chalk.white(`   天窗: ${window?.date || '未知日期'} ${window?.time.start}-${window?.time.end}`));
      console.log(chalk.green(`   分配时间: ${task.assignedTime.start}-${task.assignedTime.end}`));
      console.log(chalk.white(`   状态: ${task.status}`));
      console.log('');
    }
  });

program
  .command('export <output>')
  .description('导出排程结果（Excel格式，供业务负责人查看）')
  .option('-d, --db <path>', '指定数据文件路径')
  .action(async (output: string, options: { db?: string }) => {
    try {
      const storage = initStorage(options.db);
      const exportService = new ExportService(storage);

      console.log(chalk.cyan('\n▶  正在生成报告...'));
      const path = await exportService.exportToExcel(output);

      console.log(chalk.green('\n✓ 导出完成'));
      console.log(chalk.white(`  文件路径: ${path}`));

      const stats = exportService.exportStats();
      console.log(chalk.white('\n报告内容:'));
      console.log(chalk.white(`  概览页 - 整体运行状态`));
      console.log(chalk.white(`  排程结果 - ${stats.scheduled} 项已排程任务`));
      console.log(chalk.white(`  资源使用 - ${stats.resources} 项资源统计`));
      console.log(chalk.white(`  异常冲突 - ${stats.conflicts} 项冲突详情`));
      console.log(chalk.white(`  数据清单 - 天窗计划和任务明细`));
    } catch (error) {
      console.error(chalk.red(`\n✗ 导出失败: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('查看详细统计信息')
  .option('-d, --db <path>', '指定数据文件路径')
  .action((options: { db?: string }) => {
    const storage = initStorage(options.db);
    const exportService = new ExportService(storage);
    const stats = exportService.exportStats();

    console.log(chalk.cyan('\n═══ 详细统计 ═══\n'));

    const scheduledRate = stats.tasks > 0 ? ((stats.scheduled / stats.tasks) * 100).toFixed(1) : '0.0';
    const unscheduled = stats.tasks - stats.scheduled;

    console.log(chalk.white('核心指标:'));
    console.log(chalk.white(`  排程完成率: ${chalk.green(`${scheduledRate}%`)}`));
    console.log(chalk.white(`  已排程任务: ${stats.scheduled}`));
    console.log(chalk.white(`  未排程任务: ${unscheduled > 0 ? chalk.red(unscheduled) : unscheduled}`));
    console.log(chalk.white(`  冲突数量: ${stats.conflicts > 0 ? chalk.red(stats.conflicts) : stats.conflicts}`));

    console.log(chalk.white('\n基础设施:'));
    console.log(chalk.white(`  工区数量: ${stats.workZones}`));
    console.log(chalk.white(`  封锁区段: ${stats.blockSections}`));
    console.log(chalk.white(`  天窗计划: ${stats.windows}`));
    console.log(chalk.white(`  资源总数: ${stats.resources}`));

    const people = Array.from(storage.db.resources.values()).filter(r => r.type === 'people').length;
    const machines = Array.from(storage.db.resources.values()).filter(r => r.type === 'machine').length;
    const materials = Array.from(storage.db.resources.values()).filter(r => r.type === 'material').length;

    console.log(chalk.white('\n资源结构:'));
    console.log(chalk.white(`  人员: ${people}`));
    console.log(chalk.white(`  机械: ${machines}`));
    console.log(chalk.white(`  材料: ${materials}`));

    const nightWindows = Array.from(storage.db.maintenanceWindows.values()).filter(w => w.windowType === 'night').length;
    const dayWindows = Array.from(storage.db.maintenanceWindows.values()).filter(w => w.windowType === 'day').length;

    console.log(chalk.white('\n天窗分布:'));
    console.log(chalk.white(`  夜间天窗: ${nightWindows}`));
    console.log(chalk.white(`  昼间天窗: ${dayWindows}`));
  });

program.parseAsync(process.argv);
