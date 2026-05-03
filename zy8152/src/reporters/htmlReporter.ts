import * as fs from 'fs';
import * as path from 'path';
import { FontReport, GlyphCheckResult, EmojiRisk, ArabicDirectionalityRisk, VariableAxisIssue, UnusedSubset, ValidationError } from '../types';
import { codePointToHex } from '../utils/unicode';

export function generatePreviewHtml(report: FontReport, outputDir: string): string {
  const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>字体回退链路预检报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f7fa;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { 
      color: #1a202c; 
      border-bottom: 3px solid #4299e1;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .timestamp {
      color: #718096;
      font-size: 0.9em;
      margin-bottom: 30px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-left: 4px solid #4299e1;
    }
    .summary-card.warning { border-left-color: #ed8936; }
    .summary-card.error { border-left-color: #e53e3e; }
    .summary-card.success { border-left-color: #48bb78; }
    .summary-label { color: #718096; font-size: 0.85em; text-transform: uppercase; }
    .summary-value { font-size: 2em; font-weight: bold; color: #1a202c; }
    .section {
      background: white;
      border-radius: 8px;
      padding: 25px;
      margin-bottom: 25px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      color: #2d3748;
      margin-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
      margin-left: 10px;
    }
    .status-pass { background: #c6f6d5; color: #22543d; }
    .status-warn { background: #feebc8; color: #744210; }
    .status-fail { background: #fed7d7; color: #742a2a; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f7fafc;
      font-weight: 600;
      color: #4a5568;
    }
    tr:hover { background: #f7fafc; }
    .code-point {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      background: #f0f4f8;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .char-preview {
      font-size: 1.5em;
      background: #f7fafc;
      padding: 5px 10px;
      border-radius: 4px;
      display: inline-block;
      min-width: 40px;
      text-align: center;
    }
    .context-box {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 15px;
      margin: 10px 0;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9em;
    }
    .direction-rtl { color: #e53e3e; font-weight: bold; }
    .direction-ltr { color: #3182ce; font-weight: bold; }
    .direction-neutral { color: #ed8936; font-weight: bold; }
    .tabs {
      display: flex;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 20px;
    }
    .tab {
      padding: 12px 24px;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      font-weight: 500;
      color: #718096;
    }
    .tab:hover { color: #2d3748; }
    .tab.active {
      color: #4299e1;
      border-bottom-color: #4299e1;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .collapsible {
      cursor: pointer;
      user-select: none;
    }
    .collapsible:hover { color: #4299e1; }
    .collapsible-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease-out;
    }
    .collapsible-content.expanded {
      max-height: 2000px;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #718096;
    }
    .empty-state-icon { font-size: 3em; margin-bottom: 15px; }
    .filter-controls {
      margin-bottom: 15px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 6px 16px;
      border: 1px solid #e2e8f0;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
    }
    .filter-btn.active { background: #4299e1; color: white; border-color: #4299e1; }
    .search-box {
      padding: 8px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      font-size: 0.9em;
      flex: 1;
      min-width: 200px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>字体回退链路预检报告</h1>
    <div class="timestamp">生成时间: ${new Date().toISOString()}</div>

    <div class="summary-grid">
      <div class="summary-card ${report.summary.passedRules >= 3 ? 'success' : 'warning'}">
        <div class="summary-label">通过规则</div>
        <div class="summary-value">${report.summary.passedRules} / 5</div>
      </div>
      <div class="summary-card ${report.summary.missingGlyphsCount > 0 ? 'error' : 'success'}">
        <div class="summary-label">缺字数量</div>
        <div class="summary-value">${report.summary.missingGlyphsCount}</div>
      </div>
      <div class="summary-card ${report.summary.emojiRisksCount > 0 ? 'warning' : 'success'}">
        <div class="summary-label">Emoji 风险</div>
        <div class="summary-value">${report.summary.emojiRisksCount}</div>
      </div>
      <div class="summary-card ${report.summary.arabicRisksCount > 0 ? 'warning' : 'success'}">
        <div class="summary-label">方向性风险</div>
        <div class="summary-value">${report.summary.arabicRisksCount}</div>
      </div>
      <div class="summary-card ${report.summary.variableAxisIssuesCount > 0 ? 'error' : 'success'}">
        <div class="summary-label">字体轴问题</div>
        <div class="summary-value">${report.summary.variableAxisIssuesCount}</div>
      </div>
      <div class="summary-card ${report.summary.unusedSubsetsCount > 0 ? 'warning' : 'success'}">
        <div class="summary-label">无用子集</div>
        <div class="summary-value">${report.summary.unusedSubsetsCount}</div>
      </div>
    </div>

    <div class="tabs" id="mainTabs">
      <div class="tab active" data-tab="glyphs">缺字检查 (${report.glyphChecks.issues.filter(i => i.isMissing).length})</div>
      <div class="tab" data-tab="emoji">Emoji 风险 (${report.emojiChecks.issues.length})</div>
      <div class="tab" data-tab="direction">方向性风险 (${report.arabicChecks.issues.length})</div>
      <div class="tab" data-tab="variable">变量字体轴 (${report.variableAxisChecks.issues.length})</div>
      <div class="tab" data-tab="subsets">无用子集 (${report.subsetChecks.issues.length})</div>
      ${report.validationErrors.length > 0 ? '<div class="tab" data-tab="errors">验证错误 (' + report.validationErrors.length + ')</div>' : ''}
    </div>

    <div id="tab-glyphs" class="tab-content active">
      <div class="section">
        <h2>缺字检查结果</h2>
        <p><strong>状态:</strong> <span class="status-badge ${report.glyphChecks.passed ? 'status-pass' : 'status-fail'}">${report.glyphChecks.passed ? '通过' : '失败'}</span></p>
        <p><strong>描述:</strong> ${report.glyphChecks.description}</p>
        
        ${renderGlyphsTable(report)}
      </div>
    </div>

    <div id="tab-emoji" class="tab-content">
      <div class="section">
        <h2>Emoji 风险检查结果</h2>
        <p><strong>状态:</strong> <span class="status-badge ${report.emojiChecks.passed ? 'status-pass' : 'status-warn'}">${report.emojiChecks.passed ? '通过' : '警告'}</span></p>
        <p><strong>描述:</strong> ${report.emojiChecks.description}</p>
        
        ${renderEmojiTable(report)}
      </div>
    </div>

    <div id="tab-direction" class="tab-content">
      <div class="section">
        <h2>阿拉伯文方向性风险检查结果</h2>
        <p><strong>状态:</strong> <span class="status-badge ${report.arabicChecks.passed ? 'status-pass' : 'status-warn'}">${report.arabicChecks.passed ? '通过' : '警告'}</span></p>
        <p><strong>描述:</strong> ${report.arabicChecks.description}</p>
        
        ${renderDirectionSection(report)}
      </div>
    </div>

    <div id="tab-variable" class="tab-content">
      <div class="section">
        <h2>变量字体轴范围检查结果</h2>
        <p><strong>状态:</strong> <span class="status-badge ${report.variableAxisChecks.passed ? 'status-pass' : 'status-fail'}">${report.variableAxisChecks.passed ? '通过' : '失败'}</span></p>
        <p><strong>描述:</strong> ${report.variableAxisChecks.description}</p>
        
        ${renderVariableTable(report)}
      </div>
    </div>

    <div id="tab-subsets" class="tab-content">
      <div class="section">
        <h2>无用子集检查结果</h2>
        <p><strong>状态:</strong> <span class="status-badge ${report.subsetChecks.passed ? 'status-pass' : 'status-warn'}">${report.subsetChecks.passed ? '通过' : '警告'}</span></p>
        <p><strong>描述:</strong> ${report.subsetChecks.description}</p>
        
        ${renderSubsetsSection(report)}
      </div>
    </div>

    ${report.validationErrors.length > 0 ? `
    <div id="tab-errors" class="tab-content">
      <div class="section">
        <h2>验证错误</h2>
        ${renderErrorsTable(report)}
      </div>
    </div>
    ` : ''}

  </div>

  <script>
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.getAttribute('data-tab');
        document.getElementById('tab-' + tabName).classList.add('active');
      });
    });
  </script>
</body>
</html>`;

  const outputPath = path.join(outputDir, 'preview.html');
  ensureDirectory(outputDir);
  fs.writeFileSync(outputPath, htmlContent, 'utf-8');

  return outputPath;
}

function renderGlyphsTable(report: FontReport): string {
  const missingOnly = report.glyphChecks.issues.filter(i => i.isMissing);
  const partialOnly = report.glyphChecks.issues.filter(i => !i.isMissing);

  if (missingOnly.length === 0 && partialOnly.length === 0) {
    return `<div class="empty-state">
      <div class="empty-state-icon">✅</div>
      <p>所有字符都能在字体回退链中找到</p>
    </div>`;
  }

  let html = '';

  if (missingOnly.length > 0) {
    html += `
    <h3 style="margin-top: 20px; margin-bottom: 10px; color: #e53e3e;">完全缺字 (${missingOnly.length} 个)</h3>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>样本ID</th>
            <th>语言/脚本</th>
            <th>字符</th>
            <th>码点</th>
            <th>回退链</th>
            <th>缺失字体</th>
          </tr>
        </thead>
        <tbody>
    `;
    for (const glyph of missingOnly) {
      html += `
          <tr>
            <td><code>${escapeHtml(glyph.sampleId)}</code></td>
            <td>${escapeHtml(glyph.language)} / ${escapeHtml(glyph.script)}</td>
            <td><span class="char-preview">${escapeHtml(glyph.char)}</span></td>
            <td><span class="code-point">${codePointToHex(glyph.codePoint)}</span></td>
            <td>${escapeHtml(glyph.fallbackChain.join(' → '))}</td>
            <td>${escapeHtml(glyph.missingInFonts.join(', '))}</td>
          </tr>
      `;
    }
    html += `
        </tbody>
      </table>
    </div>`;
  }

  if (partialOnly.length > 0) {
    html += `
    <h3 style="margin-top: 30px; margin-bottom: 10px; color: #ed8936;">部分字体缺字 (${partialOnly.length} 个)</h3>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>样本ID</th>
            <th>字符</th>
            <th>码点</th>
            <th>缺失字体</th>
          </tr>
        </thead>
        <tbody>
    `;
    for (const glyph of partialOnly.slice(0, 50)) {
      html += `
          <tr>
            <td><code>${escapeHtml(glyph.sampleId)}</code></td>
            <td><span class="char-preview">${escapeHtml(glyph.char)}</span></td>
            <td><span class="code-point">${codePointToHex(glyph.codePoint)}</span></td>
            <td>${escapeHtml(glyph.missingInFonts.join(', '))}</td>
          </tr>
      `;
    }
    if (partialOnly.length > 50) {
      html += `<tr><td colspan="4" style="text-align: center; color: #718096;">... 还有 ${partialOnly.length - 50} 个未显示</td></tr>`;
    }
    html += `
        </tbody>
      </table>
    </div>`;
  }

  return html;
}

function renderEmojiTable(report: FontReport): string {
  if (report.emojiChecks.issues.length === 0) {
    return `<div class="empty-state">
      <div class="empty-state-icon">✅</div>
      <p>未发现 Emoji 相关风险</p>
    </div>`;
  }

  const directionality = report.emojiChecks.issues.filter(i => i.riskType === 'directionality');
  const color = report.emojiChecks.issues.filter(i => i.riskType === 'color');
  const missing = report.emojiChecks.issues.filter(i => i.riskType === 'missing');

  return `
  <div style="overflow-x: auto;">
    <table>
      <thead>
        <tr>
          <th>样本ID</th>
          <th>Emoji</th>
          <th>码点</th>
          <th>风险类型</th>
          <th>描述</th>
        </tr>
      </thead>
      <tbody>
  ${report.emojiChecks.issues.slice(0, 100).map(risk => `
        <tr>
          <td><code>${escapeHtml(risk.sampleId)}</code></td>
          <td><span class="char-preview">${escapeHtml(risk.char)}</span></td>
          <td><span class="code-point">${codePointToHex(risk.codePoint)}</span></td>
          <td><span class="status-badge ${risk.riskType === 'directionality' ? 'status-warn' : risk.riskType === 'color' ? 'status-warn' : 'status-fail'}">${getEmojiRiskTypeLabel(risk.riskType)}</span></td>
          <td>${escapeHtml(risk.description)}</td>
        </tr>
  `).join('')}
      </tbody>
    </table>
  </div>
  ${report.emojiChecks.issues.length > 100 ? `<p style="margin-top: 10px; color: #718096; text-align: center;">... 还有 ${report.emojiChecks.issues.length - 100} 个未显示</p>` : ''}`;
}

function renderDirectionSection(report: FontReport): string {
  if (report.arabicChecks.issues.length === 0) {
    return `<div class="empty-state">
      <div class="empty-state-icon">✅</div>
      <p>未发现方向性风险</p>
    </div>`;
  }

  let html = '';
  for (const risk of report.arabicChecks.issues) {
    html += `
    <div style="margin-bottom: 20px; padding: 15px; background: #fffaf0; border-radius: 4px; border-left: 4px solid #ed8936;">
      <h4 style="margin-bottom: 10px;">样本: <code>${escapeHtml(risk.sampleId)}</code></h4>
      <p><strong>文本:</strong> <code>${escapeHtml(risk.sampleText)}</code></p>
      <p><strong>混合方向:</strong> ${risk.mixedDirection ? '<span class="direction-rtl">是</span>' : '<span class="direction-ltr">否</span>'}</p>
      <p><strong>中性字符:</strong> ${risk.hasNeutralChars ? '<span class="direction-neutral">是</span>' : '否'}</p>
      <p><strong>描述:</strong> ${escapeHtml(risk.description)}</p>
      <div style="margin-top: 10px;">
        <strong>上下文:</strong>
        <div class="context-box">${escapeHtml(risk.context)}</div>
      </div>
    </div>`;
  }

  return html;
}

function renderVariableTable(report: FontReport): string {
  if (report.variableAxisChecks.issues.length === 0) {
    return `<div class="empty-state">
      <div class="empty-state-icon">✅</div>
      <p>所有变量字体轴请求值都在有效范围内</p>
    </div>`;
  }

  return `
  <div style="overflow-x: auto;">
    <table>
      <thead>
        <tr>
          <th>字体名</th>
          <th>轴标签</th>
          <th>轴名称</th>
          <th>请求值</th>
          <th>最小值</th>
          <th>最大值</th>
          <th>问题类型</th>
        </tr>
      </thead>
      <tbody>
  ${report.variableAxisChecks.issues.map(issue => `
        <tr>
          <td><code>${escapeHtml(issue.fontName)}</code></td>
          <td><span class="code-point">${escapeHtml(issue.axisTag)}</span></td>
          <td>${escapeHtml(issue.axisName)}</td>
          <td><strong style="color: ${issue.issueType === 'underflow' ? '#e53e3e' : '#e53e3e'}">${issue.requestedValue}</strong></td>
          <td>${issue.minValue}</td>
          <td>${issue.maxValue}</td>
          <td><span class="status-badge status-fail">${issue.issueType === 'underflow' ? '低于最小值' : '高于最大值'}</span></td>
        </tr>
  `).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderSubsetsSection(report: FontReport): string {
  if (report.subsetChecks.issues.length === 0) {
    return `<div class="empty-state">
      <div class="empty-state-icon">✅</div>
      <p>所有子集都被有效使用</p>
    </div>`;
  }

  let html = '';
  for (const issue of report.subsetChecks.issues) {
    html += `
    <div style="margin-bottom: 20px; padding: 15px; background: #faf5ff; border-radius: 4px; border-left: 4px solid #9f7aea;">
      <h4 style="margin-bottom: 10px;">子集: <code>${escapeHtml(issue.subsetName)}</code></h4>
      <p><strong>原因:</strong> ${escapeHtml(issue.reason)}</p>
      ${issue.subsetDefinition.description ? `<p><strong>描述:</strong> ${escapeHtml(issue.subsetDefinition.description)}</p>` : ''}
      <p><strong>Unicode 范围数量:</strong> ${issue.subsetDefinition.unicodeRanges.length}</p>
      <details style="margin-top: 10px;">
        <summary style="cursor: pointer; color: #805ad5;">查看 Unicode 范围</summary>
        <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 4px;">
          <ul style="list-style: none; padding: 0;">
          ${issue.subsetDefinition.unicodeRanges.map(range => `
            <li style="padding: 4px 0;">
              <span class="code-point">${codePointToHex(range.start)}</span> - <span class="code-point">${codePointToHex(range.end)}</span>
              ${range.name ? `<span style="color: #718096; margin-left: 10px;">(${escapeHtml(range.name)})</span>` : ''}
            </li>
          `).join('')}
          </ul>
        </div>
      </details>
    </div>`;
  }

  return html;
}

function renderErrorsTable(report: FontReport): string {
  return `
  <div style="overflow-x: auto;">
    <table>
      <thead>
        <tr>
          <th>类型</th>
          <th>来源</th>
          <th>消息</th>
          <th>详情</th>
        </tr>
      </thead>
      <tbody>
  ${report.validationErrors.map(error => `
        <tr>
          <td><span class="status-badge status-fail">${getValidationTypeLabel(error.type)}</span></td>
          <td><code>${escapeHtml(error.source)}</code></td>
          <td>${escapeHtml(error.message)}</td>
          <td>${error.detail ? escapeHtml(error.detail) : '-'}</td>
        </tr>
  `).join('')}
      </tbody>
    </table>
  </div>`;
}

function getEmojiRiskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    directionality: '方向性',
    color: '颜色',
    missing: '缺失字体'
  };
  return labels[type] || type;
}

function getValidationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    font: '字体配置',
    sample: '样本数据',
    fallback: '回退配置',
    subset: '子集定义',
    general: '通用'
  };
  return labels[type] || type;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
