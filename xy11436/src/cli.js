#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { DataStore } = require('./models/DataStore');
const { OrderCalendarParser } = require('./parsers/OrderCalendarParser');
const { CleaningGroupParser } = require('./parsers/CleaningGroupParser');
const { MaintenanceNoteParser } = require('./parsers/MaintenanceNoteParser');
const { ScanDetailParser } = require('./parsers/ScanDetailParser');
const { Inspector } = require('./utils/Inspector');
const { Fixer } = require('./utils/Fixer');
const { Reporter } = require('./utils/Reporter');
const { SourceEvidence } = require('./models/Task');

const program = new Command();
const dataStore = new DataStore();
const inspector = new Inspector(dataStore);
const fixer = new Fixer(dataStore);
const reporter = new Reporter(dataStore);

program
  .name('hci')
  .description('民宿保洁排班多源导入巡检 CLI 工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化工作目录')
  .option('--force', '强制重置已有数据')
  .action((options) => {
    console.log(chalk.blue('=== 初始化工作目录 ==='));
    
    if (options.force) {
      const readline = require('readline-sync');
      const confirm = readline.question(chalk.yellow('确认重置所有数据？(yes/no): '));
      if (confirm !== 'yes') {
        console.log(chalk.gray('已取消操作'));
        return;
      }
      dataStore.reset('user');
      console.log(chalk.green('✓ 数据已重置'));
    } else {
      dataStore.init();
      console.log(chalk.green('✓ 工作目录已初始化'));
    }
    
    console.log(chalk.gray(`数据目录: ${dataStore.baseDir}`));
  });

program
  .command('import <file>')
  .description('导入数据文件')
  .option('-t, --type <type>', '数据源类型: order|group|maintenance|scan')
  .option('-o, --operator <name>', '操作者名称', 'user')
  .action((file, options) => {
    console.log(chalk.blue('=== 导入数据 ==='));
    console.log(`文件: ${file}`);
    console.log(`类型: ${options.type || 'auto'}`);

    let parser;
    const fileName = file.split('/').pop().toLowerCase();

    if (options.type === 'order' || fileName.includes('order') || fileName.includes('订单')) {
      parser = new OrderCalendarParser();
    } else if (options.type === 'group' || fileName.includes('group') || fileName.includes('群')) {
      parser = new CleaningGroupParser();
    } else if (options.type === 'maintenance' || fileName.includes('maintenance') || fileName.includes('维修')) {
      parser = new MaintenanceNoteParser();
    } else if (options.type === 'scan' || fileName.includes('scan') || fileName.includes('扫码')) {
      parser = new ScanDetailParser();
    } else {
      console.log(chalk.red('✗ 无法自动识别数据源类型，请使用 --type 指定'));
      console.log(chalk.gray('可用类型: order, group, maintenance, scan'));
      process.exit(1);
    }

    try {
      const result = parser.parse(file, options.operator);
      console.log(`数据源: ${result.source}`);
      console.log(chalk.green(`✓ 成功解析: ${result.success.length} 条`));
      
      if (result.failed.length > 0) {
        console.log(chalk.red(`✗ 解析失败: ${result.failed.length} 条`));
        result.failed.forEach(f => {
          console.log(chalk.gray(`  行${f.lineNumber}: ${f.error}`));
        });
      }

      let added = 0;
      let skipped = 0;

      result.success.forEach(item => {
        try {
          if (result.source === 'scan_detail') {
            const verification = item.verification;
            const existingTask = dataStore.findTask(
              verification.roomNumber,
              verification.date,
              '退房清洁'
            ) || dataStore.findTask(
              verification.roomNumber,
              verification.date,
              '续住清洁'
            );

            if (existingTask) {
              existingTask.addSourceEvidence(verification.evidence, options.operator);
              existingTask.status = 'confirmed';
              dataStore.updateTask(existingTask.id, () => {}, options.operator);
              added++;
            }
          } else {
            let tasks = Array.isArray(item.task) ? item.task : [item.task];
            tasks.forEach(task => {
              const existing = dataStore.findTask(task.roomNumber, task.date, task.type);
              if (existing) {
                try {
                  existing.addSourceEvidence(task.sourceEvidences[0], options.operator);
                  dataStore.updateTask(existing.id, () => {}, options.operator);
                  added++;
                } catch (e) {
                  skipped++;
                }
              } else {
                dataStore.addTask(task, options.operator);
                added++;
              }
            });
          }
        } catch (e) {
          console.log(chalk.gray(`  跳过: ${e.message}`));
          skipped++;
        }
      });

      dataStore.addImportSession({
        source: result.source,
        file,
        success: result.success.length,
        failed: result.failed.length,
        added,
        skipped
      }, options.operator);

      console.log('');
      console.log(chalk.green(`✓ 导入完成: 新增/更新 ${added} 条，跳过 ${skipped} 条`));
    } catch (e) {
      console.log(chalk.red(`✗ 导入失败: ${e.message}`));
      console.log(chalk.gray(e.stack));
      process.exit(1);
    }
  });

