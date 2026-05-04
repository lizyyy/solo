export type FileType = 'markdown' | 'html' | 'image' | 'attachment' | 'code' | 'other';

export interface FileInfo {
  path: string;
  name: string;
  type: FileType;
  extension: string;
  size: number;
  lastModified: Date;
}

export interface LinkInfo {
  href: string;
  text: string;
  type: 'internal' | 'external' | 'anchor';
  line: number;
  column: number;
}

export interface ImageInfo {
  src: string;
  alt: string;
  line: number;
  column: number;
}

export interface CodeSnippet {
  id: string;
  language: string;
  code: string;
  filename: string;
  line: number;
  column: number;
  file: string;
  section: string;
  isDangerous: boolean;
}

export interface Frontmatter {
  title?: string;
  description?: string;
  date?: string;
  author?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface ParsedDocument {
  path: string;
  frontmatter: Frontmatter;
  content: string;
  links: LinkInfo[];
  images: ImageInfo[];
  codeSnippets: CodeSnippet[];
  sections: SectionInfo[];
}

export interface SectionInfo {
  title: string;
  level: number;
  anchor: string;
  line: number;
}

export type IssueType = 'missing_file' | 'bad_anchor' | 'code_error' | 'dangerous_command' | 'config_error' | 'broken_link';

export interface Issue {
  id: string;
  type: IssueType;
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  message: string;
  suggestion: string;
  context?: string;
}

export interface CodeExecutionResult {
  snippetId: string;
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut: boolean;
}

export interface ScanResult {
  scannedAt: Date;
  rootPath: string;
  files: FileInfo[];
  summary: {
    totalFiles: number;
    byType: Record<FileType, number>;
  };
}

export interface ValidateResult {
  validatedAt: Date;
  rootPath: string;
  issues: Issue[];
  scannedFiles: number;
  summary: {
    totalIssues: number;
    byType: Record<IssueType, number>;
    bySeverity: {
      errors: number;
      warnings: number;
      info: number;
    };
  };
}

export interface RunSnippetsResult {
  executedAt: Date;
  rootPath: string;
  snippets: CodeSnippet[];
  results: CodeExecutionResult[];
  issues: Issue[];
  summary: {
    totalSnippets: number;
    passed: number;
    failed: number;
    skipped: number;
    byLanguage: Record<string, number>;
  };
}

export interface ReportSummary {
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  skippedChecks: number;
}

export interface ExportReport {
  generatedAt: Date;
  version: string;
  rootPath: string;
  summary: ReportSummary;
  scan: ScanResult;
  validate: ValidateResult;
  runSnippets: RunSnippetsResult;
  fixList: FixItem[];
}

export interface FixItem {
  id: string;
  type: IssueType;
  description: string;
  location: {
    file: string;
    line: number;
  };
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Config {
  ignore: {
    patterns: string[];
    links: string[];
    snippets: string[];
  };
  validation: {
    checkExternalLinks: boolean;
    validateAnchors: boolean;
    allowDangerousCommands: boolean;
  };
  execution: {
    timeout: number;
    workingDir: string;
    environments: Record<string, string>;
  };
  report: {
    outputDir: string;
    formats: ('json' | 'html' | 'markdown')[];
    includeDetails: boolean;
  };
}

export const defaultConfig: Config = {
  ignore: {
    patterns: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      '*.log',
      '.DS_Store'
    ],
    links: [],
    snippets: []
  },
  validation: {
    checkExternalLinks: false,
    validateAnchors: true,
    allowDangerousCommands: false
  },
  execution: {
    timeout: 30000,
    workingDir: '.',
    environments: {}
  },
  report: {
    outputDir: './reports',
    formats: ['json', 'html', 'markdown'],
    includeDetails: true
  }
};