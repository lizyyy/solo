#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');

const { importData } = require('./commands/import');
const { reviewRecord, correctRecord } = require('./commands/review');
const { showHistory, diffRecord } = require('./commands/history');
const { exportData, exportReport } = require('./commands/export');
const { queryRecords, showStatus } = require('./commands/query');
const { explainAlarm } = require('./commands/alarm');

const DATA_DIR = path.join(process.cwd(), 'data');
const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const program = new Command();

program
  .name('brake-temp')
  .description('轨道制动温升工作流管理工具')
  .version('1.0.0');

program
  .command('import')
  .description('导入制动温升记录')
  .option('-f, --file <path>', '导入文件路径 (JSON/Markdown)')
  .option('-t, --type <type>', '记录类型: shift(班组)|inspection(巡检)', 'shift')
  .action((options) => {
    ensureDataDir();
    importData(DATA_DIR, options);
  });

program
  .command('review')
  .description('复核记录')
  .argument('<recordId>', '记录ID')
  .action((recordId) => {
    ensureDataDir();
    reviewRecord(DATA_DIR, recordId);
  });

program
  .command('correct')
  .description('修正记录')
  .argument('<recordId>', '记录ID')
  .option('-f, --field <field>', '修正字段')
  .option('-v, --value <value>', '新值')
  .option('-r, --reason <reason>', '修正原因')
  .option('-e, --engineer <name>', '设备工程师姓名')
  .action((recordId, options) => {
    ensureDataDir();
    correctRecord(DATA_DIR, recordId, options);
  });

program
  .command('history')
  .description('查看历史记录')
  .argument('[recordId]', '记录ID（可选，不填则列出全部）')
  .option('-d, --diff', '显示差异对比')
  .action((recordId, options) => {
    ensureDataDir();
    if (options.diff && recordId) {
      diffRecord(DATA_DIR, recordId);
    } else {
      showHistory(DATA_DIR, recordId);
    }
  });

program
  .command('export')
  .description('导出数据')
  .option('-o, --output <path>', '输出路径')
  .option('-f, --format <format>', '格式: json|md', 'json')
  .option('-t, --type <type>', '类型: all|report|detail', 'all')
  .action((options) => {
    ensureDataDir();
    exportData(DATA_DIR, options);
  });

program
  .command('report')
  .description('生成一致性巡检报告')
  .option('-o, --output <path>', '输出路径', 'inspection-report.md')
  .action((options) => {
    ensureDataDir();
    exportReport(DATA_DIR, options);
  });

program
  .command('query')
  .description('查询记录')
  .option('-s, --status <status>', '按状态筛选: pending|reviewed|corrected')
  .option('-d, --date <date>', '按日期筛选 YYYY-MM-DD')
  .action((options) => {
    ensureDataDir();
    queryRecords(DATA_DIR, options);
  });

program
  .command('status')
  .description('查看整体状态')
  .action(() => {
    ensureDataDir();
    showStatus(DATA_DIR);
  });

program
  .command('explain')
  .description('解释报警来源')
  .argument('<recordId>', '记录ID')
  .action((recordId) => {
    ensureDataDir();
    explainAlarm(DATA_DIR, recordId);
  });

program.parse(process.argv);
