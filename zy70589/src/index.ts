#!/usr/bin/env node

import { Command } from 'commander';
import { parseScanReport, parseBaseline } from './parser.js';
import { processFindings, generateNewBaseline } from './processor.js';
import { printTerminalSummary } from './printer.js';
import { exportJsonReport, exportHtmlReport, exportBaseline } from './exporter.js';
import { CLIConfig } from './types.js';

const program = new Command();

program
  .name('gitleaks-baseline')
  .description('Gitleaks 基线整理工具 - 区分历史基线和新增泄漏')
  .version('1.0.0');

program
  .argument('<scan-report>', 'Gitleaks 扫描报告文件路径 (JSON 或 CSV)')
  .option('-b, --baseline <path>', '基线文件路径 (JSON)')
  .option('-o, --output-json <path>', '输出 JSON 报告路径', 'report/result.json')
  .option('-h, --output-html <path>', '输出 HTML 报告路径', 'report/result.html')
  .option('--output-baseline <path>', '输出更新后的基线文件路径')
  .option('-v, --verbose', '显示详细信息')
  .option('--strict', '严格模式，有新增泄漏时退出码为 1')
  .action(async (scanReport: string, options: any) => {
    const config: CLIConfig = {
      scanReport,
      baseline: options.baseline,
      outputJson: options.outputJson,
      outputHtml: options.outputHtml,
      outputBaseline: options.outputBaseline,
      verbose: options.verbose || false,
      strict: options.strict || false
    };

    await runBaselineCheck(config);
  });

async function runBaselineCheck(config: CLIConfig): Promise<void> {
  try {
    const parseResult = await parseScanReport(config.scanReport);

    let baseline: any[] = [];
    let baselinePath = config.baseline;
    if (baselinePath) {
      const baselineResult = await parseBaseline(baselinePath);
      baseline = baselineResult.baseline;
      if (baselineResult.errors.length > 0) {
        parseResult.errors.push(...baselineResult.errors);
      }
    }

    const reportData = processFindings(
      parseResult.findings,
      baseline,
      parseResult.errors,
      config.scanReport,
      config.baseline
    );

    printTerminalSummary(reportData, config.verbose);

    if (config.outputJson) {
      await exportJsonReport(reportData, config.outputJson);
      console.log(`✅ JSON 报告已导出: ${config.outputJson}`);
    }

    if (config.outputHtml) {
      await exportHtmlReport(reportData, config.outputHtml);
      console.log(`✅ HTML 报告已导出: ${config.outputHtml}`);
    }

    if (config.outputBaseline) {
      const newBaseline = generateNewBaseline(reportData);
      await exportBaseline(newBaseline, config.outputBaseline);
      console.log(`✅ 基线文件已导出: ${config.outputBaseline}`);
    }

    if (config.strict && (reportData.summary.newLeaks > 0 || reportData.summary.anomalies > 0)) {
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ 运行出错:', error.message);
    if (config.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

program.parse();
