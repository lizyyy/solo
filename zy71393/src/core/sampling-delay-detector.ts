import { EventLogEntry, Issue, IssueSeverity } from '../types';
import { ValidationConfig } from '../types';

export interface SamplingDelayResult {
  hasDelay: boolean;
  averageDelayMs: number;
  maxDelayMs: number;
  minDelayMs: number;
  firstSeen: number;
  lastSeen: number;
  totalDurationMs: number;
}

export class SamplingDelayDetector {
  private config: ValidationConfig;

  constructor(config: ValidationConfig) {
    this.config = config;
  }

  detect(entries: EventLogEntry[]): { result: SamplingDelayResult; issues: Issue[] } {
    const issues: Issue[] = [];
    
    if (entries.length === 0) {
      return {
        result: {
          hasDelay: false,
          averageDelayMs: 0,
          maxDelayMs: 0,
          minDelayMs: 0,
          firstSeen: 0,
          lastSeen: 0,
          totalDurationMs: 0
        },
        issues
      };
    }

    const timestamps = entries.map(e => e.timestamp).sort((a, b) => a - b);
    const firstSeen = timestamps[0];
    const lastSeen = timestamps[timestamps.length - 1];
    const totalDurationMs = lastSeen - firstSeen;

    const delays: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      delays.push(timestamps[i] - timestamps[i - 1]);
    }

    const averageDelayMs = delays.length > 0 
      ? delays.reduce((a, b) => a + b, 0) / delays.length 
      : 0;
    const maxDelayMs = delays.length > 0 ? Math.max(...delays) : 0;
    const minDelayMs = delays.length > 0 ? Math.min(...delays) : 0;

    const hasDelay = maxDelayMs > this.config.samplingDelayThresholdMs;

    if (hasDelay) {
      issues.push(this.createDelayIssue(entries, maxDelayMs, averageDelayMs));
    }

    return {
      result: {
        hasDelay,
        averageDelayMs,
        maxDelayMs,
        minDelayMs,
        firstSeen,
        lastSeen,
        totalDurationMs
      },
      issues
    };
  }

  private createDelayIssue(
    entries: EventLogEntry[],
    maxDelayMs: number,
    averageDelayMs: number
  ): Issue {
    const eventIds = [...new Set(entries.map(e => e.eventId))];
    const eventNames = [...new Set(entries.map(e => e.eventName))];

    return {
      id: `sampling-delay-${Date.now()}`,
      type: 'sampling_delay',
      severity: this.getDelaySeverity(maxDelayMs),
      eventId: eventIds[0],
      eventName: eventNames[0],
      message: `检测到采样延迟: 最大 ${this.formatDelay(maxDelayMs)}，平均 ${this.formatDelay(averageDelayMs)}`,
      reason: `事件采集间隔超过阈值 (${this.formatDelay(this.config.samplingDelayThresholdMs)})。可能原因：采样率过低、网络拥塞、批量上报延迟、或事件触发频率不均匀。`,
      impactScope: [
        `事件数: ${entries.length}`,
        `最大延迟: ${this.formatDelay(maxDelayMs)}`,
        `平均延迟: ${this.formatDelay(averageDelayMs)}`,
        `阈值: ${this.formatDelay(this.config.samplingDelayThresholdMs)}`,
        `事件ID: ${eventIds.join(', ')}`
      ],
      nextActions: [
        `1. 检查埋点SDK的上报策略（实时/批量/定时）`,
        `2. 确认采样率配置是否合理`,
        `3. 分析网络请求日志是否存在拥塞`,
        `4. 如是预期行为，可调高延迟阈值`,
        `5. 检查事件触发场景是否均匀分布`
      ],
      expected: this.config.samplingDelayThresholdMs,
      actual: maxDelayMs
    };
  }

  private getDelaySeverity(delayMs: number): IssueSeverity {
    const threshold = this.config.samplingDelayThresholdMs;
    const ratio = delayMs / threshold;
    
    if (ratio >= 5) return 'critical';
    if (ratio >= 3) return 'high';
    if (ratio >= 2) return 'medium';
    return 'low';
  }

  private formatDelay(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }
}
