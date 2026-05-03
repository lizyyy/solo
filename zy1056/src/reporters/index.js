'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { SEVERITY, RULES } = require('../checkers');

function generateConsoleReport(result, config) {
  const { issues, ignored, statistics, languages } = result;
  const lines = [];
  
  lines.push(chalk.bold('\n╔══════════════════════════════════════════════════════════╗'));
  lines.push(chalk.bold('║              I18N LINT 检查报告                            ║'));
  lines.push(chalk.bold('╚══════════════════════════════════════════════════════════╝\n'));
  
  lines.push(chalk.cyan('📊 统计信息:'));
  lines.push(`  基准语言: ${config.baseLang}`);
  lines.push(`  检测语言: ${languages.join(', ')}`);
  lines.push(`  总问题数: ${statistics.total}`);
  lines.push(`    - 错误 (Errors): ${chalk.red(statistics.bySeverity.error)}`);
  lines.push(`    - 警告 (Warnings): ${chalk.yellow(statistics.bySeverity.warning)}`);
  lines.push(`    - 信息 (Info): ${chalk.blue(statistics.bySeverity.info)}\n`);
  
  if (Object.keys(statistics.byRule).length > 0) {
    lines.push(chalk.cyan('📋 按规则分类:'));
    for (const [rule, count] of Object.entries(statistics.byRule)) {
      const ruleName = getRuleName(rule);
      lines.push(`  - ${ruleName}: ${count}`);
    }
    lines.push('');
  }
  
  if (ignored.length > 0) {
    lines.push(chalk.gray(`⚠️  已忽略 ${ignored.length} 个问题 (查看详细报告获取更多信息)\n`));
  }
  
  if (issues.length > 0) {
    lines.push(chalk.cyan('🔍 问题详情:\n'));
    
    const groupedBySeverity = {
      error: [],
      warning: [],
      info: []
    };
    
    for (const issue of issues) {
      groupedBySeverity[issue.severity].push(issue);
    }
    
    if (groupedBySeverity.error.length > 0) {
      lines.push(chalk.red.bold('❌ 错误 (Errors):'));
      for (const issue of groupedBySeverity.error) {
        lines.push(formatIssue(issue, 'error'));
      }
      lines.push('');
    }
    
    if (groupedBySeverity.warning.length > 0) {
      lines.push(chalk.yellow.bold('⚠️  警告 (Warnings):'));
      for (const issue of groupedBySeverity.warning) {
        lines.push(formatIssue(issue, 'warning'));
      }
      lines.push('');
    }
    
    if (groupedBySeverity.info.length > 0) {
      lines.push(chalk.blue.bold('ℹ️  信息 (Info):'));
      for (const issue of groupedBySeverity.info) {
        lines.push(formatIssue(issue, 'info'));
      }
      lines.push('');
    }
  } else {
    lines.push(chalk.green.bold('✅ 所有检查通过！没有发现问题。\n'));
  }
  
  return lines.join('\n');
}

function formatIssue(issue, severity) {
  const icon = severity === 'error' ? '  ❌' : severity === 'warning' ? '  ⚠️ ' : '  ℹ️ ';
  const colorFn = severity === 'error' ? chalk.red : severity === 'warning' ? chalk.yellow : chalk.blue;
  
  let line = colorFn(`${icon} [${getRuleName(issue.rule)}] ${issue.message}`);
  
  if (issue.key) {
    line += `\n     Key: ${issue.key}`;
  }
  
  if (issue.targetLanguage) {
    line += `\n     语言: ${issue.targetLanguage}`;
  }
  
  if (issue.baseValue) {
    line += `\n     基准值: ${truncate(issue.baseValue, 60)}`;
  }
  
  if (issue.targetValue) {
    line += `\n     翻译值: ${truncate(issue.targetValue, 60)}`;
  }
  
  return line;
}

function getRuleName(rule) {
  const names = {
    [RULES.MISSING_KEY]: '缺少 Key',
    [RULES.EXTRA_KEY]: '多余 Key',
    [RULES.EMPTY_VALUE]: '空文案',
    [RULES.PLACEHOLDER_MISMATCH]: '占位符不一致',
    [RULES.ICU_PLURAL_MISSING]: 'ICU Plural 缺失',
    [RULES.ICU_PLURAL_EXTRA]: 'ICU Plural 多余',
    [RULES.VARIABLE_NAME_MISMATCH]: '变量名不一致',
    [RULES.LENGTH_RISK]: '长度风险',
    [RULES.FILE_PARSE_ERROR]: '文件解析错误',
    'configuration-error': '配置错误'
  };
  return names[rule] || rule;
}

