import * as fs from 'fs';
import * as path from 'path';
import { ValidationResult } from '../types';
import { ExportOptions, ExportResult } from './types';
import { exportMarkdownReport, generateMarkdownReport } from './markdownExporter';
import { exportCsvReport, generateCsvContent } from './csvExporter';
import { exportSummaryJson, exportFullJson, generateSummaryJson } from './jsonExporter';

const DEFAULT_OPTIONS: ExportOptions = {
  outputDir: './output',
  baseName: 'prepress-report',
  formats: ['json', 'csv', 'md'],
};

export function exportReports(
  result: ValidationResult,
  options: ExportOptions = DEFAULT_OPTIONS
): ExportResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const outputDir = opts.outputDir || './output';
  const baseName = opts.baseName || 'prepress-report';
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const files: ExportResult['files'] = [];
  const formats = opts.formats || ['json', 'csv', 'md'];
  
  if (formats.includes('json')) {
    const jsonPath = path.join(outputDir, `${baseName}.json`);
    const fullJsonPath = path.join(outputDir, `${baseName}-full.json`);
    
    exportSummaryJson(result, jsonPath);
    const stat = fs.statSync(jsonPath);
    files.push({
      path: jsonPath,
      format: 'json',
      size: stat.size,
    });
    
    exportFullJson(result, fullJsonPath);
  }
  
  if (formats.includes('csv')) {
    const csvPath = path.join(outputDir, `${baseName}-issues.csv`);
    exportCsvReport(result, csvPath);
    const stat = fs.statSync(csvPath);
    files.push({
      path: csvPath,
      format: 'csv',
      size: stat.size,
    });
  }
  
  if (formats.includes('md')) {
    const mdPath = path.join(outputDir, `${baseName}.md`);
    exportMarkdownReport(result, mdPath);
    const stat = fs.statSync(mdPath);
    files.push({
      path: mdPath,
      format: 'md',
      size: stat.size,
    });
  }
  
  return {
    files,
    summary: result.summary,
  };
}

export function generateReportContents(
  result: ValidationResult,
  formats: ('json' | 'csv' | 'md')[] = ['json', 'csv', 'md']
): Record<string, string> {
  const contents: Record<string, string> = {};
  
  if (formats.includes('json')) {
    contents.json = generateSummaryJson(result);
  }
  
  if (formats.includes('csv')) {
    contents.csv = generateCsvContent(result);
  }
  
  if (formats.includes('md')) {
    contents.md = generateMarkdownReport(result);
  }
  
  return contents;
}
