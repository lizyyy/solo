#!/usr/bin/env node

import { Command } from 'commander';
import { handleRun } from './commands/run.js';
import { handleExplain } from './commands/explain.js';
import { handleMarkFixed } from './commands/mark-fixed.js';
import { handleRerun } from './commands/rerun.js';
import { handleReport } from './commands/report.js';

const program = new Command();

program
  .name('tit')
  .description('API 租户隔离测试 CLI - 自动检测多租户系统中的越权漏洞')
  .version('1.0.0');

program
  .command('run')
  .description('执行租户隔离测试')
  .option('-c, --config <path>', '配置文件路径', 'tit-config.json')
  .option('--mock', '使用内置模拟服务')
  .option('--mock-port <port>', '模拟服务端口', '3000')
  .action(async (options) => {
    await handleRun(options);
  });

program
  .command('explain')
  .description('解释测试用例')
  .option('-c, --config <path>', '配置文件路径', 'tit-config.json')
  .option('-t, --test-case <id>', '查看特定测试用例详情')
  .action(async (options) => {
    await handleExplain(options);
  });

program
  .command('mark-fixed <issue-id>')
  .description('标记风险为已修复')
  .option('-n, --note <text>', '修复备注')
  .action(async (issueId, options) => {
    await handleMarkFixed(issueId, options);
  });

program
  .command('rerun')
  .description('重跑测试并与上次结果对比')
  .option('-c, --config <path>', '配置文件路径', 'tit-config.json')
  .option('-p, --previous <index>', '对比的之前运行索引')
  .option('--mock', '使用内置模拟服务')
  .option('--mock-port <port>', '模拟服务端口', '3000')
  .action(async (options) => {
    await handleRerun(options);
  });

program
  .command('report')
  .description('生成测试报告')
  .option('-r, --run <index>', '指定运行索引')
  .option('--history', '显示历史运行对比')
  .action(async (options) => {
    await handleReport(options);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error);
  process.exit(1);
});
