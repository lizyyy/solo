const fs = require('fs');
const path = require('path');

function generateSummary(issues, targetDir) {
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  
  const files = new Set();
  const rules = new Set();
  
  for (const issue of issues) {
    files.add(issue.filePath);
    rules.add(issue.ruleId);
  }
  
  return {
    total: issues.length,
    errors,
    warnings,
    filesCount: files.size,
    rulesCount: rules.size,
    targetDir,
    timestamp: new Date().toISOString()
  };
}

function generateJson(issues, targetDir, outputPath) {
  const summary = generateSummary(issues, targetDir);
  
  const report = {
    summary,
    issues: issues.map(issue => ({
      ...issue,
      filePath: path.relative(targetDir, issue.filePath)
    }))
  };
  
  const jsonContent = JSON.stringify(report, null, 2);
  
  if (outputPath) {
    fs.writeFileSync(outputPath, jsonContent, 'utf-8');
    return outputPath;
  }
  
  return jsonContent;
}

function generateMarkdown(issues, targetDir, outputPath) {
  const summary = generateSummary(issues, targetDir);
  
  let md = `# 无障碍问题报告\n\n`;
  
  md += `## 摘要\n\n`;
  md += `- **扫描目录**: ${targetDir}\n`;
  md += `- **扫描时间**: ${new Date(summary.timestamp).toLocaleString('zh-CN')}\n`;
  md += `- **问题总数**: ${summary.total}\n`;
  md += `- **错误 (Error)**: ${summary.errors}\n`;
  md += `- **警告 (Warning)**: ${summary.warnings}\n`;
  md += `- **涉及文件**: ${summary.filesCount} 个\n`;
  md += `- **触发规则**: ${summary.rulesCount} 条\n\n`;
  
  if (issues.length === 0) {
    md += `🎉 太棒了！没有发现无障碍问题。\n`;
    if (outputPath) {
      fs.writeFileSync(outputPath, md, 'utf-8');
      return outputPath;
    }
    return md;
  }
  
  const issuesByFile = new Map();
  for (const issue of issues) {
    const relativePath = path.relative(targetDir, issue.filePath);
    if (!issuesByFile.has(relativePath)) {
      issuesByFile.set(relativePath, []);
    }
    issuesByFile.get(relativePath).push(issue);
  }
  
  md += `## 按文件分类的问题\n\n`;
  
  for (const [filePath, fileIssues] of issuesByFile) {
    md += `### ${filePath}\n\n`;
    
    for (const issue of fileIssues) {
      const severityIcon = issue.severity === 'error' ? '🔴' : '🟡';
      md += `#### ${severityIcon} [${issue.ruleId}] ${issue.message}\n\n`;
      md += `- **位置**: 第 ${issue.lineNumber} 行\n`;
      md += `- **详情**: ${issue.details}\n`;
      md += `- **修复建议**: ${issue.fix}\n`;
      
      if (issue.snippet) {
        md += `\n\`\`\`html\n${issue.snippet}\n\`\`\`\n`;
      }
      
      if (issue.context) {
        md += `\n**上下文代码**:\n\`\`\`\n${issue.context}\n\`\`\`\n`;
      }
      
      md += '\n';
    }
  }
  
  md += `## 规则说明\n\n`;
  md += `| 规则ID | 说明 |\n`;
  md += `|--------|------|\n`;
  md += `| img-alt | 图片缺少 alt 属性 |\n`;
  md += `| form-label | 表单控件缺少标签关联 |\n`;
  md += `| button-text | 按钮缺少可读文本 |\n`;
  md += `| link-text | 链接缺少可读文本 |\n`;
  md += `| duplicate-id | 重复的 id 属性 |\n`;
  md += `| tabindex | tabindex 焦点顺序风险 |\n`;
  md += `| aria-misuse | ARIA 属性误用 |\n`;
  md += `| color-contrast | 颜色对比度不足 |\n`;
  
  if (outputPath) {
    fs.writeFileSync(outputPath, md, 'utf-8');
    return outputPath;
  }
  
  return md;
}

