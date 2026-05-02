import fs from 'fs';
import path from 'path';
import { ISSUE_TYPES } from '../utils/constants.js';

const TYPE_NAMES = {
  [ISSUE_TYPES.MISSING_IN_EXAMPLE]: 'Example 中缺失',
  [ISSUE_TYPES.EXTRA_IN_LOCAL]: 'Local 中多余',
  [ISSUE_TYPES.VALUE_CONFLICT]: '值冲突',
  [ISSUE_TYPES.POTENTIAL_SECRET]: '潜在密钥',
};

const SEVERITY_NAMES = {
  high: '🔴 严重',
  medium: '🟡 中等',
  low: '🔵 轻微',
};

export function generateMarkdownReport(scanResult, issues, config, options = {}) {
  const lines = [];

  lines.push('# 环境变量检查报告');
  lines.push('');
  lines.push('**生成时间**: ' + new Date().toLocaleString());
  lines.push('**项目目录**: ' + scanResult.projectDir);
  lines.push('');

  lines.push('## 📊 概要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push('| 扫描文件数 | ' + scanResult.files.length + ' |');
  lines.push('| 发现变量数 | ' + Object.keys(scanResult.variables.all).length + ' |');
  lines.push('| 发现问题数 | ' + issues.length + ' |');
  lines.push('');

  if (issues.length > 0) {
    const high = issues.filter(i => i.severity === 'high').length;
    const medium = issues.filter(i => i.severity === 'medium').length;
    const low = issues.filter(i => i.severity === 'low').length;

    if (high > 0 || medium > 0) {
      lines.push('**⚠️ 存在需要关注的问题**');
      lines.push('');
    }

    lines.push('### 问题分布');
    lines.push('');
    lines.push('| 严重程度 | 数量 |');
    lines.push('|----------|------|');
    lines.push('| 🔴 严重 | ' + high + ' |');
    lines.push('| 🟡 中等 | ' + medium + ' |');
    lines.push('| 🔵 轻微 | ' + low + ' |');
    lines.push('');
  }

  if (issues.length > 0) {
    lines.push('## 🔍 发现的问题');
    lines.push('');

    const groupedBySeverity = {
      high: issues.filter(i => i.severity === 'high'),
      medium: issues.filter(i => i.severity === 'medium'),
      low: issues.filter(i => i.severity === 'low'),
    };

    for (const severity of ['high', 'medium', 'low']) {
      const severityIssues = groupedBySeverity[severity];
      if (severityIssues.length > 0) {
        lines.push('### ' + SEVERITY_NAMES[severity] + ' (' + severityIssues.length + '个)');
        lines.push('');

        const groupedByType = {};
        for (const issue of severityIssues) {
          if (!groupedByType[issue.type]) {
            groupedByType[issue.type] = [];
          }
          groupedByType[issue.type].push(issue);
        }

        for (const [type, typeIssues] of Object.entries(groupedByType)) {
          lines.push('#### ' + (TYPE_NAMES[type] || type));
          lines.push('');

          for (const issue of typeIssues) {
            lines.push('**' + issue.variable + '**');
            lines.push('> ' + issue.message);
            
            if (issue.details?.sources) {
              lines.push('> 来源: ' + issue.details.sources.join(', '));
            }
            if (issue.details?.values) {
              lines.push('> 值冲突:');
              for (const val of issue.details.values) {
                lines.push('> - ' + val.source + ': ' + (val.value || '(无默认值)'));
              }
            }
            lines.push('');
          }
        }
      }
    }
  }

  lines.push('## 📋 变量清单');
  lines.push('');

  const vars = scanResult.variables;
  const allVarNames = Object.keys(vars.all).sort();

  lines.push('### 所有变量');
  lines.push('');
  lines.push('| 变量名 | 来源 | 发现位置 |');
  lines.push('|--------|------|----------|');
  for (const name of allVarNames) {
    const info = vars.all[name];
    lines.push('| ' + name + ' | ' + info.sources.join(', ') + ' | ' + info.foundIn.join(', ') + ' |');
  }
  lines.push('');

  lines.push('### 按来源分类');
  lines.push('');

  if (Object.keys(vars.fromExample).length > 0) {
    lines.push('#### 📝 .env.example 中的变量');
    lines.push('');
    lines.push('| 变量名 | 默认值 |');
    lines.push('|--------|--------|');
    for (const [name, info] of Object.entries(vars.fromExample)) {
      lines.push('| ' + name + ' | ' + (info.value || '(无默认值)') + ' |');
    }
    lines.push('');
  }

  if (Object.keys(vars.fromLocal).length > 0) {
    lines.push('#### 🏠 .env.local 中的变量');
    lines.push('');
    lines.push('| 变量名 | 值 |');
    lines.push('|--------|-----|');
    for (const [name, info] of Object.entries(vars.fromLocal)) {
      lines.push('| ' + name + ' | ' + (info.value || '(无值)') + ' |');
    }
    lines.push('');
  }

  if (Object.keys(vars.fromDocker).length > 0) {
    lines.push('#### 🐳 Docker Compose 中的变量');
    lines.push('');
    lines.push('| 变量名 | 服务 |');
    lines.push('|--------|------|');
    for (const [name, info] of Object.entries(vars.fromDocker)) {
      lines.push('| ' + name + ' | ' + (info.services?.join(', ') || '-') + ' |');
    }
    lines.push('');
  }

  if (Object.keys(vars.fromPackageJson).length > 0) {
    lines.push('#### 📦 package.json 脚本中的变量');
    lines.push('');
    lines.push('| 变量名 | 脚本 |');
    lines.push('|--------|------|');
    for (const [name, info] of Object.entries(vars.fromPackageJson)) {
      lines.push('| ' + name + ' | ' + (info.scripts?.join(', ') || '-') + ' |');
    }
    lines.push('');
  }

  if (Object.keys(vars.fromMarkdown).length > 0) {
    lines.push('#### 📖 Markdown 文档中的变量');
    lines.push('');
    lines.push('| 变量名 |');
    lines.push('|--------|');
    for (const name of Object.keys(vars.fromMarkdown)) {
      lines.push('| ' + name + ' |');
    }
    lines.push('');
  }

  if (config.optionalVars.length > 0) {
    lines.push('## ⚙️ 配置的可选变量');
    lines.push('');
    for (const varName of config.optionalVars) {
      lines.push('- ' + varName);
    }
    lines.push('');
  }

  if (config.localOnlyVars.length > 0) {
    lines.push('## 🏠 配置的本地专用变量');
    lines.push('');
    for (const varName of config.localOnlyVars) {
      lines.push('- ' + varName);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*报告由 env-checker 工具生成*');

  const content = lines.join('\n');

  if (options.outputFile) {
    const outputPath = path.resolve(options.outputFile);
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log('Markdown 报告已写入: ' + outputPath);
  }

  return content;
}
