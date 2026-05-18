#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const Table = require('cli-table3');

const { processFiles, generateSummaryReport, EXIT_CODES } = require('../src/file-processor');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('counseling-desensitize')
  .description('心理咨询室咨询预约数据脱敏工具')
  .version(packageJson.version, '-v, --version', '显示版本号');

program
  .command('process', { isDefault: true })
  .description('处理CSV文件进行数据脱敏')
  .argument('<files...>', '要处理的CSV文件路径')
  .option('-o, --output <dir>', '输出目录', './desensitized_output')
  .option('--keep-duplicates', '保留重复行，默认自动删除重复行')
  .option('--no-summary', '不显示汇总报告')
  .action(async (files, options) => {
    console.log(chalk.cyan.bold('\n╔══════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║     心理咨询室咨询预约数据脱敏工具 v' + packageJson.version + '         ║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════╝\n'));

    const absoluteFiles = files.map(f => {
      if (path.isAbsolute(f)) return f;
      return path.resolve(process.cwd(), f);
    });

    const outputDir = path.isAbsolute(options.output) 
      ? options.output 
      : path.resolve(process.cwd(), options.output);

    console.log(chalk.gray(`处理文件数: ${files.length}`));
    console.log(chalk.gray(`输出目录: ${outputDir}\n`));

    const results = await processFiles(absoluteFiles, outputDir, {
      keepDuplicates: options.keepDuplicates
    });

    if (!options.noSummary) {
      printDetailedResults(results);
      printSummaryReport(results);
    }

    const summary = generateSummaryReport(results);
    console.log(chalk.dim('\n─────────────────────────────────────────────────────'));
    console.log(chalk.dim(`退出码说明: 0=完全成功, 1=部分成功/含特殊标记, 2=全部失败`));
    console.log(chalk.dim(`本次退出码: ${summary.exitCode}`));
    
    if (summary.hasMinorData) {
      console.log(chalk.yellow(`⚠  检测到未成年人信息`));
    }
    if (summary.hasFreeText) {
      console.log(chalk.yellow(`⚠  检测到自由文本字段处理`));
    }
    if (summary.hasRepeatable) {
      console.log(chalk.yellow(`⚠  输出可复跑（确定性脱敏）`));
    }

    process.exit(summary.exitCode);
  });

program
  .command('detect')
  .description('检测CSV文件字段并显示识别结果')
  .argument('<file>', '要检测的CSV文件')
  .action(async (file) => {
    const { detectFieldMapping } = require('../src/desensitize');
    const csv = require('csv-parser');
    
    const absoluteFile = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
    
    const headers = await new Promise((resolve) => {
      const h = [];
      fs.createReadStream(absoluteFile, 'utf8')
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('headers', (headerList) => {
          h.push(...headerList);
        })
        .on('data', () => {})
        .on('end', () => resolve(h));
    });

    const mapping = detectFieldMapping(headers);
    
    console.log(chalk.cyan.bold('\n字段检测结果:'));
    console.log(chalk.gray(`原始字段: ${headers.join(', ')}\n`));
    
    const table = new Table({
      head: ['映射字段', '检测到的CSV列名'],
      style: { head: ['cyan'] }
    });
    
    Object.entries(mapping).forEach(([key, value]) => {
      if (key === 'freeTextFields') {
        table.push(['自由文本字段', value.join(', ') || '无']);
      } else {
        table.push([key, value || '未检测到']);
      }
    });
    
    console.log(table.toString());
  });

function printDetailedResults(results) {
  console.log(chalk.cyan.bold('📋 文件处理详情:\n'));
  
  const table = new Table({
    head: ['文件', '状态', '总行数', '处理行数', '跳过行数', '备注'],
    style: { head: ['cyan'] },
    colWidths: [30, 10, 8, 10, 10, 25]
  });

  results.forEach(result => {
    const fileName = path.basename(result.inputPath);
    const status = result.success 
      ? chalk.green('成功') 
      : chalk.red('失败');
    
    let notes = [];
    if (result.hasMinor) notes.push(chalk.yellow('含未成年人'));
    if (result.hasFreeText) notes.push(chalk.yellow('含自由文本'));
    if (result.duplicateRows > 0) notes.push(chalk.gray(`${result.duplicateRows}重复`));
    if (result.missingColumns.length > 0) notes.push(chalk.red('缺列'));
    if (!result.success) notes.push(chalk.red(result.error));

    table.push([
      fileName,
      status,
      result.totalRows,
      result.processedRows,
      result.skippedRows,
      notes.join(' ') || '-'
    ]);
  });

  console.log(table.toString());
  console.log('');
}

function printSummaryReport(results) {
  const summary = generateSummaryReport(results);
  
  console.log(chalk.cyan.bold('📊 汇总报告:\n'));
  
  const table = new Table({
    style: { 'padding-left': 2, 'padding-right': 2 },
    colWidths: [30, 20]
  });

  table.push(
    ['总文件数', summary.totalFiles],
    ['成功处理', chalk.green(summary.successfulFiles)],
    ['处理失败', chalk.red(summary.failedFiles)],
    ['总行数', summary.totalRows],
    ['已处理行数', chalk.green(summary.processedRows)],
    ['跳过行数', chalk.yellow(summary.skippedRows)],
    ['重复行数', chalk.gray(summary.duplicateRows)]
  );

  console.log(table.toString());
  
  if (summary.hasMinorData || summary.hasFreeText || summary.hasRepeatable) {
    console.log('');
    console.log(chalk.yellow.bold('⚠  特殊标记:'));
    if (summary.hasMinorData) console.log(chalk.yellow('   • 包含未成年人信息'));
    if (summary.hasFreeText) console.log(chalk.yellow('   • 包含自由文本处理'));
    if (summary.hasRepeatable) console.log(chalk.yellow('   • 输出可复跑（确定性算法）'));
  }
}

program.parse();