program
  .command('check')
  .description('执行冲突检测')
  .option('-d, --date <date>', '指定日期 (YYYY-MM-DD)')
  .option('-o, --operator <name>', '操作者名称', 'system')
  .action((options) => {
    console.log(chalk.blue('=== 执行冲突检测 ==='));
    if (options.date) {
      console.log(`日期: ${options.date}`);
    }

    const results = inspector.runCheck(options.date, options.operator);
    
    console.log(chalk.green(`✓ 已检查 ${results.checked} 条任务`));
    console.log(chalk.yellow(`发现冲突: ${results.conflicts.length} 条`));

    Object.entries(results.byType).forEach(([type, conflicts]) => {
      if (conflicts.length > 0) {
        console.log(`  ${type}: ${conflicts.length} 条`);
      }
    });

    if (results.conflicts.length > 0) {
      console.log('');
      console.log(chalk.red('--- 冲突详情 ---'));
      results.conflicts.slice(0, 10).forEach((c, i) => {
        console.log(`${i + 1}. ${c.type}: ${c.description}`);
      });
      if (results.conflicts.length > 10) {
        console.log(chalk.gray(`... 还有 ${results.conflicts.length - 10} 条冲突`));
      }
    }

    console.log('');
    console.log(chalk.gray('使用 hci report 查看完整报告'));
    console.log(chalk.gray('使用 hci fix 自动修复冲突'));
  });

program
  .command('fix')
  .description('修复冲突')
  .option('-a, --auto', '自动修复所有可修复冲突')
  .option('-t, --task <id>', '指定任务ID')
  .option('-o, --operator <name>', '操作者名称', 'user')
  .option('--override', '人工改判模式')
  .option('--reason <text>', '改判原因')
  .action((options) => {
    console.log(chalk.blue('=== 修复冲突 ==='));

    if (options.auto) {
      const results = fixer.autoFix(options.operator);
      console.log(`尝试修复: ${results.attempted} 条失败任务`);
      console.log(chalk.green(`自动修复: ${results.fixed} 条`));
      if (results.skipped > 0) {
        console.log(chalk.yellow(`无法自动修复: ${results.skipped} 条`));
      }
      return;
    }

    if (options.task && options.override) {
      if (!options.reason) {
        console.log(chalk.red('✗ 人工改判必须提供 --reason'));
        process.exit(1);
      }
      
      const readline = require('readline-sync');
      const date = readline.question('新日期 (留空保持不变): ');
      const type = readline.question('新类型 (留空保持不变): ');
      const linen = readline.question('需要换布草? (yes/no/留空): ');

      const overrideData = {};
      if (date) overrideData.date = date;
      if (type) overrideData.type = type;
      if (linen === 'yes') overrideData.needLinenChange = true;
      if (linen === 'no') overrideData.needLinenChange = false;

      fixer.manualOverride(options.task, overrideData, options.operator, options.reason);
      console.log(chalk.green('✓ 人工改判已应用'));
      return;
    }

    if (options.task) {
      const suggestions = fixer.getFixSuggestions(options.task);
      if (suggestions.length === 0) {
        console.log(chalk.green('该任务无待解决冲突 ✓'));
        return;
      }

      console.log(`任务 ${options.task} 的修复建议:`);
      suggestions.forEach((s, i) => {
        console.log(`\n${i + 1}. ${s.type}: ${s.description}`);
        s.options.forEach((o, j) => {
          console.log(`   ${i + 1}.${j} ${o.label}`);
        });
      });
      return;
    }

    const failed = dataStore.getFailedTasks();
    console.log(`共有 ${failed.length} 条失败任务`);
    console.log('');
    console.log('使用方式:');
    console.log('  hci fix --auto              自动修复');
    console.log('  hci fix --task <id>         查看建议');
    console.log('  hci fix --task <id> --override --reason "..."  人工改判');
  });

