import { AnalysisResult, BudgetIssue, ExportOptions } from '@/types';
import { formatBytes, formatMilliseconds } from './harParser';

const getSeverityIcon = (severity: string): string => {
  switch (severity) {
    case 'error': return '❌';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '•';
  }
};

const getSeverityEmoji = (severity: string): string => {
  return getSeverityIcon(severity);
};

export const exportMarkdown = (
  result: AnalysisResult, 
  options: ExportOptions = { format: 'markdown', includeDetails: true, includeWaterfall: false }
): string => {
  const { pageInfo, resourceTypeStats, cacheStats, thirdPartyStats, issues, timingStats } = result;
  
  const issuesBySeverity = {
    errors: issues.filter(i => i.severity === 'error'),
    warnings: issues.filter(i => i.severity === 'warning'),
    infos: issues.filter(i => i.severity === 'info'),
  };

  let md = `# HAR 性能预算体检报告\n\n`;
  md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  
  md += `## 📊 概览\n\n`;
  md += `| 指标 | 值 |\n|------|-----|\n`;
  md += `| 页面 | ${pageInfo.startedDateTime.split('T')[0]} |\n`;
  md += `| 总请求数 | ${pageInfo.totalRequests} |\n`;
  md += `| 总资源大小 | ${formatBytes(pageInfo.totalSize)} |\n`;
  md += `| 总传输大小 | ${formatBytes(pageInfo.totalTransferSize)} |\n`;
  md += `| DOMContentLoaded | ${formatMilliseconds(timingStats.domContentLoaded)} |\n`;
  md += `| onLoad | ${formatMilliseconds(timingStats.onLoad)} |\n\n`;
  
  md += `## 🚨 问题统计\n\n`;
  md += `- ❌ 错误: ${issuesBySeverity.errors.length}\n`;
  md += `- ⚠️ 警告: ${issuesBySeverity.warnings.length}\n`;
  md += `- ℹ️ 信息: ${issuesBySeverity.infos.length}\n\n`;
  
  if (issues.length > 0) {
    md += `## 🔍 详细问题\n\n`;
    
    if (issuesBySeverity.errors.length > 0) {
      md += `### ❌ 错误\n\n`;
      for (const issue of issuesBySeverity.errors) {
        md += `#### ${issue.title}\n\n`;
        md += `${issue.description}\n\n`;
        if (issue.threshold !== undefined && issue.actual !== undefined) {
          md += `- 阈值: ${issue.threshold}\n`;
          md += `- 实际: ${issue.actual}\n\n`;
        }
        if (options.includeDetails && issue.requests && issue.requests.length > 0) {
          md += `**相关请求:**\n\n`;
          for (const req of issue.requests.slice(0, 5)) {
            md += `- \`${req.method} ${req.url}\` (${req.status} - ${formatBytes(req.transferSize)} - ${formatMilliseconds(req.totalTime)})\n`;
          }
          if (issue.requests.length > 5) {
            md += `- ... 还有 ${issue.requests.length - 5} 个请求\n`;
          }
          md += `\n`;
        }
      }
    }
    
    if (issuesBySeverity.warnings.length > 0) {
      md += `### ⚠️ 警告\n\n`;
      for (const issue of issuesBySeverity.warnings) {
        md += `#### ${issue.title}\n\n`;
        md += `${issue.description}\n\n`;
        if (options.includeDetails && issue.requests && issue.requests.length > 0) {
          md += `**相关请求:**\n\n`;
          for (const req of issue.requests.slice(0, 3)) {
            md += `- \`${req.method} ${req.url}\`\n`;
          }
          if (issue.requests.length > 3) {
            md += `- ... 还有 ${issue.requests.length - 3} 个请求\n`;
          }
          md += `\n`;
        }
      }
    }
    
    if (issuesBySeverity.infos.length > 0) {
      md += `### ℹ️ 信息\n\n`;
      for (const issue of issuesBySeverity.infos) {
        md += `#### ${issue.title}\n\n`;
        md += `${issue.description}\n\n`;
      }
    }
  }
  
  md += `## 📦 资源类型统计\n\n`;
  md += `| 类型 | 数量 | 大小 | 传输大小 |\n|------|------|------|----------|\n`;
  for (const [type, stats] of Object.entries(resourceTypeStats)) {
    if (stats.count > 0) {
      md += `| ${type} | ${stats.count} | ${formatBytes(stats.size)} | ${formatBytes(stats.transferSize)} |\n`;
    }
  }
  md += `\n`;
  
  md += `## 💾 缓存统计\n\n`;
  md += `| 状态 | 数量 | 占比 |\n|------|------|------|\n`;
  md += `| 命中 | ${cacheStats.hitCount} | ${cacheStats.hitRate.toFixed(2)}% |\n`;
  md += `| 未命中 | ${cacheStats.missCount} | ${((cacheStats.missCount / (cacheStats.hitCount + cacheStats.missCount + cacheStats.noneCount)) * 100).toFixed(2)}% |\n`;
  md += `| 无缓存 | ${cacheStats.noneCount} | ${((cacheStats.noneCount / (cacheStats.hitCount + cacheStats.missCount + cacheStats.noneCount)) * 100).toFixed(2)}% |\n\n`;
  
  md += `## 🔗 第三方资源统计\n\n`;
  md += `**总计:** ${thirdPartyStats.totalCount} 个请求, ${formatBytes(thirdPartyStats.totalSize)}\n\n`;
  
  if (thirdPartyStats.domains.length > 0) {
    md += `| 域名 | 请求数 | 大小 |\n|------|--------|------|\n`;
    for (const domain of thirdPartyStats.domains) {
      md += `| ${domain.domain} | ${domain.count} | ${formatBytes(domain.size)} |\n`;
    }
    md += `\n`;
  }
  
  if (options.includeDetails) {
    md += `## 📋 完整请求列表\n\n`;
    md += `| # | 方法 | URL | 状态 | 类型 | 大小 | 时间 | 缓存 | 第三方 |\n`;
    md += `|---|------|-----|------|------|------|------|------|--------|\n`;
    for (const req of result.requests) {
      const cacheStatus = req.isFromCache ? '✅' : '❌';
      const thirdParty = req.isThirdParty ? '✅' : '❌';
      const shortUrl = req.url.length > 50 ? req.url.substring(0, 50) + '...' : req.url;
      md += `| ${req.index + 1} | ${req.method} | ${shortUrl} | ${req.status} | ${req.resourceType} | ${formatBytes(req.transferSize)} | ${formatMilliseconds(req.totalTime)} | ${cacheStatus} | ${thirdParty} |\n`;
    }
    md += `\n`;
  }
  
  return md;
};

export const exportHTML = (
  result: AnalysisResult,
  options: ExportOptions = { format: 'html', includeDetails: true, includeWaterfall: false }
): string => {
  const markdown = exportMarkdown(result, { ...options, format: 'markdown' });
  
  const htmlContent = markdown
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\`(.*?)\`/g, '<code>$1</code>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HAR 性能预算体检报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .report-container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h2 {
      color: #2563eb;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    h3 {
      color: #4b5563;
      margin-top: 25px;
      margin-bottom: 10px;
    }
    h4 {
      color: #6b7280;
      margin-top: 20px;
      margin-bottom: 8px;
    }
    blockquote {
      border-left: 4px solid #3b82f6;
      padding-left: 15px;
      color: #6b7280;
      margin: 15px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #f9fafb;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    li {
      margin: 5px 0;
    }
    code {
      background-color: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }
    p {
      margin: 10px 0;
    }
    .error { color: #dc2626; }
    .warning { color: #f59e0b; }
    .info { color: #3b82f6; }
  </style>
</head>
<body>
  <div class="report-container">
    ${htmlContent}
  </div>
</body>
</html>`;

  return html;
};

export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
