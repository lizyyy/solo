#!/usr/bin/env node

const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const Table = require('cli-table3');
const dayjs = require('dayjs');

const TemperatureParser = require('../parsers/temperatureParser');
const DoorParser = require('../parsers/doorParser');
const NoteParser = require('../parsers/noteParser');
const DataMerger = require('../parsers/dataMerger');
const RulesEngine = require('../analyzers/rulesEngine');
const ChartGenerator = require('../visualizers/chartGenerator');
const ReportExporter = require('../exporters/reportExporter');
const IssuesExporter = require('../exporters/issuesExporter');
const { ISSUE_SEVERITY, CONFIG } = require('../config/constants');

const program = new Command();

program
  .name('cold-chain-analyzer')
  .description('冷链温度复盘器 - 食品工厂质检数据分析工具')
  .version('1.0.0');

const printBanner = () => {
  console.log(
    chalk.blue(
      figlet.textSync('Cold Chain', { horizontalLayout: 'full' })
    )
  );
  console.log(chalk.blue.bold('冷链温度复盘器 - 食品工厂质检数据分析工具'));
  console.log(chalk.gray('版本 1.0.0'));
  console.log('');
};

const printSummary = (consolidatedReport, outputDir) => {
  console.log('\n' + chalk.bold('='.repeat(60)));
  console.log(chalk.bold('  分析结果总览'));
  console.log(chalk.bold('='.repeat(60)));

  const statusColors = {
    normal: chalk.green,
    attention: chalk.blue,
    warning: chalk.yellow,
    critical: chalk.red
  };

  const statusText = {
    normal: '正常',
    attention: '需关注',
    warning: '警告',
    critical: '严重'
  };

  console.log('\n  整体状态: ' + 
    statusColors[consolidatedReport.overallStatus](statusText[consolidatedReport.overallStatus]));
  console.log('  分析批次: ' + chalk.bold(consolidatedReport.totalBatches));
  console.log('  检测问题数: ' + chalk.bold(consolidatedReport.totalIssues));

  if (consolidatedReport.totalIssues > 0) {
    const table = new Table({
      head: ['严重程度', '数量'],
      colWidths: [20, 10],
      style: { head: ['cyan'] }
    });

    const severityLabels = {
      critical: ['严重', 'red'],
      high: ['高', 'yellow'],
      medium: ['中', 'blue'],
      low: ['低', 'green']
    };

    for (const [severity, count] of Object.entries(consolidatedReport.issueBreakdown)) {
      if (count > 0) {
        const [label, color] = severityLabels[severity];
        table.push([label, chalk[color](count)]);
      }
    }

    console.log('\n  问题分布:');
    console.log(table.toString());
  }

  console.log('\n  输出目录: ' + chalk.cyan(outputDir));
  console.log('  生成时间: ' + dayjs().format('YYYY-MM-DD HH:mm:ss'));
  console.log('');
};

const printBatchSummary = (analysisResults) => {
  console.log('\n' + chalk.bold('各批次详情:'));

  const table = new Table({
    head: ['车辆', '批次', '记录数', '平均温度', '最高温度', '开门数', '问题数'],
    colWidths: [12, 12, 10, 14, 14, 10, 10],
    style: { head: ['cyan'] }
  });

  for (const [key, result] of Object.entries(analysisResults)) {
    const { vehicle, batch, statistics } = result;
    const issues = statistics.issues?.total || 0;
    const issuesColor = issues > 0 ? 'red' : 'green';
    
    table.push([
      vehicle,
      batch,
      statistics.totalRecords,
      statistics.temperature?.avg?.toFixed(1) + '°C',
      statistics.temperature?.max?.toFixed(1) + '°C',
      statistics.doorEvents?.total || 0,
      chalk[issuesColor](issues)
    ]);
  }

  console.log(table.toString());
};

