#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { SingleBar, Presets } from 'cli-progress';
import chalk from 'chalk';
import { SitemapParser } from './sitemap-parser';
import { HttpChecker } from './http-checker';
import { ReportGenerator } from './report-generator';
import { AuditResult, AuditSummary } from './types';

const program = new Command();

program
  .name('sitemap-audit')
  .description('Sitemap 链接巡检工具 - 检查 XML sitemap 中的链接有效性')
  .version('1.0.0')
  .argument('<path>', 'sitemap XML 文件路径或包含 sitemap 的目录路径')
  .option('-c, --concurrency <number>', '并发请求数', '5')
  .option('-o, --output <directory>', '报告输出目录', './audit-results')
  .option('--no-json', '不导出 JSON 报告')
  .option('--no-html', '不导出 HTML 报告')
  .action(async (inputPath: string, options: any) => {
    const startTime = Date.now();
    const startedAt = new Date().toLocaleString('zh-CN');

    console.log(chalk.bold.blue('🚀 Sitemap 链接巡检开始'));
    console.log(chalk.gray(`📁 输入路径: ${inputPath}`));
    console.log(chalk.gray(`⚡ 并发数: ${options.concurrency}`));
    console.log('');

    try {
      const isDirectory = fs.lstatSync(inputPath).isDirectory();
      
      const parser = new SitemapParser();
      let parseResult;

      if (isDirectory) {
        console.log(chalk.blue('📂 扫描目录中的 sitemap 文件...'));
        parseResult = await parser.parseDirectory(inputPath);
      } else {
        console.log(chalk.blue('📄 解析 sitemap 文件...'));
        parseResult = await parser.parse(inputPath);
      }

      const { entries, errors: parseErrors } = parseResult;
      
      console.log(chalk.green(`✅ 解析完成，共发现 ${entries.length} 个链接`));
      if (parseErrors.length > 0) {
        console.log(chalk.yellow(`⚠️  发现 ${parseErrors.length} 个解析错误`));
      }
      console.log('');

      if (entries.length === 0) {
        console.log(chalk.red('❌ 没有发现可检查的链接'));
        process.exit(1);
      }

      console.log(chalk.blue('🌐 开始检查链接...'));
      
      const progressBar = new SingleBar({
        format: '   进度 |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} 链接 | {duration_formatted}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
      }, Presets.shades_classic);

      progressBar.start(entries.length, 0);

      const checker = new HttpChecker(parseInt(options.concurrency));
      const originalCheckAll = checker.checkAll.bind(checker);
      let checkedCount = 0;
      
      checker.checkAll = async (entries) => {
        const results: any[] = [];
        const chunkSize = parseInt(options.concurrency);
        
        for (let i = 0; i < entries.length; i += chunkSize) {
          const chunk = entries.slice(i, i + chunkSize);
          const chunkResults = await originalCheckAll(chunk);
          results.push(...chunkResults);
          checkedCount += chunk.length;
          progressBar.update(checkedCount);
        }
        
        return results;
      };

      const results = await checker.checkAll(entries);
      progressBar.stop();

      console.log('');
      console.log(chalk.green('✅ 链接检查完成'));
      console.log('');

      const finishedAt = new Date().toLocaleString('zh-CN');
      const totalTime = Date.now() - startTime;

      const summary: AuditSummary = {
        totalUrls: results.length,
        successful: results.filter(r => r.ok && !r.is404).length,
        failed: results.filter(r => !r.ok || r.is404).length,
        notFound: results.filter(r => r.is404).length,
        redirected: results.filter(r => r.isRedirect).length,
        serverErrors: results.filter(r => r.status >= 500).length,
        clientErrors: results.filter(r => r.status >= 400 && r.status < 500).length,
        parseErrors: parseErrors.length,
        avgResponseTime: results.reduce((sum, r) => sum + r.responseTime, 0) / results.length,
        totalTime,
      };

      const sourceFiles = [...new Set(results.map(r => r.sourceFile))];

      const auditResult: AuditResult = {
        summary,
        results,
        parseErrors,
        startedAt,
        finishedAt,
        sourceFiles,
      };

      const reportGenerator = new ReportGenerator();
      await reportGenerator.generateConsoleSummary(auditResult);

      const outputDir = path.resolve(options.output);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      if (options.json) {
        const jsonPath = path.join(outputDir, `sitemap-audit-${timestamp}.json`);
        await reportGenerator.exportJson(auditResult, jsonPath);
      }

      if (options.html) {
        const htmlPath = path.join(outputDir, `sitemap-audit-${timestamp}.html`);
        await reportGenerator.exportHtml(auditResult, htmlPath);
      }

      const hasErrors = summary.failed > 0 || summary.parseErrors > 0;
      process.exit(hasErrors ? 1 : 0);

    } catch (error: any) {
      console.error(chalk.red('\n❌ 执行失败:'));
      console.error(chalk.red(error.message));
      console.error(error.stack);
      process.exit(1);
    }
  });

program.parseAsync().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
