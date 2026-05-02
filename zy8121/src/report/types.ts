import { ValidationResult, Issue } from '../types';

export interface ExportOptions {
  outputDir?: string;
  baseName?: string;
  formats?: ('json' | 'csv' | 'md')[];
}

export interface MarkdownTemplateOptions {
  includeDetails?: boolean;
  includeSuggestions?: boolean;
  groupByCategory?: boolean;
  groupBySeverity?: boolean;
}

export interface CsvExportOptions {
  delimiter?: string;
  includeHeader?: boolean;
  columns?: (keyof {
    id: string;
    severity: string;
    severityLevel: number;
    category: string;
    categoryName: string;
    message: string;
    location: string;
    locationX: string;
    locationY: string;
    elementId: string;
    suggestion: string;
  })[];
}

export interface JsonExportOptions {
  pretty?: boolean;
  indentSize?: number;
}

export interface ExportResult {
  files: {
    path: string;
    format: 'json' | 'csv' | 'md';
    size: number;
  }[];
  summary: ValidationResult['summary'];
}
