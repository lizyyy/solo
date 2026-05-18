#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';
import { importFile, importDirectory, writeOutput } from './importer.js';

const argv = yargs(hideBin(process.argv))
  .command('check <input>', '核对农贸市场摊位收费数据', (yargs) => {
    return yargs
      .positional('input', {
        describe: 'CSV 文件路径或目录路径',
        type: 'string'
      })
      .option('output', {
        alias: 'o',
        describe: '输出文件路径',
        type: 'string',
        default: './stall-fee-result.json'
      })
      .option('verbose', {
        alias: 'v',
        describe: '显示详细日志',
        type: 'boolean',
        default: false
      });
  })
  .command('sample', '生成农贸市场摊位收费样例数据', (yargs) => {
    return yargs
      .option('output', {
        alias: 'o',
        describe: '输出目录路径',
        type: 'string',
        default: './samples'
      });
  })
  .demandCommand(1, '请指定要执行的命令')
  .help()
  .alias('help', 'h')
  .argv;

async function main() {
  const command = argv._[0];

  if (command === 'check') {
    const inputPath = path.resolve(argv.input);
    const outputPath = path.resolve(argv.output);
    
    logger.setVerbose(argv.verbose);
    
    console.log('='.repeat(50));
    console.log('农贸市场摊位办摊位收费核对工具');
    console.log('='.repeat(50));
    
    try {
      let results;
      
      if (fs.statSync(inputPath).isDirectory()) {
        results = await importDirectory(inputPath);
      } else {
        logger.incrementFiles(1);
        const records = await importFile(inputPath);
        results = [{
          file: path.basename(inputPath),
          records
        }];
      }
      
      writeOutput(results, outputPath);
      logger.printSummary();
      
    } catch (error) {
      logger.error('处理失败:', error.message);
      process.exit(1);
    }
    
  } else if (command === 'sample') {
    const outputDir = path.resolve(argv.output);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const samples = {
      'normal.csv': createNormalSample(),
      'missing-column.csv': createMissingColumnSample(),
      'duplicate-rows.csv': createDuplicateRowsSample(),
      'special-cases.csv': createSpecialCasesSample()
    };
    
    for (const [fileName, content] of Object.entries(samples)) {
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ 已创建: ${filePath}`);
    }
    
    console.log('\n样例数据已生成完成！');
    console.log(`运行: stall-fee-check check ${outputDir}`);
  }
}

function createNormalSample() {
  return `摊位编号,摊主姓名,摊位类型,收费月份,应收金额,实收金额,收费状态
A001,张三,蔬菜类,2024-01,500,500,已缴
A002,李四,水果类,2024-01,800,800,已缴
A003,王五,肉类,2024-01,1200,1200,已缴
B001,赵六,水产类,2024-01,1000,800,部分缴纳
B002,钱七,干货类,2024-01,600,600,已缴
C001,孙八,熟食类,2024-01,700,700,已缴
C002,周九,豆制品类,2024-01,400,0,未缴`;
}

function createMissingColumnSample() {
  return `摊位编号,摊主姓名,收费月份,应收金额,实收金额,收费状态
A001,张三,2024-01,500,500,已缴`;
}

function createDuplicateRowsSample() {
  return `摊位编号,摊主姓名,摊位类型,收费月份,应收金额,实收金额,收费状态
A001,张三,蔬菜类,2024-01,500,500,已缴
A001,张三,蔬菜类,2024-01,500,500,已缴
A002,李四,水果类,2024-01,800,800,已缴`;
}

function createSpecialCasesSample() {
  return `摊位编号,摊主姓名,摊位类型,收费月份,应收金额,实收金额,收费状态
A001,张三,蔬菜类,2024-01,500,500,已缴
A004,吴十,蔬菜类,2024-01,500,0,临时休市
B003,郑十一,水果类,2024-01,800,800,转租
C003,王十二,肉类,2024-01,-100,0,未缴
D001,,水产类,2024-01,1000,1000,已缴
D002,陈十四,干货类,2024/01,600,600,已缴`;
}

main();
