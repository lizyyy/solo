import * as path from 'path';
import {
  Issue,
  IssueType,
  IssueSeverity,
  IssueExplanation,
  Config,
  TokenDefinition,
  HardcodedValue,
  TokenReference,
} from './types';
import { checkThemeConsistency, AliasError } from './token-parser';

const ISSUE_EXPLANATIONS: Record<IssueType, IssueExplanation> = {
  [IssueType.HARDCODED_COLOR]: {
    type: IssueType.HARDCODED_COLOR,
    title: '硬编码颜色值',
    description: '代码中直接使用了颜色字面量，而不是通过 Design Token 引用。这会导致主题切换困难、颜色不一致等问题。',
    severity: IssueSeverity.HIGH,
    examples: [
      {
        bad: `const color = '#ff0000';`,
        good: `const color = var(--color-primary);`,
        explanation: '使用 CSS 变量或 Design Token 替代硬编码颜色值',
      },
      {
        bad: `style={{ color: 'rgb(255, 0, 0)' }}`,
        good: `style={{ color: 'var(--color-danger)' }}`,
        explanation: '在 JSX 样式中也应该使用 Token 引用',
      },
    ],
  },
  [IssueType.HARDCODED_SPACING]: {
    type: IssueType.HARDCODED_SPACING,
    title: '硬编码间距值',
    description: '代码中直接使用了间距字面量（如 px、rem 值），而不是通过 Design Token 引用。这会导致布局不一致、响应式适配困难等问题。',
    severity: IssueSeverity.MEDIUM,
    examples: [
      {
        bad: `padding: 16px;`,
        good: `padding: var(--spacing-md);`,
        explanation: '使用间距 Token 保证布局一致性',
      },
      {
        bad: `margin: 8px 16px;`,
        good: `margin: var(--spacing-sm) var(--spacing-md);`,
        explanation: '所有间距值都应该通过 Token 引用',
      },
    ],
  },
  [IssueType.HARDCODED_FONT]: {
    type: IssueType.HARDCODED_FONT,
    title: '硬编码字体值',
    description: '代码中直接使用了字体系列或字号字面量，而不是通过 Design Token 引用。这会导致字体层级混乱、品牌一致性问题。',
    severity: IssueSeverity.MEDIUM,
    examples: [
      {
        bad: `font-family: 'Inter', sans-serif;`,
        good: `font-family: var(--font-family-sans);`,
        explanation: '使用字体 Token 保证品牌一致性',
      },
      {
        bad: `font-size: 14px;`,
        good: `font-size: var(--font-size-sm);`,
        explanation: '字号也应该通过 Token 统一管理',
      },
    ],
  },
  [IssueType.MISSING_TOKEN]: {
    type: IssueType.MISSING_TOKEN,
    title: '引用不存在的 Token',
    description: '代码中引用了一个不存在的 Design Token。这可能是 Token 已被删除、重命名，或者引用拼写错误导致的。',
    severity: IssueSeverity.CRITICAL,
    examples: [
      {
        bad: `var(--color-primery)`,
        good: `var(--color-primary)`,
        explanation: '检查 Token 名称拼写是否正确',
      },
      {
        bad: `var(--color-deprecated)`,
        good: `// 查找替代的新 Token 或检查 Token 列表`,
        explanation: '如果 Token 已被删除，需要查找替代方案',
      },
    ],
  },
  [IssueType.UNUSED_TOKEN]: {
    type: IssueType.UNUSED_TOKEN,
    title: '未使用的 Token',
    description: 'Design Token 已定义但在代码中没有被使用。这可能是遗留 Token、过时的 Token，或者是准备使用但忘记应用的 Token。',
    severity: IssueSeverity.LOW,
    examples: [
      {
        bad: `// tokens.json 中定义了但未使用
{ "color": { "legacy": { "value": "#ff0000" } } }`,
        good: `// 确认是否需要这个 Token，不需要则删除
// 或检查是否有地方应该使用但漏掉了`,
        explanation: '定期清理未使用的 Token 可以保持设计系统的整洁',
      },
    ],
  },
  [IssueType.THEME_MISMATCH]: {
    type: IssueType.THEME_MISMATCH,
    title: '主题值不完整',
    description: '同一个语义化 Token 在某些主题中缺少定义。这会导致主题切换时出现样式问题或回退到默认值。',
    severity: IssueSeverity.HIGH,
    examples: [
      {
        bad: `{
  "light": { "text-primary": { "value": "#000000" } },
  "dark": {}  // 缺少 text-primary 的暗色调定义
}`,
        good: `{
  "light": { "text-primary": { "value": "#000000" } },
  "dark": { "text-primary": { "value": "#ffffff" } }
}`,
        explanation: '确保所有语义化 Token 在所有主题中都有定义',
      },
    ],
  },
  [IssueType.INVALID_ALIAS]: {
    type: IssueType.INVALID_ALIAS,
    title: '无效的别名引用',
    description: 'Token 别名指向了一个不存在的基础 Token。这会导致 Token 解析失败，样式无法正确应用。',
    severity: IssueSeverity.CRITICAL,
    examples: [
      {
        bad: `{
  "color": {
    "primary": { "alias": "color.nonexistent" },
    "base": { "value": "#0066ff" }
  }
}`,
        good: `{
  "color": {
    "primary": { "alias": "color.base" },
    "base": { "value": "#0066ff" }
  }
}`,
        explanation: '确保别名引用的 Token 实际存在',
      },
    ],
  },
  [IssueType.CIRCULAR_ALIAS]: {
    type: IssueType.CIRCULAR_ALIAS,
    title: '循环别名引用',
    description: '发现 Token 之间形成了循环引用（A 引用 B，B 又引用 A）。这会导致无限递归，Token 无法正确解析。',
    severity: IssueSeverity.CRITICAL,
    examples: [
      {
        bad: `{
  "color": {
    "primary": { "alias": "color.secondary" },
    "secondary": { "alias": "color.primary" }
  }
}`,
        good: `{
  "color": {
    "primary": { "value": "#0066ff" },
    "secondary": { "alias": "color.primary" }
  }
}`,
        explanation: '打破循环引用，确保有一个 Token 定义了实际值',
      },
    ],
  },
};

