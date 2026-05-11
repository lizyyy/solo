#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const chalk = require('chalk');
const { deduplicateLeads, exportReport } = require('./src/dedupe');
const { loadLeadsFromFiles, loadBlacklist } = require('./src/loader');

program
  .name('dedupe')
  .description('私域线索去重CLI工具')
  .version('1.0.0');

program
  .command('dedupe')
  .description('去重线索并生成分配报告')
  .option('-f, --files <files...>', '线索文件路径，支持多个CSV文件')
  .option('-b, --blacklist <file>', '黑名单文件路径')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-s, --similarity <threshold>', '昵称相似度阈值 (0-1)', '0.8')
  .option('-i, --interactive', '启用人工确认模式')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n╔════════════════════════════════════════════╗'));
      console.log(chalk.blue('║       私域线索去重 CLI 工具 v1.0.0          ║'));
      console.log(chalk.blue('╚════════════════════════════════════════════╝\n'));

      if (!options.files || options.files.length === 0) {
        console.log(chalk.red('错误: 请至少指定一个线索文件'));
        program.help();
        return;
      }

      console.log(chalk.green('📂 正在加载线索文件...'));
      const leads = await loadLeadsFromFiles(options.files);
      
      let blacklist = [];
      if (options.blacklist) {
        console.log(chalk.green('🚫 正在加载黑名单...'));
        blacklist = await loadBlacklist(options.blacklist);
      }

      console.log(chalk.green('🔄 正在去重处理...\n'));
      const result = await deduplicateLeads(leads, {
        similarityThreshold: parseFloat(options.similarity),
        blacklist,
        interactive: options.interactive
      });

      console.log(chalk.green('📊 正在生成报告...'));
      await exportReport(result, options.output);

      console.log(chalk.green('\n✅ 处理完成！报告已输出到: ' + options.output));
    } catch (error) {
      console.error(chalk.red('\n❌ 处理出错: '), error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

program.parse(process.argv);
