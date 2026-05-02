import * as fs from 'fs';
import * as path from 'path';
import { ValidationResult, Issue, IssueSeverity } from '../types';
import { MarkdownTemplateOptions } from './types';

const DEFAULT_OPTIONS: MarkdownTemplateOptions = {
  includeDetails: true,
  includeSuggestions: true,
  groupByCategory: true,
  groupBySeverity: true,
};

export function generateMarkdownReport(
  result: ValidationResult,
  options: MarkdownTemplateOptions = DEFAULT_OPTIONS
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const lines: string[] = [];
  
  lines.push(`# 制版预检报告`);
  lines.push('');
  lines.push(`> 生成时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}`);
  lines.push(`> 订单号: ${result.orderId}`);
  lines.push('');
  
  lines.push(`## 摘要`);
  lines.push('');
  
  const { summary } = result;
  const statusEmoji = summary.critical > 0 ? '🔴' : summary.warning > 0 ? '🟡' : '🟢';
  const statusText = summary.critical > 0 ? '不通过' : summary.warning > 0 ? '有警告' : '通过';
  
  lines.push(`**状态**: ${statusEmoji} ${statusText}`);
  lines.push('');
  
  lines.push(`| 严重程度 | 数量 |`);
  lines.push(`|----------|------|`);
  lines.push(`| 🔴 严重错误 | ${summary.critical} |`);
  lines.push(`| 🟡 警告 | ${summary.warning} |`);
  lines.push(`| ℹ️ 信息 | ${summary.info} |`);
  lines.push(`| **总计** | **${summary.total}** |`);
  lines.push('');
  
  if (result.metadata.svgFileName || result.metadata.orderFileName) {
    lines.push(`### 源文件信息`);
    lines.push('');
    
    if (result.metadata.svgFileName) {
      lines.push(`- SVG 刀模文件: \`${result.metadata.svgFileName}\``);
    }
    if (result.metadata.orderFileName) {
      lines.push(`- 订单文件: \`${result.metadata.orderFileName}\``);
    }
    if (result.metadata.rulesFileName) {
      lines.push(`- 工艺规则: \`${result.metadata.rulesFileName}\``);
    }
    if (result.metadata.barcodesFileName) {
      lines.push(`- 条码清单: \`${result.metadata.barcodesFileName}\``);
    }
    lines.push('');
  }
  
  if (result.issues.length > 0) {
    lines.push(`## 问题详情`);
    lines.push('');
    
    let issuesToDisplay = [...result.issues];
    
    if (opts.groupBySeverity) {
      const severityOrder: IssueSeverity[] = ['critical', 'warning', 'info'];
      
      for (const severity of severityOrder) {
        const severityIssues = issuesToDisplay.filter(i => i.severity === severity);
        
        if (severityIssues.length > 0) {
          const severityName = getSeverityName(severity);
          const severityEmoji = getSeverityEmoji(severity);
          
          lines.push(`### ${severityEmoji} ${severityName} (${severityIssues.length})`);
          lines.push('');
          
          if (opts.groupByCategory) {
            const categories = [...new Set(severityIssues.map(i => i.category))];
            
            for (const category of categories) {
              const categoryIssues = severityIssues.filter(i => i.category === category);
              const categoryName = getCategoryName(category);
              
              lines.push(`#### ${categoryName} (${categoryIssues.length})`);
              lines.push('');
              
              for (const issue of categoryIssues) {
                lines.push(formatIssueMarkdown(issue, opts));
                lines.push('');
              }
            }
          } else {
            for (const issue of severityIssues) {
              lines.push(formatIssueMarkdown(issue, opts));
              lines.push('');
            }
          }
        }
      }
    } else if (opts.groupByCategory) {
      const categories = [...new Set(issuesToDisplay.map(i => i.category))];
      
      for (const category of categories) {
        const categoryIssues = issuesToDisplay.filter(i => i.category === category);
        const categoryName = getCategoryName(category);
        
        lines.push(`### ${categoryName} (${categoryIssues.length})`);
        lines.push('');
        
        for (const issue of categoryIssues) {
          lines.push(formatIssueMarkdown(issue, opts));
          lines.push('');
        }
      }
    } else {
      for (const issue of issuesToDisplay) {
        lines.push(formatIssueMarkdown(issue, opts));
        lines.push('');
      }
    }
  } else {
    lines.push(`## 🎉 恭喜！`);
    lines.push('');
    lines.push(`未发现任何问题，文件可以正常交付。`);
    lines.push('');
  }
  
  lines.push(`---`);
  lines.push('');
  lines.push(`*此报告由 prepress-checker 工具自动生成*`);
  
  return lines.join('\n');
}

function formatIssueMarkdown(
  issue: Issue,
  options: MarkdownTemplateOptions
): string {
  const lines: string[] = [];
  const emoji = getSeverityEmoji(issue.severity);
  
  lines.push(`##### ${emoji} ${issue.message}`);
  lines.push('');
  
  lines.push(`- **类别**: ${getCategoryName(issue.category)}`);
  lines.push(`- **问题ID**: \`${issue.id}\``);
  
  if (issue.location) {
    const locParts: string[] = [];
    if (issue.location.x !== undefined && issue.location.y !== undefined) {
      locParts.push(`位置: (${issue.location.x}, ${issue.location.y})`);
    }
    if (issue.location.elementId) {
      locParts.push(`元素ID: ${issue.location.elementId}`);
    }
    if (locParts.length > 0) {
      lines.push(`- **定位**: ${locParts.join(' | ')}`);
    }
  }
  
  if (options.includeDetails && issue.details) {
    lines.push('');
    lines.push(`**详情:**`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(issue.details, null, 2));
    lines.push('```');
  }
  
  if (options.includeSuggestions && issue.suggestion) {
    lines.push('');
    lines.push(`**建议**: ${issue.suggestion}`);
  }
  
  return lines.join('\n');
}

function getSeverityName(severity: IssueSeverity): string {
  const names: Record<IssueSeverity, string> = {
    critical: '严重错误',
    warning: '警告',
    info: '信息',
  };
  return names[severity];
}

function getSeverityEmoji(severity: IssueSeverity): string {
  const emojis: Record<IssueSeverity, string> = {
    critical: '🔴',
    warning: '🟡',
    info: 'ℹ️',
  };
  return emojis[severity];
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    viewbox: 'ViewBox 检查',
    dimension: '尺寸单位',
    dieline: '刀线检查',
    bleed: '出血边距',
    spot_color: '专色命名',
    registration: '套准孔',
    barcode: '条码检查',
  };
  return names[category] || category;
}

export function exportMarkdownReport(
  result: ValidationResult,
  outputPath: string,
  options?: MarkdownTemplateOptions
): void {
  const content = generateMarkdownReport(result, options);
  const dir = path.dirname(outputPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, content, 'utf-8');
}
