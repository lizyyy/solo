export type Severity = 'error' | 'warning' | 'info';

export type LinkType = 'image' | 'local' | 'anchor' | 'external';

export interface CheckResult {
  file: string;
  type: LinkType;
  raw: string;
  resolved?: string;
  status: 'valid' | 'invalid' | 'warning' | 'skipped';
  message: string;
  severity: Severity;
  line?: number;
  column?: number;
}

export interface FileCheckResult {
  filePath: string;
  links: ExtractedLink[];
  issues: CheckResult[];
}

export interface ExtractedLink {
  type: LinkType;
  raw: string;
  href: string;
  alt?: string;
  title?: string;
  line: number;
  column: number;
}

export interface Heading {
  text: string;
  level: number;
  anchor: string;
  line: number;
}

export interface SnapshotsManifest {
  version: string;
  snapshots: {
    [filePath: string]: {
      hash?: string;
      mtime?: number;
      lastUpdated?: string;
      relatedDocs?: string[];
      note?: string;
    };
  };
}

export interface Config {
  docsDir: string;
  ignorePatterns: string[];
  ignoreUrls: string[];
  external: {
    enabled: boolean;
    concurrency: number;
    timeout: number;
    retries: number;
    retryDelay: number;
    cacheDir: string;
    cacheTTL: number;
    userAgent: string;
  };
  images: {
    enabled: boolean;
    manifestPath?: string;
    checkMtime: boolean;
    checkHash: boolean;
  };
  anchors: {
    enabled: boolean;
    caseSensitive: boolean;
    allowDuplicates: boolean;
  };
  severity: {
    missingImage: Severity;
    expiredImage: Severity;
    missingLink: Severity;
    invalidAnchor: Severity;
    duplicateAnchor: Severity;
    failedExternal: Severity;
  };
  output: {
    terminal: boolean;
    markdown: boolean;
    markdownPath: string;
    html: boolean;
    htmlPath: string;
    json: boolean;
    jsonPath: string;
  };
}

export type ExternalCheckStatus = 'valid' | 'invalid' | 'warning' | 'skipped';

export interface ExternalCheckResult {
  url: string;
  status: ExternalCheckStatus;
  statusCode?: number;
  message: string;
  fromCache?: boolean;
  cachedAt?: number;
}

export interface ExternalCacheEntry {
  url: string;
  status: ExternalCheckStatus;
  statusCode?: number;
  message: string;
  checkedAt: number;
  expiresAt: number;
}

export interface RunResult {
  timestamp: string;
  config: Config;
  files: {
    total: number;
    checked: number;
    withIssues: number;
  };
  links: {
    total: number;
    images: number;
    locals: number;
    anchors: number;
    externals: number;
  };
  issues: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
    byType: {
      [key in LinkType]: number;
    };
  };
  results: FileCheckResult[];
  exitCode: number;
}
