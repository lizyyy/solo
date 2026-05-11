#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { processAllData } = require('./core');
const { toJSON } = require('./parser');

const STATUS_COLORS = {
  passed: '\x1b[32m',
  needs_manual_review: '\x1b[33m',
  failed: '\x1b[31m',
  partial: '\x1b[36m',
  unknown: '\x1b[90m',
  reset: '\x1b[0m'
};

const STATUS_LABELS = {
  passed: '通过',
  needs_manual_review: '需要人工确认',
  failed: '失败',
  partial: '部分完成',
  unknown: '未知'
};

function printHeader() {
  console.log('\n' + '='.repeat(70));
  console.log('            冷库门禁温升追踪 CLI (Cold Storage Tracker)');
  console.log('='.repeat(70) + '\n');
}

function printUsage() {
  console.log('用法:');
  console.log('  node src/cli.js [命令] [选项]\n');
  console.log('命令:');
  console.log('  analyze          分析完整数据集（门禁日志+温度+批次+班次）');
  console.log('  validate         仅验证数据文件格式');
  console.log('  samples          查看样例数据说明');
  console.log('  help             显示帮助信息\n');
  console.log('选项:');
  console.log('  --access <文件>    门禁日志文件 (CSV/JSON)');
  console.log('  --temperature <文件> 温度数据文件 (CSV/JSON)');
  console.log('  --batches <文件>   货品批次文件 (CSV/JSON)');
  console.log('  --shifts <文件>    班次排班文件 (CSV/JSON)');
  console.log('  --config <文件>    配置参数文件 (CSV/JSON)');
  console.log('  --output <文件>    输出结果到 JSON 文件');
  console.log('  --json             以 JSON 格式输出');
  console.log('  --verbose          显示详细信息\n');
  console.log('示例:');
  console.log('  node src/cli.js analyze --access samples/csv/access_log.csv --temperature samples/csv/temperature.csv');
  console.log('  node src/cli.js validate --access samples/csv/access_log.csv\n');
}

function printValidationSummary(summary) {
  console.log('\n--- 数据验证统计 ---');
  
  const dataTypes = [
    { key: 'accessLog', label: '门禁日志' },
    { key: 'temperature', label: '温度数据' },
    { key: 'batches', label: '货品批次' },
    { key: 'shifts', label: '班次排班' }
  ];
  
  dataTypes.forEach(type => {
    const data = summary[type.key];
    if (data.total > 0) {
      console.log(`\n${type.label}:`);
      console.log(`  总行数: ${data.total}`);
      console.log(`  有效行: ${data.valid}`);
      if (data.skipped > 0) {
        console.log(`  ${STATUS_COLORS.failed}跳过的坏行: ${data.skipped}${STATUS_COLORS.reset}`);
      }
      if (data.needsReview > 0) {
        console.log(`  ${STATUS_COLORS.needs_manual_review}需人工确认: ${data.needsReview}${STATUS_COLORS.reset}`);
      }
    }
  });
}

function printSkippedRows(result) {
  const sections = [
    { data: result.accessLog, label: '门禁日志' },
    { data: result.temperature, label: '温度数据' },
    { data: result.batches, label: '货品批次' },
    { data: result.shifts, label: '班次排班' }
  ];
  
  let hasSkipped = false;
  sections.forEach(section => {
    if (section.data && section.data.skipped && section.data.skipped.length > 0) {
      if (!hasSkipped) {
        console.log(`\n${STATUS_COLORS.failed}=== 跳过的坏行详情 ===${STATUS_COLORS.reset}`);
        hasSkipped = true;
      }
      console.log(`\n${section.label} 跳过的行:`);
      section.data.skipped.forEach(row => {
        console.log(`  行 ${row.lineNumber}:`);
        console.log(`    数据: ${JSON.stringify(row.data)}`);
        console.log(`    错误: ${row.errors.join('; ')}`);
      });
    }
  });
}

