export interface Placeholder {
  name: string;
  raw: string;
  type: 'curly' | 'doubleCurly' | 'dollar' | 'percent' | 'colon';
}

export interface TranslationEntry {
  key: string;
  value: string;
  filePath: string;
  language: string;
  lineNumber?: number;
}

export interface PlaceholderCheckResult {
  key: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  targetText: string;
  sourcePlaceholders: Placeholder[];
  targetPlaceholders: Placeholder[];
  missingPlaceholders: Placeholder[];
  extraPlaceholders: Placeholder[];
  filePath: string;
  lineNumber?: number;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface CheckReport {
  summary: {
    totalKeys: number;
    checkedKeys: number;
    errors: number;
    warnings: number;
    passed: number;
  };
  results: PlaceholderCheckResult[];
  metadata: {
    sourceLanguage: string;
    targetLanguages: string[];
    checkedAt: string;
    filesProcessed: string[];
  };
}

export interface CLIOptions {
  source: string;
  sourceLang: string;
  targetLangs?: string[];
  outputDir: string;
  pattern: string;
  failOnError: boolean;
  format: 'json' | 'markdown' | 'html' | 'all';
  verbose: boolean;
}
