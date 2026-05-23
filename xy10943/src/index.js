#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const { scanDirectory, parseFilename } = require('./scanner');
const { detectMissingPhotos, detectDuplicates } = require('./detector');
const { exportResults, printSummary } = require('./exporter');
const { runSelfTest } = require('./self-test');

program
  .name('photo-audit')
  .description('售后照片清点CLI工具 - 检测维修照片完整性、识别重复文件、生成归档报告')
  .version('1.0.0');

program
  .command('audit')
  .description('清点照片目录，检测缺失和重复')
  .requiredOption('-d, --directory <path>', '照片目录路径')
  .option('-o, --output <path>', '输出目录路径', './audit-output')
  .option('-c, --customer <id>', '客户编号过滤')
  .option('-w, --workorder <id>', '工单号过滤')
  .option('-t, --types <list>', '照片类型列表，逗号分隔', 'before,after')
  .option('--no-summary', '不显示终端摘要')
  .option('--no-export', '不导出结果文件')
  .action(async (options) => {
    try {
      await validateOptions(options);
      
      console.log(chalk.blue('\n=== 售后照片清点工具 ===\n'));
      
      const photoTypes = options.types.split(',').map(t => t.trim());
      
      console.log(chalk.gray(`扫描目录: ${options.directory}`));
      console.log(chalk.gray(`照片类型: ${photoTypes.join(', ')}\n`));
      
      const files = await scanDirectory(options.directory);
      
      console.log(chalk.green(`✓ 共扫描到 ${files.length} 个文件\n`));
      
      const parsedFiles = files.map(file => ({
        ...file,
        parsed: parseFilename(file.name, file.path)
      }));
      
      const validFiles = parsedFiles.filter(f => f.parsed.valid);
      const invalidFiles = parsedFiles.filter(f => !f.parsed.valid);
      
      console.log(chalk.green(`✓ 有效解析文件: ${validFiles.length}`));
      console.log(chalk.yellow(`⚠ 无法解析文件: ${invalidFiles.length}\n`));
      
      const missingResult = detectMissingPhotos(validFiles, photoTypes, options);
      const duplicateResult = await detectDuplicates(validFiles);
      
      if (!options.export) {
        console.log(chalk.gray('跳过结果导出\n'));
      } else {
        await exportResults({
          validFiles,
          invalidFiles,
          missingPhotos: missingResult,
          duplicates: duplicateResult,
          photoTypes,
          options
        }, options.output);
      }
      
      if (!options.summary) {
        console.log(chalk.gray('跳过终端摘要\n'));
      } else {
        printSummary({
          validFiles,
          invalidFiles,
          missingPhotos: missingResult,
          duplicates: duplicateResult,
          photoTypes
        });
      }
      
      console.log(chalk.blue('\n=== 清点完成 ===\n'));
      
    } catch (error) {
      console.error(chalk.red('\n✗ 错误:'), error.message);
      console.error(chalk.gray('使用 --help 查看帮助信息\n'));
      process.exit(1);
    }
  });

program
  .command('self-test')
  .description('运行自检，验证工具功能正确性')
  .option('-k, --keep', '保留测试数据目录')
  .action(async (options) => {
    console.log(chalk.blue('\n=== 售后照片清点工具 - 自检 ===\n'));
    try {
      await runSelfTest(options.keep);
      console.log(chalk.green('\n✓ 自检通过！\n'));
    } catch (error) {
      console.error(chalk.red('\n✗ 自检失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('parse <filename>')
  .description('解析单个文件名，调试用')
  .action((filename) => {
    const result = parseFilename(filename);
    console.log('\n解析结果:');
    console.log(JSON.stringify(result, null, 2));
    console.log();
  });

async function validateOptions(options) {
  const dirPath = path.resolve(options.directory);
  
  if (!fs.existsSync(dirPath)) {
    throw new Error(`目录不存在: ${dirPath}`);
  }
  
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    throw new Error(`路径不是目录: ${dirPath}`);
  }
  
  options.directory = dirPath;
  options.output = path.resolve(options.output);
}

program.parse();
