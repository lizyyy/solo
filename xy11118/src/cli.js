#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const MealSubsidySplitter = require('./splitter');
const { EXIT_CODES } = require('./constants');

function loadConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ 配置文件不存在: ${absolutePath}`);
    process.exit(EXIT_CODES.ERROR_CONFIG_NOT_FOUND);
  }
  
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (e) {
    console.error(`❌ 配置文件解析失败: ${e.message}`);
    process.exit(EXIT_CODES.ERROR_CONFIG_NOT_FOUND);
  }
}

function validateInput(inputPath) {
  const absolutePath = path.resolve(inputPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ 输入文件不存在: ${absolutePath}`);
    process.exit(EXIT_CODES.ERROR_INPUT_NOT_FOUND);
  }
  return absolutePath;
}

function printSummary(result) {
  console.log('\n📊 拆账完成！');
  console.log('================================');
  console.log(`总记录数: ${result.counts.total}`);
  console.log(`✓ 正常结果: ${result.counts.normal}`);
  console.log(`⚠ 跨月退款: ${result.counts.crossMonthRefund}`);
  console.log(`⚠ 离职员工: ${result.counts.resignedEmployee}`);
  console.log(`⚠ 复跑输出: ${result.counts.rerunOutput}`);
  console.log(`📝 审计日志: ${result.auditFile}`);
  console.log('================================\n');

  if (result.hasSpecialCases) {
    console.log('⚠  注意：检测到特殊情况，已分别输出到独立文件，请重点复核！\n');
  }
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('config', {
      alias: 'c',
      type: 'string',
      description: '规则配置文件路径',
      default: 'config/default.json'
    })
    .option('input', {
      alias: 'i',
      type: 'string',
      description: '输入CSV文件路径'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: '输出目录路径',
      default: 'output/'
    })
    .option('audit', {
      alias: 'a',
      type: 'string',
      description: '审计日志目录',
      default: 'audit/'
    })
    .option('sample', {
      alias: 's',
      type: 'boolean',
      description: '使用样例数据演示拆账流程'
    })
    .example('$0 --input data/sample-input.csv', '使用默认配置和样例数据')
    .example('$0 -c config/my-rules.json -i data/raw.csv -o result/', '自定义配置和输出目录')
    .epilogue('退出码说明:\n  0 - 成功，无特殊情况\n  1 - 参数错误\n  2 - 配置文件不存在\n  3 - 输入文件不存在\n  4 - CSV格式错误\n  5 - 处理失败\n  6 - 输出失败\n  10 - 成功，但检测到特殊情况需要复核')
    .help()
    .argv;

  let configPath = argv.config;
  let inputPath = argv.input;

  if (argv.sample) {
    configPath = path.join(__dirname, '../config/default.json');
    inputPath = path.join(__dirname, '../data/sample-input.csv');
    console.log('🎯 使用样例数据演示拆账流程...\n');
  } else if (!argv.input) {
    console.error('❌ 请指定输入文件路径');
    yargs.showHelp();
    process.exit(EXIT_CODES.ERROR_INVALID_ARGS);
  }

  const config = loadConfig(configPath);
  const validatedInputPath = validateInput(inputPath);
  const outputDir = path.resolve(argv.output);
  const auditDir = path.resolve(argv.audit);

  console.log(`📍 配置文件: ${configPath}`);
  console.log(`📍 输入文件: ${validatedInputPath}`);
  console.log(`📍 输出目录: ${outputDir}`);
  console.log(`📍 审计目录: ${auditDir}\n`);

  try {
    const splitter = new MealSubsidySplitter(config, auditDir);
    const result = await splitter.process(validatedInputPath, outputDir);
    
    printSummary(result);

    if (result.hasSpecialCases) {
      process.exit(EXIT_CODES.WARNING_HAS_SPECIAL_CASES);
    } else {
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (e) {
    console.error(`❌ 处理失败: ${e.message}`);
    console.error(e.stack);
    process.exit(EXIT_CODES.ERROR_PROCESSING_FAILED);
  }
}

main().catch(e => {
  console.error(`❌ 程序异常: ${e.message}`);
  process.exit(EXIT_CODES.ERROR_PROCESSING_FAILED);
});
