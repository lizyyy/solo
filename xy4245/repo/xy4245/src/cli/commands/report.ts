import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { Exporter } from '../../exporter/exporter';
import { CheckResult, ReviewSession } from '../../types';

export const reportCommand = new Command('report')
  .description('导出审计报告，支持 Markdown、CSV 和 JSON 格式')
  .option('-c, --check-result <path>', '检查结果路径', '.foi-output/check-result.json')
  .option('-r, --review <path>', '复核结果路径', '.foi-output/review-*.json')
  .option('-o, --output <path>', '输出目录', 'audit-report')
  .option('-f, --format <format>', '导出格式 (markdown,csv,json,all)', 'all')
  .option('--name <name>', '报告名称', '无障碍焦点顺序审计报告')
  .option('--no-json', '不导出 JSON 审计包')
  .option('--no-markdown', '不导出 Markdown 报告')
  .option('--no-csv', '不导出 CSV 问题清单')
  .option('--include-fixed', '包含已标记为修复的问题')
  .option('--include-ignored', '包含已标记为忽略的问题')
  .action(async (options: {
    checkResult: string;
    review: string;
    output: string;
    format: string;
    name: string;
    json: boolean;
    markdown: boolean;
    csv: boolean;
    includeFixed: boolean;
    includeIgnored: boolean;
  }) => {
    console.log(chalk.blue('焦点顺序体检员 - 导出审计报告'));
    console.log('='.repeat(50));

    try {
      const checkResultPath = path.resolve(options.checkResult);
      const outputDir = path.resolve(options.output);

      if (!fs.existsSync(checkResultPath)) {
        throw new Error(`找不到检查结果: ${checkResultPath}。请先运行 "foi check" 命令。`);
      }

      const checkResultContent = fs.readFileSync(checkResultPath, 'utf-8');
      const checkResult: CheckResult = JSON.parse(checkResultContent);

      console.log(chalk.green(`[✓] 加载检查结果: ${checkResult.scanResult.snapshotId}`));

      let reviewSession: ReviewSession | null = null;
      if (options.review) {
        const reviewPath = findReviewFile(options.review, outputDir);
        if (reviewPath && fs.existsSync(reviewPath)) {
          try {
            const reviewContent = fs.readFileSync(reviewPath, 'utf-8');
            reviewSession = JSON.parse(reviewContent);
            console.log(chalk.green(`[✓] 加载复核结果: ${reviewSession.id}`));
          } catch (e) {
            console.log(chalk.yellow(`[!] 无法加载复核结果: ${reviewPath}`));
          }
        }
      }

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const exporter = new Exporter({
        reportName: options.name,
        includeFixed: options.includeFixed,
        includeIgnored: options.includeIgnored
      });

      const format = options.format.toLowerCase();
      const exportAll = format === 'all';

      const exportedPaths: string[] = [];

      if (exportAll || format === 'markdown' || options.markdown) {
        const markdownContent = exporter.exportMarkdown(checkResult, reviewSession);
        const markdownPath = path.join(outputDir, 'audit-report.md');
        fs.writeFileSync(markdownPath, markdownContent);
        exportedPaths.push(markdownPath);
        console.log(chalk.green(`[✓] 导出 Markdown 报告: ${markdownPath}`));
      }

      if (exportAll || format === 'csv' || options.csv) {
        const csvContent = exporter.exportCsv(checkResult, reviewSession);
        const csvPath = path.join(outputDir, 'issues.csv');
        fs.writeFileSync(csvPath, csvContent);
        exportedPaths.push(csvPath);
        console.log(chalk.green(`[✓] 导出 CSV 清单: ${csvPath}`));
      }

      if (exportAll || format === 'json' || options.json) {
        const auditPackage = exporter.exportJson(checkResult, reviewSession);
        const jsonPath = path.join(outputDir, 'audit-package.json');
        fs.writeFileSync(jsonPath, JSON.stringify(auditPackage, null, 2));
        exportedPaths.push(jsonPath);
        console.log(chalk.green(`[✓] 导出 JSON 审计包: ${jsonPath}`));
      }

      console.log('\n' + '='.repeat(50));
      console.log(chalk.green('导出完成！'));
      console.log(`\n报告文件:`);
      exportedPaths.forEach(p => console.log(`  - ${p}`));

      printReportSummary(checkResult, reviewSession, options);

    } catch (error) {
      console.error(chalk.red(`错误: ${(error as Error).message}`));
      process.exit(1);
    }
  });

function findReviewFile(reviewPath: string, outputDir: string): string | null {
  const resolvedPath = path.resolve(reviewPath);
  
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return resolvedPath;
  }

  const foiOutputDir = path.join(path.dirname(outputDir), '.foi-output');
  if (fs.existsSync(foiOutputDir)) {
    const files = fs.readdirSync(foiOutputDir);
    const reviewFiles = files.filter(f => f.startsWith('review-') && f.endsWith('.json'));
    if (reviewFiles.length > 0) {
      reviewFiles.sort((a, b) => b.localeCompare(a));
      return path.join(foiOutputDir, reviewFiles[0]);
    }
  }

  return null;
}

function printReportSummary(
  checkResult: CheckResult,
  reviewSession: ReviewSession | null,
  options: { includeFixed: boolean; includeIgnored: boolean }
): void {
  const issues = checkResult.issues;
  let filteredIssues = [...issues];

  if (!options.includeFixed && reviewSession) {
    filteredIssues = filteredIssues.filter(issue => {
      const reviewItem = reviewSession.issues.find(r => r.issueId === issue.id);
      return reviewItem?.status !== 'fixed';
    });
  }

  if (!options.includeIgnored && reviewSession) {
    filteredIssues = filteredIssues.filter(issue => {
      const reviewItem = reviewSession.issues.find(r => r.issueId === issue.id);
      return reviewItem?.status !== 'ignored';
    });
  }

  console.log('\n报告摘要:');
  console.log(`  快照 ID: ${checkResult.scanResult.snapshotId}`);
  console.log(`  页面标题: ${checkResult.scanResult.pageTitle}`);
  console.log(`  检查时间: ${checkResult.scanResult.timestamp}`);
  
  console.log(`\n  可聚焦元素: ${checkResult.scanResult.focusableElements.length} 个`);
  console.log(`  轨迹点数量: ${checkResult.scanResult.trajectory?.items.length || 0} 个`);
  console.log(`  关键操作: ${checkResult.scanResult.criticalOperations.length} 个`);

  console.log(`\n  问题统计:`);
  console.log(`    总问题数: ${issues.length}`);
  console.log(`    报告中包含: ${filteredIssues.length}`);
  
  if (reviewSession) {
    const confirmed = reviewSession.issues.filter(r => r.status === 'confirmed').length;
    const ignored = reviewSession.issues.filter(r => r.status === 'ignored').length;
    const fixed = reviewSession.issues.filter(r => r.status === 'fixed').length;
    const reviewed = reviewSession.issues.length;
    
    console.log(`\n  复核统计:`);
    console.log(`    已复核: ${reviewed} 个`);
    console.log(`    已确认: ${confirmed} 个`);
    console.log(`    已忽略: ${ignored} 个`);
    console.log(`    已修复: ${fixed} 个`);
  }
}
