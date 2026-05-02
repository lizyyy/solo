#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');

const SchemaParser = require('./schema-parser');
const TraceParser = require('./trace-parser');
const TimelineBuilder = require('./timeline-builder');
const ReplayPlanner = require('./replay-planner');
const Reporter = require('./reporter');
const Reproducer = require('./reproducer');

const pkg = require('../package.json');

program
  .name('mcp-replay')
  .description('MCP 工具调用录制与重放调试器')
  .version(pkg.version);

program
  .command('analyze')
  .description('分析轨迹文件，生成分析摘要')
  .requiredOption('--schema <path>', 'Schema 文件路径 (JSON/YAML)')
  .requiredOption('--trace <path>', '轨迹文件路径 (JSONL/JSON)')
  .option('--old-schema <path>', '旧 Schema 文件路径，用于对比漂移')
  .option('--config <path>', '配置文件路径')
  .option('--output <path>', '输出文件路径')
  .option('--format <format>', '输出格式: json|markdown (默认: json)', 'json')
  .action(async (options) => {
    try {
      const result = await runAnalysis(options);
      
      if (options.output) {
        const outputDir = path.dirname(options.output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        if (options.format === 'markdown') {
          const reporter = new Reporter({ outputFormat: 'markdown' });
          const report = reporter.generateReport({
            trace: result.trace,
            timeline: result.timeline,
            schema: result.schema,
            plan: result.plan,
            drift: result.drift
          });
          fs.writeFileSync(options.output, report, 'utf-8');
        } else {
          fs.writeFileSync(options.output, JSON.stringify(result, null, 2), 'utf-8');
        }
        console.log(`分析结果已保存到: ${options.output}`);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error('分析失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('plan')
  .description('生成 dry-run 回放计划')
  .requiredOption('--schema <path>', 'Schema 文件路径 (JSON/YAML)')
  .requiredOption('--trace <path>', '轨迹文件路径 (JSONL/JSON)')
  .option('--include-retries', '包含重试调用', true)
  .option('--skip-non-idempotent', '跳过非幂等调用')
  .option('--output <path>', '输出文件路径')
  .action(async (options) => {
    try {
      const result = await runAnalysis(options);
      const planner = new ReplayPlanner();
      
      const plan = planner.generate(result.timeline, result.schema, {
        includeRetries: options.includeRetries,
        skipNonIdempotent: options.skipNonIdempotent
      });

      const dryRunSummary = planner.generateDryRunSummary(plan);

      if (options.output) {
        const outputDir = path.dirname(options.output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(options.output, JSON.stringify({
          plan,
          dryRunSummary
        }, null, 2), 'utf-8');
        console.log(`回放计划已保存到: ${options.output}`);
      } else {
        console.log('=== 回放计划 ===');
        console.log('总调用数:', plan.summary.totalCalls);
        console.log('计划执行:', plan.summary.plannedCalls);
        console.log('跳过:', plan.summary.skippedCalls);
        console.log('是否可执行:', dryRunSummary.canExecute ? '✅ 是' : '❌ 否');
        
        if (dryRunSummary.blockers.length > 0) {
          console.log('\n=== 阻塞问题 ===');
          for (const blocker of dryRunSummary.blockers) {
            console.log(`  - ${blocker.tool_name}: ${blocker.reason}`);
          }
        }

        if (dryRunSummary.warnings.length > 0) {
          console.log('\n=== 警告 ===');
          for (const warning of dryRunSummary.warnings) {
            console.log(`  ⚠️  ${warning.tool_name}: ${warning.reason}`);
          }
        }
      }
    } catch (error) {
      console.error('生成回放计划失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成详细报告')
  .requiredOption('--schema <path>', 'Schema 文件路径 (JSON/YAML)')
  .requiredOption('--trace <path>', '轨迹文件路径 (JSONL/JSON)')
  .option('--old-schema <path>', '旧 Schema 文件路径，用于对比漂移')
  .option('--output <path>', '输出文件路径')
  .option('--format <format>', '输出格式: markdown|json (默认: markdown)', 'markdown')
  .option('--include-raw', '包含原始数据')
  .action(async (options) => {
    try {
      const result = await runAnalysis(options);
      
      const reporter = new Reporter({
        outputFormat: options.format,
        includeRawData: options.includeRaw
      });

      const report = reporter.generateReport({
        trace: result.trace,
        timeline: result.timeline,
        schema: result.schema,
        plan: result.plan,
        drift: result.drift
      });

      if (options.output) {
        const outputDir = path.dirname(options.output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        reporter.saveReport(report, options.output);
        console.log(`报告已保存到: ${options.output}`);
      } else {
        console.log(report);
      }
    } catch (error) {
      console.error('生成报告失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('reproduce')
  .description('生成最小复现包')
  .requiredOption('--schema <path>', 'Schema 文件路径 (JSON/YAML)')
  .requiredOption('--trace <path>', '轨迹文件路径 (JSONL/JSON)')
  .option('--target <call_id>', '目标 tool_call_id')
  .option('--output-dir <path>', '输出目录 (默认: ./reproduction)', './reproduction')
  .option('--no-schema', '不包含 Schema')
  .option('--no-config', '不包含配置文件')
  .action(async (options) => {
    try {
      const result = await runAnalysis(options);
      
      const reproducer = new Reproducer({
        outputDir: options.outputDir,
        includeSchema: options.schema !== false,
        includeConfig: options.config !== false
      });

      const reproduction = reproducer.generate({
        trace: result.trace,
        timeline: result.timeline,
        schema: result.schema,
        plan: result.plan
      }, options.target);

      const outputPath = reproducer.savePackage(reproduction);

      console.log('✅ 最小复现包已生成');
      console.log(`   目录: ${outputPath}`);
      console.log('');
      console.log('文件结构:');
      console.log('  ├── MANIFEST.json      # 清单文件');
      console.log('  ├── reproduction.json  # 完整复现数据');
      console.log('  ├── trace.jsonl        # 最小化轨迹');
      if (options.schema !== false) {
        console.log('  ├── schema.json        # 相关 Schema');
      }
      if (options.config !== false) {
        console.log('  ├── config.json        # 回放配置');
      }
      console.log('  └── README.md          # 使用说明');
      console.log('');
      console.log('使用方法:');
      console.log(`  mcp-replay analyze --schema ${outputPath}/schema.json --trace ${outputPath}/trace.jsonl`);
    } catch (error) {
      console.error('生成复现包失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('验证参数与 Schema 的兼容性')
  .requiredOption('--schema <path>', 'Schema 文件路径 (JSON/YAML)')
  .option('--trace <path>', '轨迹文件路径 (JSONL/JSON)')
  .option('--tool <name>', '工具名称')
  .option('--params <json>', '参数 JSON 字符串')
  .action(async (options) => {
    try {
      const schemaParser = new SchemaParser();
      const schema = schemaParser.parse(options.schema);

      if (options.trace) {
        const traceParser = new TraceParser();
        const trace = await traceParser.parse(options.trace);

        const issues = [];
        for (const entry of trace.entries) {
          if (entry.tool_name) {
            const validation = schemaParser.validateToolCall(
              entry.tool_name,
              entry.parameters,
              schema
            );
            if (validation.issues.length > 0) {
              issues.push({
                tool_call_id: entry.tool_call_id,
                tool_name: entry.tool_name,
                issues: validation.issues
              });
            }
          }
        }

        if (issues.length === 0) {
          console.log('✅ 所有调用与 Schema 兼容');
        } else {
          console.log(`❌ 发现 ${issues.length} 个兼容性问题`);
          console.log('');
          for (const issue of issues) {
            console.log(`工具: ${issue.tool_name} (${issue.tool_call_id})`);
            for (const i of issue.issues) {
              const severity = i.severity === 'error' ? '🔴' : '🟡';
              console.log(`  ${severity} ${i.message}`);
            }
            console.log('');
          }
        }
      } else if (options.tool && options.params) {
        const params = JSON.parse(options.params);
        const validation = schemaParser.validateToolCall(
          options.tool,
          params,
          schema
        );

        if (validation.valid) {
          console.log('✅ 参数验证通过');
          if (validation.issues.length > 0) {
            console.log('\n警告:');
            for (const issue of validation.issues) {
              console.log(`  ⚠️  ${issue.message}`);
            }
          }
        } else {
          console.log('❌ 参数验证失败');
          console.log('');
          for (const issue of validation.issues) {
            const severity = issue.severity === 'error' ? '🔴' : '🟡';
            console.log(`  ${severity} ${issue.message}`);
          }
        }
      } else {
        console.log('请提供 --trace 或 --tool 与 --params');
        process.exit(1);
      }
    } catch (error) {
      console.error('验证失败:', error.message);
      process.exit(1);
    }
  });

async function runAnalysis(options) {
  const schemaParser = new SchemaParser();
  const traceParser = new TraceParser();
  const timelineBuilder = new TimelineBuilder();
  const replayPlanner = new ReplayPlanner();

  const schema = schemaParser.parse(options.schema);
  const trace = await traceParser.parse(options.trace);
  const timeline = timelineBuilder.build(trace);
  const plan = replayPlanner.generate(timeline, schema, {
    includeRetries: options.includeRetries !== false,
    skipNonIdempotent: options.skipNonIdempotent === true
  });

  let drift = null;
  if (options.oldSchema) {
    const oldSchema = schemaParser.parse(options.oldSchema);
    drift = schemaParser.detectSchemaDrift(oldSchema, schema);
  }

  return {
    schema,
    trace,
    timeline,
    plan,
    drift
  };
}

program.parse();
