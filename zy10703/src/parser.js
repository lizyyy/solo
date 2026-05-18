import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';

export const REQUIRED_FIELDS = [
  '会话ID',
  '开始时间',
  '结束时间',
  '用户ID',
  '机器人处理结果',
  '是否转人工',
  '转人工时间',
  '转人工原因',
  '客服ID',
  '会话标签'
];

export async function parseFile(filePath) {
  const errors = [];
  let records = [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    records = parsed.map((row, index) => ({
      rowNumber: index + 2,
      data: row,
      sourceFile: path.basename(filePath)
    }));

  } catch (error) {
    errors.push({
      type: '文件解析错误',
      file: path.basename(filePath),
      reason: error.message,
      severity: 'fatal'
    });
  }

  return { records, errors, fileName: path.basename(filePath) };
}

export async function parseDirectory(dirPath) {
  const allRecords = [];
  const allErrors = [];
  const fileResults = [];

  try {
    const files = await fs.readdir(dirPath);
    const csvFiles = files.filter(f => f.toLowerCase().endsWith('.csv'));

    for (const file of csvFiles) {
      const filePath = path.join(dirPath, file);
      const result = await parseFile(filePath);
      
      fileResults.push({
        fileName: result.fileName,
        recordCount: result.records.length,
        errorCount: result.errors.length
      });

      allRecords.push(...result.records);
      allErrors.push(...result.errors);
    }
  } catch (error) {
    allErrors.push({
      type: '目录读取错误',
      file: dirPath,
      reason: error.message,
      severity: 'fatal'
    });
  }

  return { records: allRecords, errors: allErrors, fileResults };
}

export function validateFields(records) {
  const errors = [];
  const validRecords = [];

  for (const record of records) {
    const recordErrors = [];
    const { data, rowNumber, sourceFile } = record;

    for (const field of REQUIRED_FIELDS) {
      if (!(field in data)) {
        recordErrors.push({
          type: '字段缺失',
          field,
          row: rowNumber,
          file: sourceFile
        });
      } else if (!data[field] || data[field].trim() === '') {
        recordErrors.push({
          type: '字段为空',
          field,
          row: rowNumber,
          file: sourceFile,
          severity: 'warning'
        });
      }
    }

    if (recordErrors.length > 0) {
      errors.push(...recordErrors);
    }

    validRecords.push({
      ...record,
      validationErrors: recordErrors
    });
  }

  return { records: validRecords, errors };
}