export function getIssueExplanation(type: IssueType): IssueExplanation {
  return ISSUE_EXPLANATIONS[type];
}

export function getAllIssueExplanations(): IssueExplanation[] {
  return Object.values(ISSUE_EXPLANATIONS);
}

export function analyzeHardcodedValues(
  hardcoded: HardcodedValue[],
  config: Config
): Issue[] {
  const issues: Issue[] = [];

  for (const item of hardcoded) {
    let issueType: IssueType;
    let severity: IssueSeverity;
    let title: string;

    switch (item.type) {
      case 'color':
        issueType = IssueType.HARDCODED_COLOR;
        severity = IssueSeverity.HIGH;
        title = '硬编码颜色值';
        break;
      case 'spacing':
        issueType = IssueType.HARDCODED_SPACING;
        severity = IssueSeverity.MEDIUM;
        title = '硬编码间距值';
        break;
      case 'font':
        issueType = IssueType.HARDCODED_FONT;
        severity = IssueSeverity.MEDIUM;
        title = '硬编码字体值';
        break;
      default:
        issueType = IssueType.HARDCODED_COLOR;
        severity = IssueSeverity.MEDIUM;
        title = '硬编码值';
    }

    const relativePath = path.relative(config.projectRoot, item.file);

    issues.push({
      id: generateIssueId(),
      type: issueType,
      severity,
      title,
      description: `发现硬编码的 ${item.type} 值 "${item.value}"`,
      file: relativePath,
      line: item.line,
      column: item.column,
      context: item.context,
      actualValue: item.value,
    });
  }

  return issues;
}

export function analyzeTokenReferences(
  references: TokenReference[],
  definedTokens: TokenDefinition[],
  config: Config
): Issue[] {
  const issues: Issue[] = [];
  const tokenNames = new Set(definedTokens.map((t) => t.name));

  for (const ref of references) {
    if (!tokenNames.has(ref.tokenName)) {
      const cssVarName = ref.tokenName.startsWith('--')
        ? ref.tokenName
        : `--${ref.tokenName}`;
      
      if (!tokenNames.has(cssVarName)) {
        const relativePath = path.relative(config.projectRoot, ref.file);
        
        issues.push({
          id: generateIssueId(),
          type: IssueType.MISSING_TOKEN,
          severity: IssueSeverity.CRITICAL,
          title: '引用不存在的 Token',
          description: `引用的 Token "${ref.tokenName}" 不存在`,
          file: relativePath,
          line: ref.line,
          column: ref.column,
          context: ref.context,
          tokenName: ref.tokenName,
        });
      }
    }
  }

  return issues;
}

