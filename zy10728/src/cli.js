#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

import { ScheduleParser } from './parser.js';
import { ScheduleValidator } from './validator.js';
import { ResultSummarizer } from './summarizer.js';
import { ReportGenerator } from './reporter.js';

const program = new Command();

program
  .name('driver-schedule-check')
  .description('司机排班表换班冲突检查工具')
  .version('1.0.0');

program
  .command('check')
  .description('检查排班表冲突')
  .argument('<input>', '输入文件或目录路径')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('--no-report', '不生成报告文件，仅在控制台显示')
  .action(async (input, options) => {
    console.log('\n🚀 开始检查司机排班表换班冲突...\n');

    const parser = new ScheduleParser();
    let parsedResults = [];

    const stats = fs.statSync(input);
    if (stats.isDirectory()) {
      console.log(`📂 正在处理目录: ${input}`);
      parsedResults = parser.parseDirectory(input);
    } else if (stats.isFile()) {
      console.log(`📄 正在处理文件: ${input}`);
      const result = parser.parseFile(input);
      if (result) {
        parsedResults.push(result);
      }
    } else {
      console.error('❌ 无效的输入路径');
      process.exit(1);
    }

    const parseErrors = parser.getErrors();
    if (parseErrors.length > 0) {
      console.log(`⚠️  解析过程中发现 ${parseErrors.length} 个错误`);
    }

    if (parsedResults.length === 0) {
      console.log('❌ 未找到有效的排班表数据');
      process.exit(1);
    }

    console.log(`✅ 成功解析 ${parsedResults.length} 个文件，共 ${parsedResults.reduce((sum, r) => sum + r.schedules.length, 0)} 条排班记录\n`);

    const validator = new ScheduleValidator();
    const validationResult = validator.validateAll(parsedResults);

    const summarizer = new ResultSummarizer();
    summarizer.addParseResults(parsedResults, parseErrors);
    summarizer.addValidationResults(validationResult);

    const summary = summarizer.getSummary();
    console.log(summarizer.getConsoleSummary());

    if (options.report) {
      const reporter = new ReportGenerator(options.output);
      const generatedFiles = reporter.generateReports(summary);
      reporter.printGeneratedFiles(generatedFiles);
    }

    if (summary.conflicts.errors > 0) {
      process.exit(1);
    }
  });

