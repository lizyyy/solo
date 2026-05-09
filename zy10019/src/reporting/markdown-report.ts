import { PoolReport, ReportSection, PoolMetrics, HealthCheckResult, EventRecord } from '../types';

export interface ReportOptions {
  title?: string;
  includeMetrics?: boolean;
  includeErrors?: boolean;
  includeEvents?: boolean;
  includeRecommendations?: boolean;
  maxEvents?: number;
}

export class MarkdownReport {
  private title: string;
  private sections: ReportSection[];

  constructor(title: string = 'Connection Pool Report') {
    this.title = title;
    this.sections = [];
  }

  addSection(section: ReportSection): void {
    this.sections.push(section);
  }

  addMetricsSection(title: string, level: number, content: string): void {
    this.sections.push({ title, level, content });
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString();
  }

  private formatNumber(num: number): string {
    if (Number.isInteger(num)) {
      return num.toLocaleString();
    }
    return num.toFixed(2);
  }

  private formatPercent(num: number): string {
    return `${(num * 100).toFixed(2)}%`;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)} ms`;
    }
    return `${(ms / 1000).toFixed(2)} s`;
  }

  addSummary(metrics: PoolMetrics, period: { start: number; end: number }): void {
    const totalRequests = metrics.acquireCount;
    const errorRate = totalRequests > 0 ? metrics.errorCount / totalRequests : 0;
    const avgAcquireTime = totalRequests > 0 ? metrics.totalAcquireTime / totalRequests : 0;
    const utilization = metrics.totalConnections > 0 ? metrics.borrowedConnections / metrics.totalConnections : 0;

    const content = `| 指标 | 值 |
