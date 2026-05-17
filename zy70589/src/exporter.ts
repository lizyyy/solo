import * as fs from 'fs/promises';
import * as path from 'path';
import { ReportData, BaselineEntry } from './types.js';

export async function exportJsonReport(reportData: ReportData, outputPath: string): Promise<void> {
  const absolutePath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, JSON.stringify(reportData, null, 2), 'utf-8');
}

export async function exportBaseline(baseline: BaselineEntry[], outputPath: string): Promise<void> {
  const absolutePath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, JSON.stringify(baseline, null, 2), 'utf-8');
}

export async function exportHtmlReport(reportData: ReportData, outputPath: string): Promise<void> {
  const absolutePath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  const html = generateHtmlReport(reportData);
  await fs.writeFile(absolutePath, html, 'utf-8');
}

function generateHtmlReport(reportData: ReportData): string {
  const { summary, leaks, anomalies, parseErrors } = reportData;
  const newLeaks = leaks.filter(l => l.status === 'new');
  const baselineLeaks = leaks.filter(l => l.status === 'baseline');
  const modifiedLeaks = leaks.filter(l => l.status === 'modified');
  const generatedDate = new Date(reportData.generatedAt).toLocaleString('zh-CN');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gitleaks 基线整理报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 14px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    .stat-card .value { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
    .stat-card .label { color: #666; font-size: 14px; }
    .stat-card.new .value { color: #e53e3e; }
    .stat-card.baseline .value { color: #d69e2e; }
    .stat-card.anomaly .value { color: #9c27b0; }
    .stat-card.ok .value { color: #38a169; }
    .section { background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .section h2 { font-size: 20px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }
    .section h2.new { color: #e53e3e; border-bottom-color: #e53e3e; }
    .section h2.anomaly { color: #9c27b0; border-bottom-color: #9c27b0; }
    .section h2.baseline { color: #d69e2e; border-bottom-color: #d69e2e; }
    .section h2.error { color: #dd6b20; border-bottom-color: #dd6b20; }
    .leak-item { padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 15px; }
    .leak-item:last-child { margin-bottom: 0; }
    .leak-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .leak-file { font-family: 'SF Mono', Monaco, monospace; font-size: 14px; color: #553c9a; font-weight: 600; }
    .leak-rule { background: #edf2f7; padding: 4px 10px; border-radius: 12px; font-size: 12px; color: #4a5568; }
    .leak-description { color: #718096; font-size: 14px; margin-bottom: 8px; }
    .leak-meta { display: flex; gap: 20px; font-size: 13px; color: #a0aec0; }
    .leak-secret { background: #fff5f5; padding: 8px 12px; border-radius: 6px; font-family: 'SF Mono', Monaco, monospace; font-size: 13px; color: #c53030; word-break: break-all; margin-top: 10px; }
    .anomaly-reason { background: #faf5ff; padding: 10px 15px; border-radius: 6px; color: #702459; font-size: 14px; }
    .error-item { padding: 12px; background: #fffaf0; border-left: 4px solid #ed8936; border-radius: 0 6px 6px 0; margin-bottom: 10px; font-size: 14px; }
    .empty-state { text-align: center; padding: 40px; color: #a0aec0; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 10px; }
    .badge.danger { background: #fed7d7; color: #c53030; }
    .badge.warning { background: #feebc8; color: #c05621; }
    .badge.info { background: #bee3f8; color: #2b6cb0; }
    .footer { text-align: center; padding: 20px; color: #a0aec0; font-size: 13px; }
    .collapsible { cursor: pointer; }
    .collapsible::after { content: ' ▼'; font-size: 12px; }
    .collapsible-content { display: none; }
    .collapsible-content.show { display: block; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    th { background: #f7fafc; font-weight: 600; color: #4a5568; }
    .conclusion { padding: 20px; border-radius: 8px; margin-top: 20px; }
    .conclusion.success { background: #f0fff4; border: 1px solid #9ae6b4; }
    .conclusion.warning { background: #fff5f5; border: 1px solid #feb2b2; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Gitleaks 基线整理报告</h1>
      <div class="meta">
        <p>生成时间: ${generatedDate}</p>
        <p>扫描报告: ${reportData.scanReportPath}</p>
        ${reportData.baselinePath ? `<p>基线文件: ${reportData.baselinePath}</p>` : ''}
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="value">${summary.totalFindings}</div><div class="label">扫描发现总数</div></div>
      <div class="stat-card"><div class="value">${summary.totalBaseline}</div><div class="label">基线条目总数</div></div>
      <div class="stat-card new"><div class="value">${summary.newLeaks}</div><div class="label">新增泄漏</div></div>
      <div class="stat-card baseline"><div class="value">${summary.baselineLeaks}</div><div class="label">基线匹配</div></div>
      <div class="stat-card"><div class="value">${summary.modifiedLeaks}</div><div class="label">位置变更</div></div>
      <div class="stat-card anomaly"><div class="value">${summary.anomalies}</div><div class="label">异常样本</div></div>
      <div class="stat-card ok"><div class="value">${summary.filesAffected}</div><div class="label">影响文件数</div></div>
    </div>

    ${summary.newLeaks > 0 ? `
    <div class="section">
      <h2 class="new">⚠️ 新增泄漏 (${summary.newLeaks}) - 需立即关注</h2>
      ${newLeaks.map(leak => renderLeakItem(leak, '新增')).join('')}
    </div>
    ` : ''}

    ${summary.anomalies > 0 ? `
    <div class="section">
      <h2 class="anomaly">❓ 异常样本 (${summary.anomalies}) - 需检查数据</h2>
      ${anomalies.map(leak => renderAnomalyItem(leak)).join('')}
    </div>
    ` : ''}

    ${summary.modifiedLeaks > 0 ? `
    <div class="section">
      <h2 class="warning">🔄 位置变更 (${summary.modifiedLeaks})</h2>
      ${modifiedLeaks.map(leak => renderLeakItem(leak, '位置变更')).join('')}
    </div>
    ` : ''}

    ${parseErrors.length > 0 ? `
    <div class="section">
      <h2 class="error">⚠️ 解析错误 (${parseErrors.length})</h2>
      ${parseErrors.map((error: any) => `
        <div class="error-item">
          <strong>行 ${error.row}:</strong> ${error.reason}
          <br><small>原始数据: ${escapeHtml(error.raw?.substring(0, 100) || 'N/A')}</small>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="section">
      <h2 class="collapsible" onclick="toggleSection(this)">✅ 基线匹配条目 (${summary.baselineLeaks})</h2>
      <div class="collapsible-content">
        ${baselineLeaks.length > 0 ? `
          <table>
            <thead>
              <tr><th>文件</th><th>行号</th><th>规则</th><th>描述</th></tr>
            </thead>
            <tbody>
              ${baselineLeaks.map(leak => `
                <tr>
                  <td><code>${escapeHtml(leak.file)}</code></td>
                  <td>${leak.line}</td>
                  <td>${escapeHtml(leak.ruleId)}</td>
                  <td>${escapeHtml(leak.description)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div class="empty-state">暂无基线条目</div>'}
      </div>
    </div>

    <div class="section">
      <h2>📋 结论</h2>
      ${summary.newLeaks === 0 && summary.anomalies === 0 ? `
        <div class="conclusion success">
          <strong>✅ 检查通过！</strong> 没有发现新增泄漏和异常样本。
        </div>
      ` : `
        <div class="conclusion warning">
          <strong>⚠️ 需要关注！</strong>
          <ul style="margin-top: 10px; margin-left: 20px;">
            ${summary.newLeaks > 0 ? `<li>发现 ${summary.newLeaks} 条新增泄漏，请及时确认和处理。</li>` : ''}
            ${summary.anomalies > 0 ? `<li>发现 ${summary.anomalies} 条异常样本，请检查数据源是否正确。</li>` : ''}
          </ul>
        </div>
      `}
    </div>

    <div class="footer">
      <p>本报告由 Gitleaks 基线整理工具自动生成</p>
    </div>
  </div>

  <script>
    function toggleSection(header) {
      const content = header.nextElementSibling;
      content.classList.toggle('show');
      header.classList.toggle('expanded');
    }
  </script>
</body>
</html>`;
}

function renderLeakItem(leak: any, status: string): string {
  const badgeClass = status === '新增' ? 'danger' : 'warning';
  return `
    <div class="leak-item">
      <div class="leak-header">
        <span class="leak-file">📄 ${escapeHtml(leak.file)}:${leak.line}</span>
        <div>
          <span class="leak-rule">${escapeHtml(leak.ruleId)}</span>
          <span class="badge ${badgeClass}">${status}</span>
        </div>
      </div>
      <div class="leak-description">${escapeHtml(leak.description)}</div>
      ${leak.author ? `
        <div class="leak-meta">
          <span>👤 ${escapeHtml(leak.author)}</span>
          <span>📅 ${leak.date ? leak.date.substring(0, 10) : 'N/A'}</span>
          ${leak.commit ? `<span>🔗 ${leak.commit.substring(0, 8)}</span>` : ''}
        </div>
      ` : ''}
      <div class="leak-secret">🔑 ${escapeHtml(maskSecret(leak.secret))}</div>
    </div>
  `;
}

function renderAnomalyItem(leak: any): string {
  return `
    <div class="leak-item">
      <div class="leak-header">
        <span class="leak-file">📄 ${escapeHtml(leak.file || '未知文件')}:${leak.line || 'N/A'}</span>
        <span class="badge danger">异常</span>
      </div>
      <div class="anomaly-reason">❌ ${escapeHtml(leak.anomalyReason || '未知原因')}</div>
      <div style="margin-top: 10px; font-size: 13px; color: #718096;">
        <strong>原始指纹:</strong> <code>${escapeHtml(leak.fingerprint || 'N/A')}</code>
      </div>
    </div>
  `;
}

function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '*'.repeat(secret.length);
  return secret.substring(0, 4) + '*'.repeat(secret.length - 8) + secret.substring(secret.length - 4);
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
