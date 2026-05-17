#!/usr/bin/env node

import { Command } from 'commander';
import { CommentParser } from './parser.js';
import { ThreadAnalyzer } from './analyzer.js';
import { ReportGenerator } from './reporter.js';
import { SelfTest } from './selftest.js';

const program = new Command();

program
  .name('ghcs')
  .description('GitHub PR 评论采样分析工具')
  .version('1.0.0');

program
  .command('analyze')
  .description('分析评论文件')
  .argument('<file>', '要分析的评论文件路径')
  .option('-j, --json', '输出 JSON 格式结果')
  .option('-m, --markdown', '输出 Markdown 格式报告')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('--no-console', '不输出控制台摘要')
  .option('--strict', '严格模式，遇到解析错误时终止')
  .option('--no-duplicates', '禁用重复检测')
  .option('--threshold <number>', '重复检测相似度阈值 (0-1)', '0.7')
  .action(async (file, options) => {
    try {
      const parser = new CommentParser({
        strictMode: options.strict,
        keepRaw: true
      });

      const { threads, comments, parseErrors } = await parser.parseFile(file);

      const analyzer = new ThreadAnalyzer({
        enableDuplicateDetection: options.duplicates,
        duplicateThreshold: parseFloat(options.threshold)
      });

      const result = analyzer.analyze(threads, comments, parseErrors);
      result.metadata.inputFile = file;

      const reporter = new ReportGenerator({
        outputDir: options.output
      });

      if (options.console !== false) {
        reporter.printConsole(result);
      }

      if (options.json) {
        const jsonPath = await reporter.writeToFile(
          result,
          'json',
          `result-${Date.now()}.json`
        );
        console.log(`📄 JSON 结果已保存到: ${jsonPath}`);
      }

      if (options.markdown) {
        const mdPath = await reporter.writeToFile(
          result,
          'markdown',
          `report-${Date.now()}.md`
        );
        console.log(`📄 Markdown 报告已保存到: ${mdPath}`);
      }

    } catch (error) {
      console.error('❌ 分析失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('self-test')
  .description('运行自检测试，验证工具功能')
  .option('-v, --verbose', '显示详细输出')
  .action(async (options) => {
    console.log('🧪 开始运行自检测试...\n');
    
    const tester = new SelfTest({
      verbose: options.verbose
    });

    try {
      const results = await tester.runAll();
      
      console.log('\n' + '='.repeat(50));
      console.log('📊 测试结果汇总');
      console.log('='.repeat(50));
      
      let passed = 0;
      let failed = 0;
      
      for (const [name, result] of Object.entries(results)) {
        const status = result.passed ? '✅' : '❌';
        console.log(`${status} ${name}: ${result.message}`);
        if (result.passed) passed++;
        else failed++;
      }
      
      console.log(`\n总计: ${passed} 通过, ${failed} 失败`);
      
      if (failed > 0) {
        console.log('\n❌ 部分测试未通过，请检查上述错误');
        process.exit(1);
      } else {
        console.log('\n🎉 所有测试通过！工具功能正常');
      }
      
    } catch (error) {
      console.error('❌ 自测运行失败:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
