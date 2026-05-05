import { SQLiteStore } from '../store/sqlite';
import { Analyzer } from '../analysis/analyzer';
import { Recommender } from '../analysis/recommender';
import chalk from 'chalk';
import Table from 'cli-table3';

export interface AnalyzeOptions {
  runId?: string;
  db: string;
}

export default async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const store = new SQLiteStore(options.db);
  
  const result = options.runId
    ? await store.getSimulationResult(options.runId)
    : await store.getLatestSimulationResult();
  
  if (!result) {
    throw new Error('未找到模拟结果，请先运行 mq-stress simulate');
  }
  
  console.log(chalk.bold(`\n📊 模拟结果分析 - 运行ID: ${result.runId}`));
  console.log(`   开始时间: ${new Date(result.startTime).toLocaleString()}`);
  console.log(`   结束时间: ${new Date(result.endTime).toLocaleString()}`);
  
  const analyzer = new Analyzer(result);
  const analysis = analyzer.analyze();
  
  const recommender = new Recommender(result, analysis);
  const recommendations = recommender.generate();
  
  printSummary(analysis);
  printBacklogAnalysis(analysis);
  printOrderAnalysis(analysis);
  printDuplicationAnalysis(analysis);
  printLatencyAnalysis(analysis);
  printRecommendations(recommendations);
}

function printSummary(analysis: any): void {
  console.log(chalk.bold('\n📈 关键指标'));
  const table = new Table({
    head: ['指标', '数值', '描述'],
    colWidths: [25, 20, 35],
  });
  
  table.push(
    ['消息生产总数', analysis.summary.totalMessagesProduced.toString(), '模拟期间生成的消息总数'],
    ['消息消费总数', analysis.summary.totalMessagesConsumed.toString(), '成功消费的消息数'],
    ['死信消息数', analysis.summary.totalDeadLetterMessages.toString(), '进入死信队列的消息数'],
    ['重复消息数', analysis.summary.totalDuplicateMessages.toString(), '检测到的重复消息数'],
    ['乱序消息数', analysis.summary.totalOutOfOrderMessages.toString(), '检测到的乱序消息数'],
    ['最大积压', analysis.summary.maxLag.toString(), '模拟期间的最大消息积压'],
    ['平均积压', analysis.summary.avgLag.toFixed(2), '平均消息积压量'],
    ['最大延迟', `${analysis.summary.maxLatency}s`, '最大消费延迟（秒）'],
    ['平均延迟', `${analysis.summary.avgLatency.toFixed(2)}s`, '平均消费延迟（秒）'],
  );
  
  console.log(table.toString());
}

function printBacklogAnalysis(analysis: any): void {
  console.log(chalk.bold('\n📦 积压分析'));
  const table = new Table({
    head: ['指标', '数值'],
    colWidths: [25, 30],
  });
  
  table.push(
    ['峰值积压', analysis.backlogAnalysis.peakBacklog.toString()],
    ['峰值时间', `第 ${analysis.backlogAnalysis.peakTime} 秒`],
    ['积压持续时间', `${analysis.backlogAnalysis.backlogDuration} 秒`],
    ['恢复时间', `${analysis.backlogAnalysis.recoveryTime} 秒`],
  );
  
  console.log(table.toString());
}

function printOrderAnalysis(analysis: any): void {
  const riskColors: Record<string, chalk.Chalk> = {
    low: chalk.green,
    medium: chalk.yellow,
    high: chalk.red,
    critical: chalk.red,
  };
  
  console.log(chalk.bold('\n🔄 顺序消费分析'));
  const table = new Table({
    head: ['指标', '数值'],
    colWidths: [25, 30],
  });
  
  table.push(
    ['乱序消息数', analysis.orderAnalysis.outOfOrderCount.toString()],
    ['乱序率', `${(analysis.orderAnalysis.outOfOrderRate * 100).toFixed(2)}%`],
    ['受影响的 Key 数', analysis.orderAnalysis.affectedKeys.length.toString()],
    ['风险等级', riskColors[analysis.orderAnalysis.riskLevel](analysis.orderAnalysis.riskLevel.toUpperCase())],
  );
  
  console.log(table.toString());
}

function printDuplicationAnalysis(analysis: any): void {
  const riskColors: Record<string, chalk.Chalk> = {
    low: chalk.green,
    medium: chalk.yellow,
    high: chalk.red,
    critical: chalk.red,
  };
  
  console.log(chalk.bold('\n🔁 重复消息分析'));
  const table = new Table({
    head: ['指标', '数值'],
    colWidths: [25, 30],
  });
  
  table.push(
    ['重复消息数', analysis.duplicationAnalysis.duplicateCount.toString()],
    ['重复率', `${(analysis.duplicationAnalysis.duplicateRate * 100).toFixed(2)}%`],
    ['受影响的幂等 Key 数', analysis.duplicationAnalysis.affectedIdempotentKeys.length.toString()],
    ['风险等级', riskColors[analysis.duplicationAnalysis.riskLevel](analysis.duplicationAnalysis.riskLevel.toUpperCase())],
  );
  
  console.log(table.toString());
}

function printLatencyAnalysis(analysis: any): void {
  console.log(chalk.bold('\n⏱️ 消费延迟分析'));
  const table = new Table({
    head: ['指标', '数值'],
    colWidths: [25, 30],
  });
  
  table.push(
    ['平均延迟', `${analysis.latencyAnalysis.avgLatency.toFixed(2)}s`],
    ['最大延迟', `${analysis.latencyAnalysis.maxLatency}s`],
    ['P50 延迟', `${analysis.latencyAnalysis.p50.toFixed(2)}s`],
    ['P95 延迟', `${analysis.latencyAnalysis.p95.toFixed(2)}s`],
    ['P99 延迟', `${analysis.latencyAnalysis.p99.toFixed(2)}s`],
  );
  
  console.log(table.toString());
}

function printRecommendations(recommendations: any[]): void {
  const severityColors: Record<string, chalk.Chalk> = {
    low: chalk.gray,
    medium: chalk.yellow,
    high: chalk.red,
    critical: chalk.red.bold,
  };
  
  const typeIcons: Record<string, string> = {
    idempotency: '🔐',
    scaling: '📈',
    throttling: '🚦',
    ordering: '🔢',
    retry: '🔄',
    deadLetter: '💀',
  };
  
  console.log(chalk.bold('\n💡 优化建议'));
  
  if (recommendations.length === 0) {
    console.log(chalk.green('  ✓ 当前配置表现良好，无需特别优化建议。'));
    return;
  }
  
  recommendations.forEach((rec, idx) => {
    const icon = typeIcons[rec.type] || '📋';
    const color = severityColors[rec.severity];
    
    console.log(`\n  ${idx + 1}. ${icon} ${color(rec.title)} [${rec.severity.toUpperCase()}]`);
    console.log(`     描述: ${rec.description}`);
    console.log(`     建议: ${chalk.cyan(rec.action)}`);
  });
}
