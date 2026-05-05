import * as fs from 'fs';
import {
  SimulationResult,
  AnalysisResult,
  Recommendation,
} from '../types';

export async function exportToMarkdown(
  result: SimulationResult,
  analysis: AnalysisResult,
  recommendations: Recommendation[],
  outputPath: string
): Promise<void> {
  const content = generateMarkdownContent(result, analysis, recommendations);
  fs.writeFileSync(outputPath, content, 'utf-8');
}

function generateMarkdownContent(
  result: SimulationResult,
  analysis: AnalysisResult,
  recommendations: Recommendation[]
): string {
  const lines: string[] = [];
  
  lines.push(`# 消息队列压测复盘报告`);
  lines.push('');
  lines.push(`> 运行ID: ${result.runId}`);
  lines.push(`> 生成时间: ${new Date().toLocaleString()}`);
  lines.push(`> 模拟开始: ${new Date(result.startTime).toLocaleString()}`);
  lines.push(`> 模拟结束: ${new Date(result.endTime).toLocaleString()}`);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 📊 执行摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 消息生产总数 | ${analysis.summary.totalMessagesProduced.toLocaleString()} |`);
  lines.push(`| 消息消费总数 | ${analysis.summary.totalMessagesConsumed.toLocaleString()} |`);
  lines.push(`| 死信消息数 | ${analysis.summary.totalDeadLetterMessages.toLocaleString()} |`);
  lines.push(`| 重复消息数 | ${analysis.summary.totalDuplicateMessages.toLocaleString()} |`);
  lines.push(`| 乱序消息数 | ${analysis.summary.totalOutOfOrderMessages.toLocaleString()} |`);
  lines.push(`| 最大积压 | ${analysis.summary.maxLag.toLocaleString()} 条 |`);
  lines.push(`| 平均积压 | ${analysis.summary.avgLag.toFixed(2)} 条 |`);
  lines.push(`| 最大延迟 | ${analysis.summary.maxLatency} 秒 |`);
  lines.push(`| 平均延迟 | ${analysis.summary.avgLatency.toFixed(2)} 秒 |`);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 📦 积压分析');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 峰值积压 | ${analysis.backlogAnalysis.peakBacklog.toLocaleString()} 条 |`);
  lines.push(`| 峰值时间 | 第 ${analysis.backlogAnalysis.peakTime} 秒 |`);
  lines.push(`| 积压持续时间 | ${analysis.backlogAnalysis.backlogDuration} 秒 |`);
  lines.push(`| 恢复时间 | ${analysis.backlogAnalysis.recoveryTime} 秒 |`);
  lines.push('');
  
  lines.push('### 积压曲线数据');
  lines.push('');
  lines.push('```');
  lines.push('时间(秒) | 总积压量');
  lines.push('---------|---------');
  
  const sampleRate = Math.max(1, Math.floor(result.timeSeries.length / 20));
  for (let i = 0; i < result.timeSeries.length; i += sampleRate) {
    const ts = result.timeSeries[i];
    lines.push(`${ts.time.toString().padStart(8)} | ${ts.totalLag.toLocaleString().padStart(8)}`);
  }
  lines.push('```');
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 🔄 顺序消费分析');
  lines.push('');
  
  const orderRiskColor = {
    low: '🟢 低',
    medium: '🟡 中',
    high: '🔴 高',
  };
  
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 乱序消息数 | ${analysis.orderAnalysis.outOfOrderCount.toLocaleString()} |`);
  lines.push(`| 乱序率 | ${(analysis.orderAnalysis.outOfOrderRate * 100).toFixed(2)}% |`);
  lines.push(`| 受影响的 Key 数 | ${analysis.orderAnalysis.affectedKeys.length} |`);
  lines.push(`| 风险等级 | ${orderRiskColor[analysis.orderAnalysis.riskLevel]} |`);
  lines.push('');
  
  if (analysis.orderAnalysis.affectedKeys.length > 0) {
    lines.push('### 受影响的顺序键（前10个）');
    lines.push('');
    lines.push('- ' + analysis.orderAnalysis.affectedKeys.slice(0, 10).join('\n- '));
    if (analysis.orderAnalysis.affectedKeys.length > 10) {
      lines.push(`  ... 还有 ${analysis.orderAnalysis.affectedKeys.length - 10} 个`);
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push('## 🔁 重复消息分析');
  lines.push('');
  
  const dupRiskColor = {
    low: '🟢 低',
    medium: '🟡 中',
    high: '🔴 高',
  };
  
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 重复消息数 | ${analysis.duplicationAnalysis.duplicateCount.toLocaleString()} |`);
  lines.push(`| 重复率 | ${(analysis.duplicationAnalysis.duplicateRate * 100).toFixed(2)}% |`);
  lines.push(`| 受影响的幂等 Key 数 | ${analysis.duplicationAnalysis.affectedIdempotentKeys.length} |`);
  lines.push(`| 风险等级 | ${dupRiskColor[analysis.duplicationAnalysis.riskLevel]} |`);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## ⏱️ 消费延迟分析');
  lines.push('');
  
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 平均延迟 | ${analysis.latencyAnalysis.avgLatency.toFixed(2)} 秒 |`);
  lines.push(`| 最大延迟 | ${analysis.latencyAnalysis.maxLatency} 秒 |`);
  lines.push(`| P50 延迟 | ${analysis.latencyAnalysis.p50.toFixed(2)} 秒 |`);
  lines.push(`| P95 延迟 | ${analysis.latencyAnalysis.p95.toFixed(2)} 秒 |`);
  lines.push(`| P99 延迟 | ${analysis.latencyAnalysis.p99.toFixed(2)} 秒 |`);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 💀 故障分析');
  lines.push('');
  
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 消费者宕机次数 | ${analysis.failureAnalysis.consumerCrashes} |`);
  lines.push(`| 平均恢复时间 | ${analysis.failureAnalysis.avgRecoveryTime.toFixed(2)} 秒 |`);
  lines.push(`| 最大恢复时间 | ${analysis.failureAnalysis.maxRecoveryTime} 秒 |`);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 💡 优化建议');
  lines.push('');
  
  if (recommendations.length === 0) {
    lines.push('✅ 当前配置表现良好，无需特别优化建议。');
  } else {
    const typeIcons: Record<string, string> = {
      idempotency: '🔐 幂等处理',
      scaling: '📈 扩容方案',
      throttling: '🚦 限流方案',
      ordering: '🔢 顺序保障',
      retry: '🔄 重试策略',
      deadLetter: '💀 死信处理',
    };
    
    const severityIcons: Record<string, string> = {
      critical: '🔴 严重',
      high: '🔴 高',
      medium: '🟡 中',
      low: '🟢 低',
    };
    
    for (const rec of recommendations) {
      lines.push(`### ${typeIcons[rec.type] || '📋'} - ${rec.title} [${severityIcons[rec.severity]}]`);
      lines.push('');
      lines.push(`**描述:** ${rec.description}`);
      lines.push('');
      lines.push('**建议:**');
      lines.push('');
      lines.push(rec.action.split('\n').map(line => `  ${line}`).join('\n'));
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }
  
  lines.push('---');
  lines.push('');
  lines.push('## 📋 配置信息');
  lines.push('');
  
  lines.push('### Topic 配置');
  lines.push('');
  lines.push('| Topic | 分区数 | 保留时间(秒) |');
  lines.push('|-------|--------|--------------|');
  for (const topic of result.config.plan.topics) {
    lines.push(`| ${topic.name} | ${topic.partitions} | ${topic.retention.toLocaleString()} |`);
  }
  lines.push('');
  
  lines.push('### 生产者配置');
  lines.push('');
  lines.push('| Topic | 基准速率 | 突发速率 | 开始时间 | 持续时间 |');
  lines.push('|-------|----------|----------|----------|----------|');
  for (const producer of result.config.producers) {
    lines.push(`| ${producer.topic} | ${producer.rate}/s | ${producer.burstRate}/s | ${producer.startTime}s | ${producer.duration}s |`);
  }
  lines.push('');
  
  lines.push('### 消费者配置');
  lines.push('');
  lines.push('| 消费者组 | 基准消费速率 | 最大消费速率 | 自动扩缩容 |');
  lines.push('|----------|--------------|--------------|------------|');
  for (const cg of result.config.consumers) {
    const autoScale = cg.scaling.enableAutoScaling ? '✅ 启用' : '❌ 禁用';
    lines.push(`| ${cg.name} | ${cg.consumeRate}/s | ${cg.maxConsumeRate}/s | ${autoScale} |`);
  }
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('*报告生成完毕*');
  lines.push('');
  
  return lines.join('\n');
}
