#!/usr/bin/env node

import { Command } from 'commander';
import { runInit } from './init';
import { runScanCommand, ScanCommandOptions } from './scan';
import { runReportCommand, ReportCommandOptions } from './report';
import { getCheckerDescriptions } from '../checkers';

const program = new Command();

program
  .name('kas')
  .description('🎯 键盘可访问性巡检工具')
  .version('1.0.0')
  .helpOption('-h, --help', '显示帮助信息');

program
  .command('init')
  .description('🔧 初始化配置文件和示例页面')
  .option('-o, --output <path>', '输出目录（默认为当前目录）')
  .option('--no-demo', '不创建示例页面')
  .action(async (options: { output?: string; demo?: boolean }) => {
    await runInit({
      outputPath: options.output,
      includeDemo: options.demo !== false,
    });
  });

program
  .command('scan')
  .description('🔍 执行键盘可访问性巡检')
  .option('-c, --config <path>', '配置文件路径（默认为 ./routes.json）')
  .option('-o, --output <path>', '输出目录（默认为 ./.kas）')
  .option('--no-headless', '不使用无头模式（显示浏览器窗口）')
  .option('--slow-mo <ms>', '慢动作模式，延迟毫秒数')
  .option('--timeout <ms>', '页面加载超时时间（毫秒）')
  .option('--viewport <size>', '视口大小，格式如 1280x720')
  .option('--groups <list>', '扫描指定分组，用逗号分隔')
  .option('--routes <list>', '扫描指定路由 ID，用逗号分隔')
  .option('--checkers <list>', '使用指定的检查器，用逗号分隔')
  .action(async (options: ScanCommandOptions) => {
    await runScanCommand(options);
  });

program
  .command('report')
  .description('📄 生成巡检报告')
  .option('-i, --input <path>', '指定扫描结果 JSON 文件路径')
  .option('-o, --output <path>', '输出文件路径')
  .option('-f, --format <format>', '输出格式 (json|markdown|html)', 'markdown')
  .option('--data-dir <path>', '数据目录（默认为 ./.kas）')
  .action(async (options: ReportCommandOptions) => {
    await runReportCommand(options);
  });

program
  .command('checkers')
  .description('📚 列出可用的检查器')
  .action(() => {
    console.log('📚 可用的检查器:');
    console.log('═══════════════════════════════════════════');
    console.log('');
    
    const descriptions = getCheckerDescriptions();
    
    for (const checker of descriptions) {
      console.log(`📌 ${checker.name}`);
      console.log(`   ${checker.description}`);
      console.log('');
    }
    
    console.log('💡 使用方式:');
    console.log('   kas scan --checkers focus-order,focus-visibility');
    console.log('');
  });

program.parseAsync(process.argv).catch((error) => {
  console.error('❌ 执行失败:');
  console.error(`   ${error.message}`);
  if (error.stack) {
    console.error('');
    console.error('   堆栈跟踪:');
    console.error(`   ${error.stack.split('\n').join('\n   ')}`);
  }
  process.exit(1);
});
