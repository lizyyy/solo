#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { CLIOptions, ExitCode } from './types';
import {
  loadSchema,
  compareSchemas,
} from './schema-diff';
import {
  loadQueryDocuments,
  analyzeQueryImpact,
} from './query-analyzer';
import {
  generateFailurePaths,
  shouldFailBuild,
} from './nullability-rules';
import {
  generateReport,
  printTerminalReport,
  writeJsonReport,
  writeMarkdownReport,
} from './report-generator';
import {
  readFile,
  hashString,
  validateSchemaPath,
  findQueryFiles,
  loadConfigFile,
} from './utils';

const program = new Command();

program
  .name('gql-null-drift')
  .description('GraphQL空值漂移检测CLI工具 - 检测字段从非空变为可空的变更对客户端的影响')
  .version('1.0.0');

program
  .command('check')
  .description('检测两个Schema版本之间的空值漂移')
  .requiredOption('--old-schema <path>', '旧版Schema文件路径 (.graphql, .gql, .json')
  .requiredOption('--new-schema <path>', '新版Schema文件路径 (.graphql, .gql, .json')
  .option('--queries <paths...>', '查询文档文件或目录路径')
  .option('-o, --output-dir <path>', '报告输出目录', './null-drift-reports')
  .option('-f, --format <formats...>', '输出格式: terminal, json, markdown, all', ['terminal', 'json', 'markdown'])
  .option('--fail-on <level>', '失败阈值: critical, high, medium, any, none', 'high')
  .option('--client-version <version>', '客户端版本号')
  .option('--field-filter <fields...>', '只检测指定的字段路径')
  .option('-v, --verbose', '显示详细信息')
  .option('-c, --config <path>', '配置文件路径')
  .action(async (options) => {
    try {
      const exitCode = await runCheck(options);
      process.exit(exitCode);
    } catch (error) {
      console.error('错误:', (error as Error).message);
      process.exit(ExitCode.INPUT_ERROR);
    }
  });

program
  .command('self-test')
  .description('运行自检命令，验证工具功能完整性')
  .option('-o, --output-dir <path>', '测试报告输出目录', './self-test-results')
  .action(async (options) => {
    try {
      const selfTestModule = await import('./self-test');
      const exitCode = await selfTestModule.runSelfTest(options.outputDir);
      process.exit(exitCode);
    } catch (error) {
      console.error('自检失败:', (error as Error).message);
      process.exit(ExitCode.SELF_TEST_FAILED);
    }
  });

program
  .command('explain <rule-code>')
  .description('解释空值漂移规则的详细说明')
  .action((ruleCode) => {
    const rulesModule = require('./nullability-rules');
    const rule = Object.values(rulesModule.NULLABILITY_RULES).find(
      (r: any) => r.code === ruleCode.toUpperCase()
    );
    if (rule) {
      console.log(`规则代码: ${(rule as any).code}`);
      console.log(`规则名称: ${(rule as any).name}`);
      console.log(`严重程度: ${(rule as any).severity}`);
      console.log(`描述: ${(rule as any).description}`);
      console.log(`客户端影响: ${(rule as any).clientImpact}`);
      console.log(`修复优先级: ${(rule as any).fixPriority}`);
    } else {
      console.log(`未找到规则: ${ruleCode}`);
    }
  });

async function runCheck(options: any): Promise<number> {
  const config = loadConfigFile(options.config);
  const mergedOptions: CLIOptions = {
    oldSchema: options.oldSchema,
    newSchema: options.newSchema,
    queries: options.queries || config?.queryGlobs,
    outputDir: options.outputDir || config?.outputDir || './null-drift-reports',
    format: options.format,
    failOn: options.failOn || config?.failOn || 'high',
    clientVersion: options.clientVersion,
    fieldFilter: options.fieldFilter,
    verbose: options.verbose,
    config: options.config,
  };

  validateSchemaPath(mergedOptions.oldSchema);
  validateSchemaPath(mergedOptions.newSchema);

  console.log('📖 加载Schema...');
  const oldSchemaContent = readFile(mergedOptions.oldSchema);
  const newSchemaContent = readFile(mergedOptions.newSchema);
  const oldSchema = loadSchema(mergedOptions.oldSchema);
  const newSchema = loadSchema(mergedOptions.newSchema);

  console.log('🔍 对比Schema差异...');
  const { changes, summary, oldFields, newFields, typeMap } = compareSchemas(oldSchema, newSchema);

  let filteredChanges = changes;
  if (mergedOptions.fieldFilter && mergedOptions.fieldFilter.length > 0) {
    const filterSet = new Set(mergedOptions.fieldFilter);
    filteredChanges = changes.filter((c) => filterSet.has(c.fieldPath));
  }

  let affectedQueries: any[] = [];
  let queryDocs: any[] = [];

  if (mergedOptions.queries && mergedOptions.queries.length > 0) {
    console.log('📄 加载查询文档...');
    const queryFiles = findQueryFiles(mergedOptions.queries);
    if (queryFiles.length > 0) {
      queryDocs = loadQueryDocuments(queryFiles);
      console.log(`   加载了 ${queryDocs.length} 个查询文档`);

      console.log('🔗 分析查询影响...');
      affectedQueries = analyzeQueryImpact(queryDocs, filteredChanges, newFields, typeMap);
    }
  }

  console.log('📊 生成失败路径...');
  const failurePaths = generateFailurePaths(filteredChanges, affectedQueries);

  console.log('📝 生成报告...');
  const report = generateReport(filteredChanges, affectedQueries, failurePaths, {
    oldSchemaHash: hashString(oldSchemaContent),
    newSchemaHash: hashString(newSchemaContent),
    clientVersion: mergedOptions.clientVersion,
    queriesScanned: queryDocs.length,
    fieldsScanned: summary.totalFieldsChecked,
  });

  const shouldFail = shouldFailBuild(filteredChanges, mergedOptions.failOn);
  const finalExitCode = shouldFail ? report.exitCode : ExitCode.SUCCESS;
  report.exitCode = finalExitCode;

  const formats = mergedOptions.format.includes('all')
    ? ['terminal', 'json', 'markdown']
    : mergedOptions.format;

  if (formats.includes('terminal')) {
    printTerminalReport(report, mergedOptions.verbose);
  }

  if (formats.includes('json')) {
    const jsonPath = writeJsonReport(report, mergedOptions.outputDir);
    console.log(`JSON报告已保存: ${jsonPath}`);
  }

  if (formats.includes('markdown')) {
    const mdPath = writeMarkdownReport(report, mergedOptions.outputDir);
    console.log(`Markdown报告已保存: ${mdPath}`);
  }

  return finalExitCode;
}

program.parseAsync(process.argv).catch((error) => {
  console.error('命令执行失败:', error);
  process.exit(1);
});
