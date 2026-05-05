import * as fs from 'fs';
import {
  SimulationResult,
  AnalysisResult,
  Recommendation,
  ExportReport,
} from '../types';

export async function exportToJson(
  result: SimulationResult,
  analysis: AnalysisResult,
  recommendations: Recommendation[],
  outputPath: string
): Promise<void> {
  const report: ExportReport = {
    runId: result.runId,
    generatedAt: Date.now(),
    summary: analysis.summary,
    analysis: {
      backlogAnalysis: analysis.backlogAnalysis,
      orderAnalysis: analysis.orderAnalysis,
      duplicationAnalysis: analysis.duplicationAnalysis,
      latencyAnalysis: analysis.latencyAnalysis,
      failureAnalysis: analysis.failureAnalysis,
    },
    recommendations,
    keyMetrics: generateKeyMetrics(analysis),
  };
  
  const content = JSON.stringify(report, null, 2);
  fs.writeFileSync(outputPath, content, 'utf-8');
}

function generateKeyMetrics(analysis: AnalysisResult): ExportReport['keyMetrics'] {
  return [
    {
      name: '消息生产总数',
      value: analysis.summary.totalMessagesProduced.toLocaleString(),
      description: '模拟期间生成的消息总数',
    },
    {
      name: '消息消费总数',
      value: analysis.summary.totalMessagesConsumed.toLocaleString(),
      description: '成功消费的消息数',
    },
    {
      name: '死信消息数',
      value: analysis.summary.totalDeadLetterMessages.toLocaleString(),
      description: '进入死信队列的消息数',
    },
    {
      name: '重复消息数',
      value: analysis.summary.totalDuplicateMessages.toLocaleString(),
      description: '检测到的重复消息数',
    },
    {
      name: '乱序消息数',
      value: analysis.summary.totalOutOfOrderMessages.toLocaleString(),
      description: '检测到的乱序消息数',
    },
    {
      name: '最大积压',
      value: `${analysis.summary.maxLag.toLocaleString()} 条`,
      description: '模拟期间的最大消息积压',
    },
    {
      name: '平均积压',
      value: `${analysis.summary.avgLag.toFixed(2)} 条`,
      description: '平均消息积压量',
    },
    {
      name: '最大延迟',
      value: `${analysis.summary.maxLatency} 秒`,
      description: '最大消费延迟（秒）',
    },
    {
      name: '平均延迟',
      value: `${analysis.summary.avgLatency.toFixed(2)} 秒`,
      description: '平均消费延迟（秒）',
    },
    {
      name: 'P95 延迟',
      value: `${analysis.latencyAnalysis.p95.toFixed(2)} 秒`,
      description: '95% 分位消费延迟',
    },
    {
      name: 'P99 延迟',
      value: `${analysis.latencyAnalysis.p99.toFixed(2)} 秒`,
      description: '99% 分位消费延迟',
    },
    {
      name: '消费者宕机次数',
      value: analysis.failureAnalysis.consumerCrashes.toString(),
      description: '模拟期间发生的消费者宕机次数',
    },
  ];
}
