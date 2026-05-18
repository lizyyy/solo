#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { cleanTemperatureData } = require('./cleaner');
const { generateReport } = require('./reporter');

const argv = yargs(hideBin(process.argv))
  .option('input', {
    alias: 'i',
    type: 'string',
    description: '输入CSV文件路径',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: '输出目录路径',
    default: './output'
  })
  .option('timezone', {
    alias: 'tz',
    type: 'string',
    description: '目标时区',
    default: 'Asia/Shanghai'
  })
  .help()
  .argv;

async function main() {
  console.log('========================================');
  console.log('  水产批发档口海鲜温度清洗 CLI 工具');
  console.log('========================================');
  console.log(`输入文件: ${argv.input}`);
  console.log(`输出目录: ${argv.output}`);
  console.log(`目标时区: ${argv.timezone}`);
  console.log('----------------------------------------');

  try {
    const result = await cleanTemperatureData(argv.input, argv.output, argv.timezone);
    
    console.log('\n========================================');
    console.log('  清洗完成！生成以下文件:');
    console.log('----------------------------------------');
    Object.entries(result.files).forEach(([name, path]) => {
      console.log(`  ✓ ${name}: ${path}`);
    });
    console.log('========================================');

    generateReport(result);
  } catch (error) {
    console.error('❌ 清洗过程出错:', error.message);
    process.exit(1);
  }
}

main();
