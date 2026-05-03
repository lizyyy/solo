export interface TokenValue {
  value: string;
  type?: 'color' | 'spacing' | 'font' | 'radius' | 'shadow' | 'size';
  alias?: string;
}

export interface TokenDefinition {
  name: string;
  path: string[];
  value: string;
  type?: string;
  alias?: string;
  resolvedValue?: string;
}

export interface ThemeTokens {
  [theme: string]: {
    [tokenName: string]: TokenValue;
  };
}

export interface TokenSource {
  type: 'json' | 'yaml' | 'css' | 'scss' | 'tailwind';
  path: string;
  tokens: TokenDefinition[];
}

export interface CSSVariable {
  name: string;
  value: string;
  file: string;
  line: number;
}

export interface TailwindConfig {
  colors?: Record<string, string | Record<string, string>>;
  spacing?: Record<string, string>;
  fontSize?: Record<string, string | [string, string]>;
  borderRadius?: Record<string, string>;
  boxShadow?: Record<string, string>;
}

export interface HardcodedValue {
  type: 'color' | 'spacing' | 'font' | 'radius';
  value: string;
  file: string;
  line: number;
  column: number;
  context: string;
}

export interface TokenReference {
  tokenName: string;
  file: string;
  line: number;
  column: number;
  context: string;
}

export interface ScanResult {
  tokens: {
    defined: TokenDefinition[];
    unused: TokenDefinition[];
    missing: TokenReference[];
  };
  hardcoded: HardcodedValue[];
  references: TokenReference[];
  cssVariables: CSSVariable[];
}

export enum IssueSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum IssueType {
  HARDCODED_COLOR = 'hardcoded_color',
  HARDCODED_SPACING = 'hardcoded_spacing',
  HARDCODED_FONT = 'hardcoded_font',
  MISSING_TOKEN = 'missing_token',
  UNUSED_TOKEN = 'unused_token',
  THEME_MISMATCH = 'theme_mismatch',
  INVALID_ALIAS = 'invalid_alias',
  CIRCULAR_ALIAS = 'circular_alias',
}

export interface Issue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  context?: string;
  tokenName?: string;
  actualValue?: string;
  suggestedToken?: string;
  themes?: string[];
}

export interface IssueExplanation {
  type: IssueType;
  title: string;
  description: string;
  severity: IssueSeverity;
  examples: {
    bad: string;
    good: string;
    explanation: string;
  }[];
}

export interface Config {
  projectRoot: string;
  tokenFiles: string[];
  sourceDirs: string[];
  ignorePatterns: string[];
  allowedHardcoded: string[];
  themeNames: string[];
  outputDir: string;
}

export interface ReportData {
  timestamp: string;
  project: string;
  config: Config;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issues: Issue[];
  tokens: {
    total: number;
    defined: number;
    unused: number;
    missing: number;
  };
}
