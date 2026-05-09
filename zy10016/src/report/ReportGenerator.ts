import {
  StressTestResult,
  LogEntry,
  SystemInfo,
} from '../types';
import { Logger } from '../logging/Logger';
import { CacheManager, CacheStatistics } from '../cache/CacheManager';
import { StateManager } from '../state/StateManager';

export interface ReportContext {
  title: string;
  generatedAt: string;
  systemInfo: SystemInfo;
  loggerStats?: ReturnType<Logger['getStatistics']>;
  cacheStats?: CacheStatistics;
  conflictsReport?: ReturnType<StateManager['getConflictsReport']>;
  stressTestResult?: StressTestResult;
  recentErrors?: LogEntry[];
  recentLogs?: LogEntry[];
}

export class ReportGenerator {
  generate(context: ReportContext): string {
    const sections: string[] = [];

    sections.push(this.generateHeader(context));
    sections.push(this.generateSystemInfo(context));

    if (context.loggerStats) {
      sections.push(this.generateLoggerStats(context.loggerStats));
    }

    if (context.conflictsReport && context.conflictsReport.totalConflicts > 0) {
      sections.push(this.generateConflictsReport(context.conflictsReport));
    }

    if (context.cacheStats) {
      sections.push(this.generateCacheStats(context.cacheStats));
    }

    if (context.stressTestResult) {
      sections.push(this.generateStressTestReport(context.stressTestResult));
    }

    if (context.recentErrors && context.recentErrors.length > 0) {
      sections.push(this.generateRecentErrors(context.recentErrors));
    }

    if (context.recentLogs && context.recentLogs.length > 0) {
      sections.push(this.generateRecentLogs(context.recentLogs));
    }

    sections.push(this.generateFooter());

    return sections.join('\n\n---\n\n');
  }

  private generateHeader(context: ReportContext): string {
    return `# ${context.title}

**生成时间**: ${context.generatedAt}
`;
  }

  private generateSystemInfo(context: ReportContext): string {
    const { systemInfo } = context;

    return `## 系统信息

| 项目 | 值 |
|------|-----|
| Node.js 版本 | ${systemInfo.nodeVersion} |
| 平台 | ${systemInfo.platform} |
| 进程 ID | ${systemInfo.pid} |
| 运行时间 | ${this.formatDuration(systemInfo.uptime * 1000)} |
| 内存使用 (RSS) | ${this.formatBytes(systemInfo.memory.rss)} |
| 堆总大小 | ${this.formatBytes(systemInfo.memory.heapTotal)} |
| 堆已用 | ${this.formatBytes(systemInfo.memory.heapUsed)} |
| 外部内存 | ${this.formatBytes(systemInfo.memory.external)} |
`;
  }

  private generateLoggerStats(stats: ReturnType<Logger['getStatistics']>): string {
    const successRate = stats.totalOperations > 0
      ? ((stats.successfulOperations / stats.totalOperations) * 100).toFixed(2)
      : '0.00';

    return `## 数据库操作统计

| 指标 | 值 |
|------|-----|
| 总操作数 | ${stats.totalOperations} |
| 成功操作 | ${stats.successfulOperations} |
| 失败操作 | ${stats.failedOperations} |
| 成功率 | ${successRate}% |
| 锁冲突错误 | ${stats.lockErrors} |
| 重试次数 | ${stats.retries} |
| 平均延迟 | ${stats.avgLatencyMs.toFixed(2)} ms |
`;
  }

  private generateConflictsReport(
    report: ReturnType<StateManager['getConflictsReport']>
  ): string {
    let content = `## 锁冲突报告

| 指标 | 值 |
|------|-----|
| 历史冲突总数 | ${report.totalConflicts} |
| 当前活动冲突 | ${report.activeConflicts} |
`;

    if (report.conflictDetails.length > 0) {
      content += `

### 活动冲突详情

| 资源 ID | 锁类型 | 持有连接数 | 等待连接数 | 最后活动时间 |
|---------|--------|-----------|-----------|-------------|
`;

      for (const detail of report.conflictDetails) {
        content += `| ${detail.resourceId.slice(0, 8)}... | ${detail.lockType} | ${detail.holding.length} | ${detail.waiting.length} | ${new Date(detail.lastActivity).toISOString()} |
`;
      }
    }

    return content;
  }

