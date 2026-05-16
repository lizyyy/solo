#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import chalk from 'chalk';
import { SampleType } from './types';
import { SampleGenerator } from './generators';
import { Reporter } from './reporters';
import { SelfChecker } from './selfcheck';

const program = new Command();

program
  .name('jsonschema-sample')
  .description('JSON Schema 样本生成工具 - 生成正常、边界和非法样本用于联调测试')
  .version('1.0.0');

program
  .command('generate')
  .description('生成测试样本')
  .requiredOption('-s, --schema <path>', 'JSON Schema 文件路径')
  .option('-o, --output <dir>', '输出目录', './samples')
  .option('-t, --types <types>', '样本类型，逗号分隔: valid,boundary,invalid', 'valid,boundary,invalid')
  .option('-c, --count <number>', '每种类型的样本数量', '3')
  .option('--seed <number>', '随机种子，用于重复生成', Date.now().toString())
  .option('--fields <fields>', '针对特定字段生成，逗号分隔')
  .option('--no-html', '不生成 HTML 报告')
  .option('--no-json-report', '不生成 JSON 报告')
  .action(async (options) => {
    try {
      const sampleTypes = options.types.split(',').map((t: string) => t.trim()) as SampleType[];
      const validTypes: SampleType[] = ['valid', 'boundary', 'invalid'];
      
      for (const type of sampleTypes) {
        if (!validTypes.includes(type)) {
          throw new Error(`无效的样本类型: ${type}，可选值: ${validTypes.join(', ')}`);
        }
      }

      const count = parseInt(options.count, 10);
      if (isNaN(count) || count < 1) {
        throw new Error('样本数量必须是大于0的整数');
      }

      const seed = parseInt(options.seed, 10);
      if (isNaN(seed)) {
        throw new Error('随机种子必须是整数');
      }

      const generator = new SampleGenerator({
        schemaPath: path.resolve(options.schema),
        outputDir: path.resolve(options.output),
        sampleTypes,
        countPerType: count,
        seed,
        fields: options.fields ? options.fields.split(',').map((f: string) => f.trim()) : undefined
      });

      const summary = await generator.generate();
      const reporter = new Reporter(
        summary,
        generator.getSamples(),
        generator.getSchema(),
        generator['options']
      );

      reporter.printConsoleSummary();

      if (options.jsonReport) {
        const jsonReportPath = reporter.exportJsonReport();
        console.log(chalk.green(`JSON 报告已生成: ${jsonReportPath}`));
      }

      if (options.html) {
        const htmlReportPath = reporter.exportHtmlReport();
        console.log(chalk.green(`HTML 报告已生成: ${htmlReportPath}`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('\n❌ 错误:'), (error as Error).message);
      console.error(chalk.gray('\n使用 --help 查看帮助信息'));
      process.exit(1);
    }
  });

program
  .command('selfcheck')
  .description('运行自检，验证工具在不同场景下的兼容性')
  .option('-o, --output <dir>', '输出目录', './selfcheck-results')
  .option('--quick', '快速模式，只运行基础测试')
  .action(async (options) => {
    try {
      console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════'));
      console.log(chalk.cyan.bold('           JSON Schema 样本生成工具自检'));
      console.log(chalk.cyan.bold('═══════════════════════════════════════════════════\n'));

      const checker = new SelfChecker(path.resolve(options.output), options.quick);
      const results = await checker.run();

      checker.printResults(results);

      const allPassed = results.every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    } catch (error) {
      console.error(chalk.red('\n❌ 自检失败:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('验证 JSON Schema 是否有效')
  .argument('<schema-path>', 'Schema 文件路径')
  .action((schemaPath) => {
    try {
      const { validator } = require('./utils/validator');
      const { readJsonFile } = require('./utils/helpers');
      const schema = readJsonFile(path.resolve(schemaPath));

      if (validator.isValidSchema(schema)) {
        console.log(chalk.green('✅ Schema 有效'));
        process.exit(0);
      } else {
        console.log(chalk.red('❌ Schema 无效'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ 错误:'), (error as Error).message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
