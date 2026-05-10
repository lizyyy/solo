#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const readline = require('readline');

const DataStore = require('./src/dataStore');
const Importer = require('./src/importer');
const CheckInEngine = require('./src/checkInEngine');
const ReportExporter = require('./src/reportExporter');
const { CheckInStatus } = require('./src/models');

const program = new Command();
let store, importer, engine, exporter;

function init() {
  store = new DataStore('./data');
  importer = new Importer(store);
  engine = new CheckInEngine(store);
  exporter = new ReportExporter(engine);
}

function formatStatus(status) {
  const formats = {
    [CheckInStatus.VALUES.APPROVED]: chalk.green('允许通过'),
    [CheckInStatus.VALUES.PENDING]: chalk.yellow('待检录'),
    [CheckInStatus.VALUES.PENDING_EQUIPMENT]: chalk.red('待补装备'),
    [CheckInStatus.VALUES.WAIVED]: chalk.cyan('人工豁免'),
    [CheckInStatus.VALUES.REJECTED]: chalk.red('拒绝通过')
  };
  return formats[status] || status;
}

program
  .name('race-checkin')
  .description('赛事装备检录 CLI 工具')
  .version('1.0.0');

program
  .command('import-athletes <file>')
  .description('导入选手名单 (CSV 或 JSON)')
  .action((file) => {
    init();
    try {
      let result;
      if (file.endsWith('.json')) {
        result = importer.importAthletesFromJSON(file);
      } else {
        result = importer.importAthletesFromCSV(file);
      }
      console.log(chalk.green(`✓ 成功导入 ${result.count} 名选手`));
      result.athletes.slice(0, 5).forEach(a => {
        console.log(`  - ${a.bib}: ${a.name}`);
      });
      if (result.count > 5) {
        console.log(`  ... 还有 ${result.count - 5} 名选手`);
      }
    } catch (err) {
      console.error(chalk.red(`✗ 导入失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('import-equipment <file>')
  .description('导入强制装备清单 (CSV 或 JSON)')
  .action((file) => {
    init();
    try {
      let result;
      if (file.endsWith('.json')) {
        result = importer.importEquipmentFromJSON(file);
      } else {
        result = importer.importEquipmentFromCSV(file);
      }
      console.log(chalk.green(`✓ 成功导入 ${result.count} 项装备`));
      result.items.forEach(e => {
        const req = e.required ? chalk.red('强制') : chalk.yellow('可选');
        console.log(`  - [${e.id}] ${e.name} (${req})`);
      });
    } catch (err) {
      console.error(chalk.red(`✗ 导入失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('scan-bib <bib>')
  .description('扫描发放号码布')
  .option('-s, --scanner <name>', '扫描员名称', 'default')
  .action((bib, options) => {
    init();
    const validation = engine.validateBibScan(bib);
    
    if (!validation.exists) {
      console.log(chalk.red(`✗ 号码布 ${bib} 不存在于选手名单中`));
      console.log(chalk.yellow('  异常: 号码布与选手不匹配'));
      process.exit(1);
    }
    
    if (validation.duplicate) {
      console.log(chalk.yellow(`⚠ 号码布 ${bib} 已发放`));
      console.log(`  选手: ${validation.athlete.name}`);
      console.log(chalk.red('  异常: 重复扫描同一选手'));
      process.exit(1);
    }
    
    store.addBibScan(bib, options.scanner);
    console.log(chalk.green(`✓ 号码布 ${bib} 发放成功`));
    console.log(`  选手: ${validation.athlete.name}`);
  });

program
  .command('scan-supply <bib>')
  .description('扫描发放补给包')
  .option('-s, --scanner <name>', '扫描员名称', 'default')
  .action((bib, options) => {
    init();
    const validation = engine.validateSupplyScan(bib);
    
    if (!validation.exists) {
      console.log(chalk.red(`✗ 号码布 ${bib} 不存在于选手名单中`));
      process.exit(1);
    }
    
    if (validation.duplicate) {
      console.log(chalk.yellow(`⚠ 补给包已发放给 ${bib}`));
      console.log(`  选手: ${validation.athlete.name}`);
      console.log(chalk.red('  异常: 重复发放补给包'));
      process.exit(1);
    }
    
    const checkStatus = engine.getAthleteCheckInStatus(bib);
    if (!checkStatus.hasBib) {
      console.log(chalk.yellow(`⚠ 号码布 ${bib} 尚未完成检录`));
      console.log(chalk.red('  警告: 补给包已领但未检录'));
    }
    
    store.addSupplyScan(bib, options.scanner);
    console.log(chalk.green(`✓ 补给包发放成功`));
    console.log(`  号码布: ${bib}, 选手: ${validation.athlete.name}`);
  });

program
  .command('check-equipment <bib>')
  .description('现场装备检查录入')
  .option('-m, --missing <ids>', '缺少的装备ID，用逗号分隔', '')
  .option('-p, --present <ids>', '已有的装备ID，用逗号分隔', '')
  .action((bib, options) => {
    init();
    const athlete = store.athletes.get(bib);
    if (!athlete) {
      console.log(chalk.red(`✗ 选手 ${bib} 不存在`));
      process.exit(1);
    }
    
    if (options.present) {
      options.present.split(',').forEach(id => {
        if (store.equipment.has(id.trim())) {
          store.addEquipmentCheck(bib, id.trim(), true);
        }
      });
    }
    
    if (options.missing) {
      options.missing.split(',').forEach(id => {
        if (store.equipment.has(id.trim())) {
          store.addEquipmentCheck(bib, id.trim(), false);
        }
      });
    }
    
    const status = engine.getAthleteCheckInStatus(bib);
    console.log(`选手: ${bib} - ${athlete.name}`);
    console.log(`状态: ${formatStatus(status.status)}`);
    
    const equipStatus = store.getAthleteEquipmentStatus(bib);
    console.log('\n装备检查状态:');
    Object.values(equipStatus).forEach(s => {
      const indicator = s.present ? chalk.green('✓') : (s.waived ? chalk.cyan('⚑') : chalk.red('✗'));
      const req = s.item.required ? '' : ' (可选)';
      console.log(`  ${indicator} ${s.item.name}${req}`);
    });
    
    if (status.missingEquipment.length > 0) {
      console.log(chalk.red(`\n缺少装备: ${status.missingEquipment.map(e => e.name).join(', ')}`));
    }
  });

program
  .command('status <bib>')
  .description('查看选手检录状态')
  .action((bib) => {
    init();
    const status = engine.getAthleteCheckInStatus(bib);
    
    if (!status.athlete) {
      console.log(chalk.red(`✗ 选手 ${bib} 不存在`));
      process.exit(1);
    }
    
    console.log(chalk.bold(`\n=== 选手 ${bib} 检录状态 ===`));
    console.log(`姓名: ${status.athlete.name}`);
    console.log(`组别: ${status.athlete.category || '-'}`);
    console.log(`性别: ${status.athlete.gender || '-'}`);
    console.log(`状态: ${formatStatus(status.status)}`);
    console.log(`号码布: ${status.hasBib ? chalk.green('已发放') : chalk.yellow('未发放')}`);
    console.log(`补给包: ${status.hasSupply ? chalk.green('已发放') : chalk.yellow('未发放')}`);
    
    if (status.issues.length > 0) {
      console.log(chalk.red('\n问题:'));
      status.issues.forEach(i => console.log(`  - ${i}`));
    }
    
    if (status.warnings.length > 0) {
      console.log(chalk.yellow('\n警告:'));
      status.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    if (status.missingEquipment.length > 0) {
      console.log(chalk.red('\n缺少装备:'));
      status.missingEquipment.forEach(e => console.log(`  - [${e.id}] ${e.name}`));
    }
  });

program
  .command('list-missing')
  .description('查看所有缺项装备的选手')
  .action(() => {
    init();
    const missing = store.getAthletesWithMissingEquipment();
    
    if (missing.length === 0) {
      console.log(chalk.green('✓ 所有选手装备齐全'));
      return;
    }
    
    console.log(chalk.bold(`\n=== 缺项装备列表 (${missing.length}人) ===\n`));
    missing.forEach(({ athlete, missing: miss }) => {
      console.log(`${chalk.red(athlete.bib)}: ${athlete.name}`);
      console.log(`  缺少: ${miss.map(e => e.name).join(', ')}`);
      console.log();
    });
  });

program
  .command('list-waived')
  .description('查看所有有人工豁免的选手')
  .action(() => {
    init();
    const waived = store.getAthletesWithWaivings();
    
    if (waived.length === 0) {
      console.log(chalk.yellow('暂无人工豁免记录'));
      return;
    }
    
    console.log(chalk.bold(`\n=== 人工豁免列表 (${waived.length}人) ===\n`));
    waived.forEach(({ athlete, waivings }) => {
      console.log(`${chalk.cyan(athlete.bib)}: ${athlete.name}`);
      waivings.forEach(w => {
        const item = store.equipment.get(w.equipmentId);
        console.log(`  - ${item?.name || w.equipmentId}: ${w.reason}`);
        console.log(`    授权人: ${w.authorizedBy}, 时间: ${w.timestamp}`);
      });
      console.log();
    });
  });

program
  .command('waive <bib> <equipmentId> <reason>')
  .description('人工豁免某项装备')
  .option('-a, --authorizer <name>', '授权人', 'admin')
  .action((bib, equipmentId, reason, options) => {
    init();
    
    const athlete = store.athletes.get(bib);
    const equipment = store.equipment.get(equipmentId);
    
    if (!athlete) {
      console.log(chalk.red(`✗ 选手 ${bib} 不存在`));
      process.exit(1);
    }
    
    if (!equipment) {
      console.log(chalk.red(`✗ 装备 ${equipmentId} 不存在`));
      process.exit(1);
    }
    
    store.addWaiving(bib, equipmentId, reason, options.authorizer);
    console.log(chalk.cyan(`✓ 人工豁免已记录`));
    console.log(`  选手: ${bib} - ${athlete.name}`);
    console.log(`  豁免装备: ${equipment.name}`);
    console.log(`  原因: ${reason}`);
    console.log(`  授权人: ${options.authorizer}`);
  });

program
  .command('statistics')
  .description('查看当前检录统计')
  .action(() => {
    init();
    const stats = engine.getStatistics();
    
    console.log(chalk.bold('\n=== 检录统计 ===\n'));
    console.log(`总选手数: ${stats.total}`);
    console.log();
    console.log(chalk.green(`允许通过: ${stats.byStatus.approved}`));
    console.log(chalk.yellow(`待检录: ${stats.byStatus.pending}`));
    console.log(chalk.red(`待补装备: ${stats.byStatus.pendingEquipment}`));
    console.log(chalk.cyan(`人工豁免: ${stats.byStatus.waived}`));
    console.log();
    console.log(`号码布已发放: ${stats.bibIssued}`);
    console.log(`补给包已发放: ${stats.supplyIssued}`);
    console.log(`有人工豁免: ${stats.hasWaiving}`);
    console.log(`有缺项装备: ${stats.withMissingEquipment}`);
    console.log();
    console.log(chalk.bold(`通过率(含豁免): ${stats.approvalRate}%`));
    
    if (stats.anomalies.length > 0) {
      console.log(chalk.yellow(`\n异常记录数: ${stats.anomalies.length}`));
      stats.anomalies.slice(0, 5).forEach(s => {
        console.log(`  - ${s.bib}: ${s.athlete?.name}`);
        if (s.warnings.length > 0) {
          s.warnings.forEach(w => console.log(`    ${chalk.yellow('警告:')} ${w}`));
        }
      });
    }
  });

program
  .command('export <outputPath>')
  .description('导出检录报告')
  .option('-f, --format <type>', '导出格式: json, csv, text', 'text')
  .action((outputPath, options) => {
    init();
    
    let report;
    switch (options.format.toLowerCase()) {
      case 'json':
        report = exporter.exportToJSON(outputPath);
        break;
      case 'csv':
        report = exporter.exportToCSV(outputPath);
        break;
      case 'text':
      default:
        report = exporter.exportToText(outputPath);
    }
    
    console.log(chalk.green(`✓ 报告已导出到: ${outputPath}`));
    console.log(chalk.bold('\n=== 汇总 ==='));
    console.log(`总选手数: ${report.summary.totalAthletes}`);
    console.log(chalk.green(`允许通过: ${report.summary.approved}`));
    console.log(chalk.yellow(`待检录: ${report.summary.pending}`));
    console.log(chalk.red(`待补装备: ${report.summary.pendingEquipment}`));
    console.log(chalk.cyan(`人工豁免: ${report.summary.waived}`));
    console.log(chalk.bold(`通过率: ${report.summary.approvalRate}%`));
  });

program
  .command('reset')
  .description('重置所有数据（谨慎使用）')
  .option('-y, --yes', '确认重置')
  .action((options) => {
    if (!options.yes) {
      console.log(chalk.yellow('警告: 此操作将删除所有数据。使用 --yes 确认。'));
      process.exit(1);
    }
    init();
    store.reset();
    console.log(chalk.green('✓ 数据已重置'));
  });

program
  .command('list-athletes')
  .description('列出所有选手')
  .option('-l, --limit <n>', '显示数量限制', '20')
  .action((options) => {
    init();
    const limit = parseInt(options.limit) || 20;
    const athletes = Array.from(store.athletes.values()).slice(0, limit);
    
    if (athletes.length === 0) {
      console.log(chalk.yellow('暂无选手数据'));
      return;
    }
    
    console.log(chalk.bold(`\n=== 选手列表 (共${store.athletes.size}人，显示前${athletes.length}人) ===\n`));
    athletes.forEach(a => {
      const status = engine.getAthleteCheckInStatus(a.bib);
      console.log(`${a.bib.padEnd(6)} ${a.name.padEnd(12)} ${(a.category || '-').padEnd(10)} ${formatStatus(status.status)}`);
    });
  });

program
  .command('list-equipment')
  .description('列出所有装备')
  .action(() => {
    init();
    const items = Array.from(store.equipment.values());
    
    if (items.length === 0) {
      console.log(chalk.yellow('暂无装备数据'));
      return;
    }
    
    console.log(chalk.bold('\n=== 装备清单 ===\n'));
    items.forEach(e => {
      const req = e.required ? chalk.red('[强制]') : chalk.yellow('[可选]');
      console.log(`${e.id.padEnd(8)} ${e.name.padEnd(20)} ${req} ${e.category || ''}`);
    });
  });

program.parse(process.argv);
