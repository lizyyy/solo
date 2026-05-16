const fs = require('fs');
const path = require('path');

function generateBarChart(stats, maxCount) {
  return stats.map(s => {
    const width = maxCount ? (s.count / maxCount * 100) : 0;
    const color = s.bucket >= stats.length - 2 ? '#dc2626' : s.bucket >= stats.length - 3 ? '#f59e0b' : '#10b981';
    return `<div style="margin: 4px 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
        <span>${s.label}</span>
        <span>${s.count} (${s.percentage}%)</span>
      </div>
      <div style="background: #e5e7eb; height: 20px; border-radius: 4px; overflow: hidden;">
        <div style="width: ${width}%; height: 100%; background: ${color}; transition: width 0.3s;"></div>
      </div>
    </div>`;
  }).join('');
}

function generateDomainTable(domains) {
  return domains.slice(0, 15).map((d, i) => {
    const slowCount = d.buckets.slice(3).reduce((a, b) => a + b, 0);
    return `<tr style="${i % 2 === 0 ? 'background: #f9fafb;' : ''}">
      <td style="padding: 8px 12px; text-align: left;">${d.domain}</td>
      <td style="padding: 8px 12px; text-align: center;">${d.count}</td>
      <td style="padding: 8px 12px; text-align: center;">${d.avgLatency}ms</td>
      <td style="padding: 8px 12px; text-align: center; ${slowCount > 0 ? 'color: #dc2626; font-weight: 600;' : ''}">${slowCount}</td>
    </tr>`;
  }).join('');
}

function generateTypeTable(types) {
  const typeColors = {
    html: '#3b82f6',
    css: '#8b5cf6',
    js: '#f59e0b',
    image: '#10b981',
    font: '#06b6d4',
    json: '#ec4899',
    other: '#6b7280'
  };
  return types.map((t, i) => {
    const color = typeColors[t.type] || '#6b7280';
    return `<tr style="${i % 2 === 0 ? 'background: #f9fafb;' : ''}">
      <td style="padding: 8px 12px; text-align: left;">
        <span style="display: inline-block; width: 12px; height: 12px; background: ${color}; border-radius: 2px; margin-right: 8px;"></span>
        ${t.type}
      </td>
      <td style="padding: 8px 12px; text-align: center;">${t.count}</td>
      <td style="padding: 8px 12px; text-align: center;">${t.avgLatency}ms</td>
    </tr>`;
  }).join('');
}

function generateSlowestTable(requests) {
  return requests.slice(0, 15).map((r, i) => {
    const latencyColor = r.latency > 5000 ? '#dc2626' : r.latency > 2000 ? '#f59e0b' : '#6b7280';
    return `<tr style="${i % 2 === 0 ? 'background: #f9fafb;' : ''}">
      <td style="padding: 8px 12px; text-align: center;">${i + 1}</td>
      <td style="padding: 8px 12px; text-align: center; color: ${latencyColor}; font-weight: 600;">${r.latency}ms</td>
      <td style="padding: 8px 12px; text-align: left; font-size: 12px;">${r.domain}</td>
      <td style="padding: 8px 12px; text-align: left; font-size: 12px; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.url}">
        ${r.method} ${r.url}
      </td>
      <td style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280;">${r.source}</td>
    </tr>`;
  }).join('');
}

function generateErrorsTable(errors) {
  return errors.map((e, i) => {
    return `<tr style="${i % 2 === 0 ? 'background: #fef2f2;' : ''}">
      <td style="padding: 8px 12px; text-align: center;">${e.index}</td>
      <td style="padding: 8px 12px; text-align: left; font-size: 11px; color: #dc2626;">${e.errors.join(', ')}</td>
      <td style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280;">${e.source}</td>
    </tr>`;
  }).join('');
}

async function generateHtmlReport(result, outputDir) {
  const { metadata, summary, domains, resourceTypes, statusCodes, topSlowest, errors } = result;

  const maxBucketCount = Math.max(...summary.bucketStats.map(s => s.count));

  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HAR 延迟分析报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; color: #111827; line-height: 1.5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 32px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 16px; }
    .meta-card { background: rgba(255,255,255,0.15); padding: 12px 16px; border-radius: 8px; backdrop-filter: blur(4px); }
    .meta-card .label { font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-card .value { font-size: 20px; font-weight: 700; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 8px; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #f9fafb; padding: 10px 12px; text-align: left; font-weight: 600; font-size: 13px; color: #4b5563; border-bottom: 2px solid #e5e7eb; }
    .table td { border-bottom: 1px solid #f3f4f6; }
    .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 16px; }
    .error-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 0 8px 8px 0; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 500; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-error { background: #fee2e2; color: #991b1b; }
    .badge-warning { background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 HAR 延迟分析报告</h1>
      <p>${metadata.harFile} • ${new Date(metadata.analyzedAt).toLocaleString()}</p>
      <div class="meta-grid">
        <div class="meta-card">
          <div class="label">总条目</div>
          <div class="value">${metadata.totalEntries}</div>
        </div>
        <div class="meta-card">
          <div class="label">有效请求</div>
          <div class="value" style="color: #86efac;">${metadata.validEntries}</div>
        </div>
        ${errors.length > 0 ? `
        <div class="meta-card">
          <div class="label">异常</div>
          <div class="value" style="color: #fca5a5;">${errors.length}</div>
        </div>` : ''}
        <div class="meta-card">
          <div class="label">平均延迟</div>
          <div class="value">${summary.avgLatency}ms</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">⏱️ 延迟分布</div>
      ${generateBarChart(summary.bucketStats, maxBucketCount)}
    </div>

    <div class="section">
      <div class="section-title">🌐 域名统计</div>
      <table class="table">
        <thead>
          <tr>
            <th>域名</th>
            <th style="text-align: center;">请求数</th>
            <th style="text-align: center;">平均延迟</th>
            <th style="text-align: center;">慢请求(>2s)</th>
          </tr>
        </thead>
        <tbody>
          ${generateDomainTable(domains)}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">📁 资源类型</div>
      <table class="table">
        <thead>
          <tr>
            <th>类型</th>
            <th style="text-align: center;">请求数</th>
            <th style="text-align: center;">平均延迟</th>
          </tr>
        </thead>
        <tbody>
          ${generateTypeTable(resourceTypes)}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">🐢 TOP 最慢请求</div>
      <table class="table">
        <thead>
          <tr>
            <th style="text-align: center;">#</th>
            <th style="text-align: center;">延迟</th>
            <th>域名</th>
            <th>URL</th>
            <th>源位置</th>
          </tr>
        </thead>
        <tbody>
          ${generateSlowestTable(topSlowest)}
        </tbody>
      </table>
    </div>

    ${errors.length > 0 ? `
    <div class="section">
      <div class="section-title" style="color: #dc2626;">⚠️ 异常条目 (${errors.length})</div>
      <div class="warning-box">
        <strong>注意:</strong> 以下条目存在数据问题，已从统计中排除，但保留在此处供追溯。原始源位置可用于定位 HAR 文件中的具体条目。
      </div>
      <table class="table">
        <thead>
          <tr>
            <th style="text-align: center;">索引</th>
            <th>错误</th>
            <th>源位置</th>
          </tr>
        </thead>
        <tbody>
          ${generateErrorsTable(errors)}
        </tbody>
      </table>
    </div>` : ''}

    <div style="text-align: center; color: #6b7280; font-size: 12px; padding: 16px;">
      HAR 延迟分桶工具 • 生成于 ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;

  const htmlPath = path.join(outputDir, 'report.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
}

module.exports = { generateHtmlReport };
