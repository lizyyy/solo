#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const chalk = require('chalk');
const commands = require('./commands');
const logger = require('./utils/logger');
const packageJson = require('../package.json');

program
  .name('inspection')
  .description('工程巡检照片重命名 CLI 工具')
  .version(packageJson.version, '-v, --version', '显示版本号');

program
  .command('init')
  .description('初始化工作区')
  .option('-p, --path <path>', '工作区路径', '.')
  .option('-f, --force', '强制重新初始化', false)
  .action(async (options) => {
    try {
      await commands.init(options.path, options.force);
    } catch (error) {
      logger.error(error.message);
      process.exit(1);
    }
  });

program
  .command('import')
  .description('导入数据（点位清单、巡检记录、照片）')
  .option('-t, --type <type>', '数据类型: points/records/photos', 'photos')
  .option('-s, --source <source>', '源数据路径')
  .option('-p, --path <path>', '工作区路径', '.')
  .option('-f, --force', '强制覆盖', false)
  .action(async (options) => {
    try {
      await commands.import(options.path, options.type, options.source, options.force);
    } catch (error) {
      logger.error(error.message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('检查数据完整性并预览重命名结果')
  .option('-p, --path <path>', '工作区路径', '.')
  .option('-s, --summary', '仅显示汇总信息', false)
  .action(async (options) => {
    try {
      await commands.check(options.path, options.summary);
    } catch (error) {
      logger.error(error.message);
      process.exit(1);
    }
  });

program
  .command('detail')
  .description('查看详细信息（照片、点位或历史记录）')
  .option('-t, --type <type>', '类型: photo/point/history', 'photo')
  .option('-i, --id <id>', 'ID 或名称')
  .option('-p, --path <path>', '工作区路径', '.')
  .action(async (options) => {
    try {
      await commands.detail(options.path, options.type, options.id);
    } catch (error) {
      logger.error(error.message);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成归档报告')
  .option('-p, --path <path>', '工作区路径', '.')
  .option('-f, --format <format>', '输出格式: text/json', 'text')
  .option('-o, --output <output>', '输出文件路径')
  .action(async (options) => {
    try {
      await commands.report(options.path, options.format, options.output);
    } catch (error) {
      logger.error(error.message);
      process.exit(1);
    }
  });

program
  .command('archive')
  .description('执行归档（重命名并移动照片）')
  .option('-p, --path <path>', '工作区路径', '.')
  .option('-y, --yes', '自动确认', false)
  .option('--dry-run', '仅预览，不实际执行', false)
  .action(async (options) => {
    try {
      await commands.archive(options.path, options.yes, options.dryRun);
    } catch (error) {
      logger.error(error.message);
      process.exit(1);
    }
  });

program
  .command('fix')
  .description('人工修正问题照片')
  .option('-p, --path <path>', '工作区路径', '.')
  .option('-i, --id <id>', '照片 ID')
  .option('--point-id <pointId>', '新点位 ID')
  .option('--problem-type <type>', '问题类型')
  .option('--operator <name>', '操作者名称')
  .option('--reason <reason>', '修正原因')
  .action(async (options) => {
    try {
      await commands.fix(options.path, options.id, options.pointId, options.problemType, options.operator, options.reason);
    } catch (error) {
      logger.error(error.message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  logger.error(error.message);
  process.exit(1);
});
