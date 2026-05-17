export interface GitleaksFinding {
  Description: string;
  StartLine: number;
  EndLine: number;
  StartColumn: number;
  EndColumn: number;
  Match: string;
  Secret: string;
  File: string;
  SymlinkFile: string;
  Commit: string;
  Entropy: number;
  Author: string;
  Email: string;
  Date: string;
  Message: string;
  Tags: string[];
  RuleID: string;
  Fingerprint: string;
}

export type LeakStatus = 'new' | 'baseline' | 'fixed' | 'modified' | 'anomaly';

export interface ProcessedLeak {
  id: string;
  fingerprint: string;
  file: string;
  line: number;
  endLine: number;
  match: string;
  secret: string;
  ruleId: string;
  description: string;
  commit?: string;
  author?: string;
  date?: string;
  status: LeakStatus;
  baselineMatch?: {
    fingerprint: string;
    file: string;
    line: number;
  };
  anomalyReason?: string;
  originalFinding: GitleaksFinding;
}

export interface BaselineEntry {
  fingerprint: string;
  file: string;
  line: number;
  status: 'accepted' | 'false_positive' | 'to_fix';
  notes?: string;
  addedAt: string;
}

export interface ParseResult {
  success: boolean;
  findings: GitleaksFinding[];
  errors: ParseError[];
}

export interface ParseError {
  row: number;
  column?: number;
  raw: string;
  reason: string;
}

export interface SummaryStats {
  totalFindings: number;
  totalBaseline: number;
  newLeaks: number;
  baselineLeaks: number;
  fixedLeaks: number;
  modifiedLeaks: number;
  anomalies: number;
  filesAffected: number;
}

export interface ReportData {
  summary: SummaryStats;
  leaks: ProcessedLeak[];
  baseline: BaselineEntry[];
  anomalies: ProcessedLeak[];
  parseErrors: ParseError[];
  generatedAt: string;
  scanReportPath: string;
  baselinePath?: string;
}

export interface CLIConfig {
  scanReport: string;
  baseline?: string;
  outputJson?: string;
  outputHtml?: string;
  outputBaseline?: string;
  verbose: boolean;
  strict: boolean;
}
