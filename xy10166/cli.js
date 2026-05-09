#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

const ScheduleImporter = require('./src/services/ScheduleImporter');
const ConflictDetector = require('./src/services/ConflictDetector');
const HistoryManager = require('./src/services/HistoryManager');
const ReportExporter = require('./src/services/ReportExporter');
const Appointment = require('./src/models/Appointment');

const program = new Command();

program
  .name('clinic-schedule')
  .description('诊疗预约冲突检查 CLI 工具')
  .version('1.0.0');

const importer = new ScheduleImporter();
const detector = new ConflictDetector();
const historyManager = new HistoryManager();
const exporter = new ReportExporter();

function printHeader(title) {
  console.log('\n' + chalk.bold.cyan('═'.repeat(60)));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.bold.cyan('═'.repeat(60)) + '\n');
}

function printSuccess(message) {
  console.log(chalk.green(`✓ ${message}`));
}

function printWarning(message) {
  console.log(chalk.yellow(`⚠ ${message}`));
}

function printError(message) {
  console.log(chalk.red(`✗ ${message}`));
}

function printInfo(message) {
  console.log(chalk.blue(`ℹ ${message}`));
}

function formatDate(dateStr) {
  return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss');
}

program
  .command('import')
  .description('导入排班数据')
  .argument('<file>', '排班数据文件路径 (JSON 或 CSV)')
  .option('-v, --validate', '仅验证数据，不保存')
  .option('-o, --overwrite', '覆盖已存在的相同 ID 记录')
  .action(async (file, options) => {
    printHeader('排班导入');
    printInfo(`文件: ${file}`);
    printInfo(`模式: ${options.validate ? '验证模式' : options.overwrite ? '覆盖模式' : '追加模式'}`);
    console.log('');

    const result = await importer.importFromFile(file, {
      validateOnly: options.validate,
      overwrite: options.overwrite
    });

    if (result.success) {
      printSuccess(result.message);
      
      if (result.importedCount > 0) {
        console.log('');
        const table = new Table({
          head: ['指标', '数值'],
          colWidths: [20, 40]
        });
        table.push(['成功导入', result.importedCount]);
        if (result.duplicateCount > 0) {
          table.push(['跳过重复', result.duplicateCount]);
        }
        if (result.errorCount > 0) {
          table.push(['无效记录', result.errorCount]);
        }
        table.push(['操作时间', formatDate(result.timestamp)]);
        console.log(table.toString());
      }

      if (result.errorCount > 0 && result.invalidRecords.length > 0) {
        console.log('');
        printWarning(`以下记录无效：`);
        for (const invalid of result.invalidRecords) {
          console.log(`  第 ${invalid.index + 1} 行: ${invalid.errors.join(', ')}`);
        }
      }

      if (result.duplicateCount > 0 && result.duplicates.length > 0) {
        console.log('');
        printWarning(`重复的预约 ID (已跳过): ${result.duplicates.slice(0, 10).join(', ')}${result.duplicates.length > 10 ? '...' : ''}`);
      }
    } else {
      printError(result.message);
      if (result.error) {
        console.log(chalk.red(`  详情: ${result.error}`));
      }
      process.exit(1);
    }

    console.log('');
  });

