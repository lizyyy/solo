import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { SEVERITY, CATEGORIES } from './checker.js';

const SEVERITY_COLORS = {
  [SEVERITY.CRITICAL]: chalk.redBright,
  [SEVERITY.HIGH]: chalk.red,
  [SEVERITY.MEDIUM]: chalk.yellow,
  [SEVERITY.LOW]: chalk.blue,
  [SEVERITY.INFO]: chalk.gray
};

const SEVERITY_LABELS = {
  [SEVERITY.CRITICAL]: '严重',
  [SEVERITY.HIGH]: '高危',
  [SEVERITY.MEDIUM]: '中等',
  [SEVERITY.LOW]: '低',
  [SEVERITY.INFO]: '信息'
};

const CATEGORY_LABELS = {
  [CATEGORIES.PATH_REMOVED]: '路径移除',
  [CATEGORIES.METHOD_REMOVED]: '方法移除',
  [CATEGORIES.PARAMETER_MADE_REQUIRED]: '参数变必填',
  [CATEGORIES.PARAMETER_TYPE_CHANGED]: '参数类型变更',
  [CATEGORIES.PARAMETER_REMOVED]: '参数移除',
  [CATEGORIES.REQUEST_BODY_TYPE_CHANGED]: '请求体类型变更',
  [CATEGORIES.REQUEST_BODY_FIELD_TYPE_CHANGED]: '请求体字段类型变更',
  [CATEGORIES.REQUEST_BODY_MADE_REQUIRED]: '请求体变必填',
  [CATEGORIES.REQUEST_BODY_FIELD_MADE_REQUIRED]: '请求体字段变必填',
  [CATEGORIES.RESPONSE_STATUS_REMOVED]: '响应状态码移除',
  [CATEGORIES.RESPONSE_FIELD_TYPE_CHANGED]: '响应字段类型变更',
  [CATEGORIES.RESPONSE_FIELD_REMOVED]: '响应字段移除',
  [CATEGORIES.ENUM_VALUE_REMOVED]: '枚举值移除',
  [CATEGORIES.ENUM_TYPE_CHANGED]: '枚举类型变更',
  [CATEGORIES.SECURITY_REQUIREMENT_CHANGED]: '安全要求变更',
  [CATEGORIES.DEPRECATION_NOTICE]: '弃用通知',
  [CATEGORIES.MEDIA_TYPE_REMOVED]: '媒体类型移除',
  [CATEGORIES.SCHEMA_ADDITIONAL_PROPERTIES_REMOVED]: '额外字段限制',
  [CATEGORIES.SAMPLE_VALIDATION]: '请求样例校验'
};

export function generateConsoleSummary(compatibilityResult, sampleResult, options = {}) {
  const lines = [];
  const { oldPath, newPath, samplesPath } = options;
  
  lines.push('');
  lines.push(chalk.bold('═══════════════════════════════════════════════════════════════'));
  lines.push(chalk.bold('              API 契约体检报告 - API Contract Doctor'));
  lines.push(chalk.bold('═══════════════════════════════════════════════════════════════'));
  lines.push('');
  
  if (oldPath || newPath) {
    lines.push(chalk.gray('  检查文件:'));
    if (oldPath) lines.push(`    旧版本: ${oldPath}`);
    if (newPath) lines.push(`    新版本: ${newPath}`);
    if (samplesPath) lines.push(`    请求样例: ${samplesPath}`);
    lines.push('');
  }
  
  if (compatibilityResult) {
    const { summary } = compatibilityResult;
    
    lines.push(chalk.bold('  [1] 版本兼容性检查'));
    lines.push('');
    
    if (summary.hasIssues) {
      lines.push('    发现问题:');
      if (summary.bySeverity.critical > 0) {
        lines.push(`      ${SEVERITY_COLORS.critical('●')} 严重: ${summary.bySeverity.critical}`);
      }
      if (summary.bySeverity.high > 0) {
        lines.push(`      ${SEVERITY_COLORS.high('●')} 高危: ${summary.bySeverity.high}`);
      }
      if (summary.bySeverity.medium > 0) {
        lines.push(`      ${SEVERITY_COLORS.medium('●')} 中等: ${summary.bySeverity.medium}`);
      }
      if (summary.bySeverity.low > 0) {
        lines.push(`      ${SEVERITY_COLORS.low('●')} 低: ${summary.bySeverity.low}`);
      }
      if (summary.bySeverity.info > 0) {
        lines.push(`      ${SEVERITY_COLORS.info('●')} 信息: ${summary.bySeverity.info}`);
      }
      
      lines.push('');
      
      if (summary.hasBreakingChanges) {
        lines.push(`    ${chalk.redBright('⚠  检测到破坏性变更！旧客户端可能无法正常工作。')}`);
      } else {
        lines.push(`    ${chalk.yellow('ℹ  存在变更，但没有检测到破坏性变更。')}`);
      }
    } else {
      lines.push(`    ${chalk.green('✓  未发现任何兼容性问题。')}`);
    }
    lines.push('');
  }
  
  if (sampleResult) {
    const { summary } = sampleResult;
    
    lines.push(chalk.bold('  [2] 请求样例校验'));
    lines.push('');
    
    if (summary.hasIssues) {
      lines.push('    发现问题:');
      if (summary.bySeverity.critical > 0) {
        lines.push(`      ${SEVERITY_COLORS.critical('●')} 严重: ${summary.bySeverity.critical}`);
      }
      if (summary.bySeverity.high > 0) {
        lines.push(`      ${SEVERITY_COLORS.high('●')} 高危: ${summary.bySeverity.high}`);
      }
      if (summary.bySeverity.medium > 0) {
        lines.push(`      ${SEVERITY_COLORS.medium('●')} 中等: ${summary.bySeverity.medium}`);
      }
      if (summary.bySeverity.low > 0) {
        lines.push(`      ${SEVERITY_COLORS.low('●')} 低: ${summary.bySeverity.low}`);
      }
      if (summary.bySeverity.info > 0) {
        lines.push(`      ${SEVERITY_COLORS.info('●')} 信息: ${summary.bySeverity.info}`);
      }
    } else {
      lines.push(`    ${chalk.green('✓  所有请求样例校验通过。')}`);
    }
    lines.push('');
  }
  
  lines.push(chalk.bold('═══════════════════════════════════════════════════════════════'));
  lines.push('');
  
  return lines.join('\n');
}