|------|-----|
| 总请求数 | ${this.formatNumber(totalRequests)} |
| 成功数 | ${this.formatNumber(metrics.releaseCount)} |
| 错误数 | ${this.formatNumber(metrics.errorCount)} |
| 错误率 | ${this.formatPercent(errorRate)} |
| 超时数 | ${this.formatNumber(metrics.timeoutCount)} |
| 平均获取时间 | ${this.formatDuration(avgAcquireTime)} |
| 创建连接数 | ${this.formatNumber(metrics.createdCount)} |
| 销毁连接数 | ${this.formatNumber(metrics.destroyedCount)} |
| 当前总连接数 | ${this.formatNumber(metrics.totalConnections)} |
| 当前可用连接数 | ${this.formatNumber(metrics.availableConnections)} |
| 当前已使用连接数 | ${this.formatNumber(metrics.borrowedConnections)} |
| 等待请求数 | ${this.formatNumber(metrics.pendingRequests)} |
| 连接利用率 | ${this.formatPercent(utilization)} |
| 统计周期 | ${this.formatDate(period.start)} ~ ${this.formatDate(period.end)} |`;

    this.sections.push({
      title: '概览',
      level: 2,
      content
    });
  }

  addHealthCheck(health: HealthCheckResult): void {
    const statusIcon = health.healthy ? '✅' : '⚠️';
    const stateColor = health.healthy ? '健康' : '异常';

    let content = `**状态**: ${statusIcon} ${stateColor}\n\n`;
    content += `**连接池状态**: \`${health.state}\`\n\n`;
    content += `**检查时间**: ${this.formatDate(health.timestamp)}\n\n`;

    if (health.warnings.length > 0) {
      content += '### 警告\n\n';
      health.warnings.forEach((warning, index) => {
        content += `${index + 1}. ${warning}\n`;
      });
      content += '\n';
    }

    if (health.errors.length > 0) {
      content += '### 最近错误\n\n';
      health.errors.forEach((err, index) => {
        content += `**${index + 1}. ${err.code}**\n`;
        content += `- 时间: ${this.formatDate(err.timestamp)}\n`;
        content += `- 消息: ${err.message}\n`;
        if (err.connectionId) {
          content += `- 连接ID: ${err.connectionId}\n`;
        }
        if (err.requestId) {
          content += `- 请求ID: ${err.requestId}\n`;
        }
        content += '\n';
      });
    }

    this.sections.push({
      title: '健康检查',
      level: 2,
      content
    });
  }

  addEvents(events: EventRecord[], maxEvents: number = 50): void {
    if (events.length === 0) {
      this.sections.push({
        title: '事件日志',
        level: 2,
        content: '暂无事件记录'
      });
      return;
    }

    const eventsToShow = events.slice(-maxEvents);

    let content = `| 时间 | 类型 | 级别 | 消息 | 详情 |\n`;
    content += '|------|------|------|------|------|\n';

    eventsToShow.forEach(event => {
      const levelIcon = this.getLevelIcon(event.level);
      const metadata = event.metadata 
        ? this.truncate(JSON.stringify(event.metadata), 50)
        : '-';
      
      content += `| ${this.formatDate(event.timestamp)} | ${event.type} | ${levelIcon} ${event.level} | ${this.truncate(event.message, 50)} | ${metadata} |\n`;
    });

    if (events.length > maxEvents) {
      content += `\n> 显示最新 ${maxEvents} 条，共 ${events.length} 条\n`;
    }

    this.sections.push({
      title: '事件日志',
      level: 2,
      content
    });
  }

  private getLevelIcon(level: string): string {
    const icons: Record<string, string> = {
      error: '🔴',
      warn: '🟡',
      info: '🔵',
      debug: '⚪'
    };
    return icons[level] || '';
  }

  private truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return str.substring(0, max) + '...';
  }

  addRecommendations(metrics: PoolMetrics): void {
    const recommendations: string[] = [];

    const total = metrics.acquireCount;
    const errorRate = total > 0 ? metrics.errorCount / total : 0;
    const utilization = metrics.totalConnections > 0 ? metrics.borrowedConnections / metrics.totalConnections : 0;

    if (utilization > 0.9) {
      recommendations.push('⚠️ **连接利用率过高 (> 90%)，建议增加最大连接数');
    }

    if (metrics.pendingRequests > 0) {
      recommendations.push('⚠️ **有等待中的请求，建议检查连接使用情况');
    }

    if (metrics.timeoutCount > 0) {
      recommendations.push('🔴 **存在超时情况**，建议检查网络或数据库响应');
    }

    if (errorRate > 0.05) {
      recommendations.push(`🔴 **错误率过高 (> 5%)**，建议检查数据库连接配置`);
    }

    if (metrics.createdCount > metrics.totalConnections * 10) {
      recommendations.push('⚠️ **连接创建频繁**，建议检查连接生命周期配置');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ 连接池运行正常，无特别建议');
    }

    const content = recommendations.map(rec => `${rec}\n`).join('\n');

    this.sections.push({
      title: '优化建议',
      level: 2,
      content
    });
  }

  addPerformanceAnalysis(metrics: PoolMetrics): void {
    const totalRequests = metrics.acquireCount;
    const avgAcquireTime = totalRequests > 0 ? metrics.totalAcquireTime / totalRequests : 0;
    const avgUseTime = metrics.releaseCount > 0 ? metrics.totalUseTime / metrics.releaseCount : 0;

    let content = '### 连接获取性能\n\n';
    content += `- **平均获取时间**: ${this.formatDuration(avgAcquireTime)}\n`;
    content += `- **总获取时间**: ${this.formatDuration(metrics.totalAcquireTime)}\n\n`;

    content += '### 连接使用性能\n\n';
    content += `- **平均使用时间**: ${this.formatDuration(avgUseTime)}\n`;
    content += `- **总使用时间**: ${this.formatDuration(metrics.totalUseTime)}\n`;
    content += `- **总使用次数**: ${this.formatNumber(metrics.releaseCount)}\n\n`;

    content += '### 连接生命周期\n\n';
    content += `- **创建连接数**: ${this.formatNumber(metrics.createdCount)}\n`;
    content += `- **销毁连接数**: ${this.formatNumber(metrics.destroyedCount)}\n`;
    content += `- **当前连接数**: ${this.formatNumber(metrics.totalConnections)}\n`;

    this.sections.push({
      title: '性能分析',
      level: 2,
      content
    });
  }

  generate(): string {
    let markdown = `# ${this.title}\n\n`;
    markdown += `> 生成时间: ${this.formatDate(Date.now())}\n\n`;
    markdown += `---\n\n`;

    this.sections.forEach(section => {
      const header = '#'.repeat(section.level);
      markdown += `${header} ${section.title}\n\n`;
      markdown += `${section.content}\n\n`;
    });

    markdown += `---\n\n`;
    markdown += `> 此报告由 Connection Pool Monitor 自动生成\n`;

    return markdown;
  }

  generateReport(
    metrics: PoolMetrics,
    health: HealthCheckResult,
    events: EventRecord[],
    period: { start: number; end: number },
    options: ReportOptions = {}
  ): string {
    this.title = options.title || 'Connection Pool 运行报告';

    this.addSummary(metrics, period);

    if (options.includeMetrics !== false) {
      this.addPerformanceAnalysis(metrics);
    }

    this.addHealthCheck(health);

    if (options.includeEvents !== false) {
      this.addEvents(events, options.maxEvents);
    }

    if (options.includeRecommendations !== false) {
      this.addRecommendations(metrics);
    }

    return this.generate();
  }

  static createPoolReport(
    metrics: PoolMetrics,
    health: HealthCheckResult,
    events: EventRecord[],
    period: { start: number; end: number },
    options: ReportOptions = {}
  ): PoolReport {
    const report = new MarkdownReport(options.title);
    
    const sections: ReportSection[] = [];

    sections.push({
      title: '概览',
      level: 2,
      content: `
## 统计摘要

- **统计周期**: ${report.formatDate(period.start)} ~ ${report.formatDate(period.end)}

| 指标 | 值 |
|------|-----|
| 总请求数 | ${report.formatNumber(metrics.acquireCount)} |
| 错误率 | ${report.formatPercent(metrics.acquireCount > 0 ? metrics.errorCount / metrics.acquireCount : 0)} |
| 平均获取时间 | ${report.formatDuration(metrics.acquireCount > 0 ? metrics.totalAcquireTime / metrics.acquireCount : 0)} |

`
    });

    return {
      title: options.title || 'Connection Pool Report',
      generatedAt: Date.now(),
      period,
      summary: {
        totalRequests: metrics.acquireCount,
        errorRate: metrics.acquireCount > 0 ? metrics.errorCount / metrics.acquireCount : 0,
        avgAcquireTime: metrics.acquireCount > 0 ? metrics.totalAcquireTime / metrics.acquireCount : 0,
        peakConnections: metrics.totalConnections,
        averageConnections: metrics.totalConnections
      },
      sections
    };
  }
}