program
  .command('report')
  .description('生成报表')
  .option('-d, --date <date>', '指定日期')
  .option('-f, --format <format>', '输出格式: console|json|csv', 'console')
  .action((options) => {
    console.log(chalk.blue('=== 生成报表 ==='));
    
    reporter.generateFullReport(options.date, options.format);
  });

program
  .command('history')
  .description('查看操作历史')
  .option('-l, --limit <n>', '显示最近N条', 10)
  .option('--snapshots', '查看快照列表')
  .option('--diff <snapshot>', '对比当前与指定快照')
  .action((options) => {
    console.log(chalk.blue('=== 操作历史 ==='));

    if (options.snapshots) {
      const snapshots = dataStore.listSnapshots();
      console.log(`共 ${snapshots.length} 个快照`);
      console.log('');
      snapshots.slice(0, options.limit).forEach((s, i) => {
        console.log(`${i + 1}. ${s.file}`);
        console.log(`   时间: ${s.timestamp}`);
        console.log(`   操作者: ${s.operator}`);
        console.log(`   原因: ${s.reason}`);
        console.log(`   任务数: ${s.taskCount}`);
        console.log('');
      });
      return;
    }

    if (options.diff) {
      const snapshot = dataStore.loadSnapshot(options.diff);
      const current = {
        timestamp: 'current',
        data: dataStore.load()
      };
      const diff = reporter.generateCompareReport(snapshot, current);
      
      console.log(`对比: ${snapshot.timestamp} -> 当前`);
      console.log(`变更数: ${diff.changes.length}`);
      console.log('');
      
      diff.changes.slice(0, options.limit).forEach((c, i) => {
        const icon = c.type === 'added' ? '+' : c.type === 'removed' ? '-' : '~';
        console.log(`${icon} ${c.roomNumber} (${c.date})`);
        if (c.type === 'modified') {
          console.log(`   ${c.before.status} -> ${c.after.status}`);
        }
      });
      return;
    }

    const snapshots = dataStore.listSnapshots();
    console.log(`最近 ${Math.min(options.limit, snapshots.length)} 次操作:`);
    console.log('');
    snapshots.slice(0, options.limit).forEach((s, i) => {
      console.log(`${i + 1}. [${s.timestamp}] ${s.operator}: ${s.reason}`);
    });
  });

program
  .command('export')
  .description('导出排班数据')
  .option('-d, --date <date>', '指定日期')
  .option('-o, --output <file>', '输出文件')
  .option('--freeze', '导出前冻结数据')
  .option('--operator <name>', '操作者', 'export')
  .action((options) => {
    console.log(chalk.blue('=== 导出数据 ==='));

    if (options.freeze && !dataStore.isFrozen()) {
      dataStore.freezeAll(options.operator);
      console.log(chalk.yellow('⚠ 数据已冻结，修改前请先解冻'));
    }

    const data = dataStore.load();
    const tasks = options.date 
      ? data.tasks.filter(t => t.date === options.date)
      : data.tasks;

    const exportData = tasks.map(task => ({
      房间号: task.roomNumber,
      日期: task.date,
      类型: task.type,
      状态: task.status,
      换布草: task.needLinenChange ? '是' : '否',
      客人: task.guestName || '',
      备注: task.notes.map(n => n.message).join('; '),
      来源数: task.sourceEvidences.length,
      冲突数: task.conflicts.length,
      人工改判: task.manualOverride ? '是' : '否'
    }));

    const { stringify } = require('csv-stringify/sync');
    const csv = stringify(exportData, { header: true });

    const outputFile = options.output || `data/exports/export-${options.date || 'all'}.csv`;
    const fs = require('fs');
    const path = require('path');
    
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, csv);

    console.log(chalk.green(`✓ 已导出 ${tasks.length} 条记录`));
    console.log(`文件: ${outputFile}`);
  });

program
  .command('freeze')
  .description('冻结/解冻数据')
  .option('--unfreeze', '解冻数据')
  .option('-o, --operator <name>', '操作者', 'user')
  .action((options) => {
    if (options.unfreeze) {
      dataStore.unfreezeAll(options.operator);
      console.log(chalk.green('✓ 数据已解冻'));
    } else {
      dataStore.freezeAll(options.operator);
      console.log(chalk.yellow('⚠ 数据已冻结'));
    }
  });

program.parseAsync(process.argv).catch(err => {
  console.error(chalk.red('错误:'), err.message);
  console.error(chalk.gray(err.stack));
  process.exit(1);
});