function truncate(str, maxLen) {
  if (!str) return '(空)';
  if (typeof str !== 'string') return String(str);
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

function generateJSONReport(result, config) {
  return JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      baseLanguage: config.baseLang,
      localeDir: config.localeDir
    },
    statistics: result.statistics,
    issues: result.issues,
    ignored: result.ignored,
    languages: result.languages
  }, null, 2);
}

function generateMarkdownReport(result, config) {
  const { issues, ignored, statistics, languages } = result;
  const lines = [];
  
  lines.push('# I18N Lint 检查报告');
  lines.push('');
  lines.push(`> 生成时间: ${new Date().toISOString()}`);
  lines.push(`> 基准语言: ${config.baseLang}`);
  lines.push(`> 检测语言: ${languages.join(', ')}`);
  lines.push('');
  
  lines.push('## 统计信息');
  lines.push('');
  lines.push('| 类别 | 数量 |');
  lines.push('|------|------|');
  lines.push(`| 总问题数 | ${statistics.total} |`);
  lines.push(`| 错误 (Errors) | ${statistics.bySeverity.error} |`);
  lines.push(`| 警告 (Warnings) | ${statistics.bySeverity.warning} |`);
  lines.push(`| 信息 (Info) | ${statistics.bySeverity.info} |`);
  lines.push('');
  
  if (Object.keys(statistics.byRule).length > 0) {
    lines.push('### 按规则分类');
    lines.push('');
    lines.push('| 规则 | 数量 |');
    lines.push('|------|------|');
    for (const [rule, count] of Object.entries(statistics.byRule)) {
      lines.push(`| ${getRuleName(rule)} | ${count} |`);
    }
    lines.push('');
  }
  
  if (Object.keys(statistics.byLanguage).length > 0) {
    lines.push('### 按语言分类');
    lines.push('');
    lines.push('| 语言 | 问题数 |');
    lines.push('|------|--------|');
    for (const [lang, count] of Object.entries(statistics.byLanguage)) {
      lines.push(`| ${lang} | ${count} |`);
    }
    lines.push('');
  }
  
  if (issues.length > 0) {
    lines.push('## 问题详情');
    lines.push('');
    
    const groupedBySeverity = {
      error: [],
      warning: [],
      info: []
    };
    
    for (const issue of issues) {
      groupedBySeverity[issue.severity].push(issue);
    }
    
    if (groupedBySeverity.error.length > 0) {
      lines.push('### 🔴 错误 (Errors)');
      lines.push('');
      for (const issue of groupedBySeverity.error) {
        lines.push(formatMarkdownIssue(issue));
      }
    }
    
    if (groupedBySeverity.warning.length > 0) {
      lines.push('### 🟡 警告 (Warnings)');
      lines.push('');
      for (const issue of groupedBySeverity.warning) {
        lines.push(formatMarkdownIssue(issue));
      }
    }
    
    if (groupedBySeverity.info.length > 0) {
      lines.push('### 🔵 信息 (Info)');
      lines.push('');
      for (const issue of groupedBySeverity.info) {
        lines.push(formatMarkdownIssue(issue));
      }
    }
  } else {
    lines.push('## ✅ 所有检查通过');
    lines.push('');
    lines.push('没有发现任何问题。');
    lines.push('');
  }
  
  if (ignored.length > 0) {
    lines.push('## ⚠️ 已忽略的问题');
    lines.push('');
    lines.push(`共 ${ignored.length} 个问题被忽略。`);
    lines.push('');
    
    for (const item of ignored) {
      lines.push(`- **${item.key || item.language}**: ${getRuleName(item.rule)} (忽略规则: ${item.ignorePattern})`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

function formatMarkdownIssue(issue) {
  const lines = [];
  
  lines.push(`#### [${getRuleName(issue.rule)}] ${issue.message}`);
  lines.push('');
  
  if (issue.key) {
    lines.push(`- **Key**: \`${issue.key}\``);
  }
  if (issue.targetLanguage) {
    lines.push(`- **语言**: ${issue.targetLanguage}`);
  }
  if (issue.baseValue) {
    lines.push(`- **基准值**: \`${escapeMarkdown(issue.baseValue)}\``);
  }
  if (issue.targetValue) {
    lines.push(`- **翻译值**: \`${escapeMarkdown(issue.targetValue)}\``);
  }
  if (issue.missingPlaceholders && issue.missingPlaceholders.length > 0) {
    lines.push(`- **缺少的占位符**: ${issue.missingPlaceholders.join(', ')}`);
  }
  if (issue.extraPlaceholders && issue.extraPlaceholders.length > 0) {
    lines.push(`- **多余的占位符**: ${issue.extraPlaceholders.join(', ')}`);
  }
  if (issue.baseLength !== undefined) {
    lines.push(`- **长度**: 基准 ${issue.baseLength} 字符 → 翻译 ${issue.targetLength} 字符 (${issue.ratio}x)`);
  }
  
  lines.push('');
  return lines.join('\n');
}

function escapeMarkdown(str) {
  if (!str) return '';
  return String(str).replace(/`/g, '\\`');
}

function generateHTMLReport(result, config) {
  const { issues, ignored, statistics, languages } = result;
  const generatedAt = new Date().toISOString();
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>I18N Lint 检查报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 14px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .stat-card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .stat-card.error { border-left: 4px solid #ef4444; }
    .stat-card.warning { border-left: 4px solid #f59e0b; }
    .stat-card.info { border-left: 4px solid #3b82f6; }
    .stat-card.total { border-left: 4px solid #8b5cf6; }
    .stat-value { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
    .stat-label { color: #666; font-size: 14px; }
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .tab { padding: 10px 20px; background: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
    .tab:hover { background: #e5e5e5; }
    .tab.active { background: #667eea; color: white; }
    .tab.badge { margin-left: 5px; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
    .tab.active .badge { background: rgba(255,255,255,0.2); }
    .section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .section h2 { font-size: 18px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #eee; }
    .issues-list { display: flex; flex-direction: column; gap: 15px; }
    .issue { padding: 15px; border-radius: 8px; border-left: 4px solid; }
    .issue.error { background: #fef2f2; border-color: #ef4444; }
    .issue.warning { background: #fffbeb; border-color: #f59e0b; }
    .issue.info { background: #eff6ff; border-color: #3b82f6; }
    .issue-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .issue-title { font-weight: 600; }
    .issue-rule { font-size: 12px; color: #666; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; }
    .issue-details { font-size: 14px; color: #555; }
    .issue-details p { margin: 5px 0; }
    .code { font-family: 'Monaco', 'Menlo', monospace; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
      .tabs { flex-direction: column; }
    }
    .empty-state { text-align: center; padding: 40px; color: #666; }
    .empty-state .icon { font-size: 48px; margin-bottom: 15px; }
    .ignored-list { display: flex; flex-direction: column; gap: 10px; }
    .ignored-item { padding: 10px; background: #f8f8f8; border-radius: 5px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌍 I18N Lint 检查报告</h1>
      <div class="meta">
        <p>生成时间: ${generatedAt}</p>
        <p>基准语言: ${config.baseLang} | 检测语言: ${languages.join(', ')}</p>
      </div>
    </div>

    <div class="stats">
      <div class="stat-card total">
        <div class="stat-value">${statistics.total}</div>
        <div class="stat-label">总问题数</div>
      </div>
      <div class="stat-card error">
        <div class="stat-value" style="color: #ef4444">${statistics.bySeverity.error}</div>
        <div class="stat-label">错误</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value" style="color: #f59e0b">${statistics.bySeverity.warning}</div>
        <div class="stat-label">警告</div>
      </div>
      <div class="stat-card info">
        <div class="stat-value" style="color: #3b82f6">${statistics.bySeverity.info}</div>
        <div class="stat-label">信息</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" onclick="showSection('all')">
        全部问题 <span class="badge">${issues.length}</span>
      </button>
      <button class="tab" onclick="showSection('errors')">
        错误 <span class="badge">${issues.filter(i => i.severity === 'error').length}</span>
      </button>
      <button class="tab" onclick="showSection('warnings')">
        警告 <span class="badge">${issues.filter(i => i.severity === 'warning').length}</span>
      </button>
      <button class="tab" onclick="showSection('ignored')">
        已忽略 <span class="badge">${ignored.length}</span>
      </button>
    </div>

    <div id="section-all" class="section">
      <h2>📋 所有问题</h2>
      ${generateIssuesHTML(issues)}
    </div>

    <div id="section-errors" class="section" style="display: none;">
      <h2>🔴 错误</h2>
      ${generateIssuesHTML(issues.filter(i => i.severity === 'error'))}
    </div>

    <div id="section-warnings" class="section" style="display: none;">
      <h2>🟡 警告</h2>
      ${generateIssuesHTML(issues.filter(i => i.severity === 'warning'))}
    </div>

    <div id="section-ignored" class="section" style="display: none;">
      <h2>⚠️ 已忽略的问题</h2>
      ${generateIgnoredHTML(ignored)}
    </div>

  </div>

  <script>
    function showSection(section) {
      document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      
      document.getElementById('section-' + section).style.display = 'block';
      event.target.closest('.tab').classList.add('active');
    }
  </script>
</body>
</html>`;
  
  return html;
}

function generateIssuesHTML(issues) {
  if (issues.length === 0) {
    return `<div class="empty-state">
      <div class="icon">✅</div>
      <p>没有发现问题</p>
    </div>`;
  }
  
  let html = '<div class="issues-list">';
  
  for (const issue of issues) {
    html += `<div class="issue ${issue.severity}">
      <div class="issue-header">
        <div class="issue-title">${escapeHTML(issue.message)}</div>
        <span class="issue-rule">${getRuleName(issue.rule)}</span>
      </div>
      <div class="issue-details">`;
    
    if (issue.key) {
      html += `<p><strong>Key:</strong> <span class="code">${escapeHTML(issue.key)}</span></p>`;
    }
    if (issue.targetLanguage) {
      html += `<p><strong>语言:</strong> ${escapeHTML(issue.targetLanguage)}</p>`;
    }
    if (issue.baseValue) {
      html += `<p><strong>基准值:</strong> <span class="code">${escapeHTML(String(issue.baseValue))}</span></p>`;
    }
    if (issue.targetValue) {
      html += `<p><strong>翻译值:</strong> <span class="code">${escapeHTML(String(issue.targetValue))}</span></p>`;
    }
    if (issue.baseLength !== undefined) {
      html += `<p><strong>长度:</strong> 基准 ${issue.baseLength} 字符 → 翻译 ${issue.targetLength} 字符 (${issue.ratio}x)</p>`;
    }
    
    html += `</div></div>`;
  }
  
  html += '</div>';
  return html;
}

function generateIgnoredHTML(ignored) {
  if (ignored.length === 0) {
    return `<div class="empty-state">
      <div class="icon">📭</div>
      <p>没有被忽略的问题</p>
    </div>`;
  }
  
  let html = '<div class="ignored-list">';
  
  for (const item of ignored) {
    html += `<div class="ignored-item">
      <strong>${item.key || item.language}</strong>: ${getRuleName(item.rule)} 
      (忽略规则: <span class="code">${escapeHTML(item.ignorePattern)}</span>)
    </div>`;
  }
  
  html += '</div>';
  return html;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function writeReports(result, config) {
  const outputDir = config.outputDir;
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputs = {
    console: () => {
      console.log(generateConsoleReport(result, config));
    },
    json: () => {
      const jsonPath = path.join(outputDir, 'i18n-lint-report.json');
      fs.writeFileSync(jsonPath, generateJSONReport(result, config), 'utf-8');
      console.log(`JSON 报告已生成: ${jsonPath}`);
    },
    markdown: () => {
      const mdPath = path.join(outputDir, 'i18n-lint-report.md');
      fs.writeFileSync(mdPath, generateMarkdownReport(result, config), 'utf-8');
      console.log(`Markdown 报告已生成: ${mdPath}`);
    },
    html: () => {
      const htmlPath = path.join(outputDir, 'i18n-lint-report.html');
      fs.writeFileSync(htmlPath, generateHTMLReport(result, config), 'utf-8');
      console.log(`HTML 报告已生成: ${htmlPath}`);
    }
  };
  
  for (const format of config.formats) {
    if (outputs[format]) {
      outputs[format]();
    }
  }
  
  const hasErrors = result.issues.some(i => i.severity === 'error');
  return hasErrors ? 1 : 0;
}

module.exports = {
  generateConsoleReport,
  generateJSONReport,
  generateMarkdownReport,
  generateHTMLReport,
  writeReports
};
