export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  sourceFile: string;
  lineNumber?: number;
}

export interface RedirectStep {
  url: string;
  status: number;
  statusText: string;
}

export interface UrlCheckResult {
  originalUrl: string;
  finalUrl: string;
  status: number;
  statusText: string;
  ok: boolean;
  redirectChain: RedirectStep[];
  redirectCount: number;
  title?: string;
  contentType?: string;
  responseTime: number;
  error?: string;
  sourceFile: string;
  lineNumber?: number;
  is404: boolean;
  isRedirect: boolean;
}

export interface ParseError {
  sourceFile: string;
  lineNumber?: number;
  error: string;
  rawContent?: string;
}

export interface AuditSummary {
  totalUrls: number;
  successful: number;
  failed: number;
  notFound: number;
  redirected: number;
  serverErrors: number;
  clientErrors: number;
  parseErrors: number;
  avgResponseTime: number;
  totalTime: number;
}

export interface AuditResult {
  summary: AuditSummary;
  results: UrlCheckResult[];
  parseErrors: ParseError[];
  startedAt: string;
  finishedAt: string;
  sourceFiles: string[];
}
