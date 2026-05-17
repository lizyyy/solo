#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ConsistencyChecker } from './lib/consistency-checker.js';
import { ReportGenerator } from './lib/report-generator.js';

const program = new Command();

program
  .name('mock-check')
  .description('检查 Mock 数据与 OpenAPI 契约的一致性')
  .version('1.0.0');

program
  .argument('<openapi>', 'OpenAPI 契约文件路径 (YAML/JSON)')
  .argument('<mock>', 'Mock 文件或目录路径')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('--no-strict-type', '禁用严格类型检查')
  .option('--check-optional', '检查可选字段')
  .option('--fail-on-warning', '遇到警告时也返回非零退出码')
  .action(async (openapiPath, mockPath, options) => {
    console.log(chalk.blue('🔍 开始检查 Mock 数据与 OpenAPI 契约一致性...'));
    console.log(chalk.gray(`   OpenAPI: ${openapiPath}`));
    console.log(chalk.gray(`   Mock: ${mockPath}`));
    console.log();

    try {
      const checker = new ConsistencyChecker(openapiPath, mockPath, {
        strictType: options.strictType,
        checkOptional: options.checkOptional
      });

      await checker.run();
      const summary = checker.getSummary();

      printConsoleSummary(summary);
      console.log();

      const generator = new ReportGenerator(checker, options.output);
      const { jsonPath, markdownPath } = await generator.generate();

      console.log(chalk.green('✅ 报告已生成:'));
      console.log(chalk.gray(`   JSON: ${jsonPath}`));
      console.log(chalk.gray(`   Markdown: ${markdownPath}`));
      console.log();

      const shouldFail = summary.failed > 0 || summary.errors > 0 || 
        (options.failOnWarning && summary.warned > 0);

      if (shouldFail) {
        console.log(chalk.red('❌ 检查失败，存在问题需要修复'));
        process.exit(1);
      } else if (summary.warned > 0) {
        console.log(chalk.yellow('⚠️  检查通过，但存在警告需要关注'));
        process.exit(0);
      } else {
        console.log(chalk.green('✅ 所有检查通过!'));
        process.exit(0);
      }
    } catch (error) {
      console.error(chalk.red('❌ 检查过程中发生错误:'));
      console.error(chalk.red(`   ${error.message}`));
      console.error();
      console.error(chalk.gray(error.stack));
      process.exit(2);
    }
  });

function printConsoleSummary(summary) {
  const lines = [
    { label: '检查的 Mock 文件', value: summary.total },
    { label: '通过', value: summary.passed, color: 'green' },
    { label: '失败', value: summary.failed, color: 'red' },
    { label: '警告', value: summary.warned, color: 'yellow' },
    { label: '未匹配', value: summary.unmatched, color: 'gray' },
    { label: '解析错误', value: summary.errors, color: 'red' },
    { label: '无 Schema', value: summary.noSchema, color: 'yellow' },
    { label: '---', value: '---' },
    { label: '总问题数', value: summary.totalIssues },
    { label: '- 错误', value: summary.totalErrors, color: 'red' },
    { label: '- 警告', value: summary.totalWarnings, color: 'yellow' },
    { label: '通过率', value: `${summary.passRate}%`, color: summary.passRate >= 80 ? 'green' : summary.passRate >= 50 ? 'yellow' : 'red' }
  ];

  console.log(chalk.bold('📊 检查结果概览:'));
  for (const line of lines) {
    if (line.label === '---') {
      console.log('  ' + '─'.repeat(30));
      continue;
    }
    const colorFn = line.color ? chalk[line.color] : chalk.white;
    console.log(`  ${line.label}: ${colorFn(line.value)}`);
  }
}

program.parse();