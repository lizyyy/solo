const fs = require('fs');
const path = require('path');

function exportHTML(results, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const htmlContent = generateHTML(results);
  fs.writeFileSync(outputPath, htmlContent, 'utf-8');

  return outputPath;
}

function generateHTML(results) {
  const { summary, missingAssets, validAssets } = results;
  const scanTime = new Date().toLocaleString('zh-CN');

  const missingAssetsHTML = missingAssets.map(asset => generateAssetCard(asset, 'danger')).join('');
  const validAssetsHTML = validAssets.slice(0, 20).map(asset => generateAssetCard(asset, 'success')).join('');

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>前端资源404扫描报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f7fa;
            color: #333;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        .header .meta {
            opacity: 0.9;
            font-size: 14px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            text-align: center;
        }
        .stat-card .number {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-card .label {
            color: #666;
            font-size: 14px;
        }
        .stat-card.danger .number { color: #e74c3c; }
        .stat-card.warning .number { color: #f39c12; }
        .stat-card.success .number { color: #27ae60; }
        .stat-card.info .number { color: #3498db; }
        
        .missing-types {
            background: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .missing-types h2 {
            font-size: 18px;
            margin-bottom: 20px;
            color: #333;
        }
        .type-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
        }
        .type-item {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .type-item .icon {
            font-size: 24px;
            margin-bottom: 5px;
        }
        .type-item .count {
            font-size: 24px;
            font-weight: bold;
        }
        .type-item .name {
            font-size: 12px;
            color: #666;
        }
        
        .section {
            background: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .section h2 {
            font-size: 20px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #eee;
        }
        .asset-card {
            border: 1px solid #eee;
            border-radius: 8px;
            margin-bottom: 15px;
            overflow: hidden;
        }
        .asset-card.danger {
            border-left: 4px solid #e74c3c;
        }
        .asset-card.success {
            border-left: 4px solid #27ae60;
        }
        .asset-header {
            padding: 15px;
            background: #fafafa;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .asset-url {
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 14px;
            word-break: break-all;
        }
        .asset-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .asset-badge.danger { background: #fee; color: #c33; }
        .asset-badge.success { background: #efe; color: #3c3; }
        .asset-badge.type { background: #eef; color: #369; }
        .asset-details {
            padding: 15px;
        }
        .detail-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #f5f5f5;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            width: 100px;
            color: #888;
            font-size: 13px;
            flex-shrink: 0;
        }
        .detail-value {
            flex: 1;
            font-size: 13px;
            font-family: 'Monaco', 'Consolas', monospace;
            word-break: break-all;
        }
        .occurrences {
            margin-top: 15px;
        }
        .occurrences h4 {
            font-size: 13px;
            color: #666;
            margin-bottom: 10px;
        }
        .occurrence-item {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 8px;
            font-size: 12px;
        }
        .occurrence-location {
            font-family: 'Monaco', 'Consolas', monospace;
            color: #667eea;
            margin-bottom: 5px;
        }
        .occurrence-context {
            background: #fff;
            padding: 8px;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', monospace;
            color: #555;
            overflow-x: auto;
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #999;
        }
        .empty-state .icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #999;
            font-size: 13px;
        }
        .source-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            margin-right: 8px;
        }
        .source-badge.html { background: #e3f2fd; color: #1976d2; }
        .source-badge.css { background: #f3e5f5; color: #7b1fa2; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 前端资源404扫描报告</h1>
            <div class="meta">
                📁 扫描目录: ${summary.baseDir}<br>
                🕐 生成时间: ${scanTime}<br>
                ⏱️ 扫描耗时: ${summary.scanDuration}ms
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card info">
                <div class="number">${summary.totalFilesScanned}</div>
                <div class="label">扫描文件数</div>
            </div>
            <div class="stat-card info">
                <div class="number">${summary.totalAssetsFound}</div>
                <div class="label">发现资源数</div>
            </div>
            <div class="stat-card ${summary.missingAssetsCount > 0 ? 'danger' : 'success'}">
                <div class="number">${summary.missingAssetsCount}</div>
                <div class="label">缺失资源数</div>
            </div>
            <div class="stat-card success">
                <div class="number">${summary.totalAssetsFound - summary.missingAssetsCount}</div>
                <div class="label">正常资源数</div>
            </div>
        </div>

        <div class="missing-types">
            <h2>📊 缺失资源分类统计</h2>
            <div class="type-grid">
                <div class="type-item">
                    <div class="icon">🖼️</div>
                    <div class="count">${summary.missingByType.image}</div>
                    <div class="name">图片</div>
                </div>
                <div class="type-item">
                    <div class="icon">🔤</div>
                    <div class="count">${summary.missingByType.font}</div>
                    <div class="name">字体</div>
                </div>
                <div class="type-item">
                    <div class="icon">🎨</div>
                    <div class="count">${summary.missingByType.css}</div>
                    <div class="name">样式</div>
                </div>
                <div class="type-item">
                    <div class="icon">📜</div>
                    <div class="count">${summary.missingByType.script}</div>
                    <div class="name">脚本</div>
                </div>
                <div class="type-item">
                    <div class="icon">🎬</div>
                    <div class="count">${summary.missingByType.media}</div>
                    <div class="name">媒体</div>
                </div>
                <div class="type-item">
                    <div class="icon">📦</div>
                    <div class="count">${summary.missingByType.other}</div>
                    <div class="name">其他</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>❌ 缺失资源详情</h2>
            ${missingAssets.length > 0 ? missingAssetsHTML : `
                <div class="empty-state">
                    <div class="icon">🎉</div>
                    <div>太棒了！没有发现缺失的资源</div>
                </div>
            `}
        </div>

        ${validAssets.length > 0 ? `
        <div class="section">
            <h2>✅ 正常资源示例（展示前20个）</h2>
            ${validAssetsHTML}
        </div>
        ` : ''}

        <div class="footer">
            由 asset-404-scanner 生成 | 建议在部署前运行此检查以避免线上404问题
        </div>
    </div>
</body>
</html>`;
}

function generateAssetCard(asset, status) {
  const typeIcons = {
    image: '🖼️',
    font: '🔤',
    css: '🎨',
    script: '📜',
    media: '🎬',
    other: '📦'
  };

  const occurrencesHTML = asset.occurrences.map(occ => `
    <div class="occurrence-item">
      <div class="occurrence-location">
        <span class="source-badge ${occ.source}">${occ.source.toUpperCase()}</span>
        ${occ.filePath}:${occ.line}:${occ.column}
      </div>
      <div class="occurrence-context">${escapeHtml(occ.context)}</div>
    </div>
  `).join('');

  return `
    <div class="asset-card ${status}">
      <div class="asset-header">
        <div class="asset-url">
          <span>${typeIcons[asset.type] || '📎'}</span>
          ${escapeHtml(asset.url)}
        </div>
        <div>
          <span class="asset-badge type">${asset.type}</span>
          <span class="asset-badge ${status}" style="margin-left: 8px;">
            ${status === 'danger' ? '缺失' : '正常'}
          </span>
        </div>
      </div>
      <div class="asset-details">
        <div class="detail-row">
          <div class="detail-label">解析路径</div>
          <div class="detail-value">${escapeHtml(asset.resolvedPath)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">绝对路径</div>
          <div class="detail-value">${escapeHtml(asset.absolutePath)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">引用次数</div>
          <div class="detail-value">${asset.occurrenceCount} 次</div>
        </div>
        <div class="occurrences">
          <h4>📍 引用位置</h4>
          ${occurrencesHTML}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { exportHTML };
