const storage = require('./storage');

const CONFIG = {
  productionSpikeThreshold: 2.0,
  consumptionDropThreshold: 0.5,
  failureRateThreshold: 0.1,
  retryLoopThreshold: 3,
  heartbeatTimeout: 60000,
  partitionHotspotThreshold: 3.0,
  backlogThreshold: 1000,
  backlogGrowthThreshold: 1.5
};

function calculateMetricsSummary(queueName) {
  const metrics = storage.getQueueMetrics(queueName);
  if (metrics.length < 2) return null;
  const recent = metrics.slice(-30);
  const older = metrics.slice(-60, -30);
  const current = recent.length > 0 ? recent[recent.length - 1] : null;
  const avgProduceRate = average(recent.map(m => m.produceRate));
  const avgConsumeRate = average(recent.map(m => m.consumeRate));
  const olderProduceRate = older.length > 0 ? average(older.map(m => m.produceRate)) : avgProduceRate;
  const olderConsumeRate = older.length > 0 ? average(older.map(m => m.consumeRate)) : avgConsumeRate;
  const failureRate = current ? (current.failureCount || 0) / Math.max(current.consumeRate, 1) : 0;
  const netGrowthRate = current ? current.produceRate - current.consumeRate : 0;
  return {
    current,
    avgProduceRate,
    avgConsumeRate,
    olderProduceRate,
    olderConsumeRate,
    failureRate,
    netGrowthRate,
    recent,
    older
  };
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function checkProductionSpike(summary) {
  if (!summary) return null;
  const ratio = summary.avgProduceRate / Math.max(summary.olderProduceRate, 1);
  if (ratio >= CONFIG.productionSpikeThreshold && summary.netGrowthRate > 0) {
    return {
      cause: 'production_spike',
      severity: 'high',
      description: '生产速率突增',
      evidence: [
        `当前生产速率: ${summary.avgProduceRate.toFixed(2)} msg/s`,
        `历史生产速率: ${summary.olderProduceRate.toFixed(2)} msg/s`,
        `增长倍数: ${ratio.toFixed(2)}x`,
        `净增长速率: ${summary.netGrowthRate.toFixed(2)} msg/s`
      ],
      suggestions: [
        {
          action: '扩容消费者',
          evidence: `生产速率从 ${summary.olderProduceRate.toFixed(2)} 突增至 ${summary.avgProduceRate.toFixed(2)}`,
          priority: 'high'
        },
        {
          action: '检查流量来源',
          evidence: '生产速率突增可能源于上游业务洪峰或异常',
          priority: 'medium'
        }
      ],
      manualChecks: [
        '上游系统是否有活动促销或异常流量',
        '是否有新业务上线导致生产突增'
      ]
    };
  }
  return null;
}

function checkConsumptionDrop(summary) {
  if (!summary) return null;
  if (summary.olderConsumeRate === 0) return null;
  const ratio = summary.avgConsumeRate / Math.max(summary.olderConsumeRate, 1);
  if (ratio <= CONFIG.consumptionDropThreshold && summary.netGrowthRate > 0) {
    return {
      cause: 'consumption_drop',
      severity: 'high',
      description: '消费速率下降',
      evidence: [
        `当前消费速率: ${summary.avgConsumeRate.toFixed(2)} msg/s`,
        `历史消费速率: ${summary.olderConsumeRate.toFixed(2)} msg/s`,
        `下降比例: ${((1 - ratio) * 100).toFixed(2)}%`,
        `净增长速率: ${summary.netGrowthRate.toFixed(2)} msg/s`
      ],
      suggestions: [
        {
          action: '检查消费者健康状态',
          evidence: `消费速率从 ${summary.olderConsumeRate.toFixed(2)} 下降至 ${summary.avgConsumeRate.toFixed(2)}`,
          priority: 'high'
        },
        {
          action: '检查消费者日志',
          evidence: '消费速率下降可能由消费者异常或资源不足导致',
          priority: 'medium'
        }
      ],
      manualChecks: [
        '消费者进程是否存活',
        '消费者CPU/内存是否正常',
        '是否有报错日志'
      ]
    };
  }
  return null;
}

function checkConsumerOffline(groupId, summary) {
  const heartbeat = storage.getLatestHeartbeat(groupId);
  const now = Date.now();
  if (!heartbeat || (now - heartbeat.timestamp) > CONFIG.heartbeatTimeout) {
    return {
      cause: 'consumer_offline',
      severity: 'critical',
      description: '消费者掉线',
      evidence: [
        heartbeat ? `最后心跳时间: ${new Date(heartbeat.timestamp).toISOString()}` : '无心跳记录',
        `心跳超时阈值: ${CONFIG.heartbeatTimeout / 1000}s`,
        `队列积压: ${summary?.current?.backlogCount || 0} msg`
      ],
      suggestions: [
        {
          action: '重启消费者',
          evidence: heartbeat ? `心跳超时超过 ${CONFIG.heartbeatTimeout / 1000}s` : '消费者无心跳',
          priority: 'critical'
        },
        {
          action: '检查消费者部署',
          evidence: '消费者可能已崩溃或被调度器驱逐',
          priority: 'high'
        }
      ],
      manualChecks: [
        '消费者实例数量是否正常',
        '消费者是否有OOM或crash',
        '网络连接是否正常'
      ]
    };
  }
  return null;
}

function checkFailureRate(summary, queueName) {
  if (!summary) return null;
  const samples = storage.getFailureSamples(queueName);
  const recentFailures = samples.filter(s => Date.now() - s.timestamp < 5 * 60 * 1000);
  if (summary.failureRate >= CONFIG.failureRateThreshold && recentFailures.length >= 3) {
    return {
      cause: 'failure_rate_spike',
      severity: 'high',
      description: '失败率升高',
      evidence: [
        `当前失败率: ${(summary.failureRate * 100).toFixed(2)}%`,
        `失败率阈值: ${CONFIG.failureRateThreshold * 100}%`,
        `近5分钟失败样本数: ${recentFailures.length}`,
        `最近失败原因: ${recentFailures.length > 0 ? recentFailures[0].errorMessage : '未知'}`
      ],
      suggestions: [
        {
          action: '隔离坏消息',
          evidence: `失败率达到 ${(summary.failureRate * 100).toFixed(2)}%，存在坏消息可能`,
          priority: 'high'
        },
        {
          action: '查看失败样本',
          evidence: `近5分钟有 ${recentFailures.length} 条失败消息`,
          priority: 'high'
        }
      ],
      manualChecks: [
        '失败消息的具体错误原因',
        '是否是系统性问题',
        '下游依赖服务是否正常'
      ]
    };
  }
  return null;
}

function checkRetryLoop(queueName) {
  const retryStatus = storage.getRetryQueueStatus(queueName + '-retry');
  if (!retryStatus) return null;
  const highRetryMessages = (retryStatus.messages || []).filter(m => (m.retryCount || 0) >= CONFIG.retryLoopThreshold);
  if (highRetryMessages.length > 0) {
    return {
      cause: 'retry_loop',
      severity: 'critical',
      description: '重试队列循环',
      evidence: [
        `重试队列积压: ${retryStatus.totalCount || 0} msg`,
        `重试次数>=${CONFIG.retryLoopThreshold}的消息数: ${highRetryMessages.length}`,
        `最大重试次数: ${Math.max(...highRetryMessages.map(m => m.retryCount || 0))}`
      ],
      suggestions: [
        {
          action: '清理重试循环消息',
          evidence: `发现 ${highRetryMessages.length} 条消息陷入重试循环`,
          priority: 'critical'
        },
        {
          action: '死信队列处理',
          evidence: '将无法处理的消息移入死信队列',
          priority: 'high'
        }
      ],
      manualChecks: [
        '重试消息的具体内容',
        '为什么这些消息无法被消费成功',
        '是否需要业务介入处理'
      ]
    };
  }
  return null;
}

function checkPartitionHotspot(queueName) {
  const metrics = storage.getQueueMetrics(queueName);
  if (metrics.length === 0) return null;
  const latest = metrics[metrics.length - 1];
  if (!latest.partitionMetrics) return null;
  const partitionBacklogs = latest.partitionMetrics.map(p => p.backlogCount || 0);
  if (partitionBacklogs.length < 2) return null;
  const avgBacklog = average(partitionBacklogs);
  const maxBacklog = Math.max(...partitionBacklogs);
  const ratio = maxBacklog / Math.max(avgBacklog, 1);
  if (ratio >= CONFIG.partitionHotspotThreshold) {
    const hotPartition = latest.partitionMetrics.findIndex(p => (p.backlogCount || 0) === maxBacklog);
    return {
      cause: 'partition_hotspot',
      severity: 'medium',
      description: '单分区热点',
      evidence: [
        `热点分区: ${hotPartition}`,
        `热点分区积压: ${maxBacklog} msg`,
        `平均分区积压: ${avgBacklog.toFixed(2)} msg`,
        `热点倍数: ${ratio.toFixed(2)}x`
      ],
      suggestions: [
        {
          action: '检查消息分区键分布',
          evidence: `分区 ${hotPartition} 存在热点`,
          priority: 'medium'
        },
        {
          action: '优化分区策略',
          evidence: `热点倍数达到 ${ratio.toFixed(2)}x`,
          priority: 'medium'
        }
      ],
      manualChecks: [
        '是否有特定key集中发送',
        '分区数量是否足够',
        '是否需要重新分区'
      ]
    };
  }
  return null;
}

function analyze(queueName, consumerGroupId) {
  const summary = calculateMetricsSummary(queueName);
  const rootCauses = [];
  const metrics = storage.getQueueMetrics(queueName);
  const current = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  if (!current) {
    return {
      queueName,
      status: 'no_data',
      backlogCount: 0,
      rootCauses: [],
      overallStatus: 'unknown',
      overallDescription: '暂无数据',
      timestamp: Date.now()
    };
  }
  const consumerOffline = checkConsumerOffline(consumerGroupId, summary);
  if (consumerOffline) rootCauses.push(consumerOffline);
  const retryLoop = checkRetryLoop(queueName);
  if (retryLoop) rootCauses.push(retryLoop);
  const productionSpike = checkProductionSpike(summary);
  if (productionSpike) rootCauses.push(productionSpike);
  const consumptionDrop = checkConsumptionDrop(summary);
  if (consumptionDrop && !consumerOffline) rootCauses.push(consumptionDrop);
  const failureRate = checkFailureRate(summary, queueName);
  if (failureRate) rootCauses.push(failureRate);
  const partitionHotspot = checkPartitionHotspot(queueName);
  if (partitionHotspot) rootCauses.push(partitionHotspot);
  let overallStatus = 'normal';
  let overallDescription = '队列状态正常';
  if (rootCauses.length > 0) {
    const highestSeverity = rootCauses.reduce((max, rc) => {
      const order = { critical: 3, high: 2, medium: 1 };
      return order[rc.severity] > order[max] ? rc.severity : max;
    }, 'medium');
    overallStatus = highestSeverity === 'critical' ? 'critical' : 
                   highestSeverity === 'high' ? 'warning' : 'warning';
    overallDescription = rootCauses.map(rc => rc.description).join('；');
  } else if (current.backlogCount > CONFIG.backlogThreshold) {
    overallStatus = 'warning';
    overallDescription = `队列积压超过阈值: ${current.backlogCount} msg`;
  }
  const allSuggestions = [];
  const allManualChecks = [];
  const allEvidence = [];
  rootCauses.forEach(rc => {
    allSuggestions.push(...rc.suggestions);
    allManualChecks.push(...rc.manualChecks);
    allEvidence.push(...rc.evidence);
  });
  return {
    queueName,
    consumerGroupId,
    status: overallStatus,
    backlogCount: current.backlogCount || 0,
    produceRate: current.produceRate || 0,
    consumeRate: current.consumeRate || 0,
    rootCauses: rootCauses.map(rc => ({
      cause: rc.cause,
      description: rc.description,
      evidence: rc.evidence
    })),
    overallStatus,
    overallDescription,
    suggestions: allSuggestions,
    manualChecks: [...new Set(allManualChecks)],
    evidence: allEvidence,
    timestamp: Date.now()
  };
}

function shouldGenerateAlert(diagnosis) {
  return diagnosis.status === 'critical' || diagnosis.status === 'warning';
}

function shouldReopenAlert(alert, diagnosis) {
  if (alert.status !== 'acknowledged') return false;
  return diagnosis.status === 'critical';
}

module.exports = {
  CONFIG,
  analyze,
  shouldGenerateAlert,
  shouldReopenAlert
};
