#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { SearchIndexTask } from './types';
import { StableLogger } from './logger';
import { SearchIndexWindowChecker } from './checker';
import { ReportGenerator } from './report';

const program = new Command();

program
  .name('search-index-checker')
  .description('搜索索引任务重建窗口排查 CLI - 检查窗口冲突和任务拖延')
  .version('1.0.0')
  .requiredOption('-i, --input <file>', '输入任务数据文件 (JSON格式)')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('-l, --log <file>', '日志文件路径', './logs/search_index_checker.log')
  .option('--no-overwrite', '不覆盖现有日志，追加模式')
  .parse(process.argv);

const options = program.opts();

async function main() {
  const inputFile = path.resolve(options.input);
  const outputDir = path.resolve(options.output);
  const logFile = path.resolve(options.log);
  const overwrite = options.overwrite;

  const logger = new StableLogger(logFile, overwrite);
  logger.info('搜索索引任务重建窗口排查 CLI 启动', {
    inputFile,
    outputDir,
    logFile,
    overwrite
  });

  if (!fs.existsSync(inputFile)) {
    logger.error('输入文件不存在', { inputFile });
    console.error(`错误: 输入文件不存在: ${inputFile}`);
    process.exit(1);
  }

  let tasks: SearchIndexTask[];
  try {
    const content = fs.readFileSync(inputFile, 'utf-8');
    tasks = JSON.parse(content);
    logger.info('成功加载任务数据', { taskCount: tasks.length });
  } catch (error) {
    logger.error('解析输入文件失败', { error: (error as Error).message });
    console.error(`错误: 解析输入文件失败: ${(error as Error).message}`);
    process.exit(1);
  }

  const checker = new SearchIndexWindowChecker(logger);
  const result = checker.check(tasks);

  const reporter = new ReportGenerator(outputDir, logger);
  const summary = reporter.generate(result, inputFile);

  const exitCode = reporter.calculateExitCode(summary);

  console.log('\n' + '='.repeat(60));
  console.log('搜索索引任务重建窗口排查 - 结果总览');
  console.log('='.repeat(60));
  console.log(`输入文件: ${inputFile}`);
  console.log(`报告目录: ${outputDir}`);
  console.log('');
  console.log(`窗口冲突: ${result.windowConflicts.length} 项`);
  console.log(`任务拖延: ${result.taskDelays.length} 项`);
  console.log(`跨天窗口: ${result.crossDayWindows.length} 项`);
  console.log(`失败重试: ${result.failedRetries.length} 项`);
  console.log(`大索引并发: ${result.largeIndexConcurrent.length} 项`);
  console.log('');
  console.log(`退出码: ${exitCode}`);
  
  if (exitCode === 0) {
    console.log('✅ 检查通过，未发现异常');
  } else {
    console.log('⚠️  发现异常，请查看详细报告');
  }
  
  console.log('');
  console.log('生成的报告文件:');
  summary.files.forEach(f => {
    console.log(`  - ${path.basename(f.path)}`);
    console.log(`    ${f.description}`);
  });
  console.log('='.repeat(60));

  logger.info('搜索索引任务重建窗口排查完成', { exitCode });
  
  process.exit(exitCode);
}

main().catch(error => {
  console.error('未预期的错误:', error);
  process.exit(1);
});
