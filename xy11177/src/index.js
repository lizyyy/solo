#!/usr/bin/env node

import { Command } from 'commander';
import { Logger } from './logger.js';
import { RepairParser } from './parser.js';
import { RepairValidator } from './validator.js';
import { RepairDispatcher } from './dispatcher.js';
import { ReportGenerator } from './reporter.js';
import fs from 'fs/promises';

const program = new Command();

program
  .name('repair-dispatch')
  .description('校园宿舍维修队宿舍维修派单 CLI')
  .version('1.0.0');

program
  .command('preview')
  .description('预览报修数据，不执行派单')
  .option('-i, --input <path>', '输入报修数据文件路径', 'data/repairs.json')
  .option('-v, --verbose', '显示详细日志')
  .action(async (options) => {
    const logger = new Logger(options.verbose);
    
    try {
      logger.log('开始预览报修数据...');
      
      const parser = new RepairParser(logger);
      const repairs = await parser.parseFile(options.input);
      
      const validator = new RepairValidator(logger);
      const result = validator.validate(repairs);
      
      logger.log(`\n===== 数据预览 =====`);
      logger.log(`报修总数: ${repairs.length}`);
      logger.log(`有效报修: ${result.valid.length}`);
      logger.log(`重复报修: ${result.duplicates.length}`);
      logger.log(`急修单数: ${result.valid.filter(r => r.priority === 'urgent').length}`);
      
      if (result.duplicates.length > 0) {
        logger.warn('\n重复报修列表:');
        result.duplicates.forEach(d => {
          logger.warn(`  - ${d.id} 重复于 ${d.duplicateOf} (${d.reason})`);
        });
      }
      
      if (result.warnings.length > 0) {
        logger.warn('\n数据警告:');
        result.warnings.forEach(w => {
          logger.warn(`  - ${w.id}: ${w.message}`);
        });
      }
      
      logger.success('\n预览完成！可执行 dispatch 命令进行派单');
      
    } catch (error) {
      const logger = new Logger(options.verbose);
      logger.error(error.message);
      process.exit(1);
    }
  });

program
  .command('dispatch')
  .description('执行派单操作')
  .option('-i, --input <path>', '输入报修数据文件路径', 'data/repairs.json')
  .option('-o, --output <path>', '派单结果输出路径', 'output/dispatch.json')
  .option('-v, --verbose', '显示详细日志')
  .option('--resume', '从已有派单结果恢复，避免重复派单')
  .action(async (options) => {
    const logger = new Logger(options.verbose);
    
    try {
      logger.log('开始执行派单...');
      
      const parser = new RepairParser(logger);
      const repairs = await parser.parseFile(options.input);
      
      let existingDispatches = [];
      if (options.resume) {
        try {
          const content = await fs.readFile(options.output, 'utf-8');
          existingDispatches = JSON.parse(content);
          logger.verbose(`从 ${options.output} 恢复了 ${existingDispatches.length} 条已有派单`);
        } catch (e) {
          logger.verbose('未找到已有派单文件，将全新开始');
        }
      }
      
      const validator = new RepairValidator(logger);
      const validationResult = validator.validate(repairs);
      
      if (validationResult.errors.length > 0) {
        logger.error('存在错误，无法继续派单:');
        validationResult.errors.forEach(e => {
          logger.error(`  - ${e.id}: ${e.message}`);
        });
        process.exit(1);
      }
      
      const dispatcher = new RepairDispatcher(logger);
      const dispatches = dispatcher.dispatch(validationResult.valid, existingDispatches);
      
      await parser.saveDispatches(dispatches, options.output);
      
      const summary = dispatcher.getDispatchSummary(dispatches);
      
      logger.log(`\n===== 派单结果 =====`);
      logger.log(`派单总数: ${summary.total}`);
      logger.log(`急修单: ${summary.urgent}`);
      logger.log(`普通报修: ${summary.normal}`);
      logger.log(`\n按师傅分配:`);
      Object.entries(summary.byTechnician).forEach(([tech, count]) => {
        logger.log(`  - ${tech}: ${count} 单`);
      });
      
      if (validationResult.duplicates.length > 0) {
        logger.warn(`\n已排除 ${validationResult.duplicates.length} 条重复报修`);
      }
      
      logger.success('\n派单完成！可执行 report 命令查看详细报告');
      
    } catch (error) {
      logger.error(error.message);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成派单报告')
  .option('-i, --input <path>', '派单结果文件路径', 'output/dispatch.json')
  .option('-o, --output <path>', '报告输出路径', 'output/report.md')
  .option('-d, --data <path>', '原始报修数据文件路径', 'data/repairs.json')
  .option('-v, --verbose', '显示详细日志')
  .action(async (options) => {
    const logger = new Logger(options.verbose);
    
    try {
      logger.log('开始生成派单报告...');
      
      const parser = new RepairParser(logger);
      const allRepairs = await parser.parseFile(options.data);
      
      const validator = new RepairValidator(logger);
      const validationResult = validator.validate(allRepairs);
      
      let dispatches = [];
      try {
        const content = await fs.readFile(options.input, 'utf-8');
        dispatches = JSON.parse(content);
      } catch (e) {
        throw new Error(`无法读取派单结果文件: ${options.input}`);
      }
      
      const reporter = new ReportGenerator(logger);
      await reporter.generateReport(dispatches, validationResult, options.output);
      
      logger.success(`报告已生成: ${options.output}`);
      
    } catch (error) {
      logger.error(error.message);
      process.exit(1);
    }
  });

program.parse();
