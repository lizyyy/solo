#!/usr/bin/env node

const yargs = require('yargs');
const path = require('path');
const SignDataProcessor = require('./processor');

const argv = yargs
  .option('input', {
    alias: 'i',
    describe: '输入目录路径，包含养老体征日报CSV文件',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    describe: '输出目录路径，用于存放处理结果',
    type: 'string',
    demandOption: true
  })
  .help()
  .alias('help', 'h')
  .example('$0 -i ./data/input -o ./data/output', '处理输入目录中的养老体征日报数据')
  .epilog('养老日托站养老体征日报数据清洗工具 - 分离正常记录与异常记录')
  .argv;

async function main() {
  const inputDir = path.resolve(argv.input);
  const outputDir = path.resolve(argv.output);

  console.log('========================================');
  console.log('养老日托站养老体征日报 - 数据清洗工具');
  console.log('========================================');
  console.log(`输入目录: ${inputDir}`);
  console.log(`输出目录: ${outputDir}`);
  console.log('');

  const processor = new SignDataProcessor();

  try {
    console.log('开始处理文件...');
    await processor.processDirectory(inputDir);
    
    console.log('正在生成输出文件...');
    await processor.writeResults(outputDir);
    
    const stats = processor.getStats();
    console.log('');
    console.log('处理完成！');
    console.log('----------------------------------------');
    console.log(`总记录数: ${stats.total}`);
    console.log(`正常记录数: ${stats.normal}`);
    console.log(`异常记录数: ${stats.abnormal}`);
    console.log('----------------------------------------');
    console.log('输出文件:');
    console.log(`  - 正常记录.csv`);
    console.log(`  - 异常记录.csv`);
    console.log(`  - 处理摘要.json`);
    console.log(`  - 处理摘要.txt`);
    console.log('========================================');
  } catch (error) {
    console.error('处理过程中发生错误:', error.message);
    process.exit(1);
  }
}

main();
