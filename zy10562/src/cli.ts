#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { NginxParser } from './nginx-parser';
import { DomainMerger } from './domain-merger';
import { ReportGenerator } from './report-generator';
import { ScanResult } from './types';

const program = new Command();

program
  .name('nginx-cert-refer')
  .description('Nginx 证书引用扫描工具')
  .version('1.0.0');

program
  .option('-i, --input <dir>', 'Nginx 配置目录路径', '/etc/nginx')
  .option('-o, --output <dir>', '报告输出目录', './nginx-cert-reports')
  .option('--no-console', '不输出控制台摘要')
  .option('--no-json', '不生成 JSON 报告')
  .option('--no-markdown', '不生成 Markdown 报告')
  .action(async (options) => {
    try {
      await runScan(options);
    } catch (error) {
      console.error('❌ 扫描失败:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

async function runScan(options: {
  input: string;
  output: string;
  console: boolean;
  json: boolean;
  markdown: boolean;
}) {
  const scanTime = new Date();
  const timestamp = scanTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const inputDir = path.resolve(options.input);
  const outputDir = path.resolve(options.output);

  const parser = new NginxParser();
  const { serverBlocks, errors: parseErrors } = parser.parseDirectory(inputDir);

  const domainMerger = new DomainMerger();
  const { domainCertMaps, missingReferences, certInfos } = domainMerger.mergeDomains(serverBlocks);

  const domainSummary = domainMerger.calculateSummary(domainCertMaps);

  const scanResult: ScanResult = {
    scanTime,
    inputDir,
    outputDir,
    serverBlocks,
    parseErrors,
    certInfos,
    domainCertMaps,
    missingReferences,
    summary: {
      totalServers: serverBlocks.length,
      totalDomains: domainSummary.totalDomains,
      totalCerts: domainSummary.totalCerts,
      expiringIn30Days: domainSummary.expiringIn30Days,
      expiringIn7Days: domainSummary.expiringIn7Days,
      expired: domainSummary.expired,
      missingCerts: domainSummary.missingCerts,
      parseErrors: parseErrors.length
    }
  };

  const reportGenerator = new ReportGenerator();

  const reportOptions = { outputDir, timestamp };

  if (options.json) {
    const jsonPath = reportGenerator.generateJsonReport(scanResult, reportOptions);
    console.log(`📄 JSON 报告已保存: ${jsonPath}`);
  }

  if (options.markdown) {
    const mdPath = reportGenerator.generateMarkdownReport(scanResult, reportOptions);
    console.log(`📄 Markdown 报告已保存: ${mdPath}`);
  }

  if (options.console) {
    reportGenerator.printConsoleSummary(scanResult);
  }
}

program.parseAsync();
