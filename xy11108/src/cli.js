#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { processFiles } = require('./reconciliation');

const argv = yargs(hideBin(process.argv))
  .usage('使用方法: $0 [选项] <文件...>')
  .option('output', {
    alias: 'o',
    describe: '输出目录路径',
    default: './output',
    type: 'string'
  })
  .example('$0 -o ./result data/*.csv', '处理 data 目录下所有 CSV 文件并输出到 ./result')
  .example('$0 purchase_2024_05.csv', '处理单个采购文件')
  .demandCommand(1, '请指定至少一个要处理的 CSV 文件')
  .help('h')
  .alias('h', 'help')
  .epilog('花店配送花材采购对账 CLI 工具')
  .argv;

const filePaths = argv._.map(f => path.resolve(f));
const outputDir = path.resolve(argv.output);

filePaths.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.error(`错误: 文件不存在 - ${filePath}`);
    process.exit(1);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    console.error(`错误: 不是文件 - ${filePath}`);
    process.exit(1);
  }
});

console.log('========================================');
console.log('  花店配送花材采购对账 CLI 工具');
console.log('========================================');
console.log(`输入文件: ${filePaths.length} 个`);
console.log(`输出目录: ${outputDir}`);
console.log('----------------------------------------');
console.log('开始处理...\n');

processFiles(filePaths, outputDir)
  .then(result => {
    console.log('✓ 处理完成!');
    console.log('----------------------------------------');
    console.log(`输出文件: ${result.outputPath}`);
    console.log(`日志文件: ${result.logPath}`);
    console.log(`记录数量: ${result.totalRecords} 条`);
    
    if (result.failedFiles.length > 0) {
      console.log(`\n⚠ 部分文件处理失败: ${result.failedFiles.length} 个`);
      result.failedFiles.forEach(f => console.log(`  - ${f}`));
    }
    
    if (result.warnings.length > 0) {
      console.log(`\n⚠ 警告信息 (${result.warnings.length} 条):`);
      result.warnings.slice(0, 5).forEach(w => console.log(`  - ${w}`));
      if (result.warnings.length > 5) {
        console.log(`  ... 还有 ${result.warnings.length - 5} 条警告，请查看日志文件`);
      }
    }
    
    console.log('\n========================================');
  })
  .catch(err => {
    console.error('✗ 处理失败:', err.message);
    process.exit(1);
  });