function printNeedsReview(result) {
  const sections = [
    { data: result.accessLog, label: '门禁日志' },
    { data: result.temperature, label: '温度数据' },
    { data: result.batches, label: '货品批次' },
    { data: result.shifts, label: '班次排班' }
  ];
  
  let hasReview = false;
  sections.forEach(section => {
    if (section.data && section.data.needsReview && section.data.needsReview.length > 0) {
      if (!hasReview) {
        console.log(`\n${STATUS_COLORS.needs_manual_review}=== 需人工确认的记录 ===${STATUS_COLORS.reset}`);
        hasReview = true;
      }
      console.log(`\n${section.label} 需确认的行:`);
      section.data.needsReview.forEach(row => {
        console.log(`  行 ${row.lineNumber}:`);
        console.log(`    数据: ${JSON.stringify(row.data)}`);
        console.log(`    警告: ${row.warnings.join('; ')}`);
      });
    }
  });
}

function printReport(report) {
  if (!report) return;
  
  console.log('\n--- 分析报告 ---');
  console.log(`\n统计摘要:`);
  console.log(`  有效门禁开关周期: ${report.summary.validDoorCycles}`);
  console.log(`  温度数据点: ${report.summary.temperatureDataPoints}`);
  console.log(`  温升事件: ${report.summary.temperatureRisesDetected}`);
  console.log(`  关联风险事件: ${report.summary.correlationsFound}`);
  console.log(`  受影响批次: ${report.summary.batchesAffected}`);
  console.log(`  ${STATUS_COLORS.needs_manual_review}需人工审核事件: ${report.summary.needsManualReview}${STATUS_COLORS.reset}`);
  
  if (report.temperatureAnalysis) {
    console.log(`\n温度曲线分析:`);
    console.log(`  最低温度: ${report.temperatureAnalysis.minTemperature}°C`);
    console.log(`  最高温度: ${report.temperatureAnalysis.maxTemperature}°C`);
    console.log(`  平均温度: ${report.temperatureAnalysis.avgTemperature}°C`);
    console.log(`  ${STATUS_COLORS.needs_manual_review}可靠性评分: ${report.temperatureAnalysis.reliability.score}/100${STATUS_COLORS.reset}`);
    
    if (report.temperatureAnalysis.deviations.length > 0) {
      console.log(`  ${STATUS_COLORS.needs_manual_review}温度偏离正常范围: ${report.temperatureAnalysis.deviations.length} 次${STATUS_COLORS.reset}`);
    }
  }
  
  if (report.accessWarnings && report.accessWarnings.length > 0) {
    console.log(`\n${STATUS_COLORS.needs_manual_review}门禁警告:${STATUS_COLORS.reset}`);
    report.accessWarnings.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.message}`);
      if (w.lineNumber) console.log(`     行号: ${w.lineNumber}`);
    });
  }
  
  if (report.riskEvents && report.riskEvents.length > 0) {
    console.log(`\n${STATUS_COLORS.needs_manual_review}风险事件详情:${STATUS_COLORS.reset}`);
    report.riskEvents.forEach((event, i) => {
      const color = event.manualCheckRequired ? STATUS_COLORS.needs_manual_review : STATUS_COLORS.reset;
      console.log(`\n  ${color}事件 ${i + 1}:${STATUS_COLORS.reset}`);
      console.log(`    门禁: ${event.doorId}`);
      console.log(`    开门时间: ${event.openTime}`);
      console.log(`    开门时长: ${event.openDurationSeconds}秒 ${event.exceededThreshold ? '(超过阈值!)' : ''}`);
      console.log(`    最大温升: ${event.maxRise}°C`);
      console.log(`    班次: ${event.shift || '未知'} (${event.shiftEmployee || '无排班记录'})`);
      if (event.affectedBatches.length > 0) {
        console.log(`    受影响批次:`);
        event.affectedBatches.forEach(batch => {
          console.log(`      - ${batch.batchId} (${batch.productName}) ${batch.needsManualCheck ? '[无出库时间,需确认]' : ''}`);
        });
      }
      if (event.manualCheckRequired) {
        console.log(`    ${STATUS_COLORS.needs_manual_review}⚠ 需要人工确认${STATUS_COLORS.reset}`);
      }
    });
  }
}

function printResultStatus(status) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  const label = STATUS_LABELS[status] || '未知';
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  整体状态: ${color}[${label}]${STATUS_COLORS.reset}`);
  console.log(`${'='.repeat(70)}\n`);
  
  console.log('状态说明:');
  console.log(`  ${STATUS_COLORS.passed}[通过]${STATUS_COLORS.reset} - 所有数据有效，无需人工处理`);
  console.log(`  ${STATUS_COLORS.needs_manual_review}[需要人工确认]${STATUS_COLORS.reset} - 数据有效但存在需审核的记录`);
  console.log(`  ${STATUS_COLORS.failed}[失败]${STATUS_COLORS.reset} - 存在跳过的坏行，需修复后重跑`);
  console.log(`  ${STATUS_COLORS.partial}[部分完成]${STATUS_COLORS.reset} - 仅验证了部分数据文件`);
}

