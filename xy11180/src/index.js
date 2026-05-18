#!/usr/bin/env node

import { Command } from 'commander';
import { processFiles } from './processor.js';
import { generateOutput } from './output.js';

const program = new Command();

program
  .name('swim-comp')
  .description('亲子游泳馆泳课停课补偿 CLI')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', '输入文件或目录路径')
  .requiredOption('-o, --output <path>', '输出文件路径（支持 .csv, .json, .md）')
  .option('-d, --dry-run', '试运行模式，不生成实际文件')
  .option('-f, --force', '强制覆盖已存在的输出文件')
  .action(async (options) => {
    try {
      const result = await processFiles(options.input);
      
      if (options.dryRun) {
        console.log('=== 试运行模式 ===');
        console.log('处理结果摘要:');
        console.log(`- 成功处理文件: ${result.successCount}`);
        console.log(`- 处理失败文件: ${result.failedCount}`);
        console.log(`- 停课补偿记录总数: ${result.records.length}`);
        console.log(`- 部分时段停课记录: ${result.partialSuspension.length}`);
        console.log(`- 连报课程记录: ${result.packageCourses.length}`);
        console.log(`- 可复跑输出记录: ${result.reRunnable.length}`);
        return;
      }

      await generateOutput(result, options.output, options.force);
      
      console.log('=== 处理完成 ===');
      console.log(`- 成功处理文件: ${result.successCount}`);
      console.log(`- 处理失败文件: ${result.failedCount}`);
      console.log(`- 输出文件: ${options.output}`);
      
      if (result.errors.length > 0) {
        console.log('\n=== 处理失败文件汇总 ===');
        result.errors.forEach((err, idx) => {
          console.log(`${idx + 1}. 文件: ${err.file}`);
          console.log(`   原因: ${err.error}`);
        });
      }
    } catch (error) {
      console.error('处理失败:', error.message);
      process.exit(1);
    }
  });

program.parse();