  private generateCacheStats(stats: CacheStatistics): string {
    const hitRate = (stats.hitRate * 100).toFixed(2);

    return `## 缓存统计

| 指标 | 值 |
|------|-----|
| 缓存命中 | ${stats.hits} |
| 缓存未命中 | ${stats.misses} |
| 命中率 | ${hitRate}% |
| 缓存条目 | ${stats.totalEntries} |
| 淘汰条目 | ${stats.evictions} |
| 失效条目 | ${stats.invalidations} |
`;
  }

  private generateStressTestReport(result: StressTestResult): string {
    const successRate = result.totalOperations > 0
      ? ((result.successfulOperations / result.totalOperations) * 100).toFixed(2)
      : '0.00';

    let content = `## 压力测试结果

### 总体指标

| 指标 | 值 |
|------|-----|
| 总操作数 | ${result.totalOperations} |
| 成功操作 | ${result.successfulOperations} |
| 失败操作 | ${result.failedOperations} |
| 成功率 | ${successRate}% |
| 锁冲突 | ${result.lockErrors} |
| 总耗时 | ${this.formatDuration(result.totalDurationMs)} |
| 每秒操作数 (OPS) | ${result.operationsPerSecond.toFixed(2)} |
`;

    content += `

### 延迟统计

| 指标 | 值 |
|------|-----|
| 平均延迟 | ${result.avgLatencyMs.toFixed(2)} ms |
| P95 延迟 | ${result.p95LatencyMs.toFixed(2)} ms |
| P99 延迟 | ${result.p99LatencyMs.toFixed(2)} ms |
`;

    if (result.errors.length > 0) {
      content += `

### 错误详情

| 序号 | 时间 | 类型 | 消息 |
|------|------|------|------|
`;

      const topErrors = result.errors.slice(0, 20);
      topErrors.forEach((err, index) => {
        content += `| ${index + 1} | ${new Date(err.timestamp).toISOString()} | ${err.isLockError ? '🔒 锁冲突' : '❌ 其他'} | ${err.message.substring(0, 80)}${err.message.length > 80 ? '...' : ''} |
`;
      });
    }

    return content;
  }

  private generateRecentErrors(errors: LogEntry[]): string {
    let content = `## 最近错误 (${errors.length} 条)

| 序号 | 时间 | 操作类型 | 状态 | 锁类型 | 耗时 | 错误消息 |
|------|------|----------|------|--------|------|----------|
`;

    errors.slice(0, 20).forEach((err, index) => {
      content += `| ${index + 1} | ${new Date(err.timestamp).toISOString()} | ${err.operationType} | ${err.status} | ${err.lockState.lockType} | ${err.duration || '-'} ms | ${err.error?.message?.substring(0, 60) || '-'} |
`;
    });

    return content;
  }

  private generateRecentLogs(logs: LogEntry[]): string {
    let content = `## 最近操作日志 (${logs.length} 条)

| 序号 | 时间 | 操作类型 | 状态 | 耗时 | 重试 |
|------|------|----------|------|------|------|
`;

    logs.slice(0, 30).forEach((log, index) => {
      content += `| ${index + 1} | ${new Date(log.timestamp).toISOString()} | ${log.operationType} | ${log.status} | ${log.duration || '-'} ms | ${log.retryCount || '-'} |
`;
    });

    return content;
  }

  private generateFooter(): string {
    return `## 备注

- 此报告由 SQLite WAL 锁冲突处理系统自动生成
- 所有时间戳均使用 ISO 8601 格式
- 内存单位按国际标准（1KB = 1000 bytes）计算
`;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60 * 1000) return `${(ms / 1000).toFixed(2)} 秒`;
    if (ms < 60 * 60 * 1000) return `${(ms / (60 * 1000)).toFixed(2)} 分钟`;
    return `${(ms / (60 * 60 * 1000)).toFixed(2)} 小时`;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1000) return `${bytes} B`;
    if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(2)} KB`;
    if (bytes < 1000 * 1000 * 1000) return `${(bytes / (1000 * 1000)).toFixed(2)} MB`;
    return `${(bytes / (1000 * 1000 * 1000)).toFixed(2)} GB`;
  }
}
