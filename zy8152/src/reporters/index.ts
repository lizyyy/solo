import * as fs from 'fs';
import * as path from 'path';
import { FontReport } from '../types';
import { generateMissingGlyphsCsv } from './csvReporter';
import { generateFontReportMarkdown } from './markdownReporter';
import { generatePreviewHtml } from './htmlReporter';

export interface GenerateReportsResult {
  missingGlyphsCsv: string | null;
  fontReportMd: string;
  previewHtml: string;
}

export function generateAllReports(
  report: FontReport,
  outputDir: string
): GenerateReportsResult {
  ensureDirectory(outputDir);

  const missingGlyphsCsv = report.glyphChecks.issues.filter(i => i.isMissing).length > 0
    ? generateMissingGlyphsCsv(report, outputDir)
    : null;

  const fontReportMd = generateFontReportMarkdown(report, outputDir);
  const previewHtml = generatePreviewHtml(report, outputDir);

  return {
    missingGlyphsCsv,
    fontReportMd,
    previewHtml
  };
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export { generateMissingGlyphsCsv, generateFontReportMarkdown, generatePreviewHtml };
