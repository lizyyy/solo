#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

import { generateSampleData, saveGeneratedData, loadGeneratedData } from './dataGenerator.js';
import { fullAudit } from './auditDetector.js';
import { exportToJSON, exportToMarkdown, saveJSON, saveMarkdown } from './exporter.js';
import { generateCleanupCandidates, generateRollbackCandidates, multiFilter, saveCandidates } from './candidateManager.js';
import { generateSummaryReport, summaryReportToMarkdown, summaryReportToJSON } from './summaryReport.js';

const program = new Command();

program
  .name('lab-audit')
  .description('实验室样本单审核工具 - 启动参数检查、脏行识别、异常导出')
  .version('1.0.0');

program
  .command('generate')
  .description('生成测试用的实验室样本单数据（包含脏行被吞的情况）')
  .option('-c, --count <number>', '生成的样本数量', '50')
  .option('-b, --batch-id <id>', '批次ID', `BATCH${Date.now()}`)
  .option('-o, --operator <name>', '操作者姓名', '张医生')
  .option('--no-dirty', '不包含脏行数据')
  .option('-O, --output <path>', '输出文件路径', './data/sample_data.json')
  .action(async (options) => {
    console.log(chalk.blue('正在生成实验室样本单数据...'));
    
    try {
      const data = generateSampleData({
        batchId: options.batchId,
        recordCount: parseInt(options.count),
        includeDirtyRows: options.dirty,
        operator: options.operator
      });
      
      const outputPath = path.resolve(options.output);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await saveGeneratedData(data, outputPath);
      
      console.log(chalk.green('✅ 数据生成成功！'));
      console.log(chalk.cyan(`  批次ID: ${data.batchId}`));
      console.log(chalk.cyan(`  样本总数: ${data.totalRecords}`));
      console.log(chalk.cyan(`  脏行数量: ${data.dirtyRecords}`));
      console.log(chalk.cyan(`  输出文件: ${outputPath}`));
    } catch (error) {
      console.error(chalk.red('❌ 数据生成失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('audit')
  .description('审核实验室样本单数据，识别脏行和异常')
  .argument('<inputFile>', '输入数据文件路径')
  .option('--json', '以JSON格式输出审核结果')
  .option('--markdown', '以Markdown格式输出审核报告')
  .option('-O, --output <path>', '输出文件路径')
  .action(async (inputFile, options) => {
    console.log(chalk.blue('正在审核实验室样本单数据...'));
    
    try {
      const data = await loadGeneratedData(inputFile);
      const auditResult = fullAudit(data);
      
      console.log(chalk.green('✅ 审核完成！'));
      console.log(chalk.cyan(`  批次ID: ${auditResult.batchId}`));
      console.log(chalk.cyan(`  原始数据总行数: ${auditResult.summary.totalRawRows}`));
      console.log(chalk.cyan(`  正常行数: ${auditResult.summary.cleanRows}`));
      console.log(chalk.red(`  脏行数: ${auditResult.summary.dirtyRows}`));
      console.log(chalk.red(`    - 被吞掉的脏行数: ${auditResult.summary.swallowedRows}`));
      console.log(chalk.yellow(`    - 格式错误行数: ${auditResult.summary.malformedRows}`));
      console.log(chalk.cyan(`  样本总数: ${auditResult.summary.totalSamples}`));
      console.log(chalk.yellow(`  含异常的样本数: ${auditResult.summary.samplesWithAnomalies}`));
      
      if (options.json) {
        const exportData = exportToJSON(auditResult);
        const outputPath = options.output || './exports/audit_result.json';
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await saveJSON(exportData, outputPath);
        console.log(chalk.green(`\n✅ JSON结果已保存到: ${outputPath}`));
      }
      
      if (options.markdown) {
        const mdContent = exportToMarkdown(auditResult);
        const outputPath = options.output || './exports/audit_report.md';
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await saveMarkdown(mdContent, outputPath);
        console.log(chalk.green(`✅ Markdown报告已保存到: ${outputPath}`));
      }
    } catch (error) {
      console.error(chalk.red('❌ 审核失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('candidates')
  .description('生成清理/回滚候选清单')
  .argument('<auditFile>', '审核结果文件路径')
  .option('--type <type>', '候选清单类型: cleanup/rollback', 'cleanup')
  .option('--severity <level>', '最低严重程度: critical/high/medium/low', 'medium')
  .option('-O, --output <path>', '输出文件路径')
  .action(async (auditFile, options) => {
    console.log(chalk.blue('正在生成候选清单...'));
    
    try {
      const auditResult = await loadGeneratedData(auditFile);
      let candidates;
      
      if (options.type === 'cleanup') {
        candidates = generateCleanupCandidates(auditResult, {
          minSeverity: options.severity
        });
      } else {
        console.log(chalk.yellow('⚠️  回滚候选清单需要原始数据和处理后数据进行对比'));
        console.log(chalk.gray('   使用相同数据进行模拟对比...'));
        candidates = generateRollbackCandidates(auditResult, auditResult);
      }
      
      const outputPath = options.output || `./exports/${options.type}_candidates.json`;
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await saveCandidates(candidates, outputPath);
      
      console.log(chalk.green('✅ 候选清单生成成功！'));
      console.log(chalk.cyan(`  候选总数: ${candidates.totalCandidates}`));
      if (candidates.bySeverity) {
        console.log(chalk.red(`    - Critical: ${candidates.bySeverity.critical}`));
        console.log(chalk.yellow(`    - High: ${candidates.bySeverity.high}`));
        console.log(chalk.cyan(`    - Medium: ${candidates.bySeverity.medium}`));
        console.log(chalk.green(`    - Low: ${candidates.bySeverity.low}`));
      }
      console.log(chalk.green(`  输出文件: ${outputPath}`));
    } catch (error) {
      console.error(chalk.red('❌ 生成候选清单失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('summary')
  .description('生成摘要报告（按业务单号整合异常、修正、结论）')
  .argument('<auditFile>', '审核结果文件路径')
  .option('--gateway-logs <path>', '网关日志文件路径，用于检测网关错误')
  .option('--json', '以JSON格式输出')
  .option('--markdown', '以Markdown格式输出')
  .option('-O, --output <path>', '输出文件路径')
  .action(async (auditFile, options) => {
    console.log(chalk.blue('正在生成摘要报告...'));
    
    try {
      const auditResult = await loadGeneratedData(auditFile);
      
      let gatewayLogs = '';
      if (options.gatewayLogs) {
        try {
          gatewayLogs = await fs.readFile(options.gatewayLogs, 'utf8');
        } catch {
          console.log(chalk.yellow('⚠️  无法读取网关日志文件，跳过网关错误检测'));
        }
      }
      
      const report = generateSummaryReport(auditResult, gatewayLogs);
      
      console.log(chalk.green('✅ 摘要报告生成成功！'));
      console.log(chalk.cyan(`  报告ID: ${report.reportId}`));
      console.log(chalk.cyan(`  异常业务单号数量: ${report.summary.totalBusinessNos}`));
      console.log(chalk.cyan(`  总异常数: ${report.summary.totalAnomalies}`));
      console.log(chalk.red(`  网关错误数: ${report.summary.gatewayErrors}`));
      console.log(chalk.red(`    - Critical: ${report.summary.byLevel.critical}`));
      console.log(chalk.yellow(`    - High: ${report.summary.byLevel.high}`));
      console.log(chalk.cyan(`    - Medium: ${report.summary.byLevel.medium}`));
      
      if (options.json) {
        const jsonData = summaryReportToJSON(report);
        const outputPath = options.output || './exports/summary_report.json';
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await saveJSON(jsonData, outputPath);
        console.log(chalk.green(`\n✅ JSON报告已保存到: ${outputPath}`));
      }
      
      if (options.markdown) {
        const mdContent = summaryReportToMarkdown(report);
        const outputPath = options.output || './exports/summary_report.md';
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await saveMarkdown(mdContent, outputPath);
        console.log(chalk.green(`✅ Markdown报告已保存到: ${outputPath}`));
      }
    } catch (error) {
      console.error(chalk.red('❌ 生成摘要报告失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('filter')
  .description('按条件过滤历史审核记录')
  .argument('<historyFile>', '历史记录文件路径')
  .option('--batch <id>', '按批次ID过滤')
  .option('--operator <name>', '按操作者姓名过滤')
  .option('--risk <type>', '按风险类型过滤: 正常/低风险/中风险/高风险')
  .option('--anomaly <type>', '按异常类型过滤: swallowed/malformed/missing_fields/data_anomaly')
  .option('-O, --output <path>', '输出文件路径')
  .action(async (historyFile, options) => {
    console.log(chalk.blue('正在过滤历史记录...'));
    
    try {
      const history = await loadGeneratedData(historyFile);
      const historyArray = Array.isArray(history) ? history : [history];
      
      const filters = {};
      if (options.batch) filters.batchId = options.batch;
      if (options.operator) filters.operator = options.operator;
      if (options.risk) filters.riskType = options.risk;
      if (options.anomaly) filters.anomalyType = options.anomaly;
      
      const results = multiFilter(historyArray, filters);
      
      console.log(chalk.green('✅ 过滤完成！'));
      console.log(chalk.cyan(`  原始记录数: ${historyArray.length}`));
      console.log(chalk.cyan(`  匹配记录数: ${results.length}`));
      
      if (results.length > 0) {
        const outputPath = options.output || './exports/filtered_results.json';
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await saveJSON(results, outputPath);
        console.log(chalk.green(`  输出文件: ${outputPath}`));
      }
    } catch (error) {
      console.error(chalk.red('❌ 过滤失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('run-all')
  .description('执行完整流程：生成数据 → 审核 → 生成候选清单 → 生成摘要报告')
  .option('-c, --count <number>', '生成的样本数量', '50')
  .option('--no-gateway', '不生成网关错误检测')
  .action(async (options) => {
    console.log(chalk.blue('=' .repeat(60)));
    console.log(chalk.blue('开始执行完整审核流程'));
    console.log(chalk.blue('=' .repeat(60)));
    
    try {
      const batchId = `BATCH${Date.now()}`;
      
      console.log(chalk.blue('\n[1/4] 生成测试数据...'));
      const data = generateSampleData({
        batchId,
        recordCount: parseInt(options.count),
        includeDirtyRows: true,
        operator: '张医生'
      });
      const dataPath = './data/sample_data.json';
      await fs.mkdir(path.dirname(dataPath), { recursive: true });
      await saveGeneratedData(data, dataPath);
      console.log(chalk.green(`✅ 数据已保存到: ${dataPath}`));
      
      console.log(chalk.blue('\n[2/4] 执行审核...'));
      const auditResult = fullAudit(data);
      const auditPath = './exports/audit_result.json';
      await fs.mkdir(path.dirname(auditPath), { recursive: true });
      await saveJSON(exportToJSON(auditResult), auditPath);
      console.log(chalk.green(`✅ 审核结果已保存到: ${auditPath}`));
      
      const mdAuditPath = './exports/audit_report.md';
      await saveMarkdown(exportToMarkdown(auditResult), mdAuditPath);
      console.log(chalk.green(`✅ 审核报告已保存到: ${mdAuditPath}`));
      
      console.log(chalk.blue('\n[3/4] 生成清理候选清单...'));
      const candidates = generateCleanupCandidates(auditResult);
      const candidatesPath = './exports/cleanup_candidates.json';
      await saveCandidates(candidates, candidatesPath);
      console.log(chalk.green(`✅ 候选清单已保存到: ${candidatesPath}`));
      
      console.log(chalk.blue('\n[4/4] 生成摘要报告...'));
      const gatewayLogs = options.gateway ? 'GW001 timeout connecting to server' : '';
      const report = generateSummaryReport(auditResult, gatewayLogs);
      
      const reportJsonPath = './exports/summary_report.json';
      await saveJSON(summaryReportToJSON(report), reportJsonPath);
      console.log(chalk.green(`✅ 摘要报告(JSON)已保存到: ${reportJsonPath}`));
      
      const reportMdPath = './exports/summary_report.md';
      await saveMarkdown(summaryReportToMarkdown(report), reportMdPath);
      console.log(chalk.green(`✅ 摘要报告(Markdown)已保存到: ${reportMdPath}`));
      
      console.log(chalk.green('\n' + '=' .repeat(60)));
      console.log(chalk.green('✅ 完整流程执行成功！'));
      console.log(chalk.green('=' .repeat(60)));
      console.log(chalk.cyan('\n  批次ID: ' + batchId));
      console.log(chalk.cyan(`  总样本数: ${data.totalRecords}`));
      console.log(chalk.red(`  发现异常: ${auditResult.allAnomalies.length}`));
      console.log(chalk.yellow(`  清理候选: ${candidates.totalCandidates}`));
      console.log(chalk.cyan('\n  所有输出文件位于: ./exports/'));
      
    } catch (error) {
      console.error(chalk.red('\n❌ 流程执行失败:'), error.message);
      console.error(chalk.red(error.stack));
      process.exit(1);
    }
  });

program.parse();
