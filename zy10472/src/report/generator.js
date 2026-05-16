const fs = require('fs').promises;
const path = require('path');

class ReportGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  generate({ flags, references, riskSummary, scanStats, parseErrors, invalidRecords }) {
    const html = this.generateHTML({ flags, references, riskSummary, scanStats, parseErrors, invalidRecords });
    const filePath = path.join(this.outputDir, 'report.html');
    fs.writeFile(filePath, html, 'utf-8');
    return filePath;
  }

  generateHTML({ flags, references, riskSummary, scanStats, parseErrors, invalidRecords }) {
    const generatedAt = new Date().toLocaleString('zh-CN');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feature Flag 清理报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
    h1 { font-size: 28px; margin-bottom: 10px; }
    .subtitle { opacity: 0.9; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .card-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1a1a2e; display: flex; align-items: center; gap: 8px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat-item { padding: 16px; border-radius: 8px; text-align: center; }
    .stat-item.blue { background: #e3f2fd; }
    .stat-item.green { background: #e8f5e9; }
    .stat-item.yellow { background: #fff8e1; }
    .stat-item.red { background: #ffebee; }
    .stat-value { font-size: 32px; font-weight: 700; }
    .stat-label { font-size: 14px; color: #666; margin-top: 4px; }
    .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .risk-safe { background: #e8f5e9; color: #2e7d32; }
    .risk-caution { background: #fff8e1; color: #f57f17; }
    .risk-high { background: #ffebee; color: #c62828; }
    .risk-unknown { background: #f5f5f5; color: #616161; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #555; }
    tr:hover { background: #f8f9fa; }
    .code-context { font-family: 'SF Mono', Monaco, monospace; font-size: 12px; background: #f6f8fa; padding: 8px 12px; border-radius: 6px; color: #24292e; white-space: nowrap; overflow-x: auto; }
    .source-link { color: #667eea; text-decoration: none; font-size: 12px; }
    .source-link:hover { text-decoration: underline; }
    .error-item { background: #fff5f5; border-left: 4px solid #fc8181; padding: 12px 16px; margin-bottom: 8px; border-radius: 0 6px 6px 0; }
    .warning-item { background: #fffaf0; border-left: 4px solid #ed8936; padding: 12px 16px; margin-bottom: 8px; border-radius: 0 6px 6px 0; }
    .collapsible { cursor: pointer; user-select: none; }
    .collapsible::before { content: '▶'; display: inline-block; margin-right: 8px; transition: transform 0.2s; }
    .collapsible.open::before { transform: rotate(90deg); }
    .collapsible-content { display: none; margin-top: 10px; }
    .collapsible-content.show { display: block; }
    .filter-bar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .filter-btn { padding: 8px 16px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; font-size: 14px; transition: all 0.2s; }
    .filter-btn:hover { background: #f5f5f5; }
    .filter-btn.active { background: #667eea; color: white; border-color: #667eea; }
    .search-box { padding: 8px 16px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; min-width: 250px; }
    .flag-details { background: #f8f9fa; padding: 16px; border-radius: 8px; margin-top: 10px; }
    .factor-list { list-style: none; margin-top: 8px; }
    .factor-list li { padding: 4px 0; padding-left: 20px; position: relative; font-size: 13px; color: #666; }
    .factor-list li::before { content: '•'; position: absolute; left: 0; color: #667eea; font-weight: bold; }
    @media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr 1fr; } table { font-size: 12px; } th, td { padding: 8px 10px; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚩 Feature Flag 清理报告</h1>
      <p class="subtitle">生成时间: ${generatedAt}</p>
    </header>

    <div class="card">
      <div class="card-title">📊 扫描统计</div>
      <div class="stats-grid">
        <div class="stat-item blue">
          <div class="stat-value">${scanStats.filesScanned}</div>
          <div class="stat-label">扫描文件数</div>
        </div>
        <div class="stat-item blue">
          <div class="stat-value">${(scanStats.linesScanned || 0).toLocaleString()}</div>
          <div class="stat-label">扫描行数</div>
        </div>
        <div class="stat-item blue">
          <div class="stat-value">${scanStats.matchesFound}</div>
          <div class="stat-label">发现引用数</div>
        </div>
        <div class="stat-item blue">
          <div class="stat-value">${flags.length}</div>
          <div class="stat-label">分析开关数</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">🎯 风险分级汇总</div>
      <div class="stats-grid">
        <div class="stat-item green">
          <div class="stat-value">${riskSummary.safe}</div>
          <div class="stat-label">✅ 可以安全删除</div>
        </div>
        <div class="stat-item yellow">
          <div class="stat-value">${riskSummary.caution}</div>
          <div class="stat-label">⚠️ 需要注意</div>
        </div>
        <div class="stat-item red">
          <div class="stat-value">${riskSummary.high}</div>
          <div class="stat-label">❌ 高风险</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${riskSummary.unknown}</div>
          <div class="stat-label">❓ 未知</div>
        </div>
      </div>
    </div>

    ${parseErrors && parseErrors.length > 0 ? `
    <div class="card">
      <div class="card-title">⚠️ 解析警告 (${parseErrors.length})</div>
      ${parseErrors.map(err => `
        <div class="warning-item">
          <strong>${err.source}</strong>:${err.line || 0} - ${err.error}
        </div>
      `).join('')}
    </div>` : ''}

    ${invalidRecords && invalidRecords.length > 0 ? `
    <div class="card">
      <div class="card-title">❌ 无法处理的记录 (${invalidRecords.length})</div>
      ${invalidRecords.map(rec => `
        <div class="error-item">
          <strong>${rec.source}</strong>:${rec.lineNumber} - ${rec.error}
          <br><small>原始内容: ${rec.rawContent || 'N/A'}</small>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="card">
      <div class="card-title">📋 Feature Flag 详情</div>
      <div class="filter-bar">
        <input type="text" class="search-box" placeholder="搜索开关名称..." id="searchInput">
        <button class="filter-btn active" data-filter="all">全部</button>
        <button class="filter-btn" data-filter="safe">安全</button>
        <button class="filter-btn" data-filter="caution">注意</button>
        <button class="filter-btn" data-filter="high">高风险</button>
        <button class="filter-btn" data-filter="unused">未使用</button>
      </div>
      <table id="flagsTable">
        <thead>
          <tr>
            <th>开关名称</th>
            <th>风险等级</th>
            <th>风险分</th>
            <th>引用数</th>
            <th>文件数</th>
            <th>状态</th>
            <th>负责人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${flags.map((flag, idx) => `
          <tr data-risk="${flag.riskLevel}" data-name="${flag.name.toLowerCase()}" data-unused="${flag.referenceCount === 0}">
            <td><strong>${flag.name}</strong></td>
            <td><span class="risk-badge risk-${flag.riskLevel}">${this.getRiskLabel(flag.riskLevel)}</span></td>
            <td>${flag.riskScore}</td>
            <td>${flag.referenceCount}</td>
            <td>${flag.fileCount}</td>
            <td>${flag.status || '-'}</td>
            <td>${flag.owner || '-'}</td>
            <td><button class="filter-btn collapsible" onclick="toggleDetails(${idx})">详情</button></td>
          </tr>
          <tr style="display:none;" id="details-${idx}">
            <td colspan="8">
              <div class="flag-details">
                <p><strong>💡 建议:</strong> ${flag.recommendation}</p>
                ${flag.description ? `<p><strong>📝 描述:</strong> ${flag.description}</p>` : ''}
                <p><strong>📁 来源:</strong> <span class="source-link">${flag.source?.file || 'N/A'}:${flag.source?.line || ''}</span></p>
                ${flag.riskFactors.length > 0 ? `<div><strong>🔍 风险因素:</strong><ul class="factor-list">${flag.riskFactors.map(f => `<li>${f}</li>`).join('')}</ul></div>` : ''}
                ${flag.references.length > 0 ? `
                <div style="margin-top:12px;">
                  <strong>📎 代码引用:</strong>
                  <div style="margin-top:8px;">
                    ${flag.references.slice(0, 10).map(ref => `
                      <div style="margin-bottom:8px;">
                        <span class="source-link">${ref.relativePath}:${ref.line}:${ref.column}</span>
                        <div class="code-context">${this.escapeHtml(ref.context)}</div>
                      </div>
                    `).join('')}
                    ${flag.references.length > 10 ? `<p style="color:#666;font-size:12px;">... 还有 ${flag.references.length - 10} 处引用</p>` : ''}
                  </div>
                </div>` : ''}
              </div>
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    function toggleDetails(idx) {
      const row = document.getElementById('details-' + idx);
      row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }

    const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
    const searchInput = document.getElementById('searchInput');
    const tableRows = document.querySelectorAll('#flagsTable tbody tr[data-risk]');

    function applyFilters() {
      const activeFilter = document.querySelector('.filter-btn[data-filter].active')?.dataset.filter || 'all';
      const searchTerm = searchInput.value.toLowerCase();

      tableRows.forEach(row => {
        const risk = row.dataset.risk;
        const name = row.dataset.name;
        const unused = row.dataset.unused === 'true';

        let matchesFilter = activeFilter === 'all';
        if (activeFilter === 'safe') matchesFilter = risk === 'safe';
        if (activeFilter === 'caution') matchesFilter = risk === 'caution';
        if (activeFilter === 'high') matchesFilter = risk === 'high';
        if (activeFilter === 'unused') matchesFilter = unused;

        const matchesSearch = name.includes(searchTerm);

        row.style.display = matchesFilter && matchesSearch ? '' : 'none';
      });
    }

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilters();
      });
    });

    searchInput.addEventListener('input', applyFilters);
  </script>
</body>
</html>`;
  }

  getRiskLabel(level) {
    const labels = {
      safe: '安全',
      caution: '注意',
      high: '高风险',
      unknown: '未知'
    };
    return labels[level] || level;
  }

  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = { ReportGenerator };
