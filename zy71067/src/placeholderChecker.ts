import { PlaceholderIssue } from './types';
import { extractPlaceholders } from './parser';

export function checkPlaceholders(
  sourceText: string,
  targetText: string,
  expectedPlaceholders: string[] = []
): PlaceholderIssue[] {
  const issues: PlaceholderIssue[] = [];
  
  const sourcePlaceholders = extractPlaceholders(sourceText);
  const targetPlaceholders = extractPlaceholders(targetText);
  
  for (const placeholder of expectedPlaceholders) {
    if (!targetPlaceholders.includes(placeholder)) {
      issues.push({
        type: 'missing',
        placeholder,
        description: `目标文案中缺少预期的占位符: ${placeholder}`,
      });
    }
  }
  
  for (const placeholder of sourcePlaceholders) {
    if (!targetPlaceholders.includes(placeholder)) {
      if (!expectedPlaceholders.includes(placeholder)) {
        issues.push({
          type: 'missing',
          placeholder,
          description: `源文案中的占位符在目标文案中缺失: ${placeholder}`,
        });
      }
    }
  }
  
  for (const placeholder of targetPlaceholders) {
    if (!sourcePlaceholders.includes(placeholder) && !expectedPlaceholders.includes(placeholder)) {
      issues.push({
        type: 'extra',
        placeholder,
        description: `目标文案中出现了源文案中没有的占位符: ${placeholder}`,
      });
    }
  }
  
  return issues;
}

export function validatePlaceholderOrder(
  sourceText: string,
  targetText: string
): PlaceholderIssue[] {
  const issues: PlaceholderIssue[] = [];
  
  const sourcePlaceholders = extractPlaceholdersInOrder(sourceText);
  const targetPlaceholders = extractPlaceholdersInOrder(targetText);
  
  const numberedSource = sourcePlaceholders.filter(p => /\d+/.test(p));
  const numberedTarget = targetPlaceholders.filter(p => /\d+/.test(p));
  
  if (numberedSource.length > 0 && numberedTarget.length > 0) {
    if (numberedSource.length !== numberedTarget.length) {
      issues.push({
        type: 'mismatch',
        placeholder: numberedSource.join(',') + ' vs ' + numberedTarget.join(','),
        description: `带序号占位符数量不匹配: 源 ${numberedSource.length} 个 vs 目标 ${numberedTarget.length} 个`,
      });
    }
  }
  
  return issues;
}

function extractPlaceholdersInOrder(text: string): string[] {
  const placeholders: string[] = [];
  const patterns = [
    /\{(\w+)\}/g,
    /\%\{(\w+)\}/g,
    /\$(\w+)/g,
    /\{\{(\w+)\}\}/g,
  ];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
      placeholders.push(match[0]);
    }
  }

  return placeholders;
}

export function estimatePlaceholderMaxWidth(
  placeholder: string,
  estimatedLength: number = 10
): number {
  if (placeholder.includes('name') || placeholder.includes('user')) {
    return Math.max(estimatedLength, 20);
  }
  if (placeholder.includes('count') || placeholder.includes('number') || placeholder.includes('num')) {
    return Math.max(estimatedLength, 8);
  }
  if (placeholder.includes('date') || placeholder.includes('time')) {
    return Math.max(estimatedLength, 15);
  }
  if (placeholder.includes('url') || placeholder.includes('link')) {
    return Math.max(estimatedLength, 30);
  }
  if (placeholder.includes('email')) {
    return Math.max(estimatedLength, 25);
  }
  return estimatedLength;
}

export function getPlaceholderIssuesSummary(issues: PlaceholderIssue[]): string {
  if (issues.length === 0) {
    return '占位符校验通过';
  }
  
  const lines: string[] = [];
  const missing = issues.filter(i => i.type === 'missing');
  const extra = issues.filter(i => i.type === 'extra');
  const mismatch = issues.filter(i => i.type === 'mismatch');
  
  if (missing.length > 0) {
    lines.push(`缺失 ${missing.length} 个占位符:`);
    for (const issue of missing) {
      lines.push(`  - ${issue.placeholder}`);
    }
  }
  
  if (extra.length > 0) {
    lines.push(`额外 ${extra.length} 个占位符:`);
    for (const issue of extra) {
      lines.push(`  - ${issue.placeholder}`);
    }
  }
  
  if (mismatch.length > 0) {
    lines.push(`不匹配 ${mismatch.length} 处:`);
    for (const issue of mismatch) {
      lines.push(`  - ${issue.description}`);
    }
  }
  
  return lines.join('\n');
}
