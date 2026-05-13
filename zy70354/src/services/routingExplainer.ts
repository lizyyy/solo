import { ShardTarget, WriteRoutingResult, QueryRoutingResult, QueryPlan } from '../types';
import { configService } from './configService';

class RoutingExplainer {
  explainShardTarget(target: ShardTarget): string {
    return `目标库：${target.database}，目标表：${target.table}，分片ID：${target.shardId}。原因：${target.reason}`;
  }

  explainWriteRouting(result: WriteRoutingResult): Record<string, any> {
    const explanation: Record<string, any> = {
      requestId: result.requestId,
      timestamp: result.timestamp,
      tenantContext: {
        tenantId: result.tenantConfig.tenantId,
        migrationStatus: result.tenantConfig.migrationStatus,
        isMigrationInProgress: result.isMigrationInProgress,
      },
      routingStrategy: {
        writeStrategy: result.writeStrategy,
        requiresDualWrite: result.requiresDualWrite,
        requiresCompensation: result.requiresCompensation,
        isIdempotentWrite: result.isIdempotentWrite,
      },
      routingKeyAnalysis: this.analyzeRoutingKey(result.routingKey),
      targetBreakdown: {
        primaryTarget: result.primaryTarget ? this.explainShardTarget(result.primaryTarget) : null,
        alternativeTargets: result.alternativeTargets.map(t => this.explainShardTarget(t)),
      },
      auditSummary: {
        totalAuditRecords: result.auditRecords.length,
        operations: result.auditRecords.map(r => ({
          action: r.action,
          shardId: r.shardId,
          timestamp: r.timestamp,
        })),
      },
    };

    if (result.conflictResolution) {
      explanation.conflictResolution = result.conflictResolution;
    }

    if (result.warnings && result.warnings.length > 0) {
      explanation.warnings = result.warnings;
    }

    if (result.errors && result.errors.length > 0) {
      explanation.errors = result.errors;
    }

    return explanation;
  }

  explainQueryRouting(result: QueryRoutingResult): Record<string, any> {
    const explanation: Record<string, any> = {
      requestId: result.requestId,
      timestamp: result.timestamp,
      tenantContext: {
        tenantId: result.tenantConfig.tenantId,
        migrationStatus: result.tenantConfig.migrationStatus,
        isMigrationInProgress: result.isMigrationInProgress,
      },
      routingStrategy: {
        readStrategy: result.readStrategy,
        requiresDualRead: result.requiresDualRead,
      },
      routingKeyAnalysis: this.analyzeRoutingKey(result.routingKey),
      targetBreakdown: {
        primaryTarget: result.primaryTarget ? this.explainShardTarget(result.primaryTarget) : null,
        alternativeTargets: result.alternativeTargets.map(t => this.explainShardTarget(t)),
      },
      auditSummary: {
        totalAuditRecords: result.auditRecords.length,
        operations: result.auditRecords.map(r => ({
          action: r.action,
          shardId: r.shardId,
          timestamp: r.timestamp,
        })),
      },
    };

    if (result.queryPlan) {
      explanation.queryPlan = this.explainQueryPlan(result.queryPlan);
    }

    if (result.conflictResolution) {
      explanation.conflictResolution = result.conflictResolution;
    }

    if (result.warnings && result.warnings.length > 0) {
      explanation.warnings = result.warnings;
    }

    if (result.errors && result.errors.length > 0) {
      explanation.errors = result.errors;
    }

    return explanation;
  }

  explainQueryPlan(plan: QueryPlan): Record<string, any> {
    return {
      planId: plan.planId,
      originalQuery: plan.originalQuery,
      executionStrategy: plan.executionStrategy,
      estimatedShardCount: plan.estimatedShardCount,
      totalSteps: plan.totalSteps,
      steps: plan.steps.map((step, index) => ({
        stepNumber: step.order,
        stepId: step.stepId,
        description: step.description,
        reason: step.reason,
        timeRange: step.timeRange,
        canExecuteInParallel: step.canExecuteInParallel,
        shardInfo: {
          shardId: step.shardId,
          database: step.database,
          table: step.table,
        },
      })),
      executionOrder: this.generateExecutionOrder(plan),
      warnings: plan.warnings || [],
    };
  }

  private analyzeRoutingKey(routingKey: {
    tenantId: string;
    timestamp?: number;
    orderId?: string;
    customKeys?: Record<string, string>;
  }): Record<string, any> {
    const analysis: Record<string, any> = {
      provided: {
        tenantId: routingKey.tenantId ? '✓ 已提供' : '✗ 缺失',
        timestamp: routingKey.timestamp ? `✓ 已提供 (${new Date(routingKey.timestamp).toISOString()})` : '✗ 缺失',
        orderId: routingKey.orderId ? `✓ 已提供 (${routingKey.orderId})` : '✗ 缺失',
      },
      qualityScore: 0,
      issues: [],
      recommendations: [],
    };

    let score = 0;
    if (routingKey.tenantId) score += 40;
    if (routingKey.timestamp) score += 30;
    if (routingKey.orderId) score += 30;

    analysis.qualityScore = score;

    if (!routingKey.tenantId) {
      analysis.issues.push('缺少租户ID，这是必须的路由键');
      analysis.recommendations.push('请提供 tenantId 参数');
    }

    if (!routingKey.timestamp) {
      analysis.issues.push('缺少时间戳，对于月度分片规则很重要');
      analysis.recommendations.push('对于按时间分片的租户，请提供 createdAt 字段');
    }

    if (!routingKey.orderId) {
      analysis.issues.push('缺少订单ID，可能影响查询定位效率');
      analysis.recommendations.push('对于精确查询，请提供 orderId');
    }

    return analysis;
  }

  private generateExecutionOrder(plan: QueryPlan): string[] {
    const steps = plan.steps.sort((a, b) => a.order - b.order);
    const order: string[] = [];

    const parallelGroups: number[][] = [];
    let currentGroup: number[] = [];

    steps.forEach((step, index) => {
      if (step.canExecuteInParallel) {
        currentGroup.push(index);
      } else {
        if (currentGroup.length > 0) {
          parallelGroups.push(currentGroup);
          currentGroup = [];
        }
        parallelGroups.push([index]);
      }
    });

    if (currentGroup.length > 0) {
      parallelGroups.push(currentGroup);
    }

    parallelGroups.forEach((group, groupIndex) => {
      if (group.length === 1) {
        order.push(`第 ${groupIndex + 1} 步：顺序执行 ${steps[group[0]].description}`);
      } else {
        const descriptions = group.map(i => steps[i].description).join(', ');
        order.push(`第 ${groupIndex + 1} 步：并行执行 [${descriptions}]`);
      }
    });

    return order;
  }
}

export const routingExplainer = new RoutingExplainer();
