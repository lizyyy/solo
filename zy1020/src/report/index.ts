import { storage } from '../storage';
import {
  WebhookSimulation,
  WebhookDelivery,
  DeadLetterQueueItem,
  IdempotencyLedgerEntry,
} from '../types';

export interface SimulationReport {
  simulation: WebhookSimulation;
  deliveries: WebhookDelivery[];
  deadLetterItems: DeadLetterQueueItem[];
  summary: ReportSummary;
}

export interface ReportSummary {
  totalDeliveries: number;
  successful: number;
  failed: number;
  firstAttempts: number;
  duplicates: number;
  totalDurationMs: number;
  avgDurationMs: number;
  deadLetterCount: number;
}

export interface FullReport {
  simulations: WebhookSimulation[];
  allDeliveries: WebhookDelivery[];
  idempotencyLedger: IdempotencyLedgerEntry[];
  deadLetterQueue: DeadLetterQueueItem[];
  summary: {
    totalSimulations: number;
    totalDeliveries: number;
    successful: number;
    failed: number;
    deadLetterCount: number;
    pendingDeadLetters: number;
  };
}

export class ReportService {
  getSimulationReport(simulationId: string): SimulationReport | null {
    const simulation = storage.getSimulation(simulationId);
    if (!simulation) {
      return null;
    }

    const deliveries = storage.getDeliveriesBySimulation(simulationId);
    const deadLetterItems = storage.getDeadLetterItemsBySimulation(simulationId);

    const summary = this.calculateSummary(deliveries, deadLetterItems);

    return {
      simulation,
      deliveries,
      deadLetterItems,
      summary,
    };
  }

  getFullReport(): FullReport {
    const simulations = storage.getAllSimulations();
    const allDeliveries: WebhookDelivery[] = [];
    const deadLetterQueue = storage.getPendingDeadLetterItems();
    const idempotencyLedger = storage.getAllIdempotencyLedger();

    for (const simulation of simulations) {
      const deliveries = storage.getDeliveriesBySimulation(simulation.id);
      allDeliveries.push(...deliveries);
    }

    const deadLetterCount = allDeliveries.filter(d => !d.isSuccess).length;

    return {
      simulations,
      allDeliveries,
      idempotencyLedger,
      deadLetterQueue,
      summary: {
        totalSimulations: simulations.length,
        totalDeliveries: allDeliveries.length,
        successful: allDeliveries.filter(d => d.isSuccess).length,
        failed: allDeliveries.filter(d => !d.isSuccess).length,
        deadLetterCount,
        pendingDeadLetters: deadLetterQueue.filter(d => !d.isReplayed).length,
      },
    };
  }

  exportToJSON(report: SimulationReport | FullReport): string {
    return JSON.stringify(report, null, 2);
  }

  exportSimulationToMarkdown(report: SimulationReport): string {
    const { simulation, deliveries, deadLetterItems, summary } = report;

    const lines: string[] = [];

    lines.push(`# Webhook 演练报告`);
    lines.push('');
    lines.push(`## 演练信息`);
    lines.push('');
    lines.push(`| 字段 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 名称 | ${simulation.name} |`);
    lines.push(`| 策略 | ${this.formatStrategy(simulation.strategy)} |`);
    lines.push(`| 状态 | ${this.formatStatus(simulation.status)} |`);
    lines.push(`| 目标 URL | ${simulation.targetUrl} |`);
    lines.push(`| 创建时间 | ${this.formatTimestamp(simulation.createdAt)} |`);
    if (simulation.completedAt) {
      lines.push(`| 完成时间 | ${this.formatTimestamp(simulation.completedAt)} |`);
    }
    lines.push('');

    lines.push(`## 执行摘要`);
    lines.push('');
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 总投递次数 | ${summary.totalDeliveries} |`);
    lines.push(`| 成功 | ${summary.successful} |`);
    lines.push(`| 失败 | ${summary.failed} |`);
    lines.push(`| 首次处理 | ${summary.firstAttempts} |`);
    lines.push(`| 重复事件 | ${summary.duplicates} |`);
    lines.push(`| 总耗时 | ${this.formatDuration(summary.totalDurationMs)} |`);
    lines.push(`| 平均耗时 | ${this.formatDuration(summary.avgDurationMs)} |`);
    lines.push(`| 死信数量 | ${summary.deadLetterCount} |`);
    lines.push('');

    if (deliveries.length > 0) {
      lines.push(`## 投递详情`);
      lines.push('');
      lines.push(`| 事件类型 | 幂等键 | 状态 | HTTP 码 | 耗时 | 重试 | 首次 |`);
      lines.push(`|----------|--------|------|---------|------|------|------|`);
      
      for (const delivery of deliveries) {
        const status = delivery.isSuccess ? '✅ 成功' : '❌ 失败';
        const statusCode = delivery.statusCode ?? '-';
        const isFirst = delivery.isFirstAttempt ? '是' : '否';
        
        lines.push(
          `| ${delivery.eventType} | ${delivery.idempotencyKey.substring(0, 20)}... | ${status} | ${statusCode} | ${this.formatDuration(delivery.durationMs)} | ${delivery.retryCount} | ${isFirst} |`
        );
      }
      lines.push('');
    }

