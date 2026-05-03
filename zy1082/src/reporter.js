const fs = require('fs');
const path = require('path');
const { ISSUE_SEVERITY } = require('./validator');
const { ensureDirectory } = require('./utils');

const SEVERITY_EMOJI = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢'
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

class Reporter {
  constructor(options = {}) {
    this.options = options;
  }

  generateJSON(validationResult, options = {}) {
    const { pretty = true } = options;
    const data = this._prepareJSONData(validationResult);
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  generateMarkdown(validationResult, options = {}) {
    const { 
      includeDetails = true,
      includeSummary = true,
      includeAllIssues = true 
    } = options;

    const lines = [];
    const { summary, allIssues, photos, selections } = validationResult;

    lines.push('# 照片交付包校验报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    if (includeSummary) {
      lines.push('## 📊 校验摘要');
      lines.push('');
      
      const statusIcon = summary.success ? '✅' : '⚠️';
      const statusText = summary.success ? '通过' : '存在问题';
      
      lines.push(`| 项目 | 数量 |`);
      lines.push(`|------|------|`);
      lines.push(`| 📸 扫描到的照片 | ${summary.totalPhotos} |`);
      lines.push(`| 📋 选片表中的照片 | ${summary.totalSelections} |`);
      lines.push(`| ❌ 发现的问题 | ${summary.totalIssues} |`);
      lines.push(`| 🔴 严重问题 | ${summary.severityCounts.critical} |`);
      lines.push(`| 🟠 高优先级问题 | ${summary.severityCounts.high} |`);
      lines.push(`| 🟡 中优先级问题 | ${summary.severityCounts.medium} |`);
      lines.push(`| 🟢 低优先级问题 | ${summary.severityCounts.low} |`);
      lines.push('');
      lines.push(`**总体状态: ${statusIcon} ${statusText}**`);
      lines.push('');
    }

    if (includeAllIssues && allIssues.length > 0) {
      lines.push('## 🔍 问题详情');
      lines.push('');

      const groupedBySeverity = this._groupBySeverity(allIssues);

      for (const severity of SEVERITY_ORDER) {
        const issues = groupedBySeverity[severity];
        if (!issues || issues.length === 0) continue;

        const emoji = SEVERITY_EMOJI[severity];
        const severityName = this._getSeverityName(severity);
        
        lines.push(`### ${emoji} ${severityName}问题 (${issues.length}个)`);
        lines.push('');

        for (const issue of issues) {
          lines.push(`#### ${issue.message}`);
          lines.push('');
          
          if (issue.photoNumber) {
            lines.push(`- **照片编号**: ${issue.photoNumber}`);
          }
          if (issue.photoTypeName) {
            lines.push(`- **照片类型**: ${issue.photoTypeName}`);
          }
          lines.push(`- **严重程度**: ${severityName}`);
          lines.push('');
          
          lines.push(`**规则**: ${issue.rule}`);
          lines.push('');
          
          lines.push(`**建议**: ${issue.suggestion}`);
          lines.push('');

          if (includeDetails && issue.files && issue.files.length > 0) {
            lines.push('**涉及文件**:');
            lines.push('');
            for (const file of issue.files) {
              const versionInfo = file.version ? ` (版本: v${file.version})` : '';
              const latestInfo = file.isLatest ? ' [最新版本]' : '';
              lines.push(`- \`${file.relativePath || file.fileName}\`${versionInfo}${latestInfo}`);
            }
            lines.push('');
          }

          lines.push('---');
          lines.push('');
        }
      }
    }

    if (includeDetails && photos.length > 0) {
      lines.push('## 📁 照片清单');
      lines.push('');
      lines.push('| 编号 | 文件名 | 分类 | 尺寸 | 方向 | 版本 | 水印 |');
      lines.push('|------|--------|------|------|------|------|------|');

      for (const photo of photos) {
        const orientationEmoji = {
          landscape: '🖼️',
          portrait: '📱',
          square: '⬜',
          other: '❓'
        }[photo.orientation] || '❓';
        
        const watermarkStatus = photo.hasWatermark ? '带水印' : (photo.noWatermark ? '无水印' : '未知');
        const categoryStr = (photo.category || []).join(', ');
        const versionStr = photo.version ? `v${photo.version}` : '-';
        
        lines.push(
          `| ${photo.photoNumber || '-'} | ${photo.fileName} | ${categoryStr} | ` +
          `${photo.width}×${photo.height} | ${orientationEmoji} ${photo.orientation} | ` +
          `${versionStr} | ${watermarkStatus} |`
        );
      }
      lines.push('');
    }

    if (includeDetails && selections.length > 0) {
      lines.push('## 📋 选片表清单');
      lines.push('');
      lines.push('| 照片编号 | 要求类型 | 备注 |');
      lines.push('|----------|----------|------|');

      for (const selection of selections) {
        const typesStr = (selection.types || []).join(', ');
        lines.push(`| ${selection.photoNumber} | ${typesStr} | ${selection.notes || '-'} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*此报告由 photo-delivery-checker 自动生成*');

    return lines.join('\n');
  }

  generateHTML(validationResult, options = {}) {
    const { 
      includeDetails = true,
      includeSummary = true,
      includeAllIssues = true,
      template = 'default'
    } = options;

    const { summary, allIssues, photos, selections } = validationResult;

    const htmlTemplate = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>照片交付包校验报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
    }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 14px; }
    .content { padding: 30px; }
    .section { margin-bottom: 40px; }
    .section h2 {
      font-size: 20px;
      color: #333;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .status-success { background: #d4edda; color: #155724; }
    .status-warning { background: #fff3cd; color: #856404; }
    .status-danger { background: #f8d7da; color: #721c24; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .summary-card .number {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
    }
    .summary-card .label {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
    .severity-critical { background: #fee2e2; color: #dc2626; }
    .severity-high { background: #fed7aa; color: #ea580c; }
    .severity-medium { background: #fef3c7; color: #ca8a04; }
    .severity-low { background: #d1fae5; color: #059669; }
    .issue-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .issue-header {
      padding: 15px 20px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    .issue-header .severity-badge {
      margin-bottom: 0;
      font-size: 12px;
      padding: 4px 12px;
      margin-right: 10px;
    }
    .issue-header .title { font-weight: 600; }
    .issue-body { padding: 20px; }
    .issue-row {
      display: flex;
      margin-bottom: 10px;
    }
    .issue-row .label {
      font-weight: 600;
      color: #666;
      min-width: 100px;
    }
    .file-list {
      background: #f9fafb;
      border-radius: 4px;
      padding: 10px;
      margin-top: 10px;
    }
    .file-item {
      font-family: monospace;
      font-size: 13px;
      padding: 5px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .file-item:last-child { border-bottom: none; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    tr:hover { background: #f9fafb; }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📷 照片交付包校验报告</h1>
      <div class="meta">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
    </div>
    
    <div class="content">
      ${this._renderHTMLSummary(summary, includeSummary)}
      ${this._renderHTMLIssues(allIssues, includeAllIssues)}
      ${this._renderHTMLPhotos(photos, includeDetails)}
      ${this._renderHTMLSelections(selections, includeDetails)}
    </div>
    
    <div class="footer">
      此报告由 photo-delivery-checker 自动生成
    </div>
  </div>
</body>
</html>`;

    return htmlTemplate;
  }

  _prepareJSONData(validationResult) {
    const { summary, allIssues, photos, selections } = validationResult;
    
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      },
      summary: {
        totalPhotos: summary.totalPhotos,
        totalSelections: summary.totalSelections,
        totalIssues: summary.totalIssues,
        severityCounts: summary.severityCounts,
        success: summary.success,
        hasCriticalIssues: summary.hasCriticalIssues,
        hasHighIssues: summary.hasHighIssues
      },
      issues: allIssues.map(issue => ({
        type: issue.type,
        severity: issue.severity,
        photoNumber: issue.photoNumber,
        photoType: issue.photoType,
        photoTypeName: issue.photoTypeName,
        message: issue.message,
        rule: issue.rule,
        suggestion: issue.suggestion,
        files: issue.files || [],
        details: {
          actualWatermark: issue.actualWatermark,
          expectedWatermark: issue.expectedWatermark,
          dimensions: issue.dimensions,
          latestVersion: issue.latestVersion,
          olderVersions: issue.olderVersions
        }
      })),
      photos: photos.map(photo => ({
        fileName: photo.fileName,
        relativePath: photo.relativePath,
        photoNumber: photo.photoNumber,
        width: photo.width,
        height: photo.height,
        aspectRatio: photo.aspectRatio,
        orientation: photo.orientation,
        version: photo.version,
        hasWatermark: photo.hasWatermark,
        noWatermark: photo.noWatermark,
        category: photo.category,
        isRefined: photo.isRefined,
        isOriginal: photo.isOriginal,
        isGrid: photo.isGrid,
        isPrint: photo.isPrint,
        fileSize: photo.fileSize,
        modifiedTime: photo.modifiedTime
      })),
      selections: selections.map(selection => ({
        photoNumber: selection.photoNumber,
        types: selection.types,
        notes: selection.notes,
        originalValue: selection.originalValue
      }))
    };
  }

  _groupBySeverity(issues) {
    const grouped = {};
    for (const issue of issues) {
      if (!grouped[issue.severity]) {
        grouped[issue.severity] = [];
      }
      grouped[issue.severity].push(issue);
    }
    return grouped;
  }

  _getSeverityName(severity) {
    const names = {
      critical: '严重',
      high: '高优先级',
      medium: '中优先级',
      low: '低优先级'
    };
    return names[severity] || severity;
  }

  _renderHTMLSummary(summary, includeSummary) {
    if (!includeSummary) return '';

    const statusClass = summary.success 
      ? 'status-success' 
      : (summary.hasCriticalIssues ? 'status-danger' : 'status-warning');
    const statusText = summary.success ? '✅ 校验通过' : '⚠️ 存在问题';

    return `
      <div class="section">
        <h2>📊 校验摘要</h2>
        <div class="status-badge ${statusClass}">${statusText}</div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="number">${summary.totalPhotos}</div>
            <div class="label">📸 扫描到的照片</div>
          </div>
          <div class="summary-card">
            <div class="number">${summary.totalSelections}</div>
            <div class="label">📋 选片表中的照片</div>
          </div>
          <div class="summary-card">
            <div class="number severity-critical">${summary.severityCounts.critical}</div>
            <div class="label">🔴 严重问题</div>
          </div>
          <div class="summary-card">
            <div class="number severity-high">${summary.severityCounts.high}</div>
            <div class="label">🟠 高优先级</div>
          </div>
          <div class="summary-card">
            <div class="number severity-medium">${summary.severityCounts.medium}</div>
            <div class="label">🟡 中优先级</div>
          </div>
          <div class="summary-card">
            <div class="number severity-low">${summary.severityCounts.low}</div>
            <div class="label">🟢 低优先级</div>
          </div>
        </div>
      </div>
    `;
  }

  _renderHTMLIssues(allIssues, includeAllIssues) {
    if (!includeAllIssues) return '';
    if (allIssues.length === 0) {
      return `
        <div class="section">
          <h2>🔍 问题详情</h2>
          <div class="empty-state">
            <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">太棒了！没有发现任何问题</div>
            <div>所有照片都符合交付要求</div>
          </div>
        </div>
      `;
    }

    const groupedBySeverity = this._groupBySeverity(allIssues);
    let html = '<div class="section"><h2>🔍 问题详情</h2>';

    for (const severity of SEVERITY_ORDER) {
      const issues = groupedBySeverity[severity];
      if (!issues || issues.length === 0) continue;

      const severityName = this._getSeverityName(severity);
      const badgeClass = `severity-${severity}`;

      html += `
        <div style="margin-bottom: 30px;">
          <h3 style="margin-bottom: 15px; font-size: 16px; color: #374151;">
            <span class="severity-badge ${badgeClass}">${severityName}问题</span>
            (${issues.length}个)
          </h3>
      `;

      for (const issue of issues) {
        html += `
          <div class="issue-card">
            <div class="issue-header">
              <span class="severity-badge ${badgeClass}">${severityName}</span>
              <span class="title">${issue.message}</span>
            </div>
            <div class="issue-body">
        `;

        if (issue.photoNumber) {
          html += `
            <div class="issue-row">
              <span class="label">照片编号</span>
              <span>${issue.photoNumber}</span>
            </div>
          `;
        }

        if (issue.photoTypeName) {
          html += `
            <div class="issue-row">
              <span class="label">照片类型</span>
              <span>${issue.photoTypeName}</span>
            </div>
          `;
        }

        html += `
          <div class="issue-row">
            <span class="label">规则</span>
            <span>${issue.rule}</span>
          </div>
          <div class="issue-row">
            <span class="label">建议</span>
            <span>${issue.suggestion}</span>
          </div>
        `;

        if (issue.files && issue.files.length > 0) {
          html += '<div class="file-list">';
          for (const file of issue.files) {
            const versionInfo = file.version ? ` (版本: v${file.version})` : '';
            const latestInfo = file.isLatest ? ' [最新版本]' : '';
            html += `<div class="file-item">📁 ${file.relativePath || file.fileName}${versionInfo}${latestInfo}</div>`;
          }
          html += '</div>';
        }

        html += `
            </div>
          </div>
        `;
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  _renderHTMLPhotos(photos, includeDetails) {
    if (!includeDetails || photos.length === 0) return '';

    let html = `
      <div class="section">
        <h2>📁 照片清单 (${photos.length}张)</h2>
        <table>
          <thead>
            <tr>
              <th>编号</th>
              <th>文件名</th>
              <th>分类</th>
              <th>尺寸</th>
              <th>方向</th>
              <th>版本</th>
              <th>水印</th>
            </tr>
          </thead>
          <tbody>
    `;

    const orientationEmoji = {
      landscape: '🖼️ 横图',
      portrait: '📱 竖图',
      square: '⬜ 正方形',
      other: '❓ 其他'
    };

    for (const photo of photos) {
      const watermarkStatus = photo.hasWatermark ? '带水印' : (photo.noWatermark ? '无水印' : '-');
      const categoryStr = (photo.category || []).join(', ');
      const versionStr = photo.version ? `v${photo.version}` : '-';

      html += `
        <tr>
          <td>${photo.photoNumber || '-'}</td>
          <td>${photo.fileName}</td>
          <td>${categoryStr}</td>
          <td>${photo.width}×${photo.height}</td>
          <td>${orientationEmoji[photo.orientation] || photo.orientation}</td>
          <td>${versionStr}</td>
          <td>${watermarkStatus}</td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  _renderHTMLSelections(selections, includeDetails) {
    if (!includeDetails || selections.length === 0) return '';

    let html = `
      <div class="section">
        <h2>📋 选片表清单 (${selections.length}张)</h2>
        <table>
          <thead>
            <tr>
              <th>照片编号</th>
              <th>要求类型</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const selection of selections) {
      const typesStr = (selection.types || []).join(', ');
      html += `
        <tr>
          <td>${selection.photoNumber}</td>
          <td>${typesStr}</td>
          <td>${selection.notes || '-'}</td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  exportReport(validationResult, outputPath, format = 'json', options = {}) {
    let content;
    let extension;

    switch (format.toLowerCase()) {
      case 'markdown':
      case 'md':
        content = this.generateMarkdown(validationResult, options);
        extension = '.md';
        break;
      case 'html':
        content = this.generateHTML(validationResult, options);
        extension = '.html';
        break;
      case 'json':
      default:
        content = this.generateJSON(validationResult, options);
        extension = '.json';
        break;
    }

    const outputDir = path.dirname(outputPath);
    ensureDirectory(outputDir);

    let finalPath = outputPath;
    if (!path.extname(outputPath)) {
      finalPath = outputPath + extension;
    }

    fs.writeFileSync(finalPath, content, 'utf-8');
    return finalPath;
  }
}

module.exports = Reporter;
