#!/usr/bin/env node

const { program } = require('commander');
const { parseFile, transformRecords, validateFields } = require('./parser');
const { validateRecords } = require('./validator');
const { recalculateAll } = require('./aggregator');
const { generateReport, printConsoleReport } = require('./reporter');

program
  .name('budget-recalc')
  .description('报销预算文件科目调拨复算 CLI')
  .version('1.0.0');

program
  .command('run')
  .description('执行报销预算文件科目调拨复算')
  .argument('<file>', '输入文件路径 (CSV 或 Excel)')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('--allow-cross-department', '允许跨部门调拨', true)
  .option('--initial-budget <json>', '初始预算 JSON 字符串')
  .action(async (file, options) => {
    try {
      console.log(`开始解析文件: ${file}`);
      const parseResult = await parseFile(file);
      console.log(`解析完成，共 ${parseResult.metadata.recordCount} 条记录`);

      const fieldValidation = validateFields(parseResult);
      if (!fieldValidation.isValid) {
        console.error('字段校验失败:');
        fieldValidation.errors.forEach(e => console.error(`  - ${e.message}`));
        process.exit(1);
      }

      const transformedRecords = transformRecords(parseResult.records);
      console.log('数据转换完成');

      const validationResult = validateRecords(transformedRecords, {
        allowCrossDepartment: options.allowCrossDepartment
      });
      console.log(`校验完成: 通过 ${validationResult.summary.valid} 条, 错误 ${validationResult.summary.error} 条`);

      let initialBudgets = {};
      if (options.initialBudget) {
        initialBudgets = JSON.parse(options.initialBudget);
      }

      const aggregationResult = recalculateAll(validationResult.processedRecords, {
        initialBudgets
      });
      console.log('汇总计算完成');

      const reportResult = generateReport(parseResult, validationResult, aggregationResult, {
        outputDir: options.output
      });
      console.log('报告生成完成');

      printConsoleReport(reportResult.summaryReport, reportResult.exceptionReport);

      console.log('输出文件:');
      console.log(`  - 汇总报告: ${reportResult.summaryPath}`);
      console.log(`  - 异常报告: ${reportResult.exceptionPath}`);
      console.log(`  - 调拨明细: ${reportResult.detailPath}`);

    } catch (error) {
      console.error('执行失败:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('仅校验输入文件格式')
  .argument('<file>', '输入文件路径')
  .action(async (file) => {
    try {
      const parseResult = await parseFile(file);
      const fieldValidation = validateFields(parseResult);
      
      if (fieldValidation.isValid) {
        console.log('✅ 文件格式校验通过');
        console.log(`   记录数: ${parseResult.metadata.recordCount}`);
        console.log(`   字段数: ${parseResult.metadata.fields.length}`);
      } else {
        console.log('❌ 文件格式校验失败');
        fieldValidation.errors.forEach(e => console.log(`   - ${e.message}`));
        process.exit(1);
      }
    } catch (error) {
      console.error('校验失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('list-subjects')
  .description('列出所有有效预算科目')
  .action(() => {
    const { VALID_BUDGET_SUBJECTS, DISABLED_SUBJECTS } = require('./validator');
    console.log('有效预算科目:');
    VALID_BUDGET_SUBJECTS.forEach(s => console.log(`  ✓ ${s}`));
    console.log('\n已停用科目:');
    DISABLED_SUBJECTS.forEach(s => console.log(`  ⊘ ${s}`));
  });

program.parse();