export function analyzeUnusedTokens(
  definedTokens: TokenDefinition[],
  references: TokenReference[]
): Issue[] {
  const issues: Issue[] = [];
  const referencedTokens = new Set(references.map((r) => r.tokenName));

  for (const token of definedTokens) {
    if (!referencedTokens.has(token.name)) {
      const cssVarName = token.name.startsWith('--') ? token.name : `--${token.name}`;
      if (!referencedTokens.has(cssVarName)) {
        issues.push({
          id: generateIssueId(),
          type: IssueType.UNUSED_TOKEN,
          severity: IssueSeverity.LOW,
          title: '未使用的 Token',
          description: `Token "${token.name}" 已定义但未被使用`,
          tokenName: token.name,
          actualValue: token.value,
        });
      }
    }
  }

  return issues;
}

export function analyzeThemeConsistency(
  tokens: TokenDefinition[],
  themeNames: string[]
): Issue[] {
  const issues: Issue[] = [];
  const result = checkThemeConsistency(tokens, themeNames);

  for (const item of result.missing) {
    issues.push({
      id: generateIssueId(),
      type: IssueType.THEME_MISMATCH,
      severity: IssueSeverity.HIGH,
      title: '主题值不完整',
      description: `Token "${item.token}" 在以下主题中缺少定义: ${item.missingThemes.join(', ')}`,
      tokenName: item.token,
      themes: item.missingThemes,
    });
  }

  return issues;
}

export function analyzeAliasErrors(errors: AliasError[]): Issue[] {
  const issues: Issue[] = [];

  for (const error of errors) {
    if (error.message.includes('循环')) {
      issues.push({
        id: generateIssueId(),
        type: IssueType.CIRCULAR_ALIAS,
        severity: IssueSeverity.CRITICAL,
        title: '循环别名引用',
        description: error.message,
        tokenName: error.tokenName,
      });
    } else if (error.message.includes('不存在')) {
      issues.push({
        id: generateIssueId(),
        type: IssueType.INVALID_ALIAS,
        severity: IssueSeverity.CRITICAL,
        title: '无效的别名引用',
        description: error.message,
        tokenName: error.tokenName,
      });
    }
  }

  return issues;
}

export function runFullAnalysis(
  hardcoded: HardcodedValue[],
  references: TokenReference[],
  definedTokens: TokenDefinition[],
  aliasErrors: AliasError[],
  config: Config
): Issue[] {
  const issues: Issue[] = [];

  issues.push(...analyzeHardcodedValues(hardcoded, config));
  issues.push(...analyzeTokenReferences(references, definedTokens, config));
  issues.push(...analyzeUnusedTokens(definedTokens, references));
  issues.push(...analyzeThemeConsistency(definedTokens, config.themeNames));
  issues.push(...analyzeAliasErrors(aliasErrors));

  return issues.sort((a, b) => {
    const severityOrder: Record<IssueSeverity, number> = {
      [IssueSeverity.CRITICAL]: 0,
      [IssueSeverity.HIGH]: 1,
      [IssueSeverity.MEDIUM]: 2,
      [IssueSeverity.LOW]: 3,
    };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function groupIssuesBySeverity(issues: Issue[]): Record<IssueSeverity, Issue[]> {
  const groups: Record<IssueSeverity, Issue[]> = {
    [IssueSeverity.CRITICAL]: [],
    [IssueSeverity.HIGH]: [],
    [IssueSeverity.MEDIUM]: [],
    [IssueSeverity.LOW]: [],
  };

  for (const issue of issues) {
    groups[issue.severity].push(issue);
  }

  return groups;
}

export function getIssueSummary(issues: Issue[]): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
} {
  const groups = groupIssuesBySeverity(issues);
  return {
    total: issues.length,
    critical: groups[IssueSeverity.CRITICAL].length,
    high: groups[IssueSeverity.HIGH].length,
    medium: groups[IssueSeverity.MEDIUM].length,
    low: groups[IssueSeverity.LOW].length,
  };
}

let issueCounter = 0;

function generateIssueId(): string {
  issueCounter++;
  const timestamp = Date.now().toString(36);
  const counter = issueCounter.toString(36).padStart(4, '0');
  return `TD-${timestamp}-${counter}`;
}

export function resetIssueCounter(): void {
  issueCounter = 0;
}
