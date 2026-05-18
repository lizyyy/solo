#!/usr/bin/env node

const path = require('path');
const { parseInventoryFile, parseDirectory } = require('./parser');
const { validateInventory } = require('./validator');
const { generateReports, listReports } = require('./reporter');

function parseArgs(args) {
  const result = {
    command: null,
    input: null,
    output: 'output',
    overwrite: false,
    preview: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === 'preview' || arg === 'run' || arg === 'report') {
      result.command = arg;
    } else if (arg === '--input' && i + 1 < args.length) {
      result.input = args[++i];
    } else if (arg === '--output' && i + 1 < args.length) {
      result.output = args[++i];
    } else if (arg === '--overwrite') {
      result.overwrite = true;
    }
  }

  return result;
}

function printPreview(parseResult, validateResult) {
  console.log('========================================');
  console.log('  露营装备租赁清点 - 预览结果');
  console.log('========================================');
  console.log();

  console.log('【解析统计】');
  console.log(`  总记录: ${parseResult.stats.total}`);
  console.log(`  有效: ${parseResult.stats.valid}`);
  console.log(`  无效: ${parseResult.stats.invalid}`);
  console.log();

  console.log('【校验统计】');
  console.log(`  正常记录: ${validateResult.stats.normal}`);
  console.log(`  问题记录: ${validateResult.stats.total - validateResult.stats.normal}`);
  console.log();

  const issues = validateResult.issues;
  if (issues.crossSetItems.length > 0) {
    console.log(`  * 同配件跨套装: ${issues.crossSetItems.length} 项`);
  }
  if (issues.handwrittenNotes.length > 0) {
    console.log(`  * 备注手写: ${issues.handwrittenNotes.length} 条`);
  }
  if (issues.duplicateRecords.length > 0) {
    console.log(`  * 重复记录: ${issues.duplicateRecords.length} 条`);
  }
  if (issues.invalidStatus.length > 0) {
    console.log(`  * 状态异常: ${issues.invalidStatus.length} 条`);
  }
  if (issues.invalidQuantity.length > 0) {
    console.log(`  * 数量异常: ${issues.invalidQuantity.length} 条`);
  }
  console.log();

  console.log('【待生成文件】');
  console.log('  - 正常清点结果.csv');
  if (issues.crossSetItems.length > 0) console.log('  - 同配件跨套装_待复核.csv');
  if (issues.handwrittenNotes.length > 0) console.log('  - 备注手写_待复核.csv');
  if (issues.duplicateRecords.length > 0) console.log('  - 重复记录_待复核.csv');
  if (parseResult.invalid.length > 0) console.log('  - 解析失败_待修复.csv');
  console.log('  - 清点汇总报告.md');
  console.log();
  
  console.log('执行正式清点请运行: npm run run');
  console.log('========================================');
}

function printRunResult(reportResult) {
  console.log('========================================');
  console.log('  露营装备租赁清点 - 执行完成');
  console.log('========================================');
  console.log();
  console.log(`输出目录: ${reportResult.outputPath}`);
  console.log(`时间戳: ${reportResult.timestamp}`);
  console.log();
  console.log('生成文件:');
  reportResult.files.forEach(f => {
    console.log(`  - ${f.name} (${f.count}条)`);
  });
  console.log();
  console.log('查看报告请运行: npm run report');
  console.log('========================================');
}

function printReportList(outputPath) {
  const reports = listReports(outputPath);
  
  console.log('========================================');
  console.log('  露营装备租赁清点 - 报告列表');
  console.log('========================================');
  console.log();
  
  if (reports.length === 0) {
    console.log('暂无报告文件');
    console.log();
    console.log('请先运行: npm run run');
    console.log('========================================');
    return;
  }

  reports.forEach((f, index) => {
    console.log(`${index + 1}. ${f.name}`);
    console.log(`   大小: ${f.size} 字节`);
    console.log(`   时间: ${f.mtime.toLocaleString('zh-CN')}`);
    console.log();
  });

  console.log('最新汇总报告:');
  const latestSummary = reports.find(f => f.name.includes('汇总报告') && f.name.endsWith('.md'));
  if (latestSummary) {
    console.log(`  ${latestSummary.name}`);
    console.log();
    console.log('查看方式:');
    console.log(`  cat ${latestSummary.path}`);
  }
  console.log('========================================');
}

function printHelp() {
  console.log('========================================');
  console.log('  露营装备租赁清点 CLI');
  console.log('========================================');
  console.log();
  console.log('用法:');
  console.log('  npm run preview -- --input <文件/目录>  # 预览清点结果');
  console.log('  npm run run -- --input <文件/目录>        # 执行清点生成报告');
  console.log('  npm run report -- --output <目录>          # 查看报告列表');
  console.log();
  console.log('示例:');
  console.log('  npm run preview -- --input data/sample.csv');
  console.log('  npm run run -- --input data/sample.csv --output output');
  console.log('  npm run report -- --output output');
  console.log();
  console.log('选项:');
  console.log('  --overwrite    覆盖已有文件，不加时间戳');
  console.log('========================================');
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.command) {
    printHelp();
    process.exit(0);
  }

  try {
    if (options.command === 'preview') {
      if (!options.input) {
        console.error('错误: 请指定 --input 参数');
        process.exit(1);
      }

      const inputPath = path.resolve(options.input);
      const parseResult = parseInventoryFile(inputPath);
      const validateResult = validateInventory(parseResult.valid);
      
      printPreview(parseResult, validateResult);

    } else if (options.command === 'run') {
      if (!options.input) {
        console.error('错误: 请指定 --input 参数');
        process.exit(1);
      }

      const inputPath = path.resolve(options.input);
      const outputPath = path.resolve(options.output);

      const parseResult = parseInventoryFile(inputPath);
      const validateResult = validateInventory(parseResult.valid);
      const reportResult = generateReports(parseResult, validateResult, outputPath, {
        overwrite: options.overwrite,
        preview: false
      });

      printRunResult(reportResult);

    } else if (options.command === 'report') {
      const outputPath = path.resolve(options.output);
      printReportList(outputPath);
    }
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

main();