function printSamplesInfo() {
  console.log('\n--- 样例数据文件说明 ---\n');
  console.log('CSV 样例位置: samples/csv/');
  console.log('JSON 样例位置: samples/json/\n');
  
  console.log('文件格式说明:');
  console.log('\n1. 门禁日志 (access_log.csv/json):');
  console.log('   必需字段: timestamp, doorId');
  console.log('   可选字段: employeeId, cardId, accessType (OPEN/CLOSE/GRANTED/DENIED), doorStatus (OPEN/CLOSED)');
  console.log('   示例: 2024-01-15T08:30:00,DOOR_A,EMP001,CARD123,OPEN,OPEN\n');
  
  console.log('2. 温度数据 (temperature.csv/json):');
  console.log('   必需字段: timestamp, temperature');
  console.log('   可选字段: sensorId');
  console.log('   示例: 2024-01-15T08:30:00,-20.5,SENSOR_01\n');
  
  console.log('3. 货品批次 (batches.csv/json):');
  console.log('   必需字段: batchId');
  console.log('   可选字段: productName, storageStart, storageEnd, requiredTemp');
  console.log('   示例: BATCH001,冷冻水饺,2024-01-10T10:00:00,2024-01-20T14:00:00,-18\n');
  
  console.log('4. 班次排班 (shifts.csv/json):');
  console.log('   必需字段: date, shiftName (早班/中班/晚班)');
  console.log('   可选字段: employeeId, employeeName');
  console.log('   示例: 2024-01-15,早班,EMP001,张三\n');
  
  console.log('5. 配置参数 (config.json/csv):');
  console.log('   doorOpenDurationThreshold: 门开时长阈值(秒), 默认 300');
  console.log('   temperatureRiseThreshold: 温升阈值(°C), 默认 2.0');
  console.log('   normalTemperatureRange: 正常温度范围, 默认 [-25, -18]');
  console.log('\n');
}

function parseArgs(args) {
  const options = {
    command: null,
    accessLog: null,
    temperature: null,
    batches: null,
    shifts: null,
    config: null,
    output: null,
    json: false,
    verbose: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (!options.command && !arg.startsWith('--')) {
      options.command = arg;
      continue;
    }
    
    if (arg === '--access' || arg === '--access-log') {
      options.accessLog = args[++i];
    } else if (arg === '--temperature' || arg === '--temp') {
      options.temperature = args[++i];
    } else if (arg === '--batches' || arg === '--batch') {
      options.batches = args[++i];
    } else if (arg === '--shifts' || arg === '--shift') {
      options.shifts = args[++i];
    } else if (arg === '--config') {
      options.config = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      options.command = 'help';
    }
  }
  
  return options;
}

function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (!options.command || options.command === 'help') {
    printHeader();
    printUsage();
    return;
  }
  
  if (options.command === 'samples') {
    printHeader();
    printSamplesInfo();
    return;
  }
  
  if (options.command !== 'analyze' && options.command !== 'validate') {
    console.error(`未知命令: ${options.command}`);
    printUsage();
    process.exit(1);
  }
  
  if (options.command === 'validate' && !options.accessLog && !options.temperature && 
      !options.batches && !options.shifts) {
    console.error('验证命令需要至少指定一个数据文件');
    printUsage();
    process.exit(1);
  }
  
  try {
    printHeader();
    
    const result = processAllData(options);
    
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, toJSON(result), 'utf8');
      console.log(`结果已保存到: ${outputPath}`);
    }
    
    if (options.json) {
      console.log(toJSON(result));
      return;
    }
    
    printValidationSummary(result.validationSummary);
    printSkippedRows(result);
    printNeedsReview(result);
    
    if (options.command === 'analyze' && result.report) {
      printReport(result.report);
    }
    
    printResultStatus(result.status);
    
    if (result.status === 'failed') {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n${STATUS_COLORS.failed}错误: ${error.message}${STATUS_COLORS.reset}\n`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