program
  .command('analyze')
  .description('分析冷链温度数据')
  .option('-t, --temperature <path>', '温度记录CSV文件路径')
  .option('-d, --door <path>', '开门记录CSV文件路径')
  .option('-n, --notes <path>', '人工备注CSV文件路径')
  .option('-o, --output <path>', '输出目录路径', './output')
  .option('--sample', '使用示例数据进行分析')
  .action(async (options) => {
    printBanner();

    try {
      const outputDir = path.resolve(options.output);
      
      let temperaturePath = options.temperature;
      let doorPath = options.door;
      let notesPath = options.notes;

      if (options.sample) {
        console.log(chalk.blue('使用示例数据进行分析...'));
        temperaturePath = path.join(__dirname, '../../data/sample/temperature.csv');
        doorPath = path.join(__dirname, '../../data/sample/door.csv');
        notesPath = path.join(__dirname, '../../data/sample/notes.csv');
      }

      if (!temperaturePath) {
        console.log(chalk.red('错误: 必须提供温度记录CSV文件路径'));
        console.log(chalk.yellow('提示: 使用 --sample 选项可使用示例数据进行测试'));
        process.exit(1);
      }

      console.log(chalk.blue('开始解析数据...'));

      const temperatureParser = new TemperatureParser();
      const doorParser = new DoorParser();
      const noteParser = new NoteParser();

      let temperatures = [];
      let doorEvents = [];
      let notes = [];

      if (temperaturePath) {
        console.log(`  解析温度数据: ${chalk.cyan(temperaturePath)}`);
        temperatures = await temperatureParser.parseFile(temperaturePath);
        console.log(`  ✓ 读取 ${chalk.bold(temperatures.length)} 条温度记录`);
      }

      if (doorPath) {
        console.log(`  解析开门数据: ${chalk.cyan(doorPath)}`);
        const doorResult = await doorParser.parseFile(doorPath);
        doorEvents = doorResult.events;
        console.log(`  ✓ 读取 ${chalk.bold(doorEvents.length)} 次开门事件`);
      }

      if (notesPath) {
        console.log(`  解析备注数据: ${chalk.cyan(notesPath)}`);
        notes = await noteParser.parseFile(notesPath);
        console.log(`  ✓ 读取 ${chalk.bold(notes.length)} 条备注`);
      }

      console.log('\n' + chalk.blue('合并数据...'));
      const dataMerger = new DataMerger();
      const mergeResult = dataMerger.merge({
        temperatureRecords: temperatures,
        doorEvents,
        notes
      });

      const vehicleBatches = mergeResult.vehicleBatches;
      const vehicles = Object.keys(vehicleBatches);
      console.log(`  ✓ 合并为 ${chalk.bold(vehicles.length)} 辆车的运输数据`);

      console.log('\n' + chalk.blue('执行规则分析...'));
      const rulesEngine = new RulesEngine();

      for (const vehicle of vehicles) {
        const vehicleData = vehicleBatches[vehicle];
        const batches = Object.keys(vehicleData.batches);

        for (const batch of batches) {
          console.log(`  分析 ${vehicle} - 批次 ${batch}...`);
          
          const batchData = vehicleData.batches[batch];
          rulesEngine.analyzeBatch({
            vehicle,
            batch,
            temperatures: batchData.temperatures,
            doorEvents: batchData.doorEvents,
            notes: batchData.notes
          });
        }
      }

      const analysisResults = rulesEngine.getAllResults();
      const consolidatedReport = rulesEngine.getConsolidatedReport();

      console.log(`  ✓ 完成 ${chalk.bold(Object.keys(analysisResults).length)} 个批次的分析`);

      console.log('\n' + chalk.blue('生成可视化图表...'));
      const chartGenerator = new ChartGenerator(outputDir);
      
      for (const [key, result] of Object.entries(analysisResults)) {
        const chartResult = chartGenerator.generateBatchChart(result);
        if (chartResult) {
          console.log(`  ✓ 生成图表: ${chalk.cyan(chartResult.filename)}`);
        }
      }

      chartGenerator.generateConsolidatedChart(consolidatedReport);
      console.log(`  ✓ 生成总览图表: ${chalk.cyan('chart_overview.html')}`);

      console.log('\n' + chalk.blue('生成复盘报告...'));
      const reportExporter = new ReportExporter(outputDir);
      
      for (const [key, result] of Object.entries(analysisResults)) {
        const reportResult = reportExporter.generateBatchReport(result);
        console.log(`  ✓ 生成报告: ${chalk.cyan(reportResult.filename)}`);
      }

      reportExporter.generateConsolidatedReport(consolidatedReport, analysisResults);
      console.log(`  ✓ 生成总览报告: ${chalk.cyan('report_summary.md')}`);

      console.log('\n' + chalk.blue('导出问题清单...'));
      const issuesExporter = new IssuesExporter(outputDir);
      const issuesResult = await issuesExporter.exportConsolidatedIssues(consolidatedReport);
      console.log(`  ✓ 导出问题清单: ${chalk.cyan(issuesResult.filename)} (${issuesResult.count} 条)`);

      for (const [key, result] of Object.entries(analysisResults)) {
        if (result.issues.length > 0) {
          const batchIssuesResult = await issuesExporter.exportBatchIssues(result);
          console.log(`  ✓ 导出批次问题: ${chalk.cyan(batchIssuesResult.filename)}`);
        }
      }

      printSummary(consolidatedReport, outputDir);
      printBatchSummary(analysisResults);

      if (consolidatedReport.overallStatus === 'critical') {
        console.log(chalk.red.bold('\n⚠️  检测到严重问题，请立即查看详细报告！'));
      } else if (consolidatedReport.overallStatus === 'warning') {
        console.log(chalk.yellow.bold('\n⚠️  检测到高优先级问题，建议进一步检查。'));
      } else if (consolidatedReport.overallStatus === 'attention') {
        console.log(chalk.blue.bold('\nℹ️  存在需关注的问题，请查看详细报告。'));
      } else {
        console.log(chalk.green.bold('\n✅  未检测到严重问题，数据整体正常。'));
      }

      console.log(chalk.gray('\n提示: 请查看输出目录下的图表和报告获取详细信息。'));
      console.log('');

    } catch (error) {
      console.log(chalk.red('\n错误: ' + error.message));
      console.log(chalk.gray(error.stack));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('查看示例数据信息')
  .action(() => {
    printBanner();
    
    console.log(chalk.bold('\n示例数据说明:'));
    console.log('');
    console.log('  温度记录 (temperature.csv):');
    console.log('    - 包含多辆冷藏车的温度传感器数据');
    console.log('    - 字段: 时间, 温度, 车辆, 批次');
    console.log('');
    console.log('  开门记录 (door.csv):');
    console.log('    - 包含车门开关时间记录');
    console.log('    - 字段: 时间, 门状态, 车辆');
    console.log('');
    console.log('  人工备注 (notes.csv):');
    console.log('    - 包含司机和质检员的交接备注');
    console.log('    - 字段: 时间, 备注, 车辆');
    console.log('');
    
    console.log(chalk.bold('\n使用示例数据命令:'));
    console.log('  ' + chalk.cyan('npm run demo'));
    console.log('  或');
    console.log('  ' + chalk.cyan('node src/cli/index.js analyze --sample'));
    console.log('');
  });

program
  .command('info')
  .description('显示工具信息和配置')
  .action(() => {
    printBanner();
    
    console.log(chalk.bold('\n配置信息:'));
    
    const table = new Table({
      head: ['配置项', '值'],
      colWidths: [35, 40],
      style: { head: ['cyan'] }
    });

    table.push(['安全温度上限', `${CONFIG.TEMPERATURE.THRESHOLD.SAFE_MAX}°C`]);
    table.push(['危险温度上限', `${CONFIG.TEMPERATURE.THRESHOLD.DANGER_MAX}°C`]);
    table.push(['连续超温判定时间', `${CONFIG.TEMPERATURE.RULES.CONTINUOUS_OVERTEMP_MINUTES} 分钟`]);
    table.push(['短时波动判定时间', `${CONFIG.TEMPERATURE.RULES.SHORT_FLUCTUATION_MINUTES} 分钟`]);
    table.push(['传感器断点阈值', `${CONFIG.TEMPERATURE.RULES.SENSOR_GAP_MINUTES} 分钟`]);
    table.push(['传感器漂移阈值', `${CONFIG.TEMPERATURE.RULES.DRIFT_THRESHOLD}°C`]);
    table.push(['合理开门时间', `${CONFIG.DOOR.ACCEPTABLE_OPEN_MINUTES} 分钟`]);
    table.push(['关门后影响持续时间', `${CONFIG.DOOR.IMPACT_DURATION_AFTER_CLOSE_MINUTES} 分钟`]);

    console.log(table.toString());

    console.log(chalk.bold('\n问题类型说明:'));
    const issueTable = new Table({
      head: ['问题类型', '说明'],
      colWidths: [25, 50],
      style: { head: ['cyan'] }
    });

    issueTable.push(['连续超温', '温度持续超过安全阈值一定时间']);
    issueTable.push(['短时波动', '开门后短时间内的温度波动（可解释）']);
    issueTable.push(['开门超时', '开门时间超过合理范围']);
    issueTable.push(['传感器断点', '传感器数据采集中断']);
    issueTable.push(['传感器漂移', '传感器读数突然偏移']);
    issueTable.push(['备注异常', '人工备注中提及的异常情况']);

    console.log(issueTable.toString());

    console.log(chalk.bold('\n严重程度说明:'));
    const severityTable = new Table({
      head: ['严重程度', '说明'],
      colWidths: [15, 60],
      style: { head: ['cyan'] }
    });

    severityTable.push([chalk.red('严重'), '温度严重超标或门长时间未关，可能影响食品安全']);
    severityTable.push([chalk.yellow('高'), '明显违规，需要进一步调查']);
    severityTable.push([chalk.blue('中'), '轻微违规或潜在问题']);
    severityTable.push([chalk.green('低'), '可解释的波动或轻微异常']);

    console.log(severityTable.toString());
    console.log('');
  });

if (process.argv.length === 2) {
  printBanner();
  program.help();
}

program.parse(process.argv);
