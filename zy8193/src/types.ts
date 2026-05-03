export interface LocaleMessages {
  [locale: string]: NestedMessages;
}

export interface NestedMessages {
  [key: string]: string | NestedMessages;
}

export interface FlatMessages {
  [key: string]: string;
}

export interface ParsedICUMessage {
  key: string;
  raw: string;
  placeholders: Placeholder[];
  pluralForms: string[];
  selectForms: { [key: string]: string[] };
  hasPlural: boolean;
  hasSelect: boolean;
  isValid: boolean;
  parseError?: string;
}

export interface Placeholder {
  name: string;
  type: 'simple' | 'plural' | 'select' | 'number' | 'date' | 'time' | 'selectordinal';
  raw: string;
}

export interface RouteEntry {
  path: string;
  keys: string[];
  component: string;
}

export interface ScreenshotEntry {
  name: string;
  path: string;
  keys: string[];
  status: 'active' | 'deprecated' | 'missing';
}

export interface RulesConfig {
  maxTextLength: {
    button: number;
    navigation: number;
    title: number;
  };
  pluralRules: {
    requiredForms: string[];
    localeOverrides: {
      [locale: string]: string[];
    };
  };
  deprecatedKeys: string[];
  keyPatterns: {
    allowed: string[];
    forbidden: string[];
  };
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCategory = 
  | 'missing_key'
  | 'extra_key'
  | 'unused_key'
  | 'placeholder_mismatch'
  | 'plural_missing'
  | 'text_too_long'
  | 'deprecated_key'
  | 'invalid_icu'
  | 'nested_key_invalid';

export interface Issue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  locale: string;
  key: string;
  message: string;
  context: {
    expected?: string[];
    actual?: string[];
    value?: string;
    limit?: number;
    reference?: string;
  };
}

export interface AnalysisResult {
  locales: string[];
  totalKeys: number;
  missingKeys: { [locale: string]: string[] };
  extraKeys: { [locale: string]: string[] };
  unusedKeys: string[];
  issues: Issue[];
  placeholderMismatches: PlaceholderMismatch[];
  pluralIssues: PluralIssue[];
  longTextIssues: LongTextIssue[];
  deprecatedKeyUsages: DeprecatedKeyUsage[];
}

export interface PlaceholderMismatch {
  key: string;
  locale: string;
  referenceLocale: string;
  referencePlaceholders: Placeholder[];
  actualPlaceholders: Placeholder[];
}

export interface PluralIssue {
  key: string;
  locale: string;
  requiredForms: string[];
  actualForms: string[];
  missingForms: string[];
}

export interface LongTextIssue {
  key: string;
  locale: string;
  value: string;
  length: number;
  limit: number;
  category: 'button' | 'navigation' | 'title';
}

export interface DeprecatedKeyUsage {
  key: string;
  location: string;
  page?: string;
}

export interface ReportOutput {
  issuesCsv: string;
  markdownReport: string;
  htmlPreview: string;
}
