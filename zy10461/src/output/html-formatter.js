class HtmlFormatter {
  format(report) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>环境变量影子分析报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; text-align: center; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .card h2 { font-size: 20px; margin-bottom: 20px; color: #1a202c; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
    .stat-item { text-align: center; padding: 20px; background: #f7fafc; border-radius: 8px; }
    .stat-item .number { font-size: 32px; font-weight: bold; color: #4a5568; }
    .stat-item .label { font-size: 14px; color: #718096; margin-top: 4px; }
    .stat-item.warning .number { color: #d69e2e; }
    .stat-item.danger .number { color: #c53030; }
    .stat-item.success .number { color: #38a169; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f7fafc; font-weight: 600; color: #4a5568; }
    tr:hover { background: #f7fafc; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-dotenv { background: #ebf8ff; color: #2b6cb0; }
    .badge-shell { background: #f0fff4; color: #2f855a; }
    .badge-compose { background: #faf5ff; color: #6b46c1; }
    .variable-row { cursor: pointer; }
    .override-detail { display: none; background: #fff5f5; }
    .override-detail.show { display: table-row; }
    .override-item { padding: 12px 24px; border-left: 3px solid #fc8181; margin-bottom: 8px; background: white; border-radius: 0 6px 6px 0; }
    .winner-badge { background: #c6f6d5; color: #276749; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .overridden-badge { background: #fed7d7; color: #c53030; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .error-item { background: #fff5f5; border-left: 4px solid #fc8181; padding: 16px; margin-bottom: 12px; border-radius: 0 6px 6px 0; }
    .error-type { font-weight: 600; color: #c53030; margin-bottom: 8px; }
    .error-location { color: #718096; font-size: 14px; font-family: monospace; }
    .error-content { color: #4a5568; font-family: monospace; background: #f7fafc; padding: 8px; border-radius: 4px; margin-top: 8px; }
    .footer { text-align: center; padding: 24px; color: #718096; font-size: 14px; }
    .chain-indicator { color: #a0aec0; margin: 0 8px; }
    .truncated { color: #a0aec0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 环境变量影子分析报告</h1>
      <p>ENV Shadow CLI Analysis Report</p>
      <p style="margin-top: 12px;">生成时间: ${report.generatedAt}</p>
      <p>分析目录: ${report.inputDirectory}</p>
    </div>

    <div class="card">
      <h2>📊 统计摘要</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="number">${report.statistics.totalVariables}</div>
          <div class="label">唯一变量总数</div>
        </div>
        <div class="stat-item">
          <div class="number">${report.statistics.totalDefinitions}</div>
          <div class="label">总定义次数</div>
        </div>
        <div class="stat-item warning">
          <div class="number">${report.statistics.overriddenCount}</div>
          <div class="label">被覆盖变量数</div>
        </div>
        <div class="stat-item success">
          <div class="number">${report.statistics.noOverrides}</div>
          <div class="label">无覆盖变量数</div>
        </div>
        <div class="stat-item">
          <div class="number">${report.statistics.uniqueSources}</div>
          <div class="label">源文件数量</div>
        </div>
        ${report.statistics.errorCount > 0 ? `
        <div class="stat-item danger">
          <div class="number">${report.statistics.errorCount}</div>
          <div class="label">错误数量</div>
        </div>` : ''}
      </div>
    </div>

    <div class="card">
      <h2>📁 源文件列表</h2>
      <table>
        <thead>
          <tr>
            <th>文件路径</th>
            <th>类型</th>
            <th>变量数量</th>
          </tr>
        </thead>
        <tbody>
          ${report.sources.map(s => `
          <tr>
            <td><code>${s.path}</code></td>
            <td><span class="badge badge-${s.type}">${s.type}</span></td>
            <td>${s.variableCount}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>🔄 变量覆盖链追踪</h2>
      <table>
        <thead>
          <tr>
            <th>变量名</th>
            <th>最终值</th>
            <th>来源类型</th>
            <th>状态</th>
            <th>覆盖次数</th>
          </tr>
        </thead>
        <tbody>
          ${report.variables.map(v => `
          <tr class="variable-row" onclick="toggleDetail('${v.name}')">
            <td><strong>${v.name}</strong></td>
            <td><code>${this._escapeHtml(this._truncateValue(v.finalValue, 40))}</code></td>
            <td><span class="badge badge-${v.winner.sourceType}">${v.winner.sourceType}</span></td>
            <td>${v.isOverridden ? '<span class="overridden-badge">被覆盖</span>' : '<span class="winner-badge">唯一值</span>'}</td>
            <td>${v.overrideCount}</td>
          </tr>
          <tr class="override-detail" id="detail-${v.name}">
            <td colspan="5">
              <div style="padding: 16px;">
                <div style="margin-bottom: 12px;">
                  <span class="winner-badge">🏆 最终生效</span>
                  <code style="margin-left: 12px;">${v.name}=${this._escapeHtml(v.finalValue)}</code>
                  <div style="color: #718096; font-size: 14px; margin-top: 4px;">
                    📍 ${v.winner.source}${v.winner.lineNumber ? ':' + v.winner.lineNumber : ''}
                  </div>
                </div>
                ${v.overrideChain.map(link => `
                <div class="override-item">
                  <div>
                    <span class="chain-indicator">↳</span>
                    <span style="color: #c53030;">被覆盖</span>:
                    <code>${v.name}=${this._escapeHtml(link.definition.value)}</code>
                  </div>
                  <div style="color: #718096; font-size: 14px; margin-top: 4px;">
                    📍 ${link.definition.source}${link.definition.lineNumber ? ':' + link.definition.lineNumber : ''}
                  </div>
                </div>
                `).join('')}
              </div>
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      <p style="margin-top: 16px; color: #718096; font-size: 14px;">💡 点击变量行可展开查看完整覆盖链</p>
    </div>

    ${report.errors.length > 0 ? `
    <div class="card">
      <h2>❌ 解析错误</h2>
      ${report.errors.map(e => `
      <div class="error-item">
        <div class="error-type">${e.type}</div>
        <div>${e.message}</div>
        <div class="error-location">
          ${e.source ? `📍 文件: ${e.source}` : ''}
          ${e.lineNumber ? ` | 行号: ${e.lineNumber}` : ''}
          ${e.column ? ` | 列: ${e.column}` : ''}
        </div>
        ${e.line ? `<div class="error-content">${this._escapeHtml(e.line)}</div>` : ''}
      </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="footer">
      <p>由 env-shadow-cli 生成</p>
    </div>
  </div>

  <script>
    function toggleDetail(name) {
      const detail = document.getElementById('detail-' + name);
      if (detail) {
        detail.classList.toggle('show');
      }
    }
  </script>
</body>
</html>`;
  }

  _escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _truncateValue(value, maxLength) {
    const str = String(value);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
}

module.exports = HtmlFormatter;
