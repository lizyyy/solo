#!/usr/bin/env node

import { Command } from 'commander';
import { loadRules, validateRules } from './rules.js';
import { compareVersions } from './comparator.js';
import { Logger } from './logger.js';
import { generateReport } from './reporter.js';
import fs from 'fs/promises';
import path from 'path';

const program = new Command();

program
  .name('contract-compare')
  .description('合同版本目录重签版本比对 CLI')
  .version('1.0.0')
  .argument('<input-path>', '输入目录路径，包含新旧版本合同')
  .option('-r, --rules <path>', '规则配置文件路径', 'rules.yaml')
  .option('-o, --output <path>', '输出目录路径', 'output')
  .option('-n, --dry-run', '试运行，不生成输出文件', false)
  .option('-f, --force', '覆盖已存在的输出文件', false)
  .option('-v, --verbose', '详细模式，输出每条记录的处理过程', false)
  .action(async (inputPath, options) => {
    const logger = new Logger(options.verbose);
    
    try {
      logger.info('合同版本目录重签版本比对开始执行');
      logger.info(`输入目录: ${inputPath}`);
      logger.info(`规则文件: ${options.rules}`);
      logger.info(`输出目录: ${options.output}`);
      
      const rules = await loadRules(options.rules);
      validateRules(rules);
      logger.info('规则配置加载并验证通过');
      
      const results = await compareVersions(inputPath, rules, logger);
      
      if (!options.dryRun) {
        await ensureOutputDir(options.output, options.force);
        await generateReport(results, options.output, logger);
      } else {
        logger.info('试运行模式，跳过输出文件生成');
      }
      
      logger.printSummary(results);
      
    } catch (error) {
      logger.error(`执行失败: ${error.message}`);
      process.exit(1);
    }
  });

async function ensureOutputDir(outputPath, force) {
  try {
    await fs.access(outputPath);
    if (!force) {
      throw new Error(`输出目录已存在: ${outputPath}，使用 --force 覆盖`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await fs.mkdir(outputPath, { recursive: true });
}

program.parse();
