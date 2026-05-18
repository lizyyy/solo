#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

const { parseDirectory } = require('./parser');
const { validateData } = require('./validator');
const { generateReminderList } = require('./aggregator');
const { generateReports } = require('./reporter');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function ensureDirs() {
  [LOG_DIR, OUTPUT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function writeLog(runId, message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] [${runId}] ${message}\n`;
  const logFile = path.join(LOG_DIR, `asset-reminder-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logLine, 'utf8');
}

async function runReminder(options) {
  const runId = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  
  ensureDirs();
  writeLog(runId, '========== 资产借还台账逾期催还名单任务开始 ==========');
  writeLog(runId, `输入目录: ${options.input}`);
  writeLog(runId, `输出目录: ${options.output || OUTPUT_DIR}`);
  writeLog(runId, `参考日期: ${options.date || '今日'}`);

  try {
    writeLog(runId, '步骤 1/4: 解析数据文件...');
    const parseResults = await parseDirectory(options.input);
    writeLog(runId, `解析完成: ${parseResults.files.length} 个文件, ${parseResults.data.length} 条记录`);
    
    if (parseResults.errors.length > 0) {
      parseResults.errors.forEach(err => {
        writeLog(runId, `解析错误 [${err.severity}]: ${err.message}`, err.severity === 'critical' ? 'ERROR' : 'WARN');
      });
    }

    writeLog(runId, '步骤 2/4: 校验数据...');
    const validationResults = validateData(parseResults);
    writeLog(runId, `校验完成: ${validationResults.validRecords.length} 条有效, ${validationResults.invalidRecords.length} 条无效, ${validationResults.duplicateRecords.length} 条重复`);

    writeLog(runId, '步骤 3/4: 生成催还名单...');
    const referenceDate = options.date ? new Date(options.date) : new Date();
    const aggregatedResults = generateReminderList(validationResults, referenceDate);
    writeLog(runId, `催还名单生成: ${aggregatedResults.reminderList.length} 条需催还记录`);

    writeLog(runId, '步骤 4/4: 生成报告...');
    const reports = generateReports(aggregatedResults, options.output || OUTPUT_DIR, runId, validationResults);
    writeLog(runId, `报告已生成: ${reports.reminderReport}`);
    writeLog(runId, `异常报告: ${reports.exceptionReport}`);
    writeLog(runId, `汇总报告: ${reports.summaryReport}`);

    writeLog(runId, '========== 任务执行成功 ==========');

    console.log('\n' + '='.repeat(60));
    console.log('  资产借还台账逾期催还名单 - 执行结果');
    console.log('='.repeat(60));
    console.log(`\n任务 ID: ${runId}`);
    console.log(`执行状态: 成功`);
    console.log(`\n【统计数据】`);
    console.log(`  需催还记录: ${reports.stats.reminderCount} 条`);
    console.log(`  特殊情况: ${reports.stats.specialCaseCount} 条`);
    console.log(`  异常数量: ${reports.stats.errorCount} 个`);
    console.log(`\n【输出文件】`);
    console.log(`  催还名单: ${reports.reminderReport}`);
    console.log(`  异常报告: ${reports.exceptionReport}`);
    console.log(`  汇总报告: ${reports.summaryReport}`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    writeLog(runId, `任务执行失败: ${error.message}`, 'ERROR');
    writeLog(runId, `堆栈信息: ${error.stack}`, 'ERROR');
    writeLog(runId, '========== 任务执行失败 ==========');

    console.error('\n' + '='.repeat(60));
    console.error('  资产借还台账逾期催还名单 - 执行失败');
    console.error('='.repeat(60));
    console.error(`\n错误信息: ${error.message}`);
    console.error(`详细日志: ${path.join(LOG_DIR, `asset-reminder-${new Date().toISOString().split('T')[0]}.log`)}`);
    console.error('='.repeat(60) + '\n');

    process.exit(1);
  }
}

yargs(hideBin(process.argv))
  .command(
    'run',
    '生成资产借还台账逾期催还名单',
    (yargs) => {
      return yargs
        .option('input', {
          alias: 'i',
          type: 'string',
          describe: '输入目录路径（包含资产台账文件）',
          demandOption: true
        })
        .option('output', {
          alias: 'o',
          type: 'string',
          describe: '输出目录路径',
          default: OUTPUT_DIR
        })
        .option('date', {
          alias: 'd',
          type: 'string',
          describe: '参考日期（格式: YYYY-MM-DD，默认今日）'
        });
    },
    (argv) => {
      runReminder(argv);
    }
  )
  .command(
    'test',
    '运行测试套件',
    () => {},
    () => {
      require('../test/run-tests.js');
    }
  )
  .example('$0 run --input ./data/normal', '使用正常数据生成催还名单')
  .example('$0 run --input ./data/abnormal --date 2024-01-01', '指定日期处理异常数据')
  .help()
  .version('1.0.0')
  .epilog('资产借还台账逾期催还名单 CLI - 适用于定时任务和手动执行')
  .argv;
