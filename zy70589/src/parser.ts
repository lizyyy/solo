import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { GitleaksFinding, ParseResult, ParseError, BaselineEntry } from './types.js';

export async function parseScanReport(filePath: string): Promise<ParseResult> {
  const absolutePath = path.resolve(filePath);
  const ext = path.extname(filePath).toLowerCase();

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');

    if (ext === '.json') {
      return parseJsonReport(content);
    } else if (ext === '.csv') {
      return parseCsvReport(content);
    } else {
      return {
        success: false,
        findings: [],
        errors: [{
          row: 0,
          raw: ext,
          reason: `不支持的文件格式: ${ext}，仅支持 .json 和 .csv`
        }]
      };
    }
  } catch (error) {
    return {
      success: false,
      findings: [],
      errors: [{
        row: 0,
        raw: filePath,
        reason: `读取文件失败: ${(error as Error).message}`
      }]
    };
  }
}

function parseJsonReport(content: string): ParseResult {
  const errors: ParseError[] = [];
  const findings: GitleaksFinding[] = [];

  try {
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        try {
          const finding = validateAndTransformFinding(item, index);
          findings.push(finding);
        } catch (error) {
          errors.push({
            row: index,
            raw: JSON.stringify(item),
            reason: (error as Error).message
          });
        }
      });
    } else {
      errors.push({
        row: 0,
        raw: content.substring(0, 100),
        reason: 'JSON根节点必须是数组'
      });
    }
  } catch (error) {
    errors.push({
      row: 0,
      raw: content.substring(0, 100),
      reason: `JSON解析失败: ${(error as Error).message}`
    });
  }

  return {
    success: errors.length === 0,
    findings,
    errors
  };
}

function parseCsvReport(content: string): ParseResult {
  const errors: ParseError[] = [];
  const findings: GitleaksFinding[] = [];

  try {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    records.forEach((item: Record<string, string>, index: number) => {
      try {
        const finding = validateAndTransformFinding(item, index);
        findings.push(finding);
      } catch (error) {
        errors.push({
          row: index + 1,
          raw: JSON.stringify(item),
          reason: (error as Error).message
        });
      }
    });
  } catch (error) {
    errors.push({
      row: 0,
      raw: content.substring(0, 100),
      reason: `CSV解析失败: ${(error as Error).message}`
    });
  }

  return {
    success: errors.length === 0,
    findings,
    errors
  };
}

function validateAndTransformFinding(item: any, index: number): GitleaksFinding {
  const requiredFields = ['File', 'Secret', 'Fingerprint', 'RuleID'];
  const missingFields = requiredFields.filter(f => !item[f] && item[f] !== '');

  if (missingFields.length > 0) {
    throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
  }

  return {
    Description: String(item.Description || item.description || ''),
    StartLine: parseInt(item.StartLine || item.start_line || item.startLine || 0, 10),
    EndLine: parseInt(item.EndLine || item.end_line || item.endLine || 0, 10),
    StartColumn: parseInt(item.StartColumn || item.start_column || item.startColumn || 0, 10),
    EndColumn: parseInt(item.EndColumn || item.end_column || item.endColumn || 0, 10),
    Match: String(item.Match || item.match || ''),
    Secret: String(item.Secret || item.secret || ''),
    File: String(item.File || item.file || ''),
    SymlinkFile: String(item.SymlinkFile || item.symlink_file || ''),
    Commit: String(item.Commit || item.commit || ''),
    Entropy: parseFloat(item.Entropy || item.entropy || 0),
    Author: String(item.Author || item.author || ''),
    Email: String(item.Email || item.email || ''),
    Date: String(item.Date || item.date || ''),
    Message: String(item.Message || item.message || ''),
    Tags: Array.isArray(item.Tags) ? item.Tags : (typeof item.Tags === 'string' ? item.Tags.split(',') : []),
    RuleID: String(item.RuleID || item.ruleID || item.rule_id || ''),
    Fingerprint: String(item.Fingerprint || item.fingerprint || '')
  };
}

export async function parseBaseline(filePath: string): Promise<{
  success: boolean;
  baseline: BaselineEntry[];
  errors: ParseError[];
}> {
  const absolutePath = path.resolve(filePath);
  const errors: ParseError[] = [];
  const baseline: BaselineEntry[] = [];

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      return {
        success: false,
        baseline: [],
        errors: [{
          row: 0,
          raw: content.substring(0, 100),
          reason: '基线文件必须是JSON数组'
        }]
      };
    }

    data.forEach((item, index) => {
      try {
        if (!item.fingerprint || !item.file) {
          throw new Error('缺少必填字段: fingerprint 或 file');
        }
        baseline.push({
          fingerprint: String(item.fingerprint),
          file: String(item.file),
          line: parseInt(item.line || 0, 10),
          status: item.status || 'to_fix',
          notes: item.notes ? String(item.notes) : undefined,
          addedAt: item.addedAt || new Date().toISOString()
        });
      } catch (error) {
        errors.push({
          row: index,
          raw: JSON.stringify(item),
          reason: (error as Error).message
        });
      }
    });
  } catch (error) {
    errors.push({
      row: 0,
      raw: filePath,
      reason: `读取基线文件失败: ${(error as Error).message}`
    });
  }

  return {
    success: errors.length === 0,
    baseline,
    errors
  };
}
