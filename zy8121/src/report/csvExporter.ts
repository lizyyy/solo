import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
import { ValidationResult, Issue, IssueSeverity } from '../types';
import { CsvExportOptions } from './types';

const DEFAULT_COLUMNS: (keyof CsvIssueRow)[] = ['id', 'severity', 'category', 'message', 'location'];

const DEFAULT_OPTIONS: CsvExportOptions = {
  delimiter: ',',
  includeHeader: true,
  columns: DEFAULT_COLUMNS,
};

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 1,
  warning: 2,
  info: 3,
};

export interface CsvIssueRow {
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
}

export function generateCsvContent(
  result: ValidationResult,
  options: CsvExportOptions = DEFAULT_OPTIONS
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const rows: CsvIssueRow[] = result.issues.map(issue => ({
    id: issue.id,
    severity: getSeverityName(issue.severity),
    severityLevel: SEVERITY_ORDER[issue.severity],
    category: issue.category,
    categoryName: getCategoryName(issue.category),
    message: issue.message,
    location: formatLocation(issue),
    locationX: issue.location?.x?.toString() || '',
    locationY: issue.location?.y?.toString() || '',
    elementId: issue.location?.elementId || '',
    suggestion: issue.suggestion || '',
  }));

  const columns = (opts.columns as (keyof CsvIssueRow)[]) || DEFAULT_COLUMNS;
  const header = columns.map(col => getColumnHeader(col));
  
  const dataRows = rows.map(row => 
    columns.map(col => getColumnValue(row, col))
  );

  const records = opts.includeHeader ? [header, ...dataRows] : dataRows;

  return stringify(records, {
    delimiter: opts.delimiter,
    quoted: true,
    quoted_string: true,
  });
}

function getColumnHeader(col: keyof CsvIssueRow | 'severityLevel'): string {
  const headers: Record<string, string> = {
    id: '问题ID',
    severity: '严重程度',
    severityLevel: '严重等级',
    category: '类别代码',
    categoryName: '类别名称',
    message: '问题描述',
    location: '位置信息',
    locationX: 'X坐标',
    locationY: 'Y坐标',
    elementId: '元素ID',
    suggestion: '建议',
  };
  return headers[col] || col;
}

function getColumnValue(row: CsvIssueRow, col: keyof CsvIssueRow | 'severityLevel'): string {
  const value = row[col as keyof CsvIssueRow];
  return value !== undefined && value !== null ? String(value) : '';
}

function formatLocation(issue: Issue): string {
  if (!issue.location) {
    return '';
  }
  
  const parts: string[] = [];
  
  if (issue.location.x !== undefined && issue.location.y !== undefined) {
    parts.push(`(${issue.location.x}, ${issue.location.y})`);
  }
  
  if (issue.location.elementId) {
    parts.push(`元素: ${issue.location.elementId}`);
  }
  
  return parts.join(' | ');
}

function getSeverityName(severity: IssueSeverity): string {
  const names: Record<IssueSeverity, string> = {
    critical: '严重错误',
    warning: '警告',
    info: '信息',
  };
  return names[severity];
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    viewbox: 'ViewBox 检查',
    dimension: '尺寸单位',
    dieline: '刀线检查',
    bleed: '出血边距',
    spot_color: '专色命名',
    registration: '套准孔',
    barcode: '条码检查',
  };
  return names[category] || category;
}

export function exportCsvReport(
  result: ValidationResult,
  outputPath: string,
  options?: CsvExportOptions
): void {
  const content = generateCsvContent(result, options);
  const dir = path.dirname(outputPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, '\uFEFF' + content, 'utf-8');
}
