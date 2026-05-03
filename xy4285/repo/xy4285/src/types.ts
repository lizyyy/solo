export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface SubtitleFile {
  path: string;
  fileName: string;
  format: 'srt' | 'vtt';
  cues: SubtitleCue[];
  language: string;
  episode: string;
  platform: string;
}

export interface DeliveryRule {
  platforms: PlatformRule[];
  languages: LanguageRule[];
  timing: TimingRule;
  text: TextRule;
  forbiddenWords: ForbiddenWordRule;
  naming: NamingRule;
}

export interface PlatformRule {
  name: string;
  code: string;
  requiredLanguages: string[];
}

export interface LanguageRule {
  code: string;
  name: string;
  readingSpeed: number;
  maxLinesPerCue: number;
}

export interface TimingRule {
  minGapBetweenCues: number;
  minCueDuration: number;
  maxCueDuration: number;
  allowOverlap: boolean;
}

export interface TextRule {
  allowEmptyLines: boolean;
  maxLineLength: number;
  checkPunctuation: boolean;
}

export interface ForbiddenWordRule {
  enabled: boolean;
  words: string[];
  caseSensitive: boolean;
}

export interface NamingRule {
  pattern: string;
  requiredParts: string[];
  separator: string;
}

export interface ValidationIssue {
  file: string;
  severity: 'error' | 'warning' | 'info';
  category: 'timing' | 'text' | 'forbidden-word' | 'naming' | 'language-coverage' | 'format';
  cueId?: string;
  startTime?: number;
  endTime?: number;
  message: string;
  suggestion?: string;
}

export interface ScanResult {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  filesByPlatform: Record<string, SubtitleFile[]>;
  filesByLanguage: Record<string, SubtitleFile[]>;
  issues: ValidationIssue[];
  languageCoverage: LanguageCoverageReport[];
}

export interface LanguageCoverageReport {
  episode: string;
  platform: string;
  required: string[];
  present: string[];
  missing: string[];
  complete: boolean;
}

export interface ExportOptions {
  outputDir: string;
  generateMarkdown: boolean;
  generateCsv: boolean;
  packageByPlatform: boolean;
}