program
  .command('samples')
  .description('生成样例数据并进行测试')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .action(async (options) => {
    console.log('\n🧪 正在生成样例数据并进行测试...\n');

    const samplesDir = './samples';
    if (!fs.existsSync(samplesDir)) {
      fs.mkdirSync(samplesDir, { recursive: true });
    }

    const normalData = [
      { '司机姓名': '张三', '车牌号': '京A12345', '日期': '2024-05-20', '开始时间': '08:00', '结束时间': '12:00', '线路': '1号线' },
      { '司机姓名': '张三', '车牌号': '京A12345', '日期': '2024-05-20', '开始时间': '13:00', '结束时间': '17:00', '线路': '2号线' },
      { '司机姓名': '李四', '车牌号': '京B67890', '日期': '2024-05-20', '开始时间': '08:00', '结束时间': '16:00', '线路': '3号线' },
      { '司机姓名': '王五', '车牌号': '京C11111', '日期': '2024-05-20', '开始时间': '09:00', '结束时间': '18:00', '线路': '4号线' }
    ];

    const normalWorkbook = xlsx.utils.book_new();
    const normalWorksheet = xlsx.utils.json_to_sheet(normalData);
    xlsx.utils.book_append_sheet(normalWorkbook, normalWorksheet, '排班表');
    xlsx.writeFile(normalWorkbook, path.join(samplesDir, '正常排班.xlsx'));
    console.log('✅ 已生成: samples/正常排班.xlsx');

    const conflictData = [
      { '司机姓名': '赵六', '车牌号': '京D22222', '日期': '2024-05-20', '开始时间': '08:00', '结束时间': '12:00', '线路': '5号线' },
      { '司机姓名': '赵六', '车牌号': '京D22222', '日期': '2024-05-20', '开始时间': '11:00', '结束时间': '15:00', '线路': '6号线' },
      { '司机姓名': '钱七', '车牌号': '京E33333', '日期': '2024-05-20', '开始时间': '08:00', '结束时间': '12:00', '线路': '7号线' },
      { '司机姓名': '孙八', '车牌号': '京E33333', '日期': '2024-05-20', '开始时间': '10:00', '结束时间': '14:00', '线路': '8号线' }
    ];

    const conflictWorkbook = xlsx.utils.book_new();
    const conflictWorksheet = xlsx.utils.json_to_sheet(conflictData);
    xlsx.utils.book_append_sheet(conflictWorkbook, conflictWorksheet, '排班表');
    xlsx.writeFile(conflictWorkbook, path.join(samplesDir, '存在冲突.xlsx'));
    console.log('✅ 已生成: samples/存在冲突.xlsx');

    const specialCasesData = [
      { '司机姓名': '周九', '车牌号': '京F44444', '日期': '2024-05-20', '开始时间': '22:00', '结束时间': '06:00', '线路': '夜班1号线' },
      { '司机姓名': '吴十', '车牌号': '京G55555', '日期': '2024-05-20', '开始时间': '08:00', '结束时间': '12:00', '线路': '车辆保养', '备注': '定期保养' },
      { '司机姓名': '郑十一', '车牌号': '京H66666', '日期': '2024-05-20', '开始时间': '08:00', '结束时间': '12:00', '线路': '9号线', '备注': '兼岗' },
      { '司机姓名': '郑十一', '车牌号': '京H77777', '日期': '2024-05-20', '开始时间': '10:00', '结束时间': '14:00', '线路': '10号线', '备注': '兼岗' }
    ];

    const specialWorkbook = xlsx.utils.book_new();
    const specialWorksheet = xlsx.utils.json_to_sheet(specialCasesData);
    xlsx.utils.book_append_sheet(specialWorkbook, specialWorksheet, '排班表');
    xlsx.writeFile(specialWorkbook, path.join(samplesDir, '特殊情况.xlsx'));
    console.log('✅ 已生成: samples/特殊情况.xlsx');

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('              测试1: 检查正常排班表 (正常路径)');
    console.log('════════════════════════════════════════════════════════════');
    
    const parser = new ScheduleParser();
    const normalResult = parser.parseFile(path.join(samplesDir, '正常排班.xlsx'));
    const validator = new ScheduleValidator();
    const normalValidation = validator.validateAll([normalResult]);
    const summarizer = new ResultSummarizer();
    summarizer.addParseResults([normalResult], []);
    summarizer.addValidationResults(normalValidation);
    console.log(summarizer.getConsoleSummary());

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('              测试2: 检查存在冲突排班表 (异常路径)');
    console.log('════════════════════════════════════════════════════════════');
    
    const conflictResult = parser.parseFile(path.join(samplesDir, '存在冲突.xlsx'));
    const conflictValidation = validator.validateAll([conflictResult]);
    const summarizer2 = new ResultSummarizer();
    summarizer2.addParseResults([conflictResult], []);
    summarizer2.addValidationResults(conflictValidation);
    console.log(summarizer2.getConsoleSummary());

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('              测试3: 检查特殊情况排班表');
    console.log('════════════════════════════════════════════════════════════');
    
    const specialResult = parser.parseFile(path.join(samplesDir, '特殊情况.xlsx'));
    const specialValidation = validator.validateAll([specialResult]);
    const summarizer3 = new ResultSummarizer();
    summarizer3.addParseResults([specialResult], []);
    summarizer3.addValidationResults(specialValidation);
    console.log(summarizer3.getConsoleSummary());

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('              测试4: 检查整个samples目录');
    console.log('════════════════════════════════════════════════════════════');
    
    const allResults = parser.parseDirectory(samplesDir);
    const allValidation = validator.validateAll(allResults);
    const summarizer4 = new ResultSummarizer();
    summarizer4.addParseResults(allResults, []);
    summarizer4.addValidationResults(allValidation);
    console.log(summarizer4.getConsoleSummary());

    const reporter = new ReportGenerator(options.output);
    const generatedFiles = reporter.generateReports(summarizer4.getSummary());
    reporter.printGeneratedFiles(generatedFiles);

    console.log('✅ 样例数据生成和测试完成！\n');
  });

program.parse();
