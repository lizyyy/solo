#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeEnvironment, generateTerminalSummary } from '../src/index.js';

const program = new Command();

program
  .name('dc-env-merge')
  .description('Docker Compose 环境变量合并工具 - 分析并报告环境变量的来源和优先级')
  .version('1.0.0');

program
  .option('-i, --input <directory>', '输入目录（包含compose文件）', process.cwd())
  .option('-o, --output <directory>', '输出报告目录', './reports')
  .option('-f, --file <file>', '指定compose文件路径（自动检测）')
  .option('-e, --env <file>', '额外的.env文件（可多次指定）', (val, acc) => [...acc, val], [])
  .option('-s, --service <name>', '只分析指定服务')
  .option('--env-var <key=value>', '指定CLI环境变量（可多次指定）', (val, acc) => [...acc, val], [])
  .option('--no-terminal', '不输出终端摘要')
  .option('--no-shell', '不包含shell环境变量')
  .option('--only-conflicts', '只显示有冲突的变量')
  .action(async (options) => {
    try {
      const result = await analyzeEnvironment({
        inputDir: options.input,
        outputDir: options.output,
        composeFile: options.file,
        envFiles: options.env,
        cliEnv: options.envVar,
        service: options.service,
        noShell: options.noShell,
        onlyConflicts: options.onlyConflicts
      });

      if (options.terminal) {
        console.log(generateTerminalSummary(result, {
          noShell: !options.shell,
          onlyConflicts: options.onlyConflicts
        }));
        console.log('');
        console.log('📄 报告已生成:');
        console.log(`   JSON: ${result.reports.json}`);
        console.log(`   Markdown: ${result.reports.markdown}`);
      }

      if (result.errors.length > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.error('❌ 执行出错:', err.message);
      console.error(err.stack);
      process.exit(1);
    }
  });

program.parse();
