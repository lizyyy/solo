#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { readCSV, mergeData } = require('./csvHandler');
const { checkTemperature, generateStatistics } = require('./temperatureChecker');
const { outputResults, outputJSON, outputMarkdownReport } = require('./outputGenerator');
const { validateInput, ValidationError } = require('./validator');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function color(color, text) {
  return COLORS[color] + text + COLORS.reset;
}

function showHelp() {
  console.log(`
生鲜到货温度检查 CLI 工具

使用方法:
  node src/cli.js check [选项]

选项:
  -a, --arrival <path>       到货单 CSV 文件路径 (必填)
  -t, --temperature <path>   温度记录 CSV 文件路径 (必填)
  -o, --output <directory>   输出目录路径 (默认: ./output)
  --default-threshold <num>  默认拒收温度阈值 (℃) (默认: 8)
  --verbose                  显示详细处理信息
  -h, --help                 显示帮助信息

示例:
  node src/cli.js check -a data/arrival.csv -t data/temperature.csv
  node src/cli.js check -a data/arrival.csv -t data/temperature.csv -o ./output --default-threshold 8
`);
}

function parseArgs(args) {
  const options = {
    command: null,
    arrival: null,
    temperature: null,
    output: './output',
    defaultThreshold: 8,
    verbose: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (!options.command && !arg.startsWith('-')) {
      options.command = arg;
      i++;
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      showHelp();
      process.exit(0);
    }

    if (arg === '-a' || arg === '--arrival') {
      options.arrival = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '-t' || arg === '--temperature') {
      options.temperature = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '-o' || arg === '--output') {
      options.output = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--default-threshold') {
      options.defaultThreshold = parseFloat(args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === '--verbose') {
      options.verbose = true;
      i++;
      continue;
    }

    i++;
  }

  return options;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.command || options.command !== 'check') {
    console.log(color('red', '错误: 请指定命令。使用 --help 查看帮助信息。'));
    process.exit(1);
  }

  try {
    console.log(color('blue', '═══════════════════════════════════════════════'));
    console.log(color('blue', color('bright', '      生鲜到货温度检查工具')));
    console.log(color('blue', '═══════════════════════════════════════════════\n'));

    validateInput(options);

    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
      console.log(color('gray', `创建输出目录: ${options.output}`));
    }

    console.log(color('cyan', '📂 正在读取数据文件...'));
    const arrivalData = await readCSV(options.arrival, { verbose: options.verbose });
    console.log(color('green', `  ✓ 到货单: ${arrivalData.length} 条记录`));

    const temperatureData = await readCSV(options.temperature, { verbose: options.verbose });
    console.log(color('green', `  ✓ 温度记录: ${temperatureData.length} 条记录\n`));

    console.log(color('cyan', '🔗 正在合并数据...'));
    const { mergedData, unmatchedArrival, unmatchedTemperature, badRows } = mergeData(arrivalData, temperatureData);
    console.log(color('green', `  ✓ 成功合并: ${mergedData.length} 条记录`));
    if (unmatchedArrival.length > 0) {
      console.log(color('yellow', `  ⚠ 未匹配到货单: ${unmatchedArrival.length} 条`));
    }
    if (unmatchedTemperature.length > 0) {
      console.log(color('yellow', `  ⚠ 未匹配温度记录: ${unmatchedTemperature.length} 条`));
    }
    if (badRows.length > 0) {
      console.log(color('red', `  ✗ 坏记录: ${badRows.length} 条\n`));
    }

    console.log(color('cyan', '🌡️  正在进行温度检查...'));
    const threshold = parseFloat(options.defaultThreshold);
    const { rejectedRecords, acceptedRecords, anomalyRecords } = checkTemperature(mergedData, threshold);
    console.log(color('green', `  ✓ 拒收批次: ${rejectedRecords.length}`));
    console.log(color('green', `  ✓ 通过批次: ${acceptedRecords.length}`));
    console.log(color('yellow', `  ✓ 异常样本: ${anomalyRecords.length}\n`));

    console.log(color('cyan', '📊 正在生成统计数据...'));
    const statistics = generateStatistics({
      rejectedRecords,
      acceptedRecords,
      anomalyRecords,
      unmatchedArrival,
      unmatchedTemperature,
      badRows,
      totalProcessed: mergedData.length
    });
    console.log(color('green', '  ✓ 统计数据生成完成\n'));

    console.log(color('cyan', '📄 正在生成输出文件...'));
    
    const resultData = {
      runTime: new Date().toISOString(),
      inputFiles: {
        arrival: options.arrival,
        temperature: options.temperature
      },
      threshold,
      statistics,
      rejectedRecords,
      acceptedRecords,
      anomalyRecords,
      unmatchedArrival,
      unmatchedTemperature,
      badRows
    };

    await outputJSON(resultData, path.join(options.output, 'results.json'));
    console.log(color('green', `  ✓ 机器可读结果: ${path.join(options.output, 'results.json')}`));

    await outputMarkdownReport(resultData, path.join(options.output, 'report.md'));
    console.log(color('green', `  ✓ Markdown 报告: ${path.join(options.output, 'report.md')}`));

    console.log('\n' + color('blue', '═══════════════════════════════════════════════'));
    outputResults(resultData);
    console.log(color('blue', '═══════════════════════════════════════════════'));
    
    console.log('\n' + color('green', color('bright', '✅ 处理完成!')));
    console.log(color('gray', `所有输出文件已保存至: ${path.resolve(options.output)}`));

  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(color('red', '\n❌ 输入错误: ') + error.message);
      process.exit(1);
    } else {
      console.error(color('red', '\n❌ 处理失败: ') + error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

main();