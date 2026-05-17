#!/usr/bin/env node

import { Command } from 'commander';
import { parseInputFile, loadBaseline } from './parser';
import { clusterFailures, buildClusterResult, createBaselineFromResult } from './clusterer';
import { printConsoleSummary, writeJsonReport, writeMarkdownReport } from './reporter';
import { runSelfTest } from './self-test';
import * as fs from 'fs';

const program = new Command();

program
  .name('tfc')
  .description('Test Failure Cluster - 测试失败聚类工具')
  .version('1.0.0');

program
  .command('cluster')
  .description('聚类测试失败并生成报告')
  .requiredOption('-i, --input <path>', '输入文件路径（.log 或 .json）')
  .option('-b, --baseline <path>', '历史基线 JSON 文件路径')
  .option('-j, --json <path>', '输出 JSON 结果路径')
  .option('-m, --md <path>', '输出 Markdown 报告路径')
  .option('-t, --threshold <number>', '相似度阈值 (0-1)', '0.7')
  .option('-v, --verbose', '显示详细信息')
  .option('--export-baseline <path>', '从当前结果导出基线文件')
  .action(async (options) => {
    try {
      if (!fs.existsSync(options.input)) {
        console.error(`❌ 输入文件不存在: ${options.input}`);
        process.exit(1);
      }
      
      const parseResult = parseInputFile(options.input);
      
      let baseline = undefined;
      if (options.baseline) {
        if (!fs.existsSync(options.baseline)) {
          console.error(`❌ 基线文件不存在: ${options.baseline}`);
          process.exit(1);
        }
        baseline = loadBaseline(options.baseline);
      }
      
      const threshold = parseFloat(options.threshold);
      const clusters = clusterFailures(parseResult.successes, threshold, baseline);
      const result = buildClusterResult(parseResult, clusters, baseline);
      
      printConsoleSummary(result, options.verbose);
      
      if (options.json) {
        writeJsonReport(result, options.json);
        console.log(`📄 JSON 结果已写入: ${options.json}`);
      }
      
      if (options.md) {
        writeMarkdownReport(result, options.md);
        console.log(`📑 Markdown 报告已写入: ${options.md}`);
      }
      
      if (options.exportBaseline) {
        const newBaseline = createBaselineFromResult(result);
        fs.writeFileSync(options.exportBaseline, JSON.stringify(newBaseline, null, 2), 'utf-8');
        console.log(`📍 基线文件已导出: ${options.exportBaseline}`);
      }
      
    } catch (error: any) {
      console.error('❌ 处理失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('self-test')
  .description('运行自检，验证所有功能')
  .action(async () => {
    const success = await runSelfTest();
    process.exit(success ? 0 : 1);
  });

program.parseAsync(process.argv);
