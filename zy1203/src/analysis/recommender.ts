import {
  SimulationResult,
  AnalysisResult,
  Recommendation,
} from '../types';

export class Recommender {
  private result: SimulationResult;
  private analysis: AnalysisResult;

  constructor(result: SimulationResult, analysis: AnalysisResult) {
    this.result = result;
    this.analysis = analysis;
  }

  generate(): Recommendation[] {
    const recommendations: Recommendation[] = [];

    recommendations.push(...this.checkBacklog());
    recommendations.push(...this.checkOrdering());
    recommendations.push(...this.checkDuplication());
    recommendations.push(...this.checkLatency());
    recommendations.push(...this.checkDeadLetter());
    recommendations.push(...this.checkFailures());

    return recommendations.sort((a, b) => {
      const priority: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priority[b.severity] || 0) - (priority[a.severity] || 0);
    });
  }

  private checkBacklog(): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const backlog = this.analysis.backlogAnalysis;
    const summary = this.analysis.summary;

    if (backlog.peakBacklog > 1000) {
      recommendations.push({
        type: 'scaling',
        severity: backlog.peakBacklog > 5000 ? 'high' : 'medium',
        title: '消息堆积严重',
        description: `模拟期间峰值消息堆积达到 ${backlog.peakBacklog} 条，发生在第 ${backlog.peakTime} 秒。堆积持续时间为 ${backlog.backlogDuration} 秒。`,
        action: this.generateScalingRecommendation(),
      });
    }

    if (backlog.recoveryTime > 60) {
      recommendations.push({
        type: 'scaling',
        severity: backlog.recoveryTime > 180 ? 'high' : 'medium',
        title: '堆积恢复缓慢',
        description: `从峰值堆积恢复需要 ${backlog.recoveryTime} 秒，超过了正常范围。`,
        action: '考虑增加消费者数量、提高消费速率，或启用自动扩缩容功能。',
      });
    }

    return recommendations;
  }

  private checkOrdering(): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const ordering = this.analysis.orderAnalysis;

    if (ordering.outOfOrderCount > 0) {
      const severity = this.getSeverity(ordering.riskLevel);
      
      recommendations.push({
        type: 'ordering',
        severity,
        title: '检测到消息乱序',
        description: `检测到 ${ordering.outOfOrderCount} 条乱序消息（占比 ${(ordering.outOfOrderRate * 100).toFixed(2)}%），影响 ${ordering.affectedKeys.length} 个顺序键。`,
        action: this.generateOrderingRecommendation(),
      });
    }

    return recommendations;
  }

  private checkDuplication(): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const duplication = this.analysis.duplicationAnalysis;

    if (duplication.duplicateCount > 0) {
      const severity = this.getSeverity(duplication.riskLevel);
      
      recommendations.push({
        type: 'idempotency',
        severity,
        title: '检测到重复消息',
        description: `检测到 ${duplication.duplicateCount} 条重复消息（占比 ${(duplication.duplicateRate * 100).toFixed(2)}%），影响 ${duplication.affectedIdempotentKeys.length} 个幂等键。`,
        action: this.generateIdempotencyRecommendation(),
      });
    }

    return recommendations;
  }

  private checkLatency(): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const latency = this.analysis.latencyAnalysis;

    if (latency.p95 > 30) {
      recommendations.push({
        type: 'throttling',
        severity: latency.p99 > 60 ? 'high' : 'medium',
        title: '消费延迟过高',
        description: `P95 消费延迟为 ${latency.p95.toFixed(2)} 秒，P99 延迟为 ${latency.p99.toFixed(2)} 秒，超过正常范围。`,
        action: this.generateLatencyRecommendation(),
      });
    }

    return recommendations;
  }

  private checkDeadLetter(): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const summary = this.analysis.summary;

    if (summary.totalDeadLetterMessages > 0) {
      const rate = summary.totalDeadLetterMessages / summary.totalMessagesProduced;
      const severity = rate > 0.05 ? 'high' : rate > 0.01 ? 'medium' : 'low';
      
      recommendations.push({
        type: 'deadLetter',
        severity,
        title: '存在死信消息',
        description: `有 ${summary.totalDeadLetterMessages} 条消息进入死信队列，需要人工介入处理。`,
        action: this.generateDeadLetterRecommendation(),
      });
    }

    return recommendations;
  }

  private checkFailures(): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const failure = this.analysis.failureAnalysis;

    if (failure.consumerCrashes > 0) {
      recommendations.push({
        type: 'scaling',
        severity: failure.maxRecoveryTime > 60 ? 'high' : 'medium',
        title: '消费者故障检测',
        description: `模拟期间发生 ${failure.consumerCrashes} 次消费者宕机，平均恢复时间 ${failure.avgRecoveryTime.toFixed(2)} 秒，最大恢复时间 ${failure.maxRecoveryTime} 秒。`,
        action: this.generateFailureRecommendation(),
      });
    }

    return recommendations;
  }

  private getSeverity(level: 'low' | 'medium' | 'high'): Recommendation['severity'] {
    return level;
  }

  private generateScalingRecommendation(): string {
    const consumerGroups = this.result.config.consumers;
    const suggestions: string[] = [];

    for (const cg of consumerGroups) {
      if (!cg.scaling.enableAutoScaling) {
        suggestions.push(`- 为消费者组 "${cg.name}" 启用自动扩缩容 (enableAutoScaling: true)`);
      } else {
        if (cg.scaling.maxConsumers <= cg.consumers) {
          suggestions.push(`- 增加消费者组 "${cg.name}" 的最大消费者数量 (当前: ${cg.scaling.maxConsumers})`);
        }
        if (cg.scaling.targetLag < 100) {
          suggestions.push(`- 考虑提高消费者组 "${cg.name}" 的目标堆积阈值 (当前: ${cg.scaling.targetLag})`);
        }
      }
      
      if (cg.consumeRate < cg.maxConsumeRate) {
        suggestions.push(`- 可提高消费者组 "${cg.name}" 的基础消费速率 (当前: ${cg.consumeRate}/s, 最大: ${cg.maxConsumeRate}/s)`);
      }
    }

    if (suggestions.length === 0) {
      return '考虑增加分区数量或增加消费者组来提升整体消费能力。';
    }

    return suggestions.join('\n    ');
  }

  private generateOrderingRecommendation(): string {
    return [
      '1. 确保使用分区键进行消息分区，同一业务键的消息发送到同一分区',
      '2. 消费者组内的消费者数量不应超过分区数量',
      '3. 如果需要严格顺序，考虑使用单分区或专用顺序主题',
      '4. 检查是否存在消费者宕机导致的 rebalance 引发的乱序',
      '5. 应用层面实现最终一致性补偿机制',
    ].join('\n    ');
  }

  private generateIdempotencyRecommendation(): string {
    return [
      '1. 使用数据库唯一约束（如幂等键字段设为唯一索引）',
      '2. 实现分布式锁或乐观锁机制',
      '3. 在消费端维护已处理消息 ID 缓存',
      '4. 使用事务保证操作原子性',
      '5. 设计业务操作天然幂等（如使用 UPDATE ... WHERE 而非 INSERT）',
    ].join('\n    ');
  }

  private generateLatencyRecommendation(): string {
    return [
      '1. 检查消费逻辑是否存在 I/O 阻塞或耗时操作',
      '2. 考虑增加消费者数量并行消费',
      '3. 检查是否存在消费者慢消费导致的级联延迟',
      '4. 优化消费端数据库查询，添加适当索引',
      '5. 考虑使用限流策略保护下游服务',
    ].join('\n    ');
  }

  private generateDeadLetterRecommendation(): string {
    return [
      '1. 查看死信队列中的消息，分析失败原因',
      '2. 检查重试策略配置（maxAttempts 是否合理）',
      '3. 考虑实现死信消息补偿流程或人工审核机制',
      '4. 分析是否需要对特定失败类型增加重试次数',
      '5. 设置死信队列监控告警，及时发现异常',
    ].join('\n    ');
  }

  private generateFailureRecommendation(): string {
    const suggestions: string[] = [];
    
    for (const cg of this.result.config.consumers) {
      if (cg.failure.recoveryTime > 30) {
        suggestions.push(`- 缩短消费者组 "${cg.name}" 的恢复时间 (当前: ${cg.failure.recoveryTime}s)`);
      }
      if (cg.consumers <= 1) {
        suggestions.push(`- 增加消费者组 "${cg.name}" 的消费者数量以实现高可用`);
      }
    }

    suggestions.push('- 实现健康检查和自动重启机制');
    suggestions.push('- 部署多实例消费者提高容错能力');

    return suggestions.join('\n    ');
  }
}
