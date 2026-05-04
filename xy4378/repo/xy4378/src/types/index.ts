export type Locale = 'zh' | 'en' | 'ja';

export interface LocalePackage {
  locale: Locale;
  path: string;
  data: Record<string, any>;
}

export interface Issue {
  id: string;
  type: IssueType;
  severity: Severity;
  key?: string;
  message: string;
  locale?: Locale;
  sourceFile?: string;
  line?: number;
  column?: number;
  context?: string;
  placeholderInfo?: PlaceholderInfo;
  pluralInfo?: PluralInfo;
  status: IssueStatus;
  falsePositive: boolean;
  notes: string;
  fixSuggestion: string;
  createdAt: number;
  updatedAt: number;
}

export type IssueType = 
  | 'missing_key'
  | 'extra_key'
  | 'placeholder_mismatch'
  | 'plural_rule_missing'
  | 'plural_rule_inconsistent'
  | 'hardcoded_chinese'
  | 'unused_key'
  | 'empty_value';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type IssueStatus = 'open' | 'acknowledged' | 'resolved' | 'ignored';

export interface PlaceholderInfo {
  expected: string[];
  actual: string[];
  locale: Locale;
}

export interface PluralInfo {
  expectedForms: string[];
  actualForms: string[];
  locale: Locale;
}

export interface ScanResult {
  timestamp: number;
  locales: Locale[];
  totalKeys: number;
  issues: Issue[];
  sourceFiles: string[];
  localeFiles: string[];
}

export interface ScanConfig {
  projectPath: string;
  locales: Locale[];
  localePatterns: string[];
  sourcePatterns: string[];
  ignorePatterns: string[];
  pluralRules: Record<Locale, string[]>;
  i18nFunctionNames: string[];
}

export interface ExportOptions {
  format: 'markdown' | 'json' | 'patch';
  outputPath: string;
  includeResolved: boolean;
  includeIgnored: boolean;
}
