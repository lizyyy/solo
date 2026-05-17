#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { OpenAPIParser } from './parser';
import { ConsistencyChecker } from './checker';
import { Reporter } from './reporter';
import { CLIOptions } from './types';

const program = new Command();

program
  .name('openapi-error-check')
  .description('检查 REST API 错误响应体的一致性')
  .version('1.0.0');

program
  .argument('<input>', 'OpenAPI 规范文件路径 (JSON/YAML)')
  .option('-o, --output-dir <dir>', '输出目录', './reports')
  .option('--json <path>', 'JSON 报告输出路径')
  .option('--markdown <path>', 'Markdown 报告输出路径')
  .option('--fail-on-error', '发现错误时以非零状态码退出')
  .action(async (input: string, options: CLIOptions) => {
    try {
      const inputPath = path.resolve(input);
      
      console.log(`📖 解析 OpenAPI 规范: ${inputPath}`);
      const parser = new OpenAPIParser(inputPath);
      
      console.log(`🔍 提取错误响应...`);
      const errorResponses = parser.extractErrorResponses();
      console.log(`   发现 ${errorResponses.length} 个错误响应`);

      console.log(`✅ 进行一致性检查...`);
      const checker = new ConsistencyChecker(
        errorResponses,
        input,
        parser.getTotalEndpoints()
      );
      const result = checker.check();

      console.log(`📝 生成报告...`);
      const reporter = new Reporter(result, options.outputDir);
      
      const jsonPath = options.json ? path.resolve(options.json) : undefined;
      const markdownPath = options.markdown ? path.resolve(options.markdown) : undefined;
      
      reporter.generateAllReports(jsonPath, markdownPath);

      if (options.failOnError && result.summary.errors > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ 错误:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
