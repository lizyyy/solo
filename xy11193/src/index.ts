#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import { TrainingScoreProcessor } from './processor.js';
import { logger } from './logger.js';
import packageJson from '../package.json' assert { type: 'json' };

const program = new Command();

program
  .name('training-summary')
  .description('企业内训组内训成绩汇总 CLI 工具 - 分离正常记录与异常记录')
  .version(packageJson.version)
  .argument('<files...>', '要处理的 CSV 文件路径，支持多个文件')
  .option('-v, --verbose', '显示详细日志，展开每条记录')
  .option('-o, --output <dir>', '输出目录', './output')
  .action(async (files: string[], options) => {
    logger.setVerbose(options.verbose);

    logger.info('企业内训组内训成绩汇总工具启动');
    logger.verboseInfo(`详细模式: 开启`);
    logger.verboseInfo(`输出目录: ${options.output}`);

    const absoluteFiles = files.map(file => {
      if (path.isAbsolute(file)) {
        return file;
      }
      return path.resolve(process.cwd(), file);
    });

    const processor = new TrainingScoreProcessor({
      verbose: options.verbose,
      outputDir: options.output
    });

    try {
      const result = await processor.processFiles(absoluteFiles);

      const statistics = {
        ...result.statistics,
        总文件数: files.length,
        成功处理文件数: files.length - result.skippedFiles.length - result.failedFiles.length
      };

      logger.printSummary(statistics);

      if (result.abnormalRecords.length > 0) {
        logger.warning('异常记录分类统计:');
        const typeCount: Record<string, number> = {};
        for (const record of result.abnormalRecords) {
          typeCount[record.异常类型] = (typeCount[record.异常类型] || 0) + 1;
        }
        for (const [type, count] of Object.entries(typeCount)) {
          console.log(`  ${type}: ${count} 条`);
        }
      }

      if (result.failedFiles.length > 0) {
        logger.error('处理失败的文件:');
        for (const fail of result.failedFiles) {
          console.log(`  ${fail.文件名}: ${fail.错误信息}`);
        }
      }

      if (result.skippedFiles.length > 0) {
        logger.warning('跳过的文件:');
        for (const skip of result.skippedFiles) {
          console.log(`  ${skip}`);
        }
      }

      logger.success(`处理完成！结果文件已保存到: ${options.output}`);

    } catch (error) {
      logger.error(`处理过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
      process.exit(1);
    }
  });

program.addHelpText('after', `

示例:
  $ training-summary ./data/*.csv
  $ training-summary ./培训记录1.csv ./培训记录2.csv -v
  $ training-summary ./data/*.csv -o ./results
  $ training-summary ./批量导入/*.csv --verbose

业务说明:
  本工具专门用于处理企业内训组的成绩汇总数据，能够：
  1. 支持多文件批量处理
  2. 自动识别并分离异常记录：
     - 同名员工：存在多条相同姓名的记录
     - 部门调整：同一员工编号对应多个部门
     - 可复跑输出：标记为复跑/重测的记录
     - 数据异常：关键业务列数据缺失
  3. 结果文件保留关键业务列，按稳定顺序输出
  4. 默认输出简洁日志，使用 -v 参数查看详细信息
`);

program.parse();
