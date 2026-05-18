#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';

import { parseDirectory, parseFile, validateFields } from './parser.js';
import { runAllValidations } from './validator.js';
import { analyzeRecords, generateSummary, sortRecordsForComparison } from './statistics.js';
import { generateReports, printConsoleSummary } from './reporter.js';

const program = new Command();

program
  .name('cs-stats')
  .description('客服会话导出机器人转人工统计 CLI')
  .version('1.0.0');

program
  .command('analyze')
  .description('分析客服会话数据，生成统计报告')
  .argument('<input>', '输入文件或目录路径')
  .option('-o, --output <dir>', '输出目录，默认为 ./output', './output')
  .option('--skip-validation', '跳过数据校验', false)
  .action(async (input, options) => {
    try {
      const stats = await fs.stat(input);
      let parseResult;

      if (stats.isDirectory()) {
        parseResult = await parseDirectory(input);
      } else {
        const singleResult = await parseFile(input);
        parseResult = {
          records: singleResult.records,
          errors: singleResult.errors,
          fileResults: [{
            fileName: path.basename(input),
            recordCount: singleResult.records.length,
            errorCount: singleResult.errors.length
          }]
        };
      }

      const parseErrors = parseResult.errors;

      if (parseResult.records.length === 0 && parseErrors.length === 0) {
        console.log('未找到任何有效数据文件');
        process.exit(1);
      }

      const { records: fieldValidated, errors: fieldErrors } = validateFields(parseResult.records);

      let validationErrors = [...fieldErrors];
      let validatedRecords = fieldValidated;

      if (!options.skipValidation) {
        const validationResult = runAllValidations(fieldValidated);
        validatedRecords = validationResult.records;
        validationErrors = [...validationErrors, ...validationResult.errors];
      }

      const analysis = analyzeRecords(validatedRecords);
      const sortedAllRecords = sortRecordsForComparison([
        ...analysis.falseTransfers,
        ...analysis.missedTransfers,
        ...analysis.normalRecords
      ]);

      const summary = generateSummary(analysis, validationErrors, parseErrors);

      const reportFiles = await generateReports(options.output, {
        analysis,
        summary,
        validationErrors,
        parseErrors,
        fileResults: parseResult.fileResults,
        allRecords: sortedAllRecords
      });

      printConsoleSummary(summary, reportFiles);

    } catch (error) {
      console.error('运行出错:', error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('仅验证数据，不生成完整统计')
  .argument('<input>', '输入文件或目录路径')
  .option('-o, --output <dir>', '输出目录，默认为 ./output', './output')
  .action(async (input, options) => {
    try {
      const stats = await fs.stat(input);
      let parseResult;

      if (stats.isDirectory()) {
        parseResult = await parseDirectory(input);
      } else {
        const singleResult = await parseFile(input);
        parseResult = {
          records: singleResult.records,
          errors: singleResult.errors,
          fileResults: [{
            fileName: path.basename(input),
            recordCount: singleResult.records.length,
            errorCount: singleResult.errors.length
          }]
        };
      }

      const { errors: fieldErrors } = validateFields(parseResult.records);
      const validationResult = runAllValidations(parseResult.records);
      const allErrors = [...parseResult.errors, ...fieldErrors, ...validationResult.errors];

      console.log('\n' + '='.repeat(60));
      console.log('    客服会话导出机器人转人工统计 - 数据验证报告');
      console.log('='.repeat(60));

      console.log('\n【处理文件】');
      for (const file of parseResult.fileResults) {
        console.log(`  ${file.fileName}: ${file.recordCount} 条记录`);
      }

      if (allErrors.length === 0) {
        console.log('\n✅ 数据验证通过，未发现异常');
      } else {
        console.log(`\n⚠️  共发现 ${allErrors.length} 个异常:`);

        const grouped = {};
        for (const err of allErrors) {
          grouped[err.type] = (grouped[err.type] || 0) + 1;
        }

        for (const [type, count] of Object.entries(grouped)) {
          console.log(`  ${type}: ${count}`);
        }

        await fs.mkdir(options.output, { recursive: true });
        const timestamp = new Date().toISOString().slice(0, 10);
        const rows = [
          ['异常类型', '严重程度', '会话ID', '关联字段', '原因说明', '来源文件', '行号']
        ];

        for (const err of allErrors) {
          rows.push([
            err.type,
            err.severity || 'warning',
            err.sessionId || '',
            err.field || '',
            err.reason || err.context || '',
            err.file || '',
            err.row || ''
          ]);
        }

        const { stringify } = await import('csv-stringify/sync');
        const csv = stringify(rows);
        const reportPath = path.join(options.output, `验证异常报告_${timestamp}.csv`);
        await fs.writeFile(reportPath, csv, 'utf-8');
        console.log(`\n详细异常报告已保存至: ${reportPath}`);
      }

      console.log('\n' + '='.repeat(60) + '\n');

    } catch (error) {
      console.error('验证出错:', error.message);
      process.exit(1);
    }
  });

program
  .command('fields')
  .description('显示必需字段列表')
  .action(() => {
    const fields = [
      '会话ID - 会话唯一标识',
      '开始时间 - 会话开始时间',
      '结束时间 - 会话结束时间',
      '用户ID - 用户标识',
      '机器人处理结果 - 已解决/部分解决/未解决/无法处理',
      '是否转人工 - 是/否',
      '转人工时间 - 转人工的时间',
      '转人工原因 - 转人工的具体原因',
      '客服ID - 处理人工会话的客服ID',
      '会话标签 - 会话分类标签'
    ];

    console.log('\n' + '='.repeat(60));
    console.log('    客服会话导出机器人转人工统计 - 必需字段');
    console.log('='.repeat(60) + '\n');

    for (const field of fields) {
      console.log(`  ${field}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
  });

program.parse();