program
  .command('check')
  .description('检测预约冲突')
  .option('-s, --start <date>', '开始日期 (YYYY-MM-DD)')
  .option('-e, --end <date>', '结束日期 (YYYY-MM-DD)')
  .option('-r, --resource <type>', '指定资源类型检测 (doctor/room/equipment)')
  .option('--no-midnight', '禁用跨午夜拆分检测')
  .option('--save-history', '保存检查结果到历史记录')
  .action(async (options) => {
    printHeader('冲突检测');

    const checkOptions = {
      includeMidnight: options.midnight !== false
    };

    if (options.start && options.end) {
      checkOptions.dateRange = {
        start: options.start,
        end: options.end
      };
      printInfo(`检测范围: ${options.start} ~ ${options.end}`);
    }

    if (options.resource) {
      const resourceMap = {
        doctor: 'doctor',
        room: 'room',
        equipment: 'equipment'
      };
      if (resourceMap[options.resource]) {
        checkOptions.resourceTypes = [resourceMap[options.resource]];
        printInfo(`检测资源: ${options.resource}`);
      } else {
        printError(`无效的资源类型: ${options.resource}`);
        printInfo(`有效值: doctor, room, equipment`);
        process.exit(1);
      }
    }

    console.log('');
    printInfo('正在检测...');

    const result = await detector.detectConflicts(checkOptions);

    if (result.success) {
      if (result.conflicts.length === 0) {
        printSuccess(result.message);
      } else {
        printWarning(result.message);
      }

      console.log('');
      const statsTable = new Table({
        head: ['统计项', '数值'],
        colWidths: [20, 40]
      });
      statsTable.push(['总预约数', result.totalAppointments]);
      statsTable.push(['实际检测', result.checkedAppointments]);
      if (result.midnightAppointments > 0) {
        statsTable.push(['跨午夜预约', result.midnightAppointments]);
      }
      statsTable.push(['冲突总数', result.conflicts.length]);
      console.log(statsTable.toString());

      if (result.conflicts.length > 0) {
        console.log('');
        printWarning('冲突详情：');
        console.log('');

        const severityColors = {
          high: chalk.red,
          medium: chalk.yellow,
          low: chalk.green
        };

        const resourceNames = {
          doctor: '医生',
          room: '诊室',
          equipment: '设备'
        };

        const sortedConflicts = [...result.conflicts].sort((a, b) => {
          const severityOrder = { high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        });

        for (let i = 0; i < sortedConflicts.length; i++) {
          const conflict = sortedConflicts[i];
          const color = severityColors[conflict.severity];
          
          console.log(color(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
          console.log(color(`冲突 #${i + 1} [${conflict.severity.toUpperCase()}]`));
          console.log(color(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
          console.log(`  资源类型: ${resourceNames[conflict.resourceType]} (${conflict.resourceId})`);
          console.log(`  重叠时间: ${conflict.overlapMinutes} 分钟`);
          console.log(`  描述: ${conflict.description}`);
          console.log('');
          console.log('  涉及预约：');
          for (const slot of conflict.affectedSlots || []) {
            let line = `    - ${slot.patientName} (${slot.patientId})`;
            line += `: ${slot.startTime} ~ ${slot.endTime}`;
            if (slot.isSplit) line += chalk.gray(' (跨午夜)');
            console.log(line);
          }
          console.log('');
          console.log(chalk.cyan(`  💡 建议: ${conflict.suggestion}`));
          console.log('');
        }
      }

      if (options.saveHistory) {
        await historyManager.saveCheckResult(result);
        printInfo('检查结果已保存到历史记录');
      }
    } else {
      printError(result.message);
      if (result.error) {
        console.log(chalk.red(`  详情: ${result.error}`));
      }
      process.exit(1);
    }

    console.log('');
  });

program
  .command('list')
  .description('列出所有预约')
  .option('-s, --start <date>', '开始日期筛选')
  .option('-e, --end <date>', '结束日期筛选')
  .option('--only-midnight', '仅显示跨午夜预约')
  .action(async (options) => {
    printHeader('预约列表');

    const dataFile = path.join(process.cwd(), 'data', 'appointments.json');
    if (!fs.existsSync(dataFile)) {
      printWarning('没有找到预约数据，请先导入排班');
      console.log('');
      return;
    }

    const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    let appointments = rawData.map(data => new Appointment(data));

    if (options.onlyMidnight) {
      appointments = appointments.filter(apt => apt.spansMidnight());
    }

    if (options.start || options.end) {
      const start = options.start ? new Date(options.start) : null;
      const end = options.end ? new Date(options.end) : null;
      
      appointments = appointments.filter(apt => {
        if (start && apt.endTime < start) return false;
        if (end && apt.startTime > end) return false;
        return true;
      });
    }

    if (appointments.length === 0) {
      printInfo('没有匹配的预约');
      console.log('');
      return;
    }

    const table = new Table({
      head: ['ID', '患者', '医生', '诊室', '时间', '状态'],
      colWidths: [15, 12, 10, 10, 28, 12]
    });

    for (const apt of appointments) {
      const timeStr = `${format(apt.startTime, 'MM-dd HH:mm')}~${format(apt.endTime, 'HH:mm')}`;
      const status = apt.spansMidnight() ? chalk.yellow('跨午夜') : '正常';
      table.push([
        apt.id.substring(0, 12),
        apt.patientName,
        apt.doctorId,
        apt.roomId,
        timeStr,
        status
      ]);
    }

    console.log(table.toString());
    printSuccess(`共 ${appointments.length} 个预约`);
    console.log('');
  });

program
  .command('history')
  .description('查看检查历史')
  .option('-n, --limit <n>', '显示最近 N 条记录', parseInt)
  .option('--clear', '清除所有历史记录')
  .option('--compare', '与上次检查对比')
  .action(async (options) => {
    if (options.clear) {
      printHeader('清除历史记录');
      const result = await historyManager.clearHistory();
      if (result.cleared) {
        printSuccess('历史记录已清除');
      }
      console.log('');
      return;
    }

    printHeader('检查历史');

    const limit = options.limit || 10;
    const { entries, total } = await historyManager.getHistory({ limit });

    if (entries.length === 0) {
      printInfo('没有历史记录');
      console.log('');
      return;
    }

    const table = new Table({
      head: ['时间', '预约数', '冲突数', '结果'],
      colWidths: [20, 10, 10, 25]
    });

    for (const entry of entries) {
      const resultColor = entry.summary.conflictCount > 0 ? chalk.yellow : chalk.green;
      table.push([
        formatDate(entry.timestamp),
        entry.summary.totalAppointments,
        entry.summary.conflictCount,
        resultColor(entry.summary.conflictCount > 0 ? '有冲突' : '无冲突')
      ]);
    }

    console.log(table.toString());
    printInfo(`显示最近 ${entries.length} 条，共 ${total} 条历史记录`);
    console.log('');
  });

program
  .command('export')
  .description('导出冲突报告')
  .option('-f, --format <type>', '导出格式: json/md/both', 'md')
  .option('--no-details', '不导出详细冲突信息')
  .option('--run-check', '导出前先运行冲突检测')
  .action(async (options) => {
    printHeader('导出报告');

    let checkResult = null;

    if (options.runCheck) {
      printInfo('正在运行冲突检测...');
      checkResult = await detector.detectConflicts();
      
      if (!checkResult.success) {
        printError('冲突检测失败');
        process.exit(1);
      }

      await historyManager.saveCheckResult(checkResult);
      printSuccess('检测完成，结果已保存到历史');
      console.log('');
    } else {
      const dataFile = path.join(process.cwd(), 'data', 'appointments.json');
      if (!fs.existsSync(dataFile)) {
        printWarning('没有预约数据，先导入或使用 --run-check 选项');
        console.log('');
        return;
      }
      
      checkResult = await detector.detectConflicts();
    }

    const exportOptions = {
      includeDetails: options.details !== false
    };

    const exportedFiles = [];

    if (options.format === 'json' || options.format === 'both') {
      const result = await exporter.exportJSONReport(checkResult, exportOptions);
      exportedFiles.push(result);
      printSuccess(`JSON 报告已导出: ${result.fileName}`);
    }

    if (options.format === 'md' || options.format === 'both') {
      const result = await exporter.exportMarkdownReport(checkResult, exportOptions);
      exportedFiles.push(result);
      printSuccess(`Markdown 报告已导出: ${result.fileName}`);
    }

    console.log('');
    const table = new Table({
      head: ['文件名', '格式', '冲突数'],
      colWidths: [35, 10, 10]
    });

    for (const file of exportedFiles) {
      table.push([file.fileName, file.format, file.conflictCount]);
    }

    console.log(table.toString());
    printInfo(`输出目录: ${exporter.outputDir}`);
    console.log('');
  });

program
  .command('clean')
  .description('清除所有数据')
  .option('--force', '跳过确认')
  .action(async (options) => {
    printHeader('数据清除');

    if (!options.force) {
      printWarning('此操作将清除所有预约数据和历史记录！');
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question('确认继续？(yes/no): ', resolve);
      });
      readline.close();

      if (answer !== 'yes') {
        printInfo('操作已取消');
        console.log('');
        return;
      }
    }

    const dataDir = path.join(process.cwd(), 'data');
    let deleted = 0;

    const filesToDelete = [
      path.join(dataDir, 'appointments.json'),
      path.join(dataDir, 'history', 'check_history.json')
    ];

    for (const file of filesToDelete) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        deleted++;
      }
    }

    printSuccess(`已清除 ${deleted} 个数据文件`);
    console.log('');
  });

program
  .command('workflow')
  .description('运行完整工作流示例')
  .option('--sample-dir <dir>', '示例数据目录', 'examples')
  .action(async (options) => {
    printHeader('完整工作流演示');
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log('');

    const sampleDir = path.join(process.cwd(), options.sampleDir);
    
    if (!fs.existsSync(sampleDir)) {
      printError(`示例数据目录不存在: ${sampleDir}`);
      printInfo('请确保 examples/ 目录包含示例排班数据');
      process.exit(1);
    }

    const steps = [
      { name: '导入正常排班', file: path.join(sampleDir, 'schedule_normal.json'), options: {} },
      { name: '验证数据', file: path.join(sampleDir, 'schedule_conflict.json'), options: { validateOnly: true } },
      { name: '导入冲突数据', file: path.join(sampleDir, 'schedule_conflict.json'), options: {} },
      { name: '冲突检测', action: 'check', options: {} },
      { name: '导出报告', action: 'export', options: { format: 'both' } }
    ];

    let stepIndex = 1;
    const results = [];

    for (const step of steps) {
      console.log('');
      console.log(chalk.bold.blue(`[步骤 ${stepIndex}] ${step.name}`));
      console.log(chalk.gray('─'.repeat(50)));
      
      if (step.file) {
        printInfo(`文件: ${path.basename(step.file)}`);
        const result = await importer.importFromFile(step.file, step.options);
        results.push({ step: step.name, result });
        
        if (result.success) {
          printSuccess(result.message);
        } else {
          printError(result.message);
          if (result.errorCount > 0) {
            printWarning(`无效记录: ${result.errorCount} 条`);
          }
        }
      } else if (step.action === 'check') {
        const result = await detector.detectConflicts(step.options);
        results.push({ step: step.name, result });
        
        if (result.success) {
          if (result.conflicts.length > 0) {
            printWarning(result.message);
            const severity = result.statistics.bySeverity;
            printInfo(`严重: ${severity.high}, 中等: ${severity.medium}, 轻微: ${severity.low}`);
          } else {
            printSuccess(result.message);
          }
          await historyManager.saveCheckResult(result);
        }
      } else if (step.action === 'export') {
        const checkResult = results.find(r => r.step === '冲突检测')?.result;
        if (checkResult) {
          if (step.options.format === 'both') {
            const jsonResult = await exporter.exportJSONReport(checkResult);
            const mdResult = await exporter.exportMarkdownReport(checkResult);
            results.push({ step: step.name, result: { files: [jsonResult, mdResult] } });
            printSuccess('报告已导出 (JSON + Markdown)');
          }
        }
      }

      stepIndex++;
    }

    console.log('');
    console.log(chalk.bold.green('✓ 工作流执行完成！'));
    console.log('');
    console.log(chalk.cyan('输出位置：'));
    console.log(`  - 预约数据: ${path.join(process.cwd(), 'data', 'appointments.json')}`);
    console.log(`  - 历史记录: ${path.join(process.cwd(), 'data', 'history')}`);
    console.log(`  - 报告文件: ${path.join(process.cwd(), 'data', 'output')}`);
    console.log('');
  });

program.parseAsync(process.argv).catch((err) => {
  printError(err.message);
  process.exit(1);
});
