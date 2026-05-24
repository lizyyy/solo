#!/usr/bin/env node

const { Command } = require('commander');
const { runConfigTrace } = require('../src/index');

const program = new Command();

program
  .name('config-trace')
  .description('JSON配置合并轨迹CLI工具 - 追踪多层配置合并过程')
  .version('1.0.0', '-v, --version')
  .requiredOption('-d, --default <path>', '默认配置文件路径 (JSON)')
  .requiredOption('-e, --env <path>', '环境配置文件路径 (JSON 或 .env)')
  .requiredOption('-t, --tenant <path>', '租户配置文件路径 (JSON)')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-k, --key-path <path>', '只追踪特定键路径 (如: database.host)')
  .option('--array-merge <mode>', '数组合并模式: replace|concat|unique', 'replace')
  .option('--case-sensitive', '键名大小写敏感 (默认不敏感)')
  .option('--no-color', '禁用彩色输出')
  .option('--format <format>', '输出格式: all|terminal|json|markdown', 'all')
  .option('--silent', '静默模式，只输出错误')
  .action(async (options) => {
    try {
      const exitCode = await runConfigTrace(options);
      process.exit(exitCode);
    } catch (error) {
      console.error('错误:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
