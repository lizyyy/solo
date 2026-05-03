import * as fs from 'fs';
import * as path from 'path';
import { CacheReport, Issue, IssueType } from './types';
import dayjs from 'dayjs';

export class Exporter {
  private outputDir: string;

  constructor(outputDir: string = process.cwd()) {
    this.outputDir = outputDir;
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async exportIssuesCSV(issues: Issue[]): Promise<string> {
    this.ensureDir();
    
    const headers = [
      'ID',
      'Type',
      'Severity',
      'Timestamp',
      'Operation Name',
      'Message',
      'Details JSON'
    ];

    const rows = issues.map(issue => [
      issue.id,
      issue.type,
      issue.severity,
      this.formatTimestamp(issue.timestamp),
      issue.operationName,
      this.escapeCSV(issue.message),
      this.escapeCSV(JSON.stringify(issue.details))
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const filePath = path.join(this.outputDir, 'issues.csv');
    await fs.promises.writeFile(filePath, csvContent, 'utf-8');
    
    return filePath;
  }

  async exportCacheReportMD(report: CacheReport): Promise<string> {
    this.ensureDir();
    
    const content = this.generateReportContent(report);
    const filePath = path.join(this.outputDir, 'cache_report.md');
    await fs.promises.writeFile(filePath, content, 'utf-8');
    
    return filePath;
  }

  private generateReportContent(report: CacheReport): string {
    const lines: string[] = [];
    
    lines.push('# GraphQL Cache Replay Report');
    lines.push('');
    lines.push(`Generated at: ${this.formatTimestamp(Date.now())}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Queries | ${report.summary.totalQueries} |`);
    lines.push(`| Total Mutations | ${report.summary.totalMutations} |`);
    lines.push(`| Cache Hits | ${report.summary.cacheHits} |`);
    lines.push(`| Cache Misses | ${report.summary.cacheMisses} |`);
    lines.push(`| Cache Hit Rate | ${(report.summary.cacheHitRate * 100).toFixed(1)}% |`);
    lines.push(`| Invalidations | ${report.summary.invalidations} |`);
    lines.push(`| Total Issues | ${report.summary.issues.total} |`);
    lines.push('');

    lines.push('## Issues by Type');
    lines.push('');
    lines.push('| Issue Type | Count |');
    lines.push('|------------|-------|');
    
    for (const [type, count] of Object.entries(report.summary.issues.byType)) {
      lines.push(`| ${type} | ${count} |`);
    }
    lines.push('');

    lines.push('## Issues by Severity');
    lines.push('');
    lines.push('| Severity | Count |');
    lines.push('|----------|-------|');
    
    for (const [severity, count] of Object.entries(report.summary.issues.bySeverity)) {
      lines.push(`| ${severity} | ${count} |`);
    }
    lines.push('');

    const highSeverityIssues = report.timeline
      .flatMap(t => t.issues)
      .filter(i => i.severity === 'high')
      .concat(
        report.recommendations
          .filter(r => r.priority === 'high')
          .map(r => ({
            id: `policy-${r.id}`,
            type: 'policy' as IssueType,
            severity: 'high' as const,
            timestamp: Date.now(),
            operationName: 'Policy',
            message: r.title,
            details: { description: r.description }
          }))
      );

    if (highSeverityIssues.length > 0) {
      lines.push('## High Severity Issues');
      lines.push('');
      
      for (const issue of highSeverityIssues) {
        lines.push(`### ${issue.id} - ${issue.type}`);
        lines.push('');
        lines.push(`- **Timestamp**: ${this.formatTimestamp(issue.timestamp)}`);
        lines.push(`- **Operation**: ${issue.operationName}`);
        lines.push(`- **Message**: ${issue.message}`);
        lines.push('');
        lines.push('**Details:**');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(issue.details, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    lines.push('## Recommendations');
    lines.push('');

    if (report.recommendations.length === 0) {
      lines.push('No specific recommendations. Your cache policy looks well-configured!');
      lines.push('');
    } else {
      for (const rec of report.recommendations) {
        lines.push(`### ${rec.id} [${rec.priority.toUpperCase()}] - ${rec.type.toUpperCase()}`);
        lines.push('');
        lines.push(`**${rec.title}**`);
        lines.push('');
        lines.push(rec.description);
        lines.push('');
        if (rec.affectedOperations.length > 0) {
          lines.push(`Affected operations: ${rec.affectedOperations.join(', ')}`);
          lines.push('');
        }
      }
    }

    lines.push('## Timeline Events');
    lines.push('');
    lines.push('| Time | Type | Operation | Cache Hit | Issues |');
    lines.push('|------|------|-----------|-----------|--------|');

    for (const event of report.timeline) {
      const time = this.formatTimestamp(event.timestamp);
      const hit = event.details.cacheHit !== undefined 
        ? (event.details.cacheHit ? '✅' : '❌') 
        : '-';
      const issueCount = event.issues.length;
      const issues = issueCount > 0 ? `${issueCount} issue(s)` : '-';
      
      lines.push(`| ${time} | ${event.type} | ${event.operationName} | ${hit} | ${issues} |`);
    }
    lines.push('');

    lines.push('## Entity Dependencies');
    lines.push('');

    const dependencyEntries = Object.entries(report.entityDependencyMap);
    
    if (dependencyEntries.length === 0) {
      lines.push('No entity dependencies configured.');
    } else {
      lines.push('```');
      for (const [entity, deps] of dependencyEntries) {
        if (deps.length > 0) {
          lines.push(`${entity} -> [${deps.join(', ')}]`);
        } else {
          lines.push(`${entity} (no dependencies)`);
        }
      }
      lines.push('```');
    }
    lines.push('');

    lines.push('## Current Cache State');
    lines.push('');

    const cacheEntries = Object.values(report.cacheState);
    
    if (cacheEntries.length === 0) {
      lines.push('Cache is empty.');
    } else {
      lines.push('| Key | Operation | Entity Keys | TTL (s) | Expires At |');
      lines.push('|-----|-----------|-------------|---------|------------|');

      for (const entry of cacheEntries) {
        const expiresAt = this.formatTimestamp(entry.expiresAt);
        const entityKeysStr = entry.entityKeys.slice(0, 3).join(', ') + 
          (entry.entityKeys.length > 3 ? ` (+${entry.entityKeys.length - 3} more)` : '');
        
        lines.push(`| ${entry.key.substring(0, 30)}... | ${entry.operationName} | ${entityKeysStr} | ${entry.ttl} | ${expiresAt} |`);
      }
    }
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('*Report generated by GraphQL Cache Replay Tool*');

    return lines.join('\n');
  }

  private formatTimestamp(timestamp: number): string {
    return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS');
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
