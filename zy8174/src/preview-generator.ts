import * as fs from 'fs';
import * as path from 'path';
import { CacheReport, Issue, TimelineEvent, Recommendation } from './types';
import dayjs from 'dayjs';

export class PreviewGenerator {
  private outputDir: string;

  constructor(outputDir: string = process.cwd()) {
    this.outputDir = outputDir;
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generatePreview(report: CacheReport): Promise<string> {
    this.ensureDir();
    
    const html = this.generateHTML(report);
    const filePath = path.join(this.outputDir, 'preview.html');
    await fs.promises.writeFile(filePath, html, 'utf-8');
    
    return filePath;
  }

  private generateHTML(report: CacheReport): string {
    const allIssues = report.timeline.flatMap(t => t.issues);
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GraphQL Cache Replay Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #1a1a2e;
      color: #e4e4e7;
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    h1 { font-size: 28px; margin-bottom: 10px; }
    .subtitle { color: rgba(255,255,255,0.8); font-size: 14px; }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric-card {
      background: #16213e;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #2d3a5a;
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .metric-label { color: #94a3b8; font-size: 14px; }
    .metric-value.green { color: #10b981; }
    .metric-value.red { color: #ef4444; }
    .metric-value.yellow { color: #f59e0b; }
    .metric-value.blue { color: #3b82f6; }

    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .tab {
      padding: 12px 24px;
      background: #16213e;
      border: 1px solid #2d3a5a;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      font-size: 14px;
    }
    .tab:hover { background: #1e293b; }
    .tab.active {
      background: #667eea;
      border-color: #667eea;
      color: white;
    }

    .tab-content { display: none; }
    .tab-content.active { display: block; }

    .section {
      background: #16213e;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      border: 1px solid #2d3a5a;
    }
    .section-title {
      font-size: 18px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #2d3a5a;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #2d3a5a;
    }
    th {
      background: #1e293b;
      font-weight: 600;
      color: #94a3b8;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tr:hover { background: #1e293b; }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-high { background: #7f1d1d; color: #fca5a5; }
    .badge-medium { background: #78350f; color: #fcd34d; }
    .badge-low { background: #1e3a5f; color: #93c5fd; }
    .badge-hit { background: #064e3b; color: #6ee7b7; }
    .badge-miss { background: #7f1d1d; color: #fca5a5; }

    .timeline { position: relative; padding-left: 30px; }
    .timeline::before {
      content: '';
      position: absolute;
      left: 10px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #2d3a5a;
    }
    .timeline-item {
      position: relative;
      margin-bottom: 20px;
      padding: 15px;
      background: #1e293b;
      border-radius: 8px;
      border: 1px solid #2d3a5a;
    }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -25px;
      top: 20px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #667eea;
    }
    .timeline-item.query::before { background: #3b82f6; }
    .timeline-item.mutation::before { background: #f59e0b; }
    .timeline-item.invalidation::before { background: #ef4444; }
    .timeline-time { color: #64748b; font-size: 12px; margin-bottom: 5px; }
    .timeline-title { font-weight: 600; margin-bottom: 8px; }
    .timeline-details { font-size: 13px; color: #94a3b8; }

    .issue-card {
      background: #1e293b;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      border-left: 4px solid;
    }
    .issue-card.high { border-left-color: #ef4444; }
    .issue-card.medium { border-left-color: #f59e0b; }
    .issue-card.low { border-left-color: #3b82f6; }

    .recommendation-card {
      background: linear-gradient(135deg, #1e3a5f 0%, #16213e 100%);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
      border: 1px solid #2d3a5a;
    }
    .recommendation-title {
      font-weight: 600;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .json-preview {
      background: #0f172a;
      border-radius: 8px;
      padding: 15px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      overflow-x: auto;
      margin-top: 10px;
      max-height: 300px;
      overflow-y: auto;
    }

    .progress-bar {
      height: 8px;
      background: #1e293b;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 10px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
    }

    .entity-graph {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-top: 15px;
    }
    .entity-node {
      background: #1e293b;
      border: 1px solid #2d3a5a;
      border-radius: 8px;
      padding: 15px;
      min-width: 200px;
    }
    .entity-name {
      font-weight: 600;
      color: #667eea;
      margin-bottom: 8px;
    }
    .entity-deps {
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>GraphQL Cache Replay Report</h1>
      <div class="subtitle">Generated at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}</div>
    </header>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value blue">${report.summary.totalQueries}</div>
        <div class="metric-label">Total Queries</div>
      </div>
      <div class="metric-card">
        <div class="metric-value yellow">${report.summary.totalMutations}</div>
        <div class="metric-label">Total Mutations</div>
      </div>
      <div class="metric-card">
        <div class="metric-value green">${report.summary.cacheHits}</div>
        <div class="metric-label">Cache Hits</div>
      </div>
      <div class="metric-card">
        <div class="metric-value red">${report.summary.cacheMisses}</div>
        <div class="metric-label">Cache Misses</div>
      </div>
      <div class="metric-card">
        <div class="metric-value ${report.summary.cacheHitRate > 0.7 ? 'green' : report.summary.cacheHitRate > 0.4 ? 'yellow' : 'red'}">${(report.summary.cacheHitRate * 100).toFixed(1)}%</div>
        <div class="metric-label">Hit Rate</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${report.summary.cacheHitRate * 100}%"></div>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-value ${report.summary.issues.total > 0 ? 'red' : 'green'}">${report.summary.issues.total}</div>
        <div class="metric-label">Total Issues</div>
      </div>
    </div>

    <div class="tabs">
      <div class="tab active" data-tab="overview">Overview</div>
      <div class="tab" data-tab="timeline">Timeline</div>
      <div class="tab" data-tab="issues">Issues</div>
      <div class="tab" data-tab="recommendations">Recommendations</div>
      <div class="tab" data-tab="dependencies">Dependencies</div>
      <div class="tab" data-tab="cache">Cache State</div>
    </div>

    <div class="tab-content active" id="overview">
      <div class="section">
        <h2 class="section-title">Issues by Type</h2>
        <table>
          <tr>
            <th>Issue Type</th>
            <th>Count</th>
            <th>Severity</th>
          </tr>
          ${this.generateIssuesByTypeTable(report)}
        </table>
      </div>

      <div class="section">
        <h2 class="section-title">High Severity Issues</h2>
        ${this.generateHighSeverityIssues(allIssues)}
      </div>
    </div>

    <div class="tab-content" id="timeline">
      <div class="section">
        <h2 class="section-title">Event Timeline</h2>
        <div class="timeline">
          ${this.generateTimelineEvents(report.timeline)}
        </div>
      </div>
    </div>

    <div class="tab-content" id="issues">
      <div class="section">
        <h2 class="section-title">All Issues (${allIssues.length})</h2>
        ${this.generateAllIssues(allIssues)}
      </div>
    </div>

    <div class="tab-content" id="recommendations">
      <div class="section">
        <h2 class="section-title">Recommendations</h2>
        ${this.generateRecommendations(report.recommendations)}
      </div>
    </div>

    <div class="tab-content" id="dependencies">
      <div class="section">
        <h2 class="section-title">Entity Dependencies</h2>
        <div class="entity-graph">
          ${this.generateEntityGraph(report.entityDependencyMap)}
        </div>
      </div>
    </div>

    <div class="tab-content" id="cache">
      <div class="section">
        <h2 class="section-title">Current Cache State (${Object.keys(report.cacheState).length} entries)</h2>
        ${this.generateCacheState(report.cacheState)}
      </div>
    </div>
  </div>

  <script>
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });
  </script>
</body>
</html>
    `;
  }

  private generateIssuesByTypeTable(report: CacheReport): string {
    const entries = Object.entries(report.summary.issues.byType);
    if (entries.length === 0) {
      return '<tr><td colspan="3" style="text-align: center; color: #64748b;">No issues detected</td></tr>';
    }
    
    return entries.map(([type, count]) => {
      const severity = this.getDefaultSeverity(type as any);
      return `
        <tr>
          <td><code>${type}</code></td>
          <td>${count}</td>
          <td><span class="badge badge-${severity}">${severity.toUpperCase()}</span></td>
        </tr>
      `;
    }).join('');
  }

  private getDefaultSeverity(type: string): 'high' | 'medium' | 'low' {
    const highSeverity = ['stale_data', 'out_of_order_mutation', 'circular_dependency'];
    const mediumSeverity = ['over_invalidation', 'missing_key'];
    if (highSeverity.includes(type)) return 'high';
    if (mediumSeverity.includes(type)) return 'medium';
    return 'low';
  }

  private generateHighSeverityIssues(issues: Issue[]): string {
    const highIssues = issues.filter(i => i.severity === 'high');
    if (highIssues.length === 0) {
      return '<p style="color: #64748b; text-align: center; padding: 20px;">No high severity issues detected ✓</p>';
    }
    
    return highIssues.map(issue => `
      <div class="issue-card ${issue.severity}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span class="badge badge-${issue.severity}">${issue.type}</span>
          <span style="color: #64748b; font-size: 12px;">${dayjs(issue.timestamp).format('HH:mm:ss')}</span>
        </div>
        <div style="font-weight: 600; margin-bottom: 5px;">${issue.operationName}</div>
        <div style="color: #94a3b8; font-size: 13px;">${issue.message}</div>
        <details style="margin-top: 10px;">
          <summary style="cursor: pointer; color: #667eea; font-size: 12px;">View Details</summary>
          <div class="json-preview">${this.escapeHtml(JSON.stringify(issue.details, null, 2))}</div>
        </details>
      </div>
    `).join('');
  }

  private generateTimelineEvents(events: TimelineEvent[]): string {
    return events.map(event => {
      const time = dayjs(event.timestamp).format('HH:mm:ss.SSS');
      const hasIssues = event.issues.length > 0;
      const cacheBadge = event.details.cacheHit !== undefined 
        ? `<span class="badge badge-${event.details.cacheHit ? 'hit' : 'miss'}">${event.details.cacheHit ? 'HIT' : 'MISS'}</span>`
        : '';
      
      let details = '';
      if (event.details.evictedKeys?.length) {
        details = `Evicted ${event.details.evictedKeys.length} cache keys`;
      } else if (event.details.affectedKeys?.length) {
        details = `Affected keys: ${event.details.affectedKeys.slice(0, 3).join(', ')}${event.details.affectedKeys.length > 3 ? '...' : ''}`;
      }
      
      return `
        <div class="timeline-item ${event.type}">
          <div class="timeline-time">${time}</div>
          <div class="timeline-title" style="display: flex; align-items: center; gap: 10px;">
            <span class="badge" style="background: #2d3a5a; color: #94a3b8;">${event.type.toUpperCase()}</span>
            ${event.operationName}
            ${cacheBadge}
            ${hasIssues ? `<span class="badge badge-high">${event.issues.length} ISSUE(S)</span>` : ''}
          </div>
          ${details ? `<div class="timeline-details">${details}</div>` : ''}
          ${hasIssues ? `
            <details style="margin-top: 10px;">
              <summary style="cursor: pointer; color: #667eea; font-size: 12px;">View ${event.issues.length} issue(s)</summary>
              ${event.issues.map(issue => `
                <div style="margin-top: 10px; padding: 10px; background: #0f172a; border-radius: 4px;">
                  <span class="badge badge-${issue.severity}" style="margin-right: 8px;">${issue.type}</span>
                  <span style="font-size: 13px;">${issue.message}</span>
                </div>
              `).join('')}
            </details>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  private generateAllIssues(issues: Issue[]): string {
    if (issues.length === 0) {
      return '<p style="color: #64748b; text-align: center; padding: 20px;">No issues detected ✓</p>';
    }
    
    return issues.map(issue => `
      <div class="issue-card ${issue.severity}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="display: flex; align-items: center; gap: 8px;">
            <span class="badge badge-${issue.severity}">${issue.severity.toUpperCase()}</span>
            <code>${issue.type}</code>
          </span>
          <span style="color: #64748b; font-size: 12px;">${dayjs(issue.timestamp).format('HH:mm:ss')}</span>
        </div>
        <div style="font-weight: 600; margin-bottom: 5px;">${issue.operationName}</div>
        <div style="color: #94a3b8; font-size: 13px;">${issue.message}</div>
        <details style="margin-top: 10px;">
          <summary style="cursor: pointer; color: #667eea; font-size: 12px;">View Details</summary>
          <div class="json-preview">${this.escapeHtml(JSON.stringify(issue.details, null, 2))}</div>
        </details>
      </div>
    `).join('');
  }

  private generateRecommendations(recommendations: Recommendation[]): string {
    if (recommendations.length === 0) {
      return '<p style="color: #64748b; text-align: center; padding: 20px;">No recommendations needed. Your cache policy looks well-configured! ✓</p>';
    }
    
    return recommendations.map(rec => `
      <div class="recommendation-card">
        <div class="recommendation-title">
          <span class="badge badge-${rec.priority === 'high' ? 'high' : rec.priority === 'medium' ? 'medium' : 'low'}">${rec.priority.toUpperCase()}</span>
          <span style="color: #667eea;">${rec.type.toUpperCase()}</span>
          ${rec.title}
        </div>
        <div style="color: #94a3b8; margin-bottom: 10px;">${rec.description}</div>
        ${rec.affectedOperations.length > 0 ? `
          <div style="font-size: 13px; color: #64748b;">
            <strong>Affected operations:</strong> ${rec.affectedOperations.join(', ')}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  private generateEntityGraph(dependencyMap: Record<string, string[]>): string {
    const entries = Object.entries(dependencyMap);
    if (entries.length === 0) {
      return '<p style="color: #64748b; text-align: center; padding: 20px;">No entity dependencies configured</p>';
    }
    
    return entries.map(([entity, deps]) => `
      <div class="entity-node">
        <div class="entity-name">${entity}</div>
        <div class="entity-deps">
          ${deps.length > 0 
            ? `<span style="color: #667eea;">→</span> ${deps.join(', ')}`
            : '(no dependencies)'
          }
        </div>
      </div>
    `).join('');
  }

  private generateCacheState(cacheState: Record<string, any>): string {
    const entries = Object.values(cacheState);
    if (entries.length === 0) {
      return '<p style="color: #64748b; text-align: center; padding: 20px;">Cache is empty</p>';
    }
    
    return `
      <table>
        <tr>
          <th>Cache Key</th>
          <th>Operation</th>
          <th>Entity Keys</th>
          <th>TTL (s)</th>
          <th>Expires At</th>
        </tr>
        ${entries.map((entry: any) => `
          <tr>
            <td><code>${entry.key.substring(0, 30)}...</code></td>
            <td>${entry.operationName}</td>
            <td>${entry.entityKeys.length} key(s)</td>
            <td>${entry.ttl}</td>
            <td>${dayjs(entry.expiresAt).format('HH:mm:ss')}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
