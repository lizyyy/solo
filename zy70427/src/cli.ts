#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { TrainingSubmission, AuditReport } from './types';
import { allSubmissions } from './sampleData';
import { analyzeSubmission, batchAudit } from './auditor';
import { exportReport } from './exporter';
import { addReviewOpinion, getReviewSummary } from './reviewTracker';

const program = new Command();

program
  .name('training-audit')
  .description('培训环境清单审核命令行工具')
  .version('1.0.0');

program
  .command('audit')
  .description('审核提交材料')
  .option('-i, --input <file>', '输入JSON文件路径，不指定则使用样例数据')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-f, --format <type>', '输出格式: json|markdown|both', 'markdown')
  .option('-s, --submission <id>', '指定单个提交ID进行审核')
  .action(async (options) => {
    console.log(chalk.blue('=== 培训环境清单审核工具 ===\n'));
    
    let submissions: TrainingSubmission[] = [];
    
    if (options.input) {
      try {
        const inputPath = path.resolve(options.input);
        const content = fs.readFileSync(inputPath, 'utf-8');
        submissions = JSON.parse(content);
        console.log(chalk.green(`✓ 已加载输入文件: ${inputPath}`));
      } catch (error) {
        console.log(chalk.red(`✗ 加载输入文件失败: ${(error as Error).message}`));
        process.exit(1);
      }
    } else {
      submissions = allSubmissions;
      console.log(chalk.yellow('⚠  使用内置样例数据'));
    }
    
    if (options.submission) {
      submissions = submissions.filter(s => s.id === options.submission);
      if (submissions.length === 0) {
        console.log(chalk.red(`✗ 未找到提交ID: ${options.submission}`));
        process.exit(1);
      }
    }
    
    console.log(chalk.blue(`\n正在处理 ${submissions.length} 条提交记录...\n`));
    
    const batchResult = batchAudit(submissions);
    
    const report: AuditReport = {
      reportId: `RPT-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      totalProcessed: batchResult.results.length,
      interceptedCount: batchResult.results.filter(r => r.isIntercepted).length,
      approvedCount: batchResult.results.filter(r => !r.isIntercepted).length,
      results: batchResult.results,
      summary: batchResult.summary
    };
    
    console.log(chalk.green('✓ 处理完成\n'));
    console.log(chalk.cyan('=== 处理摘要 ==='));
    console.log(`- 总数: ${report.totalProcessed}`);
    console.log(`- 拦截: ${chalk.red(report.interceptedCount)}`);
    console.log(`- 通过: ${chalk.green(report.approvedCount)}`);
    console.log(`- 总耗时: ${report.summary.totalProcessingTime} ms`);
    console.log(`- 平均耗时: ${report.summary.averageProcessingTime.toFixed(2)} ms\n`);
    
    if (report.summary.topInterceptionReasons.length > 0) {
      console.log(chalk.magenta('=== 主要拦截原因 ==='));
      for (const item of report.summary.topInterceptionReasons) {
        console.log(`- ${item.reason}: ${item.count} 次`);
      }
      console.log('');
    }
    
    const outputDir = path.resolve(options.output);
    
    if (options.format === 'json' || options.format === 'both') {
      const jsonPath = exportReport(report, 'json', outputDir);
      console.log(chalk.green(`✓ JSON报告已保存: ${jsonPath}`));
    }
    
    if (options.format === 'markdown' || options.format === 'both') {
      const mdPath = exportReport(report, 'markdown', outputDir);
      console.log(chalk.green(`✓ Markdown报告已保存: ${mdPath}`));
    }
    
    console.log(chalk.blue('\n=== 审核完成 ==='));
  });

program
  .command('review')
  .description('添加复核意见')
  .requiredOption('-s, --submission <id>', '提交记录ID')
  .requiredOption('-r, --reviewer <name>', '复核人姓名')
  .requiredOption('--rid, --reviewer-id <id>', '复核人ID')
  .requiredOption('-o, --opinion <type>', '意见: agree|disagree|need_more_info')
  .requiredOption('-c, --comments <text>', '评论内容')
  .option('-i, --input <file>', '输入报告JSON文件路径')
  .option('--output <dir>', '输出目录', './output')
  .action(async (options) => {
    console.log(chalk.blue('=== 添加复核意见 ===\n'));
    
    let report: AuditReport;
    
    if (options.input) {
      try {
        const inputPath = path.resolve(options.input);
        const content = fs.readFileSync(inputPath, 'utf-8');
        report = JSON.parse(content);
      } catch (error) {
        console.log(chalk.red(`✗ 加载报告文件失败: ${(error as Error).message}`));
        process.exit(1);
      }
    } else {
      const batchResult = batchAudit(allSubmissions);
      report = {
        reportId: `RPT-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        totalProcessed: batchResult.results.length,
        interceptedCount: batchResult.results.filter(r => r.isIntercepted).length,
        approvedCount: batchResult.results.filter(r => !r.isIntercepted).length,
        results: batchResult.results,
        summary: batchResult.summary
      };
    }
    
    const resultIndex = report.results.findIndex(r => r.submissionId === options.submission);
    if (resultIndex === -1) {
      console.log(chalk.red(`✗ 未找到提交记录: ${options.submission}`));
      process.exit(1);
    }
    
    const validOpinions = ['agree', 'disagree', 'need_more_info'];
    if (!validOpinions.includes(options.opinion)) {
      console.log(chalk.red(`✗ 无效的意见类型: ${options.opinion}，必须是: ${validOpinions.join(', ')}`));
      process.exit(1);
    }
    
    report.results[resultIndex] = addReviewOpinion(
      report.results[resultIndex],
      options.reviewer,
      options.reviewerId,
      options.opinion as any,
      options.comments
    );
    
    const summary = getReviewSummary(report.results[resultIndex]);
    console.log(chalk.green('✓ 复核意见已添加\n'));
    console.log(chalk.cyan('=== 复核摘要 ==='));
    console.log(`- 总意见数: ${summary.totalOpinions}`);
    console.log(`- 同意: ${summary.agreeCount}`);
    console.log(`- 不同意: ${summary.disagreeCount}`);
    console.log(`- 需要更多信息: ${summary.needMoreInfoCount}`);
    console.log(`- 最终建议: ${summary.finalRecommendation}\n`);
    
    const outputDir = path.resolve(options.output);
    const jsonPath = exportReport(report, 'json', outputDir);
    const mdPath = exportReport(report, 'markdown', outputDir);
    console.log(chalk.green(`✓ 报告已更新: ${jsonPath}`));
    console.log(chalk.green(`✓ 报告已更新: ${mdPath}`));
  });

program
  .command('sample')
  .description('生成样例数据文件')
  .option('-o, --output <file>', '输出文件路径', './sample-data.json')
  .action(async (options) => {
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, JSON.stringify(allSubmissions, null, 2), 'utf-8');
    console.log(chalk.green(`✓ 样例数据已保存: ${outputPath}`));
    console.log(chalk.blue(`包含 ${allSubmissions.length} 条记录，其中1条会触发拦截`));
  });

program.parseAsync(process.argv);
