#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigLoader } from './config';
import { SchemaParser } from './schema-parser';
import { WorkloadParser } from './workload-parser';
import { BenchmarkEngine } from './benchmark-engine';
import { Optimizer } from './optimizer';
import { ReportGenerator } from './report-generator';
import { CLIOptions } from './types';

const pkg = require('../package.json');

const program = new Command();

program
  .name('sqlite-optimizer')
  .description('SQLite 写入优化顾问 - 分析和优化 SQLite 批量写入性能')
  .version(pkg.version, '-v, --version', '显示版本号');

program
  .command('run')
  .description('运行基准测试并生成优化报告')
  .option('-s, --schema <path>', 'Schema SQL 文件路径', './schema.sql')
  .option('-w, --workload <path>', 'Workload JSONL 文件路径', './workload.jsonl')
  .option('-c, --config <path>', '配置 YAML 文件路径', './write-config.yaml')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('-f, --format <formats...>', '输出格式: markdown, json, csv (可多选)', ['markdown', 'json'])
  .option('--limit <number>', '限制测试记录数', parseInt)
  .option('-v, --verbose', '显示详细输出')
  .action(async (options) => {
    try {
      await runOptimizer(options);
    } catch (error) {
      console.error('\n❌ 执行失败:');
      console.error(`   ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('初始化项目，生成示例配置和数据文件')
  .option('-s, --schema <path>', 'Schema 文件输出路径', './schema.sql')
  .option('-w, --workload <path>', 'Workload 文件输出路径', './workload.jsonl')
  .option('-c, --config <path>', '配置文件输出路径', './write-config.yaml')
  .option('--records <number>', '生成的示例记录数', '100')
  .action((options) => {
    try {
      initProject(options);
    } catch (error) {
      console.error('\n❌ 初始化失败:');
      console.error(`   ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('验证输入文件格式是否正确')
  .option('-s, --schema <path>', 'Schema SQL 文件路径', './schema.sql')
  .option('-w, --workload <path>', 'Workload JSONL 文件路径', './workload.jsonl')
  .option('-c, --config <path>', '配置 YAML 文件路径', './write-config.yaml')
  .action(async (options) => {
    try {
      await validateFiles(options);
    } catch (error) {
      console.error('\n❌ 验证失败:');
      console.error(`   ${(error as Error).message}`);
      process.exit(1);
    }
  });

async function runOptimizer(options: CLIOptions & { limit?: number; verbose?: boolean }) {
  console.log('\n📊 SQLite 写入优化顾问');
  console.log('='.repeat(50));

  const schemaPath = path.resolve(options.schema);
  const workloadPath = path.resolve(options.workload);
  const configPath = path.resolve(options.config);
  const outputDir = path.resolve(options.output || './reports');

  console.log(`\n📂 输入文件:`);
  console.log(`   Schema: ${schemaPath}`);
  console.log(`   Workload: ${workloadPath}`);
  console.log(`   Config: ${configPath}`);
  console.log(`   输出目录: ${outputDir}`);

  const missingFiles: string[] = [];
  if (!fs.existsSync(schemaPath)) missingFiles.push(`Schema 文件: ${schemaPath}`);
  if (!fs.existsSync(workloadPath)) missingFiles.push(`Workload 文件: ${workloadPath}`);

  if (missingFiles.length > 0) {
    throw new Error(
      `以下文件不存在:\n   - ${missingFiles.join('\n   - ')}\n\n` +
      `提示: 运行 "sqlite-optimizer init" 生成示例文件`
    );
  }

  console.log(`\n📋 加载配置...`);
  const configLoader = new ConfigLoader(configPath);
  const config = configLoader.load();
  console.log(`   ✓ 配置加载完成`);

  console.log(`\n📋 解析 Schema...`);
  const schemaParser = new SchemaParser(schemaPath);
  const tables = schemaParser.parse();
  console.log(`   ✓ 解析完成，共 ${tables.length} 个表`);
  if (options.verbose) {
    for (const table of tables) {
      console.log(`     - ${table.name}: ${table.columns.length} 列, ${table.indexes.length} 索引`);
    }
  }

  console.log(`\n📋 解析 Workload...`);
  const workloadParser = new WorkloadParser(workloadPath, tables);
  const records = await workloadParser.parse(options.limit);
  console.log(`   ✓ 解析完成，共 ${records.length} 条记录`);
  if (options.verbose) {
    const operationCounts = new Map<string, number>();
    for (const record of records) {
      operationCounts.set(record.operation, (operationCounts.get(record.operation) || 0) + 1);
    }
    for (const [op, count] of operationCounts) {
      console.log(`     - ${op}: ${count} 条`);
    }
  }

  console.log(`\n🏃 开始基准测试...`);
  console.log(`   测试记录数: ${records.length}`);
  console.log(`   Warmup 次数: ${config.benchmark.warmupRuns}`);
  console.log(`   测试次数: ${config.benchmark.testRuns}`);
  console.log('');

  const engine = new BenchmarkEngine(tables, records, config);
  const results = await engine.runAllStrategies();
  engine.cleanup();

  console.log(`\n✅ 基准测试完成，共 ${results.length} 个策略`);

  console.log(`\n📈 分析结果并生成优化建议...`);
  const optimizer = new Optimizer(results, config, tables, records.length);
  const report = optimizer.generateReport();
  console.log(`   ✓ 分析完成`);

  console.log(`\n📄 生成报告...`);
  const generator = new ReportGenerator(report, outputDir);
  
  const formats = options.format as ('markdown' | 'json' | 'csv')[];
  const validFormats = formats.filter(f => ['markdown', 'json', 'csv'].includes(f));
  
  if (validFormats.length === 0) {
    throw new Error(`无效的输出格式: ${formats.join(', ')}。有效值: markdown, json, csv`);
  }

  const generatedFiles = generator.generateAll(validFormats);
  console.log(`\n✅ 报告生成完成!`);

  generator.printConsoleSummary();

  console.log(`\n📁 生成的文件:`);
  for (const file of generatedFiles) {
    console.log(`   - ${file}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 优化分析完成!');
  console.log('='.repeat(50) + '\n');
}

function initProject(options: { 
  schema: string; 
  workload: string; 
  config: string; 
  records: string;
}) {
  console.log('\n🚀 初始化 SQLite 写入优化顾问项目');
  console.log('='.repeat(50));

  const schemaPath = path.resolve(options.schema);
  const workloadPath = path.resolve(options.workload);
  const configPath = path.resolve(options.config);
  const recordCount = parseInt(options.records, 10) || 100;

  console.log(`\n📄 生成 Schema 文件: ${schemaPath}`);
  const schemaParser = new SchemaParser(schemaPath);
  schemaParser.generateSampleSchema(schemaPath);

  console.log(`\n📄 生成 Workload 文件: ${workloadPath}`);
  const workloadParser = new WorkloadParser(workloadPath);
  workloadParser.generateSampleWorkload(workloadPath, recordCount);

  console.log(`\n📄 生成配置文件: ${configPath}`);
  const configLoader = new ConfigLoader(configPath);
  configLoader.generateDefaultConfig(configPath);

  console.log('\n' + '='.repeat(50));
  console.log('✅ 初始化完成!');
  console.log('='.repeat(50));
  console.log(`
接下来的步骤:
1. 查看生成的示例文件
2. 修改 schema.sql 为你的实际表结构
3. 修改 workload.jsonl 为你的实际写入数据
4. 运行基准测试:

   sqlite-optimizer run
   
   或指定参数:
   sqlite-optimizer run -s ./schema.sql -w ./workload.jsonl -f markdown json csv
`);
}

async function validateFiles(options: { schema: string; workload: string; config: string }) {
  console.log('\n🔍 验证输入文件');
  console.log('='.repeat(50));

  const schemaPath = path.resolve(options.schema);
  const workloadPath = path.resolve(options.workload);
  const configPath = path.resolve(options.config);

  let hasErrors = false;

  console.log(`\n📋 验证 Schema 文件: ${schemaPath}`);
  try {
    if (!fs.existsSync(schemaPath)) {
      console.log(`   ❌ 文件不存在`);
      hasErrors = true;
    } else {
      const schemaParser = new SchemaParser(schemaPath);
      const tables = schemaParser.parse();
      console.log(`   ✓ 有效，共 ${tables.length} 个表`);
      for (const table of tables) {
        console.log(`     - ${table.name}: ${table.columns.length} 列`);
      }
    }
  } catch (error) {
    console.log(`   ❌ ${(error as Error).message}`);
    hasErrors = true;
  }

  console.log(`\n📋 验证 Workload 文件: ${workloadPath}`);
  try {
    if (!fs.existsSync(workloadPath)) {
      console.log(`   ❌ 文件不存在`);
      hasErrors = true;
    } else {
      const tables: any[] = [];
      try {
        const schemaParser = new SchemaParser(schemaPath);
        tables.push(...schemaParser.parse());
      } catch (e) {
        // Ignore schema parse errors for validation
      }

      const workloadParser = new WorkloadParser(workloadPath, tables);
      const records = await workloadParser.parse(100);
      console.log(`   ✓ 有效，已读取 ${records.length} 条记录 (前 100 条)`);
      
      const operationCounts = new Map<string, number>();
      const tableCounts = new Map<string, number>();
      for (const record of records) {
        operationCounts.set(record.operation, (operationCounts.get(record.operation) || 0) + 1);
        tableCounts.set(record.table, (tableCounts.get(record.table) || 0) + 1);
      }
      
      console.log(`     操作类型:`);
      for (const [op, count] of operationCounts) {
        console.log(`       - ${op}: ${count}`);
      }
      console.log(`     涉及表:`);
      for (const [table, count] of tableCounts) {
        console.log(`       - ${table}: ${count} 条记录`);
      }
    }
  } catch (error) {
    console.log(`   ❌ ${(error as Error).message}`);
    hasErrors = true;
  }

  console.log(`\n📋 验证配置文件: ${configPath}`);
  try {
    if (!fs.existsSync(configPath)) {
      console.log(`   ⚠️  文件不存在，将使用默认配置`);
    } else {
      const configLoader = new ConfigLoader(configPath);
      const config = configLoader.load();
      console.log(`   ✓ 有效`);
      console.log(`     - Warmup: ${config.benchmark.warmupRuns} 次`);
      console.log(`     - 测试: ${config.benchmark.testRuns} 次`);
      console.log(`     - 批量大小: ${config.strategies.batchSizes.join(', ')}`);
      console.log(`     - Journal 模式: ${config.strategies.journalModes.join(', ')}`);
    }
  } catch (error) {
    console.log(`   ❌ ${(error as Error).message}`);
    hasErrors = true;
  }

  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    console.log('⚠️  验证完成，存在问题需要修复');
    console.log('='.repeat(50) + '\n');
    process.exit(1);
  } else {
    console.log('✅ 所有文件验证通过!');
    console.log('='.repeat(50) + '\n');
  }
}

program.parse(process.argv);
