#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { runPipeline, listRuns } = require('./core/pipeline');

const program = new Command();

program
  .name('qa-weekly')
  .description('问答命中率周报工具 - 保留人工改判痕迹的脱敏导出')
  .version('1.0.0');

program
  .command('run')
  .description('运行周报生成流程')
  .option('--demo', '使用演示数据运行')
  .option('--model-output <path>', '模型输出CSV路径')
  .option('--manual-review <path>', '人工改判表CSV路径')
  .option('--correction-log <path>', '人工修正日志JSON路径')
  .option('--week-range <text>', '数据周期说明')
  .action((options) => {
    console.log(chalk.bold.blue('\n========================================'));
    console.log(chalk.bold.blue('       问答命中率周报工具'));
    console.log(chalk.bold.blue('========================================\n'));
    
    try {
      const runOptions = {};
      
      if (options.demo) {
        console.log(chalk.yellow('📦 使用演示数据模式\n'));
        runOptions.baseDir = process.cwd();
      } else {
        if (options.modelOutput) runOptions.modelOutput = path.resolve(options.modelOutput);
        if (options.manualReview) runOptions.manualReview = path.resolve(options.manualReview);
        if (options.correctionLog) runOptions.correctionLog = path.resolve(options.correctionLog);
      }
      
      if (options.weekRange) runOptions.weekRange = options.weekRange;
      
      const result = runPipeline(runOptions);
      
      console.log('');
      console.log(chalk.green('========================================'));
      console.log(chalk.green('  🎉 周报生成成功！'));
      console.log(chalk.green('========================================\n'));
      console.log(chalk.bold('输出文件:'));
      console.log(`  📄 脱敏导出: ${chalk.cyan(result.outputs.sanitizedExport)}`);
      console.log(`  📊 周报文档: ${chalk.cyan(result.outputs.weeklyReport)}`);
      console.log(`  📋 运行记录: ${chalk.cyan(result.outputs.runRecord)}`);
      console.log('');
      console.log(chalk.gray('重跑命令: npm run demo'));
      console.log('');
      
    } catch (error) {
      console.error(chalk.red('\n❌ 运行出错:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('列出历史运行记录')
  .action(() => {
    const runs = listRuns();
    
    if (runs.length === 0) {
      console.log(chalk.yellow('暂无历史运行记录'));
      return;
    }
    
    console.log(chalk.bold.blue('\n========================================'));
    console.log(chalk.bold.blue('       历史运行记录'));
    console.log(chalk.bold.blue('========================================\n'));
    
    runs.forEach((run, index) => {
      console.log(chalk.bold(`${index + 1}. 运行ID: ${run.runId}`));
      console.log(`   运行时间: ${new Date(run.runTime).toLocaleString('zh-CN')}`);
      console.log(`   命中率: ${run.stats.hitRate} (${run.stats.hitCount}/${run.stats.total})`);
      console.log(`   隐私问题: ${run.stats.privacyIssues} 个`);
      console.log('');
    });
  });

program
  .command('replay')
  .description('复盘最近一次运行（展示周报内容）')
  .action(() => {
    const runs = listRuns();
    
    if (runs.length === 0) {
      console.log(chalk.yellow('暂无历史运行记录，请先运行: npm run demo'));
      return;
    }
    
    const latestRun = runs[0];
    const reportPath = latestRun.outputs.weeklyReport;
    
    if (!fs.existsSync(reportPath)) {
      console.log(chalk.red('周报文件不存在:'), reportPath);
      return;
    }
    
    const content = fs.readFileSync(reportPath, 'utf-8');
    console.log('\n' + content + '\n');
  });

program.parse(process.argv);
