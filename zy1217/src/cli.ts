#!/usr/bin/env node

import { Command } from 'commander';
import * as chalk from 'chalk';
import { table } from 'table';
import * as path from 'path';

import { ConfigParser } from './parsers/config-parser';
import { AnalysisEngine } from './analyzers/analysis-engine';
import { ConfigValidator } from './validation/config-validator';
import { SQLiteTrace } from './trace/sqlite-trace';
import { ReportGenerator } from './reporting/report-generator';
import { Issue, Severity } from './types';

const program = new Command();

program
  .name('db-gate')
  .description('数据库 Workload 回放闸门工具 - 数据库改造上线前的综合分析工具')
  .version('1.0.0');

program
  .command('analyze')
  .description('执行完整的 Workload 分析流程')
  .option('-p, --profile <path>', 'db-profile.yaml 文件路径', 'db-profile.yaml')
  .option('-s, --schema <path>', 'schema.sql 文件路径', 'schema.sql')
  .option('-t, --trace <path>', 'sql-trace.jsonl 文件路径', 'sql-trace.jsonl')
  .option('-b, --batches <path>', 'write-batches.csv 文件路径', 'write-batches.csv')
  .option('-d, --sharding <path>', 'sharding-plan.yaml 文件路径（可选）')
  .option('--slow-threshold <ms>', '慢 SQL 阈值（毫秒）', '500')
  .option('-o, --output <format>', '输出格式: markdown|json|both', 'markdown')
  .option('--output-dir <dir>', '输出目录', '.')
  .option('--no-sqlite', '禁用 SQLite 留痕')
  .option('--sqlite-path <path>', 'SQLite 数据库路径', './analysis-trace.db')
  .option('--skip-validation', '跳过配置校验')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n🚀 开始执行数据库 Workload 分析...\n'));

      const baseDir = process.cwd();
      const parser = new ConfigParser(baseDir);

      console.log(chalk.gray('📂 解析配置文件...'));
      
      const dbProfile = await parser.parseDBProfile(options.profile);
      const schema = await parser.parseSchemaSQL(options.schema);
      const traceEntries = await parser.parseSQLTrace(options.trace);
      const writeBatches = await parser.parseWriteBatches(options.batches);
      
      let shardingPlan = undefined;
      if (options.sharding) {
        shardingPlan = await parser.parseShardingPlan(options.sharding);
      }

      console.log(chalk.green(`   ✅ 解析完成: ${traceEntries.length} 条 Trace, ${writeBatches.length} 个批次, ${schema.tables.length} 张表`));

      if (!options.skipValidation) {
        console.log(chalk.gray('🔍 执行配置校验...'));
        const validator = new ConfigValidator();
        const validationResult = await validator.validateAll(
          dbProfile, schema, traceEntries, writeBatches, shardingPlan
        );

        if (validationResult.errors.length > 0) {
          console.log(chalk.red('\n❌ 配置校验失败，发现以下错误:'));
          for (const error of validationResult.errors) {
            console.log(chalk.red(`   • [${error.field}]: ${error.message}`));
            if (error.value !== undefined) {
              console.log(chalk.gray(`     值: ${JSON.stringify(error.value)}`));
            }
          }
          process.exit(1);
        }

        if (validationResult.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️ 配置校验警告:'));
          for (const warning of validationResult.warnings) {
            console.log(chalk.yellow(`   • [${warning.field}]: ${warning.message}`));
          }
        }

        console.log(chalk.green('   ✅ 配置校验通过'));
      }

      console.log(chalk.gray('📊 执行分析...'));
      
      const analysisEngine = new AnalysisEngine(
        dbProfile,
        schema,
        traceEntries,
        writeBatches,
        shardingPlan,
        {
          slowThresholdMs: parseInt(options.slowThreshold),
          enableShardingAnalysis: !!shardingPlan
        }
      );

      const result = analysisEngine.analyze();
      
      console.log(chalk.green('   ✅ 分析完成'));

      console.log(chalk.gray('\n📋 分析结果概览:'));
      
      const statusEmoji = result.summary.canDeploy ? chalk.green('✅') : chalk.red('🚫');
      const statusText = result.summary.canDeploy ? chalk.green('可以上线') : chalk.red('需要修复阻塞项');
      console.log(`   ${statusEmoji} 上线判定: ${statusText}`);
      console.log(`   🚫 阻塞项: ${chalk.red(result.summary.blockerCount)}`);
      console.log(`   ⚠️ 警告项: ${chalk.yellow(result.summary.warningCount)}`);
      console.log(`   ℹ️ 信息项: ${chalk.blue(result.summary.infoCount)}`);

      if (result.issues.length > 0) {
        console.log(chalk.gray('\n📝 问题详情:'));
        
        const severityColors: Record<Severity, (str: string) => string> = {
          'blocker': chalk.red,
          'warning': chalk.yellow,
          'info': chalk.blue
        };

        const groupedBySeverity = {
          blocker: result.issues.filter(i => i.severity === 'blocker'),
          warning: result.issues.filter(i => i.severity === 'warning'),
          info: result.issues.filter(i => i.severity === 'info')
        };

        for (const [severity, issues] of Object.entries(groupedBySeverity)) {
          if (issues.length > 0) {
            const colorFn = severityColors[severity as Severity];
            const label = severity === 'blocker' ? '阻塞' : severity === 'warning' ? '警告' : '信息';
            console.log(colorFn(`\n   ${label}项 (${issues.length}个):`));
            
            for (const issue of issues.slice(0, 5)) {
              console.log(colorFn(`      • ${issue.title}`));
              if (issue.affectedObjects.length > 0) {
                console.log(chalk.gray(`        影响: ${issue.affectedObjects.slice(0, 3).join(', ')}${issue.affectedObjects.length > 3 ? '...' : ''}`));
              }
            }
            
            if (issues.length > 5) {
              console.log(chalk.gray(`      ... 还有 ${issues.length - 5} 个问题`));
            }
          }
        }
      }

      if (!options.sqlite) {
        console.log(chalk.gray('\n💾 保存分析记录到 SQLite...'));
        
        const sqliteTrace = new SQLiteTrace(options.sqlitePath);
        await sqliteTrace.initialize();
        
        const sessionId = await sqliteTrace.saveAnalysisResult(result);
        sqliteTrace.close();
        
        console.log(chalk.green(`   ✅ 记录已保存, Session ID: ${sessionId}`));
      }

      console.log(chalk.gray('\n📄 生成报告...'));
      
      const reportGenerator = new ReportGenerator(result);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      
      if (options.output === 'markdown' || options.output === 'both') {
        const mdPath = path.join(options.outputDir, `analysis-report-${timestamp}.md`);
        await reportGenerator.saveMarkdown(mdPath);
        console.log(chalk.green(`   ✅ Markdown 报告: ${mdPath}`));
      }
      
      if (options.output === 'json' || options.output === 'both') {
        const jsonPath = path.join(options.outputDir, `analysis-report-${timestamp}.json`);
        await reportGenerator.saveJSON(jsonPath);
        console.log(chalk.green(`   ✅ JSON 报告: ${jsonPath}`));
      }

      console.log(chalk.green('\n🎉 分析完成!\n'));

      if (!result.summary.canDeploy) {
        console.log(chalk.red('⚠️  存在阻塞项，不建议上线。请先修复所有阻塞项后重新分析。\n'));
        process.exit(1);
      } else {
        console.log(chalk.green('✅ 没有阻塞项，可以安全上线。建议在上线前仍需仔细审查警告项。\n'));
        process.exit(0);
      }

    } catch (error) {
      console.error(chalk.red('\n❌ 执行失败:'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      console.error(chalk.gray(`\n   堆栈: ${(error as Error).stack}`));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('仅执行配置文件校验，不进行分析')
  .option('-p, --profile <path>', 'db-profile.yaml 文件路径', 'db-profile.yaml')
  .option('-s, --schema <path>', 'schema.sql 文件路径', 'schema.sql')
  .option('-t, --trace <path>', 'sql-trace.jsonl 文件路径', 'sql-trace.jsonl')
  .option('-b, --batches <path>', 'write-batches.csv 文件路径', 'write-batches.csv')
  .option('-d, --sharding <path>', 'sharding-plan.yaml 文件路径（可选）')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n🔍 执行配置校验...\n'));

      const baseDir = process.cwd();
      const parser = new ConfigParser(baseDir);

      const dbProfile = await parser.parseDBProfile(options.profile);
      const schema = await parser.parseSchemaSQL(options.schema);
      const traceEntries = await parser.parseSQLTrace(options.trace);
      const writeBatches = await parser.parseWriteBatches(options.batches);
      
      let shardingPlan = undefined;
      if (options.sharding) {
        shardingPlan = await parser.parseShardingPlan(options.sharding);
      }

      const validator = new ConfigValidator();
      const result = await validator.validateAll(
        dbProfile, schema, traceEntries, writeBatches, shardingPlan
      );

      if (result.valid) {
        console.log(chalk.green('✅ 配置校验通过'));
      } else {
        console.log(chalk.red('❌ 配置校验失败'));
      }

      if (result.errors.length > 0) {
        console.log(chalk.red(`\n错误 (${result.errors.length} 个):`));
        for (const error of result.errors) {
          console.log(chalk.red(`   • [${error.field}]: ${error.message}`));
        }
      }

      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`\n警告 (${result.warnings.length} 个):`));
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`   • [${warning.field}]: ${warning.message}`));
        }
      }

      console.log('');
      process.exit(result.valid ? 0 : 1);

    } catch (error) {
      console.error(chalk.red('\n❌ 校验失败:'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('history')
  .description('查看历史分析记录')
  .option('--sqlite-path <path>', 'SQLite 数据库路径', './analysis-trace.db')
  .option('-l, --limit <number>', '显示最近 N 条记录', '10')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n📜 历史分析记录\n'));

      const sqliteTrace = new SQLiteTrace(options.sqlitePath);
      await sqliteTrace.initialize();

      const sessions = await sqliteTrace.getRecentSessions(parseInt(options.limit));
      sqliteTrace.close();

      if (sessions.length === 0) {
        console.log(chalk.yellow('   暂无历史记录'));
        console.log('');
        return;
      }

      const tableData = [
        ['Session ID', '时间', '上线判定', '阻塞项', '警告项', '信息项']
      ];

      for (const session of sessions) {
        const status = session.canDeploy ? chalk.green('✅ 是') : chalk.red('🚫 否');
        const date = new Date(session.timestamp).toLocaleString('zh-CN');
        tableData.push([
          session.id.substring(0, 20) + '...',
          date,
          status,
          chalk.red(session.blockerCount.toString()),
          chalk.yellow(session.warningCount.toString()),
          chalk.blue(session.infoCount.toString())
        ]);
      }

      console.log(table(tableData));
      console.log('');

    } catch (error) {
      console.error(chalk.red('\n❌ 读取历史记录失败:'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('seed')
  .description('生成样例配置文件到当前目录')
  .option('--bad-config', '生成坏配置样例（用于测试校验功能）')
  .option('--force', '覆盖已存在的文件')
  .action(async (options) => {
    console.log(chalk.blue('\n🌱 生成样例配置文件...\n'));
    console.log(chalk.gray('   此命令需要手动复制样例文件到当前目录。'));
    console.log(chalk.gray('   样例文件位于 examples/seed/ 目录下。'));
    
    if (options.badConfig) {
      console.log(chalk.yellow('\n   坏配置样例位于 examples/bad-config/ 目录下。'));
    }
    
    console.log(chalk.green('\n   使用方法:'));
    console.log(chalk.gray('   cp -r examples/seed/* ./'));
    console.log(chalk.gray('   然后运行: db-gate analyze\n'));
  });

program.parse(process.argv);
