import { AnalysisResult, Issue, Suggestion, Severity, IssueCategory } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class ReportGenerator {
  private result: AnalysisResult;
  private timestamp: Date;

  constructor(result: AnalysisResult) {
    this.result = result;
    this.timestamp = new Date();
  }

  generateJSON(): string {
    return JSON.stringify({
      generatedAt: this.timestamp.toISOString(),
      ...this.result
    }, null, 2);
  }

  generateMarkdown(): string {
    const lines: string[] = [];

    lines.push(`# 数据库 Workload 回放闸门分析报告`);
    lines.push('');
    lines.push(`> 生成时间: ${this.timestamp.toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push('## 📊 概览');
    lines.push('');
    lines.push(this.generateSummarySection());
    lines.push('');

    lines.push('## ❌ 阻塞项 (Blockers)');
    lines.push('');
    lines.push(this.generateIssuesSection('blocker'));
    lines.push('');

    lines.push('## ⚠️ 警告项 (Warnings)');
    lines.push('');
    lines.push(this.generateIssuesSection('warning'));
    lines.push('');

    lines.push('## ℹ️ 信息项 (Infos)');
    lines.push('');
    lines.push(this.generateIssuesSection('info'));
    lines.push('');

    lines.push('## 💡 参数建议');
    lines.push('');
    lines.push(this.generateSuggestionsSection());
    lines.push('');

    lines.push('## 📈 详细指标');
    lines.push('');
    lines.push(this.generateMetricsSection());
    lines.push('');

    lines.push('## 📝 原始数据统计');
    lines.push('');
    lines.push(this.generateRawDataSection());
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('*此报告由 db-workload-gate 工具自动生成*');

    return lines.join('\n');
  }

  async saveJSON(filePath: string): Promise<void> {
    const fullPath = path.resolve(filePath);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, this.generateJSON(), 'utf-8');
  }

  async saveMarkdown(filePath: string): Promise<void> {
    const fullPath = path.resolve(filePath);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, this.generateMarkdown(), 'utf-8');
  }

  private generateSummarySection(): string {
    const { summary } = this.result;
    const statusEmoji = summary.canDeploy ? '✅' : '🚫';
    const statusText = summary.canDeploy ? '可以上线' : '需要修复阻塞项';

    const lines: string[] = [];
    lines.push(`### ${statusEmoji} 上线判定: **${statusText}**`);
    lines.push('');
    lines.push('| 类别 | 数量 |');
    lines.push('|------|------|');
    lines.push(`| 🚫 阻塞项 | ${summary.blockerCount} |`);
    lines.push(`| ⚠️ 警告项 | ${summary.warningCount} |`);
    lines.push(`| ℹ️ 信息项 | ${summary.infoCount} |`);
    lines.push('');

    if (!summary.canDeploy) {
      lines.push('> ⚠️ 存在阻塞项，请修复后再进行上线');
    }

    return lines.join('\n');
  }

  private generateIssuesSection(severity: Severity): string {
    const issues = this.result.issues.filter(i => i.severity === severity);
    
    if (issues.length === 0) {
      return '> 无问题项';
    }

    const lines: string[] = [];
    
    const grouped = this.groupIssuesByCategory(issues);
    
    for (const [category, categoryIssues] of grouped) {
      lines.push(`### ${this.getCategoryEmoji(category)} ${this.getCategoryName(category)}`);
      lines.push('');
      
      for (const issue of categoryIssues) {
        lines.push(`#### ${issue.title}`);
        lines.push('');
        lines.push(issue.description);
        lines.push('');
        
        if (issue.affectedObjects.length > 0) {
          lines.push('**受影响对象:**');
          lines.push('');
          for (const obj of issue.affectedObjects) {
            lines.push(`- \`${obj}\``);
          }
          lines.push('');
        }
        
        if (issue.evidence) {
          lines.push(`**证据:** ${issue.evidence}`);
          lines.push('');
        }
        
        lines.push('---');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private generateSuggestionsSection(): string {
    const { suggestions } = this.result;
    
    if (suggestions.length === 0) {
      return '> 无参数建议';
    }

    const lines: string[] = [];
    
    const priorityOrder = ['high', 'medium', 'low'] as const;
    
    for (const priority of priorityOrder) {
      const prioritySuggestions = suggestions.filter(s => s.priority === priority);
      
      if (prioritySuggestions.length === 0) continue;
      
      lines.push(`### ${this.getPriorityEmoji(priority)} ${this.getPriorityName(priority)}优先级`);
      lines.push('');
      
      for (const suggestion of prioritySuggestions) {
        lines.push(`#### ${suggestion.title}`);
        lines.push('');
        lines.push(suggestion.description);
        lines.push('');
        
        if (suggestion.implementation) {
          lines.push('**实施建议:**');
          lines.push('');
          lines.push('```');
          lines.push(suggestion.implementation);
          lines.push('```');
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  private generateMetricsSection(): string {
    const { metrics } = this.result;
    const lines: string[] = [];

    lines.push('### 连接池指标');
    lines.push('');
    lines.push('| 指标 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| 平均队列大小 | ${metrics.connectionPool.avgQueueSize} |`);
    lines.push(`| 最大队列大小 | ${metrics.connectionPool.maxQueueSize} |`);
    lines.push(`| 排队率 | ${(metrics.connectionPool.queueRate * 100).toFixed(1)}% |`);
    lines.push(`| 平均连接等待时间 | ${metrics.connectionPool.avgConnectionWaitMs.toFixed(0)}ms |`);
    lines.push(`| 连接利用率 | ${(metrics.connectionPool.connectionUtilization * 100).toFixed(1)}% |`);
    lines.push(`| 超时率 | ${(metrics.connectionPool.timeoutRate * 100).toFixed(1)}% |`);
    lines.push('');

    lines.push('### 写入性能指标');
    lines.push('');
    lines.push('| 指标 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| 单条写入数量 | ${metrics.writePerformance.singleWriteCount} |`);
    lines.push(`| 批量写入数量 | ${metrics.writePerformance.batchWriteCount} |`);
    lines.push(`| 平均单条写入耗时 | ${metrics.writePerformance.avgSingleWriteMs.toFixed(0)}ms |`);
    lines.push(`| 平均批量写入耗时 | ${metrics.writePerformance.avgBatchWriteMs.toFixed(0)}ms |`);
    lines.push(`| 总写入行数 | ${metrics.writePerformance.totalRowsWritten} |`);
    lines.push('');

    lines.push('### 索引使用指标');
    lines.push('');
    lines.push('| 指标 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| 已使用索引数 | ${metrics.indexUsage.usedIndexes.length} |`);
    lines.push(`| 未使用索引数 | ${metrics.indexUsage.unusedIndexes.length} |`);
    lines.push(`| 缺失索引数 | ${metrics.indexUsage.missingIndexes.length} |`);
    lines.push(`| 重复索引数 | ${metrics.indexUsage.duplicateIndexes.length} |`);
    lines.push('');

    lines.push('### 慢SQL指标');
    lines.push('');
    lines.push('| 指标 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| 慢查询总数 | ${metrics.slowSQL.totalCount} |`);
    lines.push(`| 平均耗时 | ${metrics.slowSQL.avgDurationMs.toFixed(0)}ms |`);
    lines.push(`| P95 耗时 | ${metrics.slowSQL.p95DurationMs.toFixed(0)}ms |`);
    lines.push('');

    if (metrics.slowSQL.slowQueries.length > 0) {
      lines.push('**Top 慢查询:**');
      lines.push('');
      lines.push('| SQL模式 | 平均耗时 | 执行次数 | 最大耗时 | 类型 |');
      lines.push('|---------|----------|----------|----------|------|');
      
      for (const q of metrics.slowSQL.slowQueries.slice(0, 5)) {
        const sqlShort = q.sql.length > 50 ? q.sql.substring(0, 50) + '...' : q.sql;
        lines.push(`| \`${sqlShort}\` | ${q.avgDurationMs.toFixed(0)}ms | ${q.count} | ${q.maxDurationMs.toFixed(0)}ms | ${q.isRead ? '读' : '写'} |`);
      }
      lines.push('');
    }

    lines.push('### 路由指标');
    lines.push('');
    lines.push('| 指标 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| 读查询总数 | ${metrics.routing.readCount} |`);
    lines.push(`| 写查询总数 | ${metrics.routing.writeCount} |`);
    lines.push(`| 读路由误判数 | ${metrics.routing.misroutedReads} |`);
    lines.push(`| 写路由误判数 | ${metrics.routing.misroutedWrites} |`);
    lines.push('');

    if (Object.keys(metrics.sharding.shardDistribution).length > 0) {
      lines.push('### 分库分表指标');
      lines.push('');
      lines.push('| 指标 | 值 |');
      lines.push('|------|-----|');
      lines.push(`| 平均每分片行数 | ${metrics.sharding.avgRowsPerShard.toFixed(0)} |`);
      lines.push(`| 不均衡比例 | ${(metrics.sharding.imbalanceRatio * 100).toFixed(1)}% |`);
      lines.push(`| 热点数量 | ${metrics.sharding.hotspots.length} |`);
      lines.push('');

      if (metrics.sharding.hotspots.length > 0) {
        lines.push('**热点详情:**');
        lines.push('');
        lines.push('| 分片ID | 表名 | 分片键值 | 行数 | 占比 |');
        lines.push('|--------|------|----------|------|------|');
        
        for (const h of metrics.sharding.hotspots) {
          lines.push(`| ${h.shardId} | ${h.table} | ${h.shardKeyValue} | ${h.rowCount} | ${h.percentage.toFixed(1)}% |`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private generateRawDataSection(): string {
    const { rawData } = this.result;
    const lines: string[] = [];

    lines.push('| 数据类型 | 数量 |');
    lines.push('|----------|------|');
    lines.push(`| SQL Trace 记录数 | ${rawData.traceCount} |`);
    lines.push(`| 写入批次数量 | ${rawData.batchCount} |`);
    lines.push(`| 表数量 | ${rawData.tableCount} |`);

    return lines.join('\n');
  }

  private groupIssuesByCategory(issues: Issue[]): Map<IssueCategory, Issue[]> {
    const grouped = new Map<IssueCategory, Issue[]>();
    
    for (const issue of issues) {
      if (!grouped.has(issue.category)) {
        grouped.set(issue.category, []);
      }
      grouped.get(issue.category)!.push(issue);
    }

    return grouped;
  }

  private getCategoryEmoji(category: IssueCategory): string {
    const emojiMap: Record<IssueCategory, string> = {
      'connection-pool': '🔌',
      'write-batch': '📝',
      'index': '🔍',
      'slow-sql': '🐌',
      'routing': '🔄',
      'sharding': '🧩',
      'configuration': '⚙️'
    };
    return emojiMap[category] || '📋';
  }

  private getCategoryName(category: IssueCategory): string {
    const nameMap: Record<IssueCategory, string> = {
      'connection-pool': '连接池',
      'write-batch': '写入批次',
      'index': '索引',
      'slow-sql': '慢SQL',
      'routing': '路由',
      'sharding': '分库分表',
      'configuration': '配置'
    };
    return nameMap[category] || '其他';
  }

  private getPriorityEmoji(priority: 'high' | 'medium' | 'low'): string {
    const emojiMap = { high: '🔴', medium: '🟡', low: '🟢' };
    return emojiMap[priority];
  }

  private getPriorityName(priority: 'high' | 'medium' | 'low'): string {
    const nameMap = { high: '高', medium: '中', low: '低' };
    return nameMap[priority];
  }
}
