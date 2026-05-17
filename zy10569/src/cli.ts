#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { parseLogFile, filterErrorEntries } from './parser';
import { groupErrors } from './grouper';
import { generateTerminalSummary, generateMarkdownReport, saveJsonResult, saveMarkdownReport } from './reporter';
import { ProcessingResult, SamplingConfig } from './types';

const program = new Command();

program
  .name('api-error-sampler')
  .description('API错误样本采集CLI工具 - 从日志中提取并整理错误样本')
  .version('1.0.0');

program
  .argument('<logfile>', '日志文件路径')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-s, --samples <number>', '每组最大样本数', '5')
  .option('--no-request', '不包含请求体')
  .option('--no-response', '不包含响应体')
  .option('--sensitive <fields>', '需要脱敏的敏感字段，逗号分隔', 'password,token,secret,authorization')
  .option('--json-only', '只输出JSON结果')
  .option('--no-terminal', '不输出终端摘要')
  .action(async (logfile: string, options) => {
    try {
      if (!fs.existsSync(logfile)) {
        console.error(`错误: 日志文件不存在: ${logfile}`);
        process.exit(1);
      }

      const content = fs.readFileSync(logfile, 'utf8');
      const entries = parseLogFile(content);
      const errorEntries = filterErrorEntries(entries);
      const invalidEntries = entries.filter((e) => !e.isValid);

      const config: SamplingConfig = {
        maxSamplesPerGroup: parseInt(options.samples, 10),
        includeRequest: options.request,
        includeResponse: options.response,
        sensitiveFields: options.sensitive.split(',').map((f: string) => f.trim()),
      };

      const errorGroups = groupErrors(errorEntries, config);

      const result: ProcessingResult = {
        summary: {
          totalLines: entries.length,
          validEntries: entries.filter((e) => e.isValid).length,
          invalidEntries: invalidEntries.length,
          totalErrors: errorEntries.length,
          uniqueErrorGroups: errorGroups.length,
        },
        errorGroups,
        invalidEntries,
        config,
        generatedAt: new Date().toISOString(),
      };

      if (!options.noTerminal && !options.jsonOnly) {
        const terminalSummary = generateTerminalSummary(result);
        console.log(terminalSummary);
      }

      if (options.jsonOnly) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (!fs.existsSync(options.output)) {
          fs.mkdirSync(options.output, { recursive: true });
        }

        const baseName = path.basename(logfile, path.extname(logfile));
        const jsonPath = path.join(options.output, `${baseName}-result.json`);
        const mdPath = path.join(options.output, `${baseName}-report.md`);

        saveJsonResult(result, jsonPath);
        console.log(`✅ JSON结果已保存: ${jsonPath}`);

        const markdown = generateMarkdownReport(result);
        saveMarkdownReport(markdown, mdPath);
        console.log(`✅ Markdown报告已保存: ${mdPath}`);
      }
    } catch (error) {
      console.error('处理失败:', error);
      process.exit(1);
    }
  });

program.parse();
