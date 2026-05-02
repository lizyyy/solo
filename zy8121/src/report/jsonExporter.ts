import * as fs from 'fs';
import * as path from 'path';
import { ValidationResult } from '../types';
import { JsonExportOptions } from './types';

const DEFAULT_OPTIONS: JsonExportOptions = {
  pretty: true,
  indentSize: 2,
};

export interface SummaryJson {
  orderId: string;
  timestamp: string;
  status: 'pass' | 'warning' | 'fail';
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  issuesByCategory: Record<string, {
    total: number;
    critical: number;
    warning: number;
    info: number;
  }>;
  metadata: ValidationResult['metadata'];
}

export function generateSummaryJson(
  result: ValidationResult,
  options: JsonExportOptions = DEFAULT_OPTIONS
): string {
  const summary: SummaryJson = {
    orderId: result.orderId,
    timestamp: result.timestamp,
    status: getStatus(result),
    summary: result.summary,
    issuesByCategory: groupIssuesByCategory(result),
    metadata: result.metadata,
  };
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (opts.pretty) {
    return JSON.stringify(summary, null, opts.indentSize);
  }
  
  return JSON.stringify(summary);
}

function getStatus(result: ValidationResult): 'pass' | 'warning' | 'fail' {
  if (result.summary.critical > 0) {
    return 'fail';
  }
  if (result.summary.warning > 0) {
    return 'warning';
  }
  return 'pass';
}

function groupIssuesByCategory(result: ValidationResult): SummaryJson['issuesByCategory'] {
  const grouped: SummaryJson['issuesByCategory'] = {};
  
  for (const issue of result.issues) {
    if (!grouped[issue.category]) {
      grouped[issue.category] = {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
      };
    }
    
    const cat = grouped[issue.category];
    cat.total++;
    cat[issue.severity]++;
  }
  
  return grouped;
}

export function generateFullJson(
  result: ValidationResult,
  options: JsonExportOptions = DEFAULT_OPTIONS
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (opts.pretty) {
    return JSON.stringify(result, null, opts.indentSize);
  }
  
  return JSON.stringify(result);
}

export function exportSummaryJson(
  result: ValidationResult,
  outputPath: string,
  options?: JsonExportOptions
): void {
  const content = generateSummaryJson(result, options);
  const dir = path.dirname(outputPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, content, 'utf-8');
}

export function exportFullJson(
  result: ValidationResult,
  outputPath: string,
  options?: JsonExportOptions
): void {
  const content = generateFullJson(result, options);
  const dir = path.dirname(outputPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, content, 'utf-8');
}
