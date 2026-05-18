#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const {
  OUTPUT_COLUMNS,
  separateResults,
  formatForMachine,
  formatSummary
} = require('../src/converter');

function printHelp() {
  console.log(`
烘焙工坊烘焙配方换算 CLI

用法:
  烘焙工坊烘焙配方换算 <输入文件> [选项]

选项:
  --scale <比例>        换算比例 (默认: 1.0)
  --portions <份数>     订单份数 (默认: 1)
  --output <目录>       输出目录 (默认: ./output)
  --json                输出JSON格式（机器可读）
  --summary             仅显示汇总信息
  --help, -h            显示帮助信息

示例:
  烘焙工坊烘焙配方换算 samples/input.csv --scale 2.5 --portions 3
  烘焙工坊烘焙配方换算 samples/input.csv --json
`);
}

function parseArgs(args) {
  const options = {
    inputFile: null,
    scale: 1.0,
    portions: 1,
    outputDir: './output',
    json: false,
    summary: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--scale') {
      options.scale = parseFloat(args[++i]);
    } else if (arg === '--portions') {
      options.portions = parseFloat(args[++i]);
    } else if (arg === '--output') {
      options.outputDir = args[++i];
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--summary') {
      options.summary = true;
    } else if (!arg.startsWith('-')) {
      options.inputFile = arg;
    }
  }

  if (!options.inputFile) {
    console.error('错误: 请指定输入文件');
    printHelp();
    process.exit(1);
  }

  return options;
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true });
}

function writeCsv(filePath, rows) {
  const content = stringify(rows, { header: true, columns: OUTPUT_COLUMNS });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '\uFEFF' + content, 'utf-8');
}

function printHumanSummary(summary) {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║        烘焙工坊配方换算汇总            ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  配方总数:     ${String(summary['配方总数']).padEnd(18)}║`);
  console.log(`║  原料行数:     ${String(summary['原料行数']).padEnd(18)}║`);
  console.log(`║  换算比例:     ${String(summary['换算比例']).padEnd(18)}║`);
  console.log(`║  订单份数:     ${String(summary['订单份数']).padEnd(18)}║`);
  console.log(`║  总重量(克):   ${String(summary['总重量(克)']).padEnd(18)}║`);
  console.log(`║  总重量(公斤): ${String(summary['总重量(公斤)']).padEnd(18)}║`);
  console.log('╚════════════════════════════════════════╝\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = readCsv(options.inputFile);
  
  const { normal, halfOrder, mixedUnit } = separateResults(
    rows,
    options.scale,
    options.portions
  );

  const allResults = [...normal, ...halfOrder];
  const machineData = formatForMachine(allResults);
  const summary = formatSummary(allResults, options.scale, options.portions);

  if (options.json) {
    console.log(JSON.stringify({
      summary,
      results: machineData,
      warnings: {
        hasHalfOrder: halfOrder.length > 0,
        hasMixedUnit: mixedUnit.length > 0,
        halfOrderCount: halfOrder.length,
        mixedUnitCount: mixedUnit.length
      }
    }, null, 2));
    return;
  }

  if (options.summary) {
    printHumanSummary(summary);
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = path.basename(options.inputFile, '.csv');
  
  const normalPath = path.join(options.outputDir, `${baseName}_normal.csv`);
  const halfPath = path.join(options.outputDir, `${baseName}_半份订单_${timestamp}.csv`);
  const mixedPath = path.join(options.outputDir, `${baseName}_单位混用_${timestamp}.csv`);
  const summaryPath = path.join(options.outputDir, `${baseName}_汇总.json`);

  if (normal.length > 0) {
    writeCsv(normalPath, normal);
    console.log(`✓ 正常结果已写入: ${normalPath}`);
  }

  if (halfOrder.length > 0) {
    writeCsv(halfPath, halfOrder);
    console.log(`⚠ 半份订单结果已写入: ${halfPath}`);
  }

  if (mixedUnit.length > 0) {
    writeCsv(mixedPath, mixedUnit);
    console.log(`⚠ 克/公斤混用记录已写入: ${mixedPath}`);
  }

  fs.mkdirSync(options.outputDir, { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`✓ 汇总信息已写入: ${summaryPath}`);

  printHumanSummary(summary);
}

main();
