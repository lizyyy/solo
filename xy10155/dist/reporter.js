"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reporter = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
class Reporter {
    constructor(outputDir = process.cwd()) {
        this.outputDir = outputDir;
    }
    async generateHTML(context, filename = 'report.html') {
        const html = this.renderHTML(context);
        const outputPath = path_1.default.join(this.outputDir, filename);
        await fs_extra_1.default.writeFile(outputPath, html, 'utf-8');
        return outputPath;
    }
    async generateMarkdown(context, filename = 'report.md') {
        const md = this.renderMarkdown(context);
        const outputPath = path_1.default.join(this.outputDir, filename);
        await fs_extra_1.default.writeFile(outputPath, md, 'utf-8');
        return outputPath;
    }
    renderHTML(context) {
        const issueStats = this.getIssueStats(context.issues);
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>配置漂移巡检报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 1400px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 20px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
    h2 { color: #444; margin: 30px 0 15px; padding-left: 10px; border-left: 4px solid #4a90d9; }
    .summary { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
    .summary-card { padding: 20px; border-radius: 8px; min-width: 150px; text-align: center; }
    .critical { background: #ffcccc; border: 1px solid #ff6666; }
    .high { background: #ffe0b3; border: 1px solid #ff9933; }
    .medium { background: #fff3cc; border: 1px solid #ffcc00; }
    .low { background: #e6f7ff; border: 1px solid #66ccff; }
    .count { font-size: 28px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:hover { background: #fafafa; }
    .badge { padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-critical { background: #ff4444; color: white; }
    .badge-high { background: #ff8800; color: white; }
    .badge-medium { background: #ffcc00; color: #333; }
    .badge-low { background: #66ccff; color: #333; }
    .diff-added { background: #e6ffed; color: #22863a; }
    .diff-removed { background: #ffeef0; color: #d73a49; }
    .diff-modified { background: #fff5b1; color: #b08800; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    .env-list { display: flex; gap: 10px; flex-wrap: wrap; }
    .env-tag { padding: 8px 16px; background: #f0f0f0; border-radius: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <h1>🔍 多环境配置漂移巡检报告</h1>
  <div class="meta">
    <strong>生成时间:</strong> ${(0, utils_1.formatTimestamp)(context.generatedAt)}<br>
    <strong>环境数量:</strong> ${context.environments.length}
  </div>

  <h2>📋 巡检环境</h2>
  <div class="env-list">
    ${context.environments.map(env => `<span class="env-tag">${env.name}${env.description ? ' - ' + env.description : ''}</span>`).join('')}
  </div>

  <h2>⚠️ 风险问题概览</h2>
  <div class="summary">
    <div class="summary-card critical">
      <div class="count">${issueStats.critical}</div>
      <div>Critical (严重)</div>
    </div>
    <div class="summary-card high">
      <div class="count">${issueStats.high}</div>
      <div>High (高危)</div>
    </div>
    <div class="summary-card medium">
      <div class="count">${issueStats.medium}</div>
      <div>Medium (中等)</div>
    </div>
    <div class="summary-card low">
      <div class="count">${issueStats.low}</div>
      <div>Low (低危)</div>
    </div>
  </div>

  ${context.issues.length > 0 ? `
  <h2>🔴 风险问题详情</h2>
  <table>
    <thead>
      <tr>
        <th>严重程度</th>
        <th>规则</th>
        <th>环境</th>
        <th>配置项</th>
        <th>问题描述</th>
      </tr>
    </thead>
    <tbody>
      ${context.issues.map(issue => `
      <tr>
        <td><span class="badge badge-${issue.severity}">${issue.severity.toUpperCase()}</span></td>
        <td>${issue.ruleName}</td>
        <td>${issue.environment || (issue.affectedEnvironments ? issue.affectedEnvironments.join(', ') : '-')}</td>
        <td>${issue.key || '-'}</td>
        <td>${issue.message}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<p>✅ 未发现风险问题</p>'}

  ${context.diffs && context.diffs.length > 0 ? `
  <h2>📊 环境差异对比</h2>
  ${context.diffs.map(diff => `
    <h3>${diff.envA} vs ${diff.envB}</h3>
    ${this.renderDiffTableHTML(diff.items)}
  `).join('')}
  ` : ''}

  ${context.recentHistory.length > 0 ? `
  <h2>📜 最近变更历史</h2>
  <table>
    <thead>
      <tr>
        <th>时间</th>
        <th>环境</th>
        <th>操作</th>
        <th>配置项</th>
        <th>变更内容</th>
      </tr>
    </thead>
    <tbody>
      ${context.recentHistory.slice(0, 20).map(record => `
      <tr>
        <td>${(0, utils_1.formatTimestamp)(record.timestamp)}</td>
        <td>${record.environment}</td>
        <td>${this.getActionLabel(record.action)}</td>
        <td>${record.key}</td>
        <td>${this.formatChangeHTML(record)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<p>暂无变更历史</p>'}
</body>
</html>`;
    }
    renderDiffTableHTML(items) {
        const changedItems = items.filter(i => i.type !== 'unchanged');
        if (changedItems.length === 0) {
            return '<p>✅ 两个环境配置完全一致</p>';
        }
        return `<table>
      <thead>
        <tr>
          <th>状态</th>
          <th>配置项</th>
          <th>${items[0]?.environmentA || '环境A'}</th>
          <th>${items[0]?.environmentB || '环境B'}</th>
        </tr>
      </thead>
      <tbody>
        ${changedItems.map(item => `
        <tr class="diff-${item.type}">
          <td>${this.getTypeLabel(item.type)}</td>
          <td>${item.key}</td>
          <td>${(0, utils_1.formatValue)(item.envA)}</td>
          <td>${(0, utils_1.formatValue)(item.envB)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>`;
    }
    getTypeLabel(type) {
        const labels = {
            added: '➕ 新增',
            removed: '➖ 删除',
            modified: '🔄 修改',
            unchanged: '✅ 一致'
        };
        return labels[type] || type;
    }
    getActionLabel(action) {
        const labels = {
            add: '➕ 新增',
            update: '🔄 修改',
            delete: '➖ 删除'
        };
        return labels[action] || action;
    }
    formatChangeHTML(record) {
        if (record.action === 'add') {
            return `值: ${(0, utils_1.formatValue)(record.newValue)}`;
        }
        else if (record.action === 'delete') {
            return `原值: ${(0, utils_1.formatValue)(record.oldValue)}`;
        }
        else {
            return `${(0, utils_1.formatValue)(record.oldValue)} → ${(0, utils_1.formatValue)(record.newValue)}`;
        }
    }
    getIssueStats(issues) {
        const stats = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const issue of issues) {
            stats[issue.severity]++;
        }
        return stats;
    }
    renderMarkdown(context) {
        const issueStats = this.getIssueStats(context.issues);
        let md = `# 多环境配置漂移巡检报告

**生成时间:** ${(0, utils_1.formatTimestamp)(context.generatedAt)}
**环境数量:** ${context.environments.length}

## 📋 巡检环境

${context.environments.map(env => `- **${env.name}**${env.description ? ': ' + env.description : ''}`).join('\n')}

## ⚠️ 风险问题概览

| 严重程度 | 数量 |
|---------|------|
| Critical | ${issueStats.critical} |
| High | ${issueStats.high} |
| Medium | ${issueStats.medium} |
| Low | ${issueStats.low} |

`;
        if (context.issues.length > 0) {
            md += `## 🔴 风险问题详情

| 严重程度 | 规则 | 环境 | 配置项 | 问题描述 |
|---------|------|------|--------|----------|
${context.issues.map(issue => `| ${this.getSeverityEmoji(issue.severity)} **${issue.severity.toUpperCase()}** | ${issue.ruleName} | ${issue.environment || (issue.affectedEnvironments ? issue.affectedEnvironments.join(', ') : '-')} | ${issue.key || '-'} | ${issue.message} |`).join('\n')}

`;
        }
        else {
            md += '✅ 未发现风险问题\n\n';
        }
        if (context.diffs && context.diffs.length > 0) {
            md += `## 📊 环境差异对比\n\n`;
            for (const diff of context.diffs) {
                md += `### ${diff.envA} vs ${diff.envB}\n\n`;
                md += this.renderDiffTableMD(diff.items);
                md += '\n';
            }
        }
        if (context.recentHistory.length > 0) {
            md += `## 📜 最近变更历史 (Top 20)\n\n`;
            md += `| 时间 | 环境 | 操作 | 配置项 | 变更内容 |\n|------|------|------|--------|----------|\n`;
            md += context.recentHistory.slice(0, 20).map(record => {
                return `| ${(0, utils_1.formatTimestamp)(record.timestamp)} | ${record.environment} | ${this.getActionLabel(record.action)} | ${record.key} | ${this.formatChangeMD(record)} |`;
            }).join('\n');
            md += '\n';
        }
        else {
            md += '暂无变更历史\n';
        }
        return md;
    }
    renderDiffTableMD(items) {
        const changedItems = items.filter(i => i.type !== 'unchanged');
        if (changedItems.length === 0) {
            return '✅ 两个环境配置完全一致\n\n';
        }
        let md = `| 状态 | 配置项 | ${items[0]?.environmentA || '环境A'} | ${items[0]?.environmentB || '环境B'} |\n|------|--------|-----------------|-----------------|\n`;
        md += changedItems.map(item => {
            return `| ${this.getTypeLabel(item.type)} | ${item.key} | ${(0, utils_1.formatValue)(item.envA)} | ${(0, utils_1.formatValue)(item.envB)} |`;
        }).join('\n');
        return md + '\n';
    }
    getSeverityEmoji(severity) {
        const emojis = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🔵'
        };
        return emojis[severity] || '⚪';
    }
    formatChangeMD(record) {
        if (record.action === 'add') {
            return `值: ${(0, utils_1.formatValue)(record.newValue)}`;
        }
        else if (record.action === 'delete') {
            return `原值: ${(0, utils_1.formatValue)(record.oldValue)}`;
        }
        else {
            return `\`${(0, utils_1.formatValue)(record.oldValue)}\` → \`${(0, utils_1.formatValue)(record.newValue)}\``;
        }
    }
}
exports.Reporter = Reporter;
