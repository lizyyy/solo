#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const path = require('path');
const { loadConfig } = require('./config');
const { InspectionProcessor } = require('./processor');

async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('用法: lighting-inspect <文件> [选项]')
    .example('lighting-inspect inspection_data.csv', '处理单个检修文件')
    .example('lighting-inspect *.csv -o ./output', '批量处理并输出到指定目录')
    .option('config', {
      alias: 'c',
      type: 'string',
      description: '配置文件路径'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: '输出目录',
      default: process.cwd()
    })
    .option('continue-on-error', {
      alias: 'k',
      type: 'boolean',
      description: '遇到错误时继续处理',
      default: true
    })
    .demandCommand(1, '请指定要处理的文件')
    .help('h')
    .alias('h', 'help')
    .epilog('舞台灯光租赁店灯光设备检修 CLI 工具')
    .argv;
  
  const config = loadConfig(argv.config);
  const filePatterns = argv._;
  const outputDir = argv.output;
  
  console.log('========================================');
  console.log('  舞台灯光租赁店灯光设备检修 CLI 工具');
  console.log('========================================');
  console.log(`输出目录: ${outputDir}`);
  console.log('');
  
  const processor = new InspectionProcessor(config, outputDir);
  
  for (const pattern of filePatterns) {
    try {
      const files = await resolveFilePattern(pattern);
      
      for (const file of files) {
        console.log(`处理文件: ${file}`);
        
        try {
          await processor.processFile(file);
          console.log(`  ✓ 处理完成`);
        } catch (e) {
          console.log(`  ✗ 处理失败: ${e.message}`);
          if (!argv['continue-on-error']) {
            throw e;
          }
        }
      }
    } catch (e) {
      console.error(`错误: ${e.message}`);
      if (!argv['continue-on-error']) {
        process.exit(1);
      }
    }
  }
  
  await processor.writeResults();
  
  const stats = processor.getStatistics();
  console.log('');
  console.log('========================================');
  console.log('  处理统计');
  console.log('========================================');
  console.log(`总记录数: ${stats.total}`);
  console.log(`正常处理: ${stats.normalCount}`);
  console.log(`套装缺件: ${stats.setMissingCount}`);
  console.log(`灯泡寿命告警: ${stats.bulbLifeCount}`);
  console.log(`需重跑: ${stats.rerunCount}`);
  console.log(`错误数: ${stats.errorCount}`);
  console.log('');
  console.log(`输出文件已保存到: ${outputDir}`);
}

async function resolveFilePattern(pattern) {
  const { glob } = require('glob');
  return glob(pattern);
}

main().catch(e => {
  console.error('致命错误:', e);
  process.exit(1);
});
