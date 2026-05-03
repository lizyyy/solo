import * as fs from 'fs-extra';
import { stringify } from 'csv-stringify/sync';
import { EvaluationReport, IssueItem, QueryResult } from './types';

export class Reporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async ensureOutputDir(): Promise<void> {
    await fs.ensureDir(this.outputDir);
  }

  generateIssuesCSV(issues: IssueItem[]): string {
    const records = issues.map(issue => ({
      type: issue.type,
      query_id: issue.query_id || '',
      chunk_id: issue.chunk_id || '',
      document_id: issue.document_id || '',
      severity: issue.severity,
      message: issue.message,
      details: JSON.stringify(issue.details || {})
    }));

    return stringify(records, {
      header: true,
      columns: ['type', 'query_id', 'chunk_id', 'document_id', 'severity', 'message', 'details']
    });
  }

  generateMarkdownReport(report: EvaluationReport): string {
    const { summary, query_metrics, issues, generated_at, rules_applied } = report;

    const severityCount = {
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    };

    let md = `# RAG 检索评估报告\n\n`;
    md += `**生成时间**: ${new Date(generated_at).toLocaleString()}\n\n`;

    md += `## 📊 概览摘要\n\n`;
    md += `| 指标 | 值 |\n`;
    md += `|------|-----|\n`;
    md += `| 总查询数 | ${summary.total_queries} |\n`;
    md += `| 总知识块数 | ${summary.total_chunks} |\n`;
    md += `| 平均 MRR | ${(summary.average_mrr * 100).toFixed(2)}% |\n`;
    md += `| 平均引用覆盖率 | ${(summary.average_coverage * 100).toFixed(2)}% |\n`;
    md += `| 过期文档命中数 | ${summary.expired_doc_hit_count} |\n`;
    md += `| 重复 chunk 对数 | ${summary.duplicate_chunk_count} |\n`;
    md += `| 整体通过率 | ${(summary.overall_pass_rate * 100).toFixed(2)}% |\n\n`;

    md += `### Top-K 召回率\n\n`;
    md += `| K 值 | 平均召回率 |\n`;
    md += `|-------|-----------|\n`;
    for (const [k, recall] of Object.entries(summary.average_recall)) {
      md += `| ${k} | ${(recall * 100).toFixed(2)}% |\n`;
    }
    md += `\n`;

    md += `## ⚠️ 问题列表\n\n`;
    if (issues.length === 0) {
      md += `✅ 未发现任何问题\n\n`;
    } else {
      md += `**问题统计**: 🔴 严重: ${severityCount.high} | 🟡 中等: ${severityCount.medium} | 🟢 轻微: ${severityCount.low}\n\n`;

      for (const severity of ['high', 'medium', 'low'] as const) {
        const severityIssues = issues.filter(i => i.severity === severity);
        if (severityIssues.length > 0) {
          const icon = severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '🟢';
          md += `### ${icon} ${severity === 'high' ? '严重' : severity === 'medium' ? '中等' : '轻微'}问题 (${severityIssues.length})\n\n`;
          
          for (const issue of severityIssues) {
            md += `**类型**: ${issue.type}\n\n`;
            md += `**消息**: ${issue.message}\n\n`;
            if (issue.query_id) md += `**查询 ID**: ${issue.query_id}\n\n`;
            if (issue.chunk_id) md += `**Chunk ID**: ${issue.chunk_id}\n\n`;
            md += `---\n\n`;
          }
        }
      }
    }

    md += `## 📈 逐查询指标\n\n`;
    md += `| 查询 ID | MRR | 引用覆盖率 | 过期命中 | 综合得分 | 状态 |\n`;
    md += `|---------|-----|-----------|---------|---------|------|\n`;

    for (const metric of query_metrics) {
      const isPass = metric.overall_score >= rules_applied.minimum_acceptable_score;
      const status = isPass ? '✅ 通过' : '❌ 失败';
      md += `| ${metric.query_id} | ${(metric.mrr * 100).toFixed(1)}% | ${(metric.reference_coverage * 100).toFixed(1)}% | ${metric.expired_doc_hits} | ${metric.overall_score.toFixed(3)} | ${status} |\n`;
    }
    md += `\n`;

    md += `## ⚙️ 评估规则配置\n\n`;
    md += `\`\`\`yaml\n`;
    md += `top_k_values: [${rules_applied.top_k_values.join(', ')}]\n`;
    md += `expired_documents: ${JSON.stringify(rules_applied.expired_documents)}\n`;
    md += `duplicate_threshold: ${rules_applied.duplicate_threshold}\n`;
    md += `mrr_weight: ${rules_applied.mrr_weight}\n`;
    md += `recall_weight: ${rules_applied.recall_weight}\n`;
    md += `coverage_weight: ${rules_applied.coverage_weight}\n`;
    md += `minimum_acceptable_score: ${rules_applied.minimum_acceptable_score}\n`;
    md += `\`\`\`\n\n`;

    return md;
  }

  generateHTMLPreview(
    report: EvaluationReport,
    queryResults: QueryResult[]
  ): string {
    const { summary, query_metrics, issues } = report;

    const severityCount = {
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    };

    const queryMap = new Map(queryResults.map(qr => [qr.query_id, qr]));

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAG 检索评估排名预览</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: rgba(255, 255, 255, 0.95);
      padding: 30px;
      border-radius: 16px;
      margin-bottom: 20px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }
    .header h1 {
      color: #1a202c;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header p { color: #718096; }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: rgba(255, 255, 255, 0.95);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: #667eea;
    }
    .stat-label {
      color: #718096;
      margin-top: 5px;
      font-size: 14px;
    }
    
    .issues-banner {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .issue-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
    }
    .issue-high { background: #fed7d7; color: #c53030; }
    .issue-medium { background: #feebc8; color: #c05621; }
    .issue-low { background: #e6fffa; color: #234e52; }
    
    .query-section {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      margin-bottom: 20px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .query-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    }
    .query-header:hover { opacity: 0.95; }
    .query-title {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .query-id {
      background: rgba(255, 255, 255, 0.2);
      padding: 5px 12px;
      border-radius: 20px;
      font-weight: 600;
    }
    .query-text { font-size: 16px; }
    .query-score {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .score-badge {
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 18px;
    }
    .score-pass { background: #c6f6d5; color: #22543d; }
    .score-fail { background: #fed7d7; color: #742a2a; }
    
    .query-content {
      display: none;
      padding: 20px;
    }
    .query-content.expanded { display: block; }
    
    .metrics-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .metric-item {
      background: #f7fafc;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-item .value {
      font-size: 24px;
      font-weight: 700;
      color: #4a5568;
    }
    .metric-item .label {
      color: #718096;
      font-size: 12px;
      margin-top: 4px;
    }
    
    .results-table { width: 100%; border-collapse: collapse; }
    .results-table th, .results-table td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    .results-table th {
      background: #edf2f7;
      font-weight: 600;
      color: #4a5568;
    }
    .results-table tr:hover { background: #f7fafc; }
    .rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      font-weight: 700;
      font-size: 14px;
    }
    .rank-1 { background: #ffd700; color: #744210; }
    .rank-2 { background: #c0c0c0; color: #2d3748; }
    .rank-3 { background: #cd7f32; color: #fff; }
    .rank-other { background: #e2e8f0; color: #4a5568; }
    .score-bar {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    .score-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 4px;
    }
    .expected-tag {
      background: #c6f6d5;
      color: #22543d;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .expected-section {
      background: #f0fff4;
      border: 1px solid #9ae6b4;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .expected-title {
      font-weight: 600;
      color: #22543d;
      margin-bottom: 10px;
    }
    .expected-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .expected-item {
      background: white;
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid #9ae6b4;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 RAG 检索评估排名预览</h1>
      <p>生成时间: ${new Date().toLocaleString()}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${summary.total_queries}</div>
        <div class="stat-label">总查询数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${(summary.average_mrr * 100).toFixed(1)}%</div>
        <div class="stat-label">平均 MRR</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${(summary.overall_pass_rate * 100).toFixed(1)}%</div>
        <div class="stat-label">通过率</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.total_chunks}</div>
        <div class="stat-label">知识块总数</div>
      </div>
    </div>

    ${issues.length > 0 ? `
    <div class="issues-banner">
      ${severityCount.high > 0 ? `<div class="issue-badge issue-high">🔴 严重: ${severityCount.high}</div>` : ''}
      ${severityCount.medium > 0 ? `<div class="issue-badge issue-medium">🟡 中等: ${severityCount.medium}</div>` : ''}
      ${severityCount.low > 0 ? `<div class="issue-badge issue-low">🟢 轻微: ${severityCount.low}</div>` : ''}
    </div>` : ''}

    ${query_metrics.map((metric, index) => {
      const queryResult = queryMap.get(metric.query_id);
      if (!queryResult) return '';
      
      const isPass = metric.overall_score >= report.rules_applied.minimum_acceptable_score;
      const rankClasses = ['', 'rank-1', 'rank-2', 'rank-3'];
      
      return `
    <div class="query-section">
      <div class="query-header" onclick="toggleQuery(${index})">
        <div class="query-title">
          <span class="query-id">${metric.query_id}</span>
          <span class="query-text">${queryResult.query}</span>
        </div>
        <div class="query-score">
          <span class="score-badge ${isPass ? 'score-pass' : 'score-fail'}">
            ${metric.overall_score.toFixed(3)}
          </span>
        </div>
      </div>
      <div class="query-content" id="query-content-${index}">
        <div class="metrics-row">
          <div class="metric-item">
            <div class="value">${(metric.mrr * 100).toFixed(1)}%</div>
            <div class="label">MRR</div>
          </div>
          <div class="metric-item">
            <div class="value">${(metric.reference_coverage * 100).toFixed(1)}%</div>
            <div class="label">引用覆盖率</div>
          </div>
          <div class="metric-item">
            <div class="value">${metric.expired_doc_hits}</div>
            <div class="label">过期命中</div>
          </div>
          ${Object.entries(metric.top_k_recall).map(([k, recall]) => `
          <div class="metric-item">
            <div class="value">${(recall * 100).toFixed(1)}%</div>
            <div class="label">Recall@${k}</div>
          </div>`).join('')}
        </div>
        
        ${(queryResult.expected_chunks.length > 0 || queryResult.expected_documents.length > 0) ? `
        <div class="expected-section">
          <div class="expected-title">🎯 期望引用</div>
          <div class="expected-list">
            ${queryResult.expected_chunks.map(id => `<span class="expected-item">📄 Chunk: ${id}</span>`).join('')}
            ${queryResult.expected_documents.map(id => `<span class="expected-item">📁 Doc: ${id}</span>`).join('')}
          </div>
        </div>` : ''}
        
        <h3 style="margin-bottom: 15px; color: #4a5568;">📊 检索排名</h3>
        <table class="results-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>Chunk ID</th>
              <th>Document ID</th>
              <th>相似度</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${queryResult.actual_results.map(result => {
              const isExpectedChunk = queryResult.expected_chunks.includes(result.chunk.id);
              const isExpectedDoc = queryResult.expected_documents.includes(result.chunk.document_id);
              const isExpected = isExpectedChunk || isExpectedDoc;
              const rankClass = rankClasses[result.rank] || 'rank-other';
              
              return `
            <tr>
              <td><span class="rank-badge ${rankClass}">${result.rank}</span></td>
              <td><code>${result.chunk.id}</code></td>
              <td><code>${result.chunk.document_id}</code></td>
              <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span>${(result.score * 100).toFixed(1)}%</span>
                  <div class="score-bar" style="width: 80px;">
                    <div class="score-fill" style="width: ${result.score * 100}%;"></div>
                  </div>
                </div>
              </td>
              <td>${isExpected ? '<span class="expected-tag">✅ 期望</span>' : ''}</td>
            </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
    }).join('')}
  </div>

  <script>
    function toggleQuery(index) {
      const content = document.getElementById('query-content-' + index);
      content.classList.toggle('expanded');
    }
    
    document.querySelectorAll('.query-content').forEach((el, i) => {
      if (i === 0) el.classList.add('expanded');
    });
  </script>
</body>
</html>`;

    return html;
  }

  async writeReport(
    report: EvaluationReport,
    queryResults: QueryResult[]
  ): Promise<{ issuesPath: string; reportPath: string; htmlPath: string }> {
    await this.ensureOutputDir();

    const issuesCSV = this.generateIssuesCSV(report.issues);
    const issuesPath = `${this.outputDir}/issues.csv`;
    await fs.writeFile(issuesPath, issuesCSV, 'utf-8');

    const markdownReport = this.generateMarkdownReport(report);
    const reportPath = `${this.outputDir}/rag_eval_report.md`;
    await fs.writeFile(reportPath, markdownReport, 'utf-8');

    const htmlPreview = this.generateHTMLPreview(report, queryResults);
    const htmlPath = `${this.outputDir}/ranking_preview.html`;
    await fs.writeFile(htmlPath, htmlPreview, 'utf-8');

    return { issuesPath, reportPath, htmlPath };
  }
}
