#!/usr/bin/env node

const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const dayjs = require('dayjs');

const DataStore = require('../src/services/dataStore');
const ImportService = require('../src/services/importService');
const AnalysisService = require('../src/services/analysisService');
const ReportService = require('../src/services/reportService');

const program = new Command();
const DATA_DIR = path.join(process.cwd(), 'data');

let dataStore, importService, analysisService, reportService;

function initServices() {
  dataStore = new DataStore(DATA_DIR);
  importService = new ImportService(dataStore);
  analysisService = new AnalysisService(dataStore);
  reportService = new ReportService(dataStore);
}

program
  .name('cold-inventory')
  .description('仓储冷库温区盘点 CLI')
  .version('1.0.0')
  .option('-d, --data-dir <dir>', '数据目录', DATA_DIR);

program
  .command('import-inventory')
  .description('导入 WMS 库存清单')
  .argument('<file>', '库存文件路径 (CSV 或 Excel)')
  .option('-s, --update-strategy <strategy>', '更新策略: update(更新)|skip(跳过)', 'update')
  .action(async (file, options) => {
    try {
      initServices();
      console.log(chalk.blue(`\n开始导入库存清单: ${file}`));
      console.log(chalk.gray(`更新策略: ${options.updateStrategy}`));
      
      const result = await importService.importInventory(file, {
        updateStrategy: options.updateStrategy
      });
      
      printImportResult(result);
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('import-temperature')
  .description('导入温度记录')
  .argument('<file>', '温度记录文件路径 (CSV 或 Excel)')
  .action(async (file) => {
    try {
      initServices();
      console.log(chalk.blue(`\n开始导入温度记录: ${file}`));
      
      const result = await importService.importTemperature(file);
      
      printImportResult(result);
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('import-count')
  .description('导入人工盘点数据')
  .argument('<file>', '盘点数据文件路径 (CSV 或 Excel)')
  .action(async (file) => {
    try {
      initServices();
      console.log(chalk.blue(`\n开始导入盘点数据: ${file}`));
      
      const result = await importService.importManualCount(file);
      
      printImportResult(result);
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('执行综合分析')
  .option('-t, --type <type>', '分析类型: all|lot|temperature|inventory', 'all')
  .action(async (options) => {
    try {
      initServices();
      console.log(chalk.blue('\n开始执行分析...'));
      
      let result;
      switch (options.type) {
        case 'lot':
          result = analysisService.runLotMatchingAnalysis();
          printLotAnalysisResult(result);
          break;
        case 'temperature':
          result = analysisService.runTemperatureBreakAnalysis();
          printTemperatureAnalysisResult(result);
          break;
        case 'inventory':
          result = analysisService.runInventoryDifferenceAnalysis();
          printInventoryAnalysisResult(result);
          break;
        default:
          result = analysisService.runFullAnalysis();
          printFullAnalysisResult(result);
      }
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成每日报告')
  .option('-d, --date <date>', '报告日期 (YYYY-MM-DD)', dayjs().format('YYYY-MM-DD'))
  .option('-o, --output <dir>', '输出目录', './reports')
  .action(async (options) => {
    try {
      initServices();
      console.log(chalk.blue(`\n生成日报: ${options.date}`));
      
      const result = await reportService.generateDailyReport({
        date: options.date,
        outputDir: options.output
      });
      
      console.log(chalk.green('\n✅ 报告生成完成!'));
      console.log(`  JSON报告: ${chalk.cyan(result.jsonReportPath)}`);
      console.log(`  Excel报告: ${chalk.cyan(result.excelReportPath)}`);
      console.log('\n报告摘要:');
      console.log(`  库存批号总数: ${result.summary.totalLots}`);
      console.log(`  温度记录总数: ${result.summary.totalTemperatureRecords}`);
      console.log(`  异常记录总数: ${result.summary.totalExceptions}`);
      console.log(`  未处理异常: ${result.summary.openExceptions}`);
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('exceptions')
  .description('查看异常记录')
  .option('-s, --status <status>', '筛选状态: open|resolved|all', 'open')
  .option('-l, --limit <limit>', '显示数量', '20')
  .action((options) => {
    try {
      initServices();
      const exceptions = dataStore.getExceptions();
      
      let filtered = exceptions.records;
      if (options.status !== 'all') {
        filtered = filtered.filter(e => e.status === options.status);
      }
      
      const limit = parseInt(options.limit);
      const displayed = filtered.slice(0, limit);
      
      console.log(chalk.blue(`\n异常记录 (${options.status === 'all' ? '全部' : options.status}):`));
      console.log(chalk.gray(`共 ${filtered.length} 条, 显示前 ${displayed.length} 条\n`));
      
      for (const exception of displayed) {
        const severityColor = {
          critical: chalk.red,
          high: chalk.yellow,
          medium: chalk.blue,
          low: chalk.gray
        }[exception.severity] || chalk.white;
        
        console.log(`ID: ${exception.id}`);
        console.log(`  批号: ${exception.lotNumber}`);
        console.log(`  类型: ${exception.type}`);
        console.log(`  严重度: ${severityColor(exception.severity.toUpperCase())}`);
        console.log(`  状态: ${exception.status}`);
        console.log(`  原因: ${exception.reason}`);
        console.log(`  来源: ${exception.source}`);
        console.log(`  时间: ${exception.timestamp}`);
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('resolve-exception')
  .description('处理异常')
  .argument('<id>', '异常ID')
  .argument('<resolver>', '处理人')
  .argument('<resolution>', '处理方式')
  .option('-n, --note <note>', '备注')
  .action((id, resolver, resolution, options) => {
    try {
      initServices();
      const exception = analysisService.resolveException(id, resolver, resolution, options.note || '');
      
      console.log(chalk.green('\n✅ 异常已处理'));
      console.log(`  ID: ${exception.id}`);
      console.log(`  处理人: ${exception.resolvedBy}`);
      console.log(`  处理方式: ${exception.resolution}`);
      console.log(`  处理时间: ${exception.resolvedAt}`);
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('查看数据状态')
  .action(() => {
    try {
      initServices();
      const inventory = dataStore.getInventory();
      const temperature = dataStore.getTemperature();
      const exceptions = dataStore.getExceptions();
      const importHistory = dataStore.getImportHistory();
      
      console.log(chalk.blue('\n数据状态概览:'));
      console.log(`  库存批号: ${inventory.lots.length} 个`);
      console.log(`  跨温区移动记录: ${inventory.crossZoneMovements.length} 条`);
      console.log(`  温度记录: ${temperature.records.length} 条`);
      console.log(`  异常记录: ${exceptions.records.length} 条`);
      console.log(`    - 未处理: ${exceptions.records.filter(e => e.status === 'open').length}`);
      console.log(`    - 已处理: ${exceptions.records.filter(e => e.status === 'resolved').length}`);
      console.log(`  导入记录: ${importHistory.length} 次`);
      
      const zoneStats = {};
      for (const lot of inventory.lots) {
        if (!zoneStats[lot.zone]) zoneStats[lot.zone] = 0;
        zoneStats[lot.zone]++;
      }
      
      console.log('\n温区分布:');
      for (const [zone, count] of Object.entries(zoneStats)) {
        console.log(`  ${zone}: ${count} 个批号`);
      }
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('import-history')
  .description('查看导入历史')
  .option('-l, --limit <limit>', '显示数量', '10')
  .action((options) => {
    try {
      initServices();
      const history = dataStore.getImportHistory();
      const limit = parseInt(options.limit);
      const displayed = history.slice(-limit).reverse();
      
      console.log(chalk.blue('\n导入历史:'));
      
      for (const imp of displayed) {
        console.log(`\n时间: ${imp.timestamp}`);
        console.log(`  类型: ${imp.type}`);
        console.log(`  文件: ${imp.fileName}`);
        console.log(`  总行数: ${imp.totalRows}`);
        console.log(`  成功: ${imp.successCount}, 更新: ${imp.updatedCount || 0}, 跳过: ${imp.skippedCount || 0}`);
        console.log(`  错误: ${(imp.errors?.length || 0)} 条`);
        if (imp.errors && imp.errors.length > 0) {
          console.log('  错误详情:');
          for (const err of imp.errors.slice(0, 3)) {
            console.log(`    - 行${err.row}: ${err.reason}`);
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

function printImportResult(result) {
  console.log(chalk.green('\n✅ 导入完成'));
  console.log(`  文件: ${result.fileName}`);
  console.log(`  来源: ${result.source}`);
  console.log(`  总行数: ${result.totalRows}`);
  console.log(`  处理行数: ${result.processedRows}`);
  console.log(`  成功: ${result.successCount}`);
  console.log(`  更新: ${result.updatedCount || 0}`);
  console.log(`  跳过: ${result.skippedCount || 0}`);
  
  if (result.errors.length > 0) {
    console.log(chalk.red(`\n  错误: ${result.errors.length} 条`));
    for (const err of result.errors) {
      console.log(chalk.red(`    - 行${err.row}, 字段${err.field}: ${err.reason}`));
    }
  }
  
  if (result.warnings.length > 0) {
    console.log(chalk.yellow(`\n  警告: ${result.warnings.length} 条`));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`    - 行${warning.row}: ${warning.reason}`));
    }
  }
}

function printLotAnalysisResult(result) {
  console.log(chalk.green('\n批号匹配分析结果:'));
  console.log(`  总批号: ${result.stats.totalLots}`);
  console.log(`  有温度记录: ${result.stats.lotsWithTemperature}`);
  console.log(`  无温度记录: ${result.stats.lotsWithoutTemperature}`);
  console.log(`  完全匹配: ${result.stats.matchedLots}`);
  console.log(`  不匹配: ${result.stats.unmatchedLots}`);
  
  if (result.unmatched.length > 0) {
    console.log(chalk.red('\n不匹配批号:'));
    for (const item of result.unmatched.slice(0, 10)) {
      console.log(`  - ${item.lotNumber} (${item.productName}): WMS=${item.wmsZone}, 温度记录=${item.zonesFromTemperature.join(',')}`);
    }
  }
}

function printTemperatureAnalysisResult(result) {
  console.log(chalk.green('\n温度分析结果:'));
  console.log(`  总记录数: ${result.stats.totalRecords}`);
  console.log(`  分析批号: ${result.stats.lotsAnalyzed}`);
  console.log(`  发现断点: ${result.stats.gapsFound}`);
  console.log(`  温度超标: ${result.stats.outOfRangeFound}`);
  
  if (result.gaps.length > 0) {
    console.log(chalk.red('\n温度断点:'));
    for (const gap of result.gaps.slice(0, 10)) {
      console.log(`  - ${gap.lotNumber}: ${gap.gapMinutes}分钟 (${gap.previousRecordTime} -> ${gap.currentRecordTime})`);
    }
  }
}

function printInventoryAnalysisResult(result) {
  console.log(chalk.green('\n盘点差异分析结果:'));
  console.log(`  总批号: ${result.stats.totalLots}`);
  console.log(`  已盘点: ${result.stats.lotsWithCount}`);
  console.log(`  待盘点: ${result.stats.lotsWithoutCount}`);
  console.log(`  数量差异: ${result.stats.quantityDifferences}`);
  console.log(`  温区不匹配: ${result.stats.zoneMismatches}`);
  
  if (result.differences.length > 0) {
    console.log(chalk.red('\n数量差异:'));
    for (const diff of result.differences.slice(0, 10)) {
      console.log(`  - ${diff.lotNumber}: WMS=${diff.wmsQuantity}, 盘点=${diff.countedQuantity}, 差异=${diff.difference} (${diff.differencePercentage}%)`);
    }
  }
}

function printFullAnalysisResult(result) {
  console.log(chalk.green('\n综合分析结果:'));
  
  console.log(chalk.blue('\n  异常台账更新:'));
  console.log(`    新增: ${result.ledgerUpdate.newExceptions}`);
  console.log(`    保持不变: ${result.ledgerUpdate.unchangedExceptions}`);
  console.log(`    已被取代: ${result.ledgerUpdate.supercededExceptions}`);
  
  console.log('\n  当前异常状态:');
  console.log(`    待处理 (Open): ${chalk.red(result.summary.totalOpen)}`);
  console.log(`    已解决 (Resolved): ${chalk.green(result.summary.totalResolved)}`);
  console.log(`    已过时 (Superseded): ${chalk.gray(result.summary.totalSuperseded)}`);
  console.log(`    历史总数: ${result.summary.totalExceptions}`);
  
  if (result.summary.totalOpen > 0) {
    console.log(`\n  严重度分布 (Open):`);
    console.log(`    Critical: ${chalk.red(result.summary.critical)}`);
    console.log(`    High: ${chalk.yellow(result.summary.high)}`);
    console.log(`    Medium: ${chalk.blue(result.summary.medium)}`);
    console.log(`    Low: ${chalk.gray(result.summary.low)}`);
  }
  
  console.log('\n  批号匹配:');
  console.log(`    总批号: ${result.lotMatching.stats.totalLots}`);
  console.log(`    有温度记录: ${result.lotMatching.stats.lotsWithTemperature}`);
  console.log(`    无温度记录: ${result.lotMatching.stats.lotsWithoutTemperature}`);
  
  console.log('\n  温度监控:');
  console.log(`    断点数: ${result.temperatureBreak.stats.gapsFound}`);
  console.log(`    超标数: ${result.temperatureBreak.stats.outOfRangeFound}`);
  
  console.log('\n  盘点差异:');
  console.log(`    数量差异: ${result.inventoryDiff.stats.quantityDifferences}`);
  console.log(`    温区不匹配: ${result.inventoryDiff.stats.zoneMismatches}`);
}

program
  .command('reset')
  .description('重置数据（危险操作）')
  .option('-t, --type <type>', '重置类型: all|exceptions', 'exceptions')
  .option('-y, --yes', '确认执行，跳过提示')
  .action((options) => {
    try {
      initServices();
      
      if (!options.yes) {
        console.log(chalk.yellow('\n⚠️  危险操作：此命令将清除数据'));
        console.log(`   类型: ${options.type}`);
        console.log(chalk.gray('   使用 -y 参数跳过此提示'));
        console.log(chalk.gray('\n   例如: node bin/index.js reset -t all -y'));
        process.exit(0);
      }
      
      if (options.type === 'all') {
        dataStore.resetAllData();
        console.log(chalk.green('\n✅ 已重置所有数据（库存、温度、异常、导入历史）'));
      } else {
        dataStore.resetExceptions();
        console.log(chalk.green('\n✅ 已重置异常台账'));
      }
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
