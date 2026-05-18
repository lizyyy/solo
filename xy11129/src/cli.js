#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const TraceCleaner = require('./index');

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('input', {
      alias: 'i',
      type: 'array',
      description: '输入文件路径，支持多个文件',
      demandOption: true
    })
    .option('output-dir', {
      alias: 'o',
      type: 'string',
      description: '输出目录',
      default: path.join(process.cwd(), 'data', 'output')
    })
    .option('continue-on-error', {
      alias: 'c',
      type: 'boolean',
      description: '遇到错误时继续处理后续文件',
      default: true
    })
    .help()
    .argv;

  const cleaner = new TraceCleaner({ outputDir: argv['output-dir'] });

  console.log('========================================');
  console.log('  骑行俱乐部骑行轨迹整理 CLI 工具');
  console.log('========================================');
  console.log(`输入文件数: ${argv.input.length}`);
  console.log(`输出目录: ${argv['output-dir']}`);
  console.log('----------------------------------------\n');

  for (let i = 0; i < argv.input.length; i++) {
    const inputFile = argv.input[i];
    const absolutePath = path.resolve(inputFile);
    
    console.log(`[${i + 1}/${argv.input.length}] 处理文件: ${inputFile}`);
    
    try {
      const result = await cleaner.processFile(absolutePath);
      
      if (result.success) {
        const baseName = path.basename(inputFile, path.extname(inputFile));
        const outputFileName = `${baseName}_cleaned.csv`;
        await cleaner.writeCleanedRecords(result.records, outputFileName);
        console.log(`  ✓ 处理完成，有效记录: ${result.records.length}`);
        
        if (result.errors.length > 0) {
          console.log(`  ⚠  检测到 ${result.errors.length} 个问题:`);
          result.errors.forEach(err => {
            console.log(`    - ${err.type}: ${err.message}`);
          });
        }
      } else {
        console.log(`  ✗ 处理失败:`);
        result.errors.forEach(err => {
          console.log(`    - ${err.type}: ${err.message}`);
        });
        
        if (!argv['continue-on-error']) {
          console.log('\n已设置遇错即停，终止处理。');
          break;
        }
      }
    } catch (error) {
      console.log(`  ✗ 异常错误: ${error.message}`);
      if (!argv['continue-on-error']) {
        console.log('\n已设置遇错即停，终止处理。');
        break;
      }
    }
    
    console.log('');
  }

  await cleaner.writeErrorLog();
  
  console.log('========================================');
  console.log('  处理统计');
  console.log('========================================');
  const stats = cleaner.getStats();
  console.log(`总文件数: ${stats.totalFiles}`);
  console.log(`成功处理: ${stats.processedFiles}`);
  console.log(`处理失败: ${stats.failedFiles}`);
  console.log(`总记录数: ${stats.totalRecords}`);
  console.log(`有效记录: ${stats.validRecords}`);
  console.log(`无效记录: ${stats.invalidRecords}`);
  console.log(`重复记录: ${stats.duplicateRecords}`);
  console.log(`断电事件: ${stats.powerLossEvents}`);
  console.log(`反向路线: ${stats.reverseRouteEvents}`);
  console.log('----------------------------------------');
  console.log(`错误日志已写入: ${path.join(argv['output-dir'], 'error_log.json')}`);
  console.log('========================================');
}

main().catch(err => {
  console.error('程序执行异常:', err);
  process.exit(1);
});
