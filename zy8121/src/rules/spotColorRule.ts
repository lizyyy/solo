import { Rule, RuleContext } from './types';
import { Issue } from '../types';

export const spotColorRule: Rule = {
  id: 'SPOT-001',
  name: '专色命名检查',
  category: 'spot_color',
  description: '检查专色命名是否符合规范',
  severity: 'warning',
  check: checkSpotColors,
};

function checkSpotColors(context: RuleContext): Issue[] {
  const issues: Issue[] = [];
  const { svg, rules } = context;

  const colors = extractColors(svg);
  
  for (const color of colors) {
    const validation = validateSpotColor(color, rules);
    
    if (!validation.valid) {
      issues.push({
        id: `SPOT-001-001-${color.replace(/[^a-zA-Z0-9]/g, '')}`,
        severity: validation.severity || 'warning',
        category: 'spot_color',
        message: `专色命名不符合规范: ${color}`,
        details: {
          color,
          allowedPrefixes: rules.spotColors.allowedPrefixes,
          caseSensitive: rules.spotColors.caseSensitive,
          validationIssues: validation.issues,
        },
        suggestion: `专色名称应包含以下前缀之一: ${rules.spotColors.allowedPrefixes.join(', ')}`,
      });
    }
  }

  return issues;
}

interface ColorValidation {
  valid: boolean;
  severity?: 'critical' | 'warning' | 'info';
  issues: string[];
}

function validateSpotColor(
  color: string,
  rules: RuleContext['rules']
): ColorValidation {
  const issues: string[] = [];
  
  if (isProcessColor(color)) {
    return { valid: true, issues: [] };
  }
  
  const hasValidPrefix = rules.spotColors.allowedPrefixes.some(prefix => {
    if (rules.spotColors.caseSensitive) {
      return color.startsWith(prefix);
    }
    return color.toLowerCase().startsWith(prefix.toLowerCase());
  });
  
  if (!hasValidPrefix) {
    issues.push(`颜色 "${color}" 不包含允许的专色前缀`);
  }
  
  if (color.includes(' ') || color.includes('\t')) {
    issues.push('专色名称不应包含空格');
  }
  
  return {
    valid: issues.length === 0,
    severity: issues.length > 0 ? 'warning' : undefined,
    issues,
  };
}

function isProcessColor(color: string): boolean {
  const lower = color.toLowerCase();
  
  const cmykNames = ['cyan', 'magenta', 'yellow', 'black', 'key', 'white', 'gray', 'grey'];
  if (cmykNames.includes(lower)) {
    return true;
  }
  
  if (lower.startsWith('#')) {
    return true;
  }
  
  if (lower.startsWith('rgb(') || lower.startsWith('rgba(')) {
    return true;
  }
  
  if (lower.startsWith('cmyk(')) {
    return true;
  }
  
  return false;
}

function extractColors(svg: RuleContext['svg']): string[] {
  const colors = new Set<string>();
  
  for (const element of svg.elements) {
    const attrs = element.attributes;
    
    if (attrs.fill && attrs.fill !== 'none' && attrs.fill !== 'transparent') {
      colors.add(attrs.fill);
    }
    
    if (attrs.stroke && attrs.stroke !== 'none' && attrs.stroke !== 'transparent') {
      colors.add(attrs.stroke);
    }
    
    const style = attrs.style;
    if (style) {
      const fillMatch = style.match(/fill\s*:\s*([^;]+)/i);
      if (fillMatch && fillMatch[1] !== 'none' && fillMatch[1] !== 'transparent') {
        colors.add(fillMatch[1].trim());
      }
      
      const strokeMatch = style.match(/stroke\s*:\s*([^;]+)/i);
      if (strokeMatch && strokeMatch[1] !== 'none' && strokeMatch[1] !== 'transparent') {
        colors.add(strokeMatch[1].trim());
      }
    }
  }
  
  return Array.from(colors);
}