function generateHtml(issues, targetDir, outputPath) {
  const summary = generateSummary(issues, targetDir);
  
  const issuesByFile = new Map();
  const issuesByRule = new Map();
  const issuesBySeverity = {
    error: [],
    warning: []
  };
  
  for (const issue of issues) {
    const relativePath = path.relative(targetDir, issue.filePath);
    
    if (!issuesByFile.has(relativePath)) {
      issuesByFile.set(relativePath, []);
    }
    issuesByFile.get(relativePath).push(issue);
    
    if (!issuesByRule.has(issue.ruleId)) {
      issuesByRule.set(issue.ruleId, []);
    }
    issuesByRule.get(issue.ruleId).push(issue);
    
    issuesBySeverity[issue.severity].push(issue);
  }
  
  const htmlTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>无障碍问题报告 - a11y-smoke-cli</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 0;
      margin-bottom: 30px;
    }
    h1 { font-size: 2em; margin-bottom: 10px; }
    .subtitle { opacity: 0.9; }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .summary-card .number {
      font-size: 2.5em;
      font-weight: bold;
      color: #667eea;
    }
    .summary-card .label { color: #666; font-size: 0.9em; }
    .summary-card.error .number { color: #e74c3c; }
    .summary-card.warning .number { color: #f39c12; }
    
    .filters {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .filters h3 { margin-bottom: 15px; color: #333; }
    .filter-group { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; }
    .filter-group:last-child { margin-bottom: 0; }
    .filter-btn {
      padding: 8px 16px;
      border: 2px solid #ddd;
      border-radius: 20px;
      background: white;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.9em;
    }
    .filter-btn:hover { border-color: #667eea; }
    .filter-btn.active { 
      background: #667eea; 
      color: white; 
      border-color: #667eea; 
    }
    .filter-btn.error.active { background: #e74c3c; border-color: #e74c3c; }
    .filter-btn.warning.active { background: #f39c12; border-color: #f39c12; }
    
    .issues-container { display: flex; gap: 20px; flex-wrap: wrap; }
    
    .file-list {
      background: white;
      border-radius: 8px;
      padding: 20px;
      min-width: 280px;
      max-width: 350px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      max-height: 600px;
      overflow-y: auto;
    }
    .file-list h3 { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
    .file-item {
      padding: 10px;
      cursor: pointer;
      border-radius: 4px;
      margin-bottom: 5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .file-item:hover { background: #f5f5f5; }
    .file-item.active { background: #e8eaf6; }
    .file-name { font-size: 0.85em; font-family: monospace; word-break: break-all; flex: 1; }
    .file-counts { display: flex; gap: 8px; margin-left: 10px; }
    .count-badge {
      font-size: 0.75em;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: bold;
    }
    .count-badge.error { background: #fee; color: #e74c3c; }
    .count-badge.warning { background: #fff3e0; color: #f39c12; }
    
    .issues-list {
      flex: 1;
      min-width: 300px;
    }
    
    .issue-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-left: 4px solid #667eea;
    }
    .issue-card.error { border-left-color: #e74c3c; }
    .issue-card.warning { border-left-color: #f39c12; }
    
    .issue-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
    .issue-title { display: flex; align-items: center; gap: 10px; }
    .issue-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: bold;
    }
    .issue-badge.error { background: #fee; color: #e74c3c; }
    .issue-badge.warning { background: #fff3e0; color: #f39c12; }
    .issue-rule {
      background: #e8eaf6;
      color: #667eea;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-family: monospace;
    }
    .issue-location { color: #666; font-size: 0.85em; font-family: monospace; }
    
    .issue-details { margin-bottom: 15px; }
    .issue-details p { margin-bottom: 8px; }
    .issue-details strong { color: #333; }
    
    .code-block {
      background: #282c34;
      color: #abb2bf;
      padding: 15px;
      border-radius: 4px;
      font-family: 'Fira Code', monospace;
      font-size: 0.85em;
      overflow-x: auto;
      margin-top: 10px;
    }
    .code-block pre { margin: 0; white-space: pre-wrap; }
    
    .fix-suggestion {
      background: #e8f5e9;
      border: 1px solid #a5d6a7;
      border-radius: 4px;
      padding: 15px;
      margin-top: 15px;
    }
    .fix-suggestion h4 { color: #2e7d32; margin-bottom: 8px; }
    
    .no-results {
      text-align: center;
      padding: 60px 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .no-results .emoji { font-size: 3em; margin-bottom: 15px; }
    
    .toggle-btn {
      display: inline-block;
      padding: 8px 16px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 10px;
      margin-bottom: 10px;
      font-size: 0.9em;
      transition: all 0.2s;
    }
    .toggle-btn:hover { background: #eee; }
    .toggle-btn.active { background: #667eea; color: white; border-color: #667eea; }
    
    .hidden { display: none !important; }
    
    @media (max-width: 768px) {
      .issues-container { flex-direction: column; }
      .file-list { max-width: 100%; }
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>🔍 无障碍问题报告</h1>
      <p class="subtitle">扫描目录: ${targetDir} | 扫描时间: ${new Date(summary.timestamp).toLocaleString('zh-CN')}</p>
    </div>
  </header>
  
  <div class="container">
    <div class="summary-grid">
      <div class="summary-card">
        <div class="number">${summary.total}</div>
        <div class="label">问题总数</div>
      </div>
      <div class="summary-card error">
        <div class="number">${summary.errors}</div>
        <div class="label">错误 (Error)</div>
      </div>
      <div class="summary-card warning">
        <div class="number">${summary.warnings}</div>
        <div class="label">警告 (Warning)</div>
      </div>
      <div class="summary-card">
        <div class="number">${summary.filesCount}</div>
        <div class="label">涉及文件</div>
      </div>
    </div>
    
    ${issues.length === 0 ? `
    <div class="no-results">
      <div class="emoji">🎉</div>
      <h2>太棒了！没有发现无障碍问题</h2>
      <p>你的代码通过了所有可访问性检查。</p>
    </div>
    ` : `
    <div class="filters">
      <h3>筛选条件</h3>
      <div class="filter-group">
        <span style="margin-right: 10px; color: #666;">严重级别:</span>
        <button class="filter-btn active" data-filter="severity" data-value="all">全部</button>
        <button class="filter-btn error" data-filter="severity" data-value="error">错误 (${summary.errors})</button>
        <button class="filter-btn warning" data-filter="severity" data-value="warning">警告 (${summary.warnings})</button>
      </div>
      <div class="filter-group">
        <span style="margin-right: 10px; color: #666;">查看方式:</span>
        <button class="toggle-btn active" data-view="file">按文件</button>
        <button class="toggle-btn" data-view="rule">按规则</button>
      </div>
    </div>
    
    <div class="issues-container" id="fileView">
      <div class="file-list">
        <h3>📁 文件列表 (${issuesByFile.size})</h3>
        <div id="fileItems">
          ${Array.from(issuesByFile.entries()).map(([filePath, fileIssues], index) => {
            const errors = fileIssues.filter(i => i.severity === 'error').length;
            const warnings = fileIssues.filter(i => i.severity === 'warning').length;
            return `
          <div class="file-item ${index === 0 ? 'active' : ''}" data-file="${filePath}">
            <span class="file-name">${filePath}</span>
            <span class="file-counts">
              ${errors > 0 ? `<span class="count-badge error">${errors}</span>` : ''}
              ${warnings > 0 ? `<span class="count-badge warning">${warnings}</span>` : ''}
            </span>
          </div>`;
          }).join('')}
        </div>
      </div>
      
      <div class="issues-list" id="issuesList">
        ${renderIssuesList(issuesByFile, 0)}
      </div>
    </div>
    
    <div class="issues-container hidden" id="ruleView">
      <div class="file-list">
        <h3>📋 规则列表 (${issuesByRule.size})</h3>
        <div id="ruleItems">
          ${Array.from(issuesByRule.entries()).map(([ruleId, ruleIssues], index) => {
            const errors = ruleIssues.filter(i => i.severity === 'error').length;
            const warnings = ruleIssues.filter(i => i.severity === 'warning').length;
            return `
          <div class="file-item ${index === 0 ? 'active' : ''}" data-rule="${ruleId}">
            <span class="file-name">${ruleId}</span>
            <span class="file-counts">
              ${errors > 0 ? `<span class="count-badge error">${errors}</span>` : ''}
              ${warnings > 0 ? `<span class="count-badge warning">${warnings}</span>` : ''}
            </span>
          </div>`;
          }).join('')}
        </div>
      </div>
      
      <div class="issues-list" id="ruleIssuesList">
        ${renderRuleIssuesList(issuesByRule, 0)}
      </div>
    </div>
    `}
  </div>
  
  <script>
    const issuesData = ${JSON.stringify(issues.map(i => ({
      ...i,
      filePath: path.relative(targetDir, i.filePath)
    })))};
    
    let currentFilter = { severity: 'all' };
    let currentView = 'file';
    let selectedFile = null;
    let selectedRule = null;
    
    ${issues.length > 0 ? `
    const fileItems = document.querySelectorAll('.file-item[data-file]');
    const ruleItems = document.querySelectorAll('.file-item[data-rule]');
    const severityBtns = document.querySelectorAll('.filter-btn[data-filter="severity"]');
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const fileView = document.getElementById('fileView');
    const ruleView = document.getElementById('ruleView');
    
    function filterIssues() {
      let filtered = [...issuesData];
      
      if (currentFilter.severity !== 'all') {
        filtered = filtered.filter(i => i.severity === currentFilter.severity);
      }
      
      if (currentView === 'file') {
        updateFileList(filtered);
        if (selectedFile) {
          const fileIssues = filtered.filter(i => i.filePath === selectedFile);
          renderIssuesToContainer(fileIssues, 'issuesList');
        }
      } else {
        updateRuleList(filtered);
        if (selectedRule) {
          const ruleIssues = filtered.filter(i => i.ruleId === selectedRule);
          renderIssuesToContainer(ruleIssues, 'ruleIssuesList');
        }
      }
    }
    
    function updateFileList(filtered) {
      const fileCounts = {};
      for (const issue of filtered) {
        if (!fileCounts[issue.filePath]) {
          fileCounts[issue.filePath] = { error: 0, warning: 0 };
        }
        fileCounts[issue.filePath][issue.severity]++;
      }
      
      const fileItems = document.querySelectorAll('.file-item[data-file]');
      fileItems.forEach(item => {
        const filePath = item.dataset.file;
        const counts = fileCounts[filePath];
        if (counts) {
          item.classList.remove('hidden');
          const badgeContainer = item.querySelector('.file-counts');
          badgeContainer.innerHTML = '';
          if (counts.error > 0) {
            badgeContainer.innerHTML += '<span class="count-badge error">' + counts.error + '</span>';
          }
          if (counts.warning > 0) {
            badgeContainer.innerHTML += '<span class="count-badge warning">' + counts.warning + '</span>';
          }
        } else {
          item.classList.add('hidden');
        }
      });
    }
    
    function updateRuleList(filtered) {
      const ruleCounts = {};
      for (const issue of filtered) {
        if (!ruleCounts[issue.ruleId]) {
          ruleCounts[issue.ruleId] = { error: 0, warning: 0 };
        }
        ruleCounts[issue.ruleId][issue.severity]++;
      }
      
      const ruleItems = document.querySelectorAll('.file-item[data-rule]');
      ruleItems.forEach(item => {
        const ruleId = item.dataset.rule;
        const counts = ruleCounts[ruleId];
        if (counts) {
          item.classList.remove('hidden');
          const badgeContainer = item.querySelector('.file-counts');
          badgeContainer.innerHTML = '';
          if (counts.error > 0) {
            badgeContainer.innerHTML += '<span class="count-badge error">' + counts.error + '</span>';
          }
          if (counts.warning > 0) {
            badgeContainer.innerHTML += '<span class="count-badge warning">' + counts.warning + '</span>';
          }
        } else {
          item.classList.add('hidden');
        }
      });
    }
    
    function renderIssuesToContainer(issues, containerId) {
      const container = document.getElementById(containerId);
      if (issues.length === 0) {
        container.innerHTML = '<div class="no-results"><div class="emoji">📭</div><h3>该筛选条件下没有问题</h3></div>';
        return;
      }
      
      let html = '';
      for (const issue of issues) {
        html += renderIssueCard(issue);
      }
      container.innerHTML = html;
    }
    
    function renderIssueCard(issue) {
      const severityLabel = issue.severity === 'error' ? '错误' : '警告';
      let snippetHtml = '';
      if (issue.snippet) {
        snippetHtml = '<div class="code-block"><pre>' + escapeHtml(issue.snippet) + '</pre></div>';
      }
      let contextHtml = '';
      if (issue.context) {
        contextHtml = '<div class="code-block"><pre>' + escapeHtml(issue.context) + '</pre></div>';
      }
      
      return '<div class="issue-card ' + issue.severity + '" data-severity="' + issue.severity + '">' +
        '<div class="issue-header">' +
          '<div class="issue-title">' +
            '<span class="issue-badge ' + issue.severity + '">' + severityLabel + '</span>' +
            '<span class="issue-rule">' + issue.ruleId + '</span>' +
            '<h3>' + escapeHtml(issue.message) + '</h3>' +
          '</div>' +
          '<span class="issue-location">' + issue.filePath + ':' + issue.lineNumber + '</span>' +
        '</div>' +
        '<div class="issue-details">' +
          '<p><strong>详情:</strong> ' + escapeHtml(issue.details) + '</p>' +
          (issue.snippet ? '<p><strong>代码片段:</strong></p>' + snippetHtml : '') +
          (issue.context && issue.context !== issue.snippet ? '<p><strong>上下文:</strong></p>' + contextHtml : '') +
        '</div>' +
        '<div class="fix-suggestion">' +
          '<h4>💡 修复建议</h4>' +
          '<p>' + escapeHtml(issue.fix) + '</p>' +
        '</div>' +
      '</div>';
    }
    
    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Event listeners
    severityBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        severityBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter.severity = this.dataset.value;
        filterIssues();
      });
    });
    
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        toggleBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentView = this.dataset.view;
        
        if (currentView === 'file') {
          fileView.classList.remove('hidden');
          ruleView.classList.add('hidden');
        } else {
          fileView.classList.add('hidden');
          ruleView.classList.remove('hidden');
        }
      });
    });
    
    // File items
    fileItems.forEach((item, index) => {
      item.addEventListener('click', function() {
        fileItems.forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        selectedFile = this.dataset.file;
        
        let filtered = [...issuesData];
        if (currentFilter.severity !== 'all') {
          filtered = filtered.filter(i => i.severity === currentFilter.severity);
        }
        const fileIssues = filtered.filter(i => i.filePath === selectedFile);
        renderIssuesToContainer(fileIssues, 'issuesList');
      });
      
      if (index === 0) {
        selectedFile = item.dataset.file;
      }
    });
    
    // Rule items
    ruleItems.forEach((item, index) => {
      item.addEventListener('click', function() {
        ruleItems.forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        selectedRule = this.dataset.rule;
        
        let filtered = [...issuesData];
        if (currentFilter.severity !== 'all') {
          filtered = filtered.filter(i => i.severity === currentFilter.severity);
        }
        const ruleIssues = filtered.filter(i => i.ruleId === selectedRule);
        renderIssuesToContainer(ruleIssues, 'ruleIssuesList');
      });
      
      if (index === 0) {
        selectedRule = item.dataset.rule;
      }
    });
    ` : ''}
  </script>
</body>
</html>`;

  if (outputPath) {
    fs.writeFileSync(outputPath, htmlTemplate, 'utf-8');
    return outputPath;
  }
  
  return htmlTemplate;
}

function renderIssuesList(issuesByFile, selectedIndex) {
  const entries = Array.from(issuesByFile.entries());
  if (entries.length === 0) return '';
  
  const [filePath, issues] = entries[selectedIndex];
  
  let html = '';
  for (const issue of issues) {
    html += renderIssueCardHtml(issue);
  }
  
  return html;
}

function renderRuleIssuesList(issuesByRule, selectedIndex) {
  const entries = Array.from(issuesByRule.entries());
  if (entries.length === 0) return '';
  
  const [ruleId, issues] = entries[selectedIndex];
  
  let html = '';
  for (const issue of issues) {
    html += renderIssueCardHtml(issue);
  }
  
  return html;
}

function renderIssueCardHtml(issue) {
  const severityLabel = issue.severity === 'error' ? '错误' : '警告';
  const snippetHtml = issue.snippet ? `<div class="code-block"><pre>${escapeHtmlForTemplate(issue.snippet)}</pre></div>` : '';
  const contextHtml = issue.context && issue.context !== issue.snippet 
    ? `<div class="code-block"><pre>${escapeHtmlForTemplate(issue.context)}</pre></div>` 
    : '';
  
  return `<div class="issue-card ${issue.severity}" data-severity="${issue.severity}">
  <div class="issue-header">
    <div class="issue-title">
      <span class="issue-badge ${issue.severity}">${severityLabel}</span>
      <span class="issue-rule">${issue.ruleId}</span>
      <h3>${escapeHtmlForTemplate(issue.message)}</h3>
    </div>
    <span class="issue-location">${path.relative(process.cwd(), issue.filePath)}:${issue.lineNumber}</span>
  </div>
  <div class="issue-details">
    <p><strong>详情:</strong> ${escapeHtmlForTemplate(issue.details)}</p>
    ${issue.snippet ? `<p><strong>代码片段:</strong></p>${snippetHtml}` : ''}
    ${contextHtml ? `<p><strong>上下文:</strong></p>${contextHtml}` : ''}
  </div>
  <div class="fix-suggestion">
    <h4>💡 修复建议</h4>
    <p>${escapeHtmlForTemplate(issue.fix)}</p>
  </div>
</div>`;
}

function escapeHtmlForTemplate(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateConsoleReport(issues, targetDir) {
  const summary = generateSummary(issues, targetDir);
  
  let output = '\n';
  output += '╔════════════════════════════════════════════════════════════╗\n';
  output += '║              无障碍问题报告 - a11y-smoke-cli                ║\n';
  output += '╚════════════════════════════════════════════════════════════╝\n\n';
  
  output += `📂 扫描目录: ${targetDir}\n`;
  output += `📅 扫描时间: ${new Date(summary.timestamp).toLocaleString('zh-CN')}\n\n`;
  
  output += '📊 摘要统计:\n';
  output += `   问题总数: ${summary.total}\n`;
  output += `   🔴 错误: ${summary.errors}\n`;
  output += `   🟡 警告: ${summary.warnings}\n`;
  output += `   📁 涉及文件: ${summary.filesCount} 个\n`;
  output += `   📋 触发规则: ${summary.rulesCount} 条\n\n`;
  
  if (issues.length === 0) {
    output += '🎉 太棒了！没有发现无障碍问题。\n';
    return output;
  }
  
  const issuesByFile = new Map();
  for (const issue of issues) {
    const relativePath = path.relative(targetDir, issue.filePath);
    if (!issuesByFile.has(relativePath)) {
      issuesByFile.set(relativePath, []);
    }
    issuesByFile.get(relativePath).push(issue);
  }
  
  for (const [filePath, fileIssues] of issuesByFile) {
    output += `\n${'═'.repeat(60)}\n`;
    output += `📁 ${filePath}\n`;
    output += `${'═'.repeat(60)}\n`;
    
    for (const issue of fileIssues) {
      const icon = issue.severity === 'error' ? '🔴' : '🟡';
      output += `\n${icon} [${issue.ruleId}] ${issue.message}\n`;
      output += `   位置: 第 ${issue.lineNumber} 行\n`;
      output += `   详情: ${issue.details}\n`;
      
      if (issue.snippet) {
        output += `   代码: ${issue.snippet.substring(0, 80)}${issue.snippet.length > 80 ? '...' : ''}\n`;
      }
      
      output += `   修复: ${issue.fix}\n`;
    }
  }
  
  output += `\n${'─'.repeat(60)}\n`;
  output += '💡 使用 "a11y-smoke report" 命令生成详细的 HTML/Markdown 报告\n';
  
  return output;
}

module.exports = {
  generateSummary,
  generateJson,
  generateMarkdown,
  generateHtml,
  generateConsoleReport
};
