#!/usr/bin/env node

import * as fs from 'fs';
import { Command } from 'commander';
import { loadConfig, validateConfig } from './config';
import { parseRequestSamples } from './headerParser';
import { checkAllSamples } from './checker';
import { generateReportData, outputTerminal, outputJson, outputHtml } from './reporter';

const program = new Command();

program
  .name('proxy-header-check')
  .description('反向代理头检查CLI工具 - 检查X-Forwarded-*等代理头的正确性')
  .version('1.0.0');

program
  .argument('[input-file]', '输入文件路径，每行一个JSON格式的请求样本，默认为stdin')
  .option('-c, --config <path>', '配置文件路径')
  .option('-j, --json <path>', '输出JSON报告到指定文件')
  .option('-h, --html <path>', '输出HTML报告到指定文件')
  .option('--no-terminal', '不输出终端报告')
  .action(async (inputFile, options) => {
    try {
      let input: string;
      
      if (inputFile) {
        input = fs.readFileSync(inputFile, 'utf-8');
      } else {
        input = await readStdin();
      }

      const config = loadConfig(options.config);
      const configErrors = validateConfig(config);
      if (configErrors.length > 0) {
        console.error('配置文件错误:');
        configErrors.forEach(err => console.error(`  - ${err}`));
        process.exit(1);
      }

      const { samples, badLines } = parseRequestSamples(input);
      const results = checkAllSamples(samples, config);
      const reportData = generateReportData(results, badLines, config);

      if (options.terminal) {
        outputTerminal(reportData, badLines);
      }

      if (options.json) {
        outputJson(reportData, badLines, options.json);
      }

      if (options.html) {
        outputHtml(reportData, badLines, options.html);
      }

      const hasErrors = reportData.summary.abnormal > 0;
      process.exit(hasErrors ? 1 : 0);

    } catch (error: any) {
      console.error('错误:', error.message);
      process.exit(1);
    }
  });

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    
    process.stdin.on('end', () => {
      resolve(data);
    });
    
    process.stdin.on('error', reject);
  });
}

program.parse();
