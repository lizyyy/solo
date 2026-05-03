import * as http from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PluginAuditReport, BatchAuditReport } from './types';
import { ReportGenerator } from './report-generator';

interface ServerConfig {
  port: number;
  outputDir: string;
  reports: PluginAuditReport[];
  batchReport: BatchAuditReport | null;
}

export class ReportWebServer {
  private server: http.Server | null = null;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      const reportGenerator = new ReportGenerator(this.config.outputDir);

      this.server = http.createServer(async (req, res) => {
        try {
          const url = req.url || '/';
          
          if (url === '/' || url === '/index.html') {
            this.serveHomePage(res, reportGenerator);
          } else if (url.startsWith('/report/')) {
            const pluginName = decodeURIComponent(url.slice('/report/'.length));
            this.servePluginReport(res, pluginName, reportGenerator);
          } else if (url.startsWith('/static/')) {
            this.serveStatic(res, url);
          } else if (url === '/api/reports') {
            this.serveApiReports(res);
          } else {
            this.serve404(res);
          }
        } catch (error) {
          console.error('Server error:', error);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      });

      this.server.listen(this.config.port, () => {
        console.log(`\n========================================`);
        console.log(`🚀 报告服务器已启动`);
        console.log(`   访问地址: http://localhost:${this.config.port}`);
        console.log(`   按 Ctrl+C 停止服务器`);
        console.log(`========================================\n`);
        resolve(this.config.port);
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('\n报告服务器已停止');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private serveHomePage(res: http.ServerResponse, reportGenerator: ReportGenerator): void {
    const batchReport = this.config.batchReport;
    const reports = this.config.reports;

    let reportListHtml = '';
    if (batchReport) {
      reportListHtml = `
        <div class="summary-grid">
          <div class="summary-card total">
            <div class="number">${batchReport.summary.total}</div>
            <div class="label">插件总数</div>
          </div>
          <div class="summary-card passed">
            <div class="number">${batchReport.summary.passed}</div>
            <div class="label">✅ 通过</div>
          </div>
          <div class="summary-card failed">
            <div class="number">${batchReport.summary.failed}</div>
            <div class="label">❌ 失败</div>
          </div>
          <div class="summary-card crashed">
            <div class="number">${batchReport.summary.crashed}</div>
            <div class="label">💥 崩溃</div>
          </div>
          <div class="summary-card timeout">
            <div class="number">${batchReport.summary.timeout}</div>
            <div class="label">⏱️ 超时</div>
          </div>
          <div class="summary-card violations">
            <div class="number">${batchReport.summary.violations}</div>
            <div class="label">⚠️ 违规</div>
          </div>
        </div>
      `;
    }

    let pluginTableHtml = `
      <table>
        <thead>
          <tr>
            <th>插件名称</th>
            <th>版本</th>
            <th>状态</th>
            <th>严重违规</th>
            <th>高违规</th>
            <th>中违规</th>
            <th>低警告</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const report of reports) {
      const criticalCount = report.findings.filter(f => f.severity === 'critical' && f.type === 'violation').length;
      const highCount = report.findings.filter(f => f.severity === 'high' && f.type === 'violation').length;
      const mediumCount = report.findings.filter(f => f.severity === 'medium' && f.type === 'violation').length;
      const lowCount = report.findings.filter(f => f.severity === 'low' || f.type === 'warning').length;

      const hasViolations = report.findings.some(f => f.type === 'violation');
      
      let statusText = '通过';
      let statusClass = 'status-success';
      
      if (!report.runSummary.success) {
        statusText = report.runSummary.timeout ? '超时' : '崩溃';
        statusClass = 'status-error';
      } else if (hasViolations) {
        statusText = '有违规';
        statusClass = 'status-warning';
      }

      pluginTableHtml += `
        <tr>
          <td><strong>${report.pluginName}</strong></td>
          <td>${report.pluginVersion}</td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
          <td><span class="count critical">${criticalCount}</span></td>
          <td><span class="count high">${highCount}</span></td>
          <td><span class="count medium">${mediumCount}</span></td>
          <td><span class="count low">${lowCount}</span></td>
          <td><a href="/report/${encodeURIComponent(report.pluginName)}" class="btn">查看报告</a></td>
        </tr>
      `;
    }

    pluginTableHtml += `
        </tbody>
      </table>
    `;

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>插件沙盒权限审计报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f7fa;
      padding: 40px 20px;
      color: #333;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 2rem; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 0.9rem; }

    .card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .card h2 {
      font-size: 1.3rem;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #eee;
      color: #1a1a2e;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 15px;
    }
    @media (max-width: 1024px) {
      .summary-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 600px) {
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .summary-card {
      text-align: center;
      padding: 20px;
      border-radius: 8px;
    }
    .summary-card.total { background: #f8fafc; }
    .summary-card.passed { background: #dcfce7; }
    .summary-card.failed { background: #fee2e2; }
    .summary-card.crashed { background: #fecaca; }
    .summary-card.timeout { background: #fef3c7; }
    .summary-card.violations { background: #fed7d7; }
    .summary-card .number { font-size: 2rem; font-weight: 700; margin-bottom: 5px; }
    .summary-card .label { font-size: 0.85rem; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      font-size: 0.85rem;
      text-transform: uppercase;
    }
    tr:hover { background: #f8fafc; }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .status-success { background: #dcfce7; color: #166534; }
    .status-warning { background: #fef9c3; color: #854d0e; }
    .status-error { background: #fee2e2; color: #991b1b; }

    .count {
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .count.critical { background: #fee2e2; color: #991b1b; }
    .count.high { background: #fed7aa; color: #9a3412; }
    .count.medium { background: #fef3c7; color: #92400e; }
    .count.low { background: #dbeafe; color: #1e40af; }

    .btn {
      display: inline-block;
      padding: 8px 16px;
      background: #667eea;
      color: white !important;
      text-decoration: none;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      transition: background 0.2s;
    }
    .btn:hover { background: #5a67d8; }

    .footer {
      text-align: center;
      padding: 30px;
      color: #64748b;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 插件沙盒权限审计报告</h1>
      <div class="meta">
        运行时间: ${new Date().toISOString()} | 
        报告数量: ${reports.length}
      </div>
    </div>

    ${reportListHtml ? `<div class="card"><h2>📊 审计摘要</h2>${reportListHtml}</div>` : ''}

    <div class="card">
      <h2>📦 插件列表</h2>
      ${pluginTableHtml}
    </div>

    <div class="footer">
      由 Plugin Sandbox Auditor 生成 | 
      <a href="#" onclick="history.back(); return false;" style="color: #667eea;">返回</a>
    </div>
  </div>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  private servePluginReport(
    res: http.ServerResponse, 
    pluginName: string, 
    reportGenerator: ReportGenerator
  ): void {
    const report = this.config.reports.find(r => r.pluginName === pluginName);
    
    if (!report) {
      this.serve404(res);
      return;
    }

    const html = reportGenerator.generateHtmlReport(report);
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  private serveApiReports(res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      batchReport: this.config.batchReport,
      reports: this.config.reports,
    }));
  }

  private serveStatic(res: http.ServerResponse, url: string): void {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  private serve404(res: http.ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>404 - 页面不存在</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>404 - 页面不存在</h1>
        <p>请求的页面不存在，请检查 URL 是否正确</p>
        <a href="/" style="color: #667eea;">返回首页</a>
      </body>
      </html>
    `);
  }
}

export default ReportWebServer;