    if (deadLetterItems.length > 0) {
      lines.push(`## 死信队列`);
      lines.push('');
      lines.push(`| 事件类型 | 幂等键 | 错误信息 | 重试次数 | 状态 |`);
      lines.push(`|----------|--------|----------|----------|------|`);
      
      for (const item of deadLetterItems) {
        const status = item.isReplayed ? '已重放' : '待处理';
        const errorMsg = item.errorMessage.length > 50 
          ? item.errorMessage.substring(0, 50) + '...'
          : item.errorMessage;
        
        lines.push(
          `| ${item.eventType} | ${item.idempotencyKey.substring(0, 20)}... | ${errorMsg} | ${item.retryCount} | ${status} |`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  exportFullReportToMarkdown(report: FullReport): string {
    const { simulations, allDeliveries, idempotencyLedger, deadLetterQueue, summary } = report;

    const lines: string[] = [];

    lines.push(`# Webhook 演练服务总报告`);
    lines.push('');
    lines.push(`## 总览`);
    lines.push('');
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 演练次数 | ${summary.totalSimulations} |`);
    lines.push(`| 总投递次数 | ${summary.totalDeliveries} |`);
    lines.push(`| 成功 | ${summary.successful} |`);
    lines.push(`| 失败 | ${summary.failed} |`);
    lines.push(`| 死信数量 | ${summary.deadLetterCount} |`);
    lines.push(`| 待处理死信 | ${summary.pendingDeadLetters} |`);
    lines.push('');

    if (simulations.length > 0) {
      lines.push(`## 演练列表`);
      lines.push('');
      lines.push(`| 名称 | 策略 | 状态 | 投递数 | 创建时间 |`);
      lines.push(`|------|------|------|--------|----------|`);
      
      for (const sim of simulations) {
        const deliveryCount = allDeliveries.filter(d => d.simulationId === sim.id).length;
        lines.push(
          `| ${sim.name} | ${this.formatStrategy(sim.strategy)} | ${this.formatStatus(sim.status)} | ${deliveryCount} | ${this.formatTimestamp(sim.createdAt)} |`
        );
      }
      lines.push('');
    }

    if (idempotencyLedger.length > 0) {
      lines.push(`## 幂等账本`);
      lines.push('');
      lines.push(`| 幂等键 | 事件类型 | 首次投递时间 | 总投递次数 |`);
      lines.push(`|--------|----------|--------------|------------|`);
      
      for (const entry of idempotencyLedger) {
        lines.push(
          `| ${entry.idempotencyKey.substring(0, 30)}... | ${entry.eventType} | ${this.formatTimestamp(entry.firstDeliveredAt)} | ${entry.totalDeliveries} |`
        );
      }
      lines.push('');
    }

    if (deadLetterQueue.length > 0) {
      lines.push(`## 待处理死信`);
      lines.push('');
      lines.push(`| 事件类型 | 幂等键 | 错误信息 | 最后尝试 |`);
      lines.push(`|----------|--------|----------|----------|`);
      
      for (const item of deadLetterQueue) {
        if (item.isReplayed) continue;
        const errorMsg = item.errorMessage.length > 40 
          ? item.errorMessage.substring(0, 40) + '...'
          : item.errorMessage;
        
        lines.push(
          `| ${item.eventType} | ${item.idempotencyKey.substring(0, 20)}... | ${errorMsg} | ${this.formatTimestamp(item.lastAttemptAt)} |`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private calculateSummary(
    deliveries: WebhookDelivery[],
    deadLetterItems: DeadLetterQueueItem[]
  ): ReportSummary {
    const totalDurationMs = deliveries.reduce((sum, d) => sum + d.durationMs, 0);

    return {
      totalDeliveries: deliveries.length,
      successful: deliveries.filter(d => d.isSuccess).length,
      failed: deliveries.filter(d => !d.isSuccess).length,
      firstAttempts: deliveries.filter(d => d.isFirstAttempt).length,
      duplicates: deliveries.filter(d => !d.isFirstAttempt).length,
      totalDurationMs,
      avgDurationMs: deliveries.length > 0 ? Math.round(totalDurationMs / deliveries.length) : 0,
      deadLetterCount: deadLetterItems.length,
    };
  }

  private formatStrategy(strategy: string): string {
    const mapping: Record<string, string> = {
      normal: '正常顺序',
      out_of_order: '乱序投递',
      duplicate: '重复投递',
      delayed: '延迟投递',
      signature_error: '签名错误',
      partial_failure: '部分失败',
    };
    return mapping[strategy] || strategy;
  }

  private formatStatus(status: string): string {
    const mapping: Record<string, string> = {
      pending: '待开始',
      running: '进行中',
      completed: '已完成',
      failed: '失败',
    };
    return mapping[status] || status;
  }

  private formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString('zh-CN');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

export const reportService = new ReportService();