export function generateDetailedConsoleReport(issues, title) {
  const lines = [];
  
  if (issues.length === 0) {
    return '';
  }
  
  lines.push('');
  lines.push(chalk.bold(`  ${title}`));
  lines.push(chalk.bold('  ──────────────────────────────────────────────────────────────'));
  lines.push('');
  
  for (const issue of issues) {
    const colorFn = SEVERITY_COLORS[issue.severity] || chalk.white;
    const severityLabel = SEVERITY_LABELS[issue.severity] || issue.severity;
    const categoryLabel = CATEGORY_LABELS[issue.category] || issue.category;
    
    lines.push(`    [${colorFn(issue.id)}] ${colorFn.bold(severityLabel)} - ${categoryLabel}`);
    lines.push(`        ${chalk.bold('位置:')} ${formatLocation(issue.location)}`);
    lines.push(`        ${chalk.bold('问题:')} ${issue.message}`);
    lines.push(`        ${chalk.bold('原因:')} ${issue.reason}`);
    lines.push(`        ${chalk.bold('建议:')} ${issue.migration}`);
    lines.push('');
  }
  
  return lines.join('\n');
}

export function generateMarkdownReport(compatibilityResult, sampleResult, options = {}) {
  const { oldPath, newPath, samplesPath } = options;
  const now = new Date().toISOString();
  
  const lines = [];
  
  lines.push('# API 契约体检报告');
  lines.push('');
  lines.push('> 由 API Contract Doctor 生成');
  lines.push(`> 生成时间: ${now}`);
  lines.push('');
  
  if (oldPath || newPath) {
    lines.push('## 检查文件');
    lines.push('');
    if (oldPath) lines.push(`- **旧版本规范**: \`${oldPath}\``);
    if (newPath) lines.push(`- **新版本规范**: \`${newPath}\``);
    if (samplesPath) lines.push(`- **请求样例**: \`${samplesPath}\``);
    lines.push('');
  }
  
  if (compatibilityResult) {
    const { summary, issues } = compatibilityResult;
    
    lines.push('## 1. 版本兼容性检查');
    lines.push('');
    
    lines.push('### 概览');
    lines.push('');
    
    if (summary.hasIssues) {
      lines.push('| 严重级别 | 数量 |');
      lines.push('|----------|------|');
      lines.push(`| 🔴 严重 | ${summary.bySeverity.critical} |`);
      lines.push(`| 🟠 高危 | ${summary.bySeverity.high} |`);
      lines.push(`| 🟡 中等 | ${summary.bySeverity.medium} |`);
      lines.push(`| 🔵 低 | ${summary.bySeverity.low} |`);
      lines.push(`| ℹ️ 信息 | ${summary.bySeverity.info} |`);
      lines.push('');
      
      if (summary.hasBreakingChanges) {
        lines.push('⚠️ **警告**: 检测到破坏性变更！旧客户端可能无法正常工作。');
      } else {
        lines.push('ℹ️ 存在变更，但没有检测到破坏性变更。');
      }
    } else {
      lines.push('✅ **未发现任何兼容性问题。**');
    }
    lines.push('');
    
    if (issues.length > 0) {
      lines.push('### 详细问题列表');
      lines.push('');
      
      for (const issue of issues) {
        const severityEmoji = getSeverityEmoji(issue.severity);
        const severityLabel = SEVERITY_LABELS[issue.severity] || issue.severity;
        const categoryLabel = CATEGORY_LABELS[issue.category] || issue.category;
        
        lines.push(`#### ${severityEmoji} ${issue.id} - ${severityLabel} (${categoryLabel})`);
        lines.push('');
        lines.push(`**位置**: ${formatLocationMarkdown(issue.location)}`);
        lines.push('');
        lines.push(`**问题**: ${issue.message}`);
        lines.push('');
        lines.push(`**原因**: ${issue.reason}`);
        lines.push('');
        lines.push(`**迁移建议**: ${issue.migration}`);
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }
  }
  
  if (sampleResult) {
    const { summary, issues } = sampleResult;
    
    lines.push('## 2. 请求样例校验');
    lines.push('');
    
    lines.push('### 概览');
    lines.push('');
    
    if (summary.hasIssues) {
      lines.push('| 严重级别 | 数量 |');
      lines.push('|----------|------|');
      lines.push(`| 🔴 严重 | ${summary.bySeverity.critical} |`);
      lines.push(`| 🟠 高危 | ${summary.bySeverity.high} |`);
      lines.push(`| 🟡 中等 | ${summary.bySeverity.medium} |`);
      lines.push(`| 🔵 低 | ${summary.bySeverity.low} |`);
      lines.push(`| ℹ️ 信息 | ${summary.bySeverity.info} |`);
      lines.push('');
    } else {
      lines.push('✅ **所有请求样例校验通过。**');
    }
    lines.push('');
    
    if (issues.length > 0) {
      lines.push('### 详细问题列表');
      lines.push('');
      
      for (const issue of issues) {
        const severityEmoji = getSeverityEmoji(issue.severity);
        const severityLabel = SEVERITY_LABELS[issue.severity] || issue.severity;
        
        lines.push(`#### ${severityEmoji} ${issue.id} - ${severityLabel}`);
        lines.push('');
        lines.push(`**位置**: ${formatLocationMarkdown(issue.location)}`);
        lines.push('');
        lines.push(`**问题**: ${issue.message}`);
        lines.push('');
        lines.push(`**原因**: ${issue.reason}`);
        lines.push('');
        lines.push(`**迁移建议**: ${issue.migration}`);
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }
  }
  
  return lines.join('\n');
}

export function generateJSONReport(compatibilityResult, sampleResult, options = {}) {
  const { oldPath, newPath, samplesPath } = options;
  
  const report = {
    meta: {
      tool: 'api-contract-doctor',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      files: {
        old: oldPath,
        new: newPath,
        samples: samplesPath
      }
    },
    compatibility: null,
    samples: null
  };
  
  if (compatibilityResult) {
    report.compatibility = {
      summary: compatibilityResult.summary,
      issues: compatibilityResult.issues.map(issue => ({
        ...issue,
        severityLabel: SEVERITY_LABELS[issue.severity],
        categoryLabel: CATEGORY_LABELS[issue.category]
      }))
    };
  }
  
  if (sampleResult) {
    report.samples = {
      summary: sampleResult.summary,
      issues: sampleResult.issues.map(issue => ({
        ...issue,
        severityLabel: SEVERITY_LABELS[issue.severity],
        categoryLabel: CATEGORY_LABELS[issue.category]
      }))
    };
  }
  
  return JSON.stringify(report, null, 2);
}

export function writeReport(content, outputPath) {
  const dir = path.dirname(outputPath);
  
  if (dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, content, 'utf8');
}

function formatLocation(location) {
  if (!location) return 'N/A';
  
  const parts = [];
  if (location.sampleIndex !== undefined) {
    parts.push(`样例 #${location.sampleIndex}`);
  }
  if (location.method) {
    parts.push(location.method);
  }
  if (location.path) {
    parts.push(location.path);
  }
  if (location.parameter) {
    parts.push(`参数: ${location.parameter}`);
    if (location.in) parts.push(`(in: ${location.in})`);
  }
  if (location.field) {
    parts.push(`字段: ${location.field}`);
  }
  if (location.statusCode) {
    parts.push(`状态码: ${location.statusCode}`);
  }
  if (location.mediaType) {
    parts.push(`Media-Type: ${location.mediaType}`);
  }
  
  return parts.join(' ') || 'N/A';
}

function formatLocationMarkdown(location) {
  if (!location) return 'N/A';
  
  const parts = [];
  if (location.sampleIndex !== undefined) {
    parts.push(`\`样例 #${location.sampleIndex}\``);
  }
  if (location.method) {
    parts.push(`\`${location.method}\``);
  }
  if (location.path) {
    parts.push(`\`${location.path}\``);
  }
  if (location.parameter) {
    const paramParts = [`参数: \`${location.parameter}\``];
    if (location.in) paramParts.push(`(in: \`${location.in}\`)`);
    parts.push(paramParts.join(' '));
  }
  if (location.field) {
    parts.push(`字段: \`${location.field}\``);
  }
  if (location.statusCode) {
    parts.push(`状态码: \`${location.statusCode}\``);
  }
  if (location.mediaType) {
    parts.push(`Media-Type: \`${location.mediaType}\``);
  }
  
  return parts.join(' ') || 'N/A';
}

function getSeverityEmoji(severity) {
  const emojis = {
    [SEVERITY.CRITICAL]: '🔴',
    [SEVERITY.HIGH]: '🟠',
    [SEVERITY.MEDIUM]: '🟡',
    [SEVERITY.LOW]: '🔵',
    [SEVERITY.INFO]: 'ℹ️'
  };
  return emojis[severity] || '⚪';
}
