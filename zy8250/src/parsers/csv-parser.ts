import * as fs from 'fs';
import csvParser from 'csv-parser';
import { Owner, ValidationError, ValidationResult } from '../types';

const REQUIRED_FIELDS: (keyof Owner)[] = [
  'jobName', 'owner', 'email', 'department'
];

export async function parseOwnersCsv(filePath: string): Promise<{
  owners: Owner[];
  validation: ValidationResult;
}> {
  const errors: ValidationError[] = [];
  const owners: Owner[] = [];

  const fileError = validateCsvFile(filePath);
  if (fileError) {
    errors.push(fileError);
    return { owners, validation: { valid: false, errors } };
  }

  try {
    const results: Owner[] = [];
    let lineNumber = 1;

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('headers', (headers: string[]) => {
          lineNumber++;
          for (const field of REQUIRED_FIELDS) {
            if (!headers.includes(field)) {
              errors.push({
                file: filePath,
                line: 1,
                field,
                message: `CSV 缺少必填列: ${field}`
              });
            }
          }
        })
        .on('data', (data: Record<string, string>) => {
          lineNumber++;
          const validation = validateOwnerRow(data, filePath, lineNumber);
          if (validation.errors.length > 0) {
            errors.push(...validation.errors);
          }
          if (validation.owner) {
            results.push(validation.owner);
          }
        })
        .on('end', () => {
          owners.push(...results);
          resolve();
        })
        .on('error', (error: Error) => {
          errors.push({
            file: filePath,
            line: lineNumber,
            message: `CSV 解析错误: ${error.message}`
          });
          reject(error);
        });
    });

  } catch (error) {
    errors.push({
      file: filePath,
      message: `读取文件错误: ${(error as Error).message}`
    });
  }

  return {
    owners,
    validation: {
      valid: errors.length === 0,
      errors
    }
  };
}

function validateCsvFile(filePath: string): ValidationError | null {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      message: `文件不存在: ${filePath}`
    };
  }
  if (!filePath.endsWith('.csv')) {
    return {
      file: filePath,
      message: `文件格式不正确，期望 .csv 后缀`
    };
  }
  return null;
}

function validateOwnerRow(
  row: Record<string, string>,
  filePath: string,
  lineNumber: number
): { owner: Owner | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || row[field].trim() === '') {
      errors.push({
        file: filePath,
        line: lineNumber,
        field,
        message: `第 ${lineNumber} 行缺少 ${field} 列的值`
      });
    }
  }

  if (errors.length > 0) {
    return { owner: null, errors };
  }

  if (row.email && !isValidEmail(row.email)) {
    errors.push({
      file: filePath,
      line: lineNumber,
      field: 'email',
      message: `第 ${lineNumber} 行 email 格式无效: ${row.email}`
    });
  }

  const owner: Owner = {
    jobName: row.jobName.trim(),
    owner: row.owner.trim(),
    email: row.email.trim(),
    department: row.department.trim()
  };

  return { owner, errors };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function findOwnerByJobName(
  owners: Owner[],
  jobName: string
): Owner | null {
  const exactMatch = owners.find(o => o.jobName === jobName);
  if (exactMatch) {
    return exactMatch;
  }

  const caseInsensitiveMatch = owners.find(
    o => o.jobName.toLowerCase() === jobName.toLowerCase()
  );
  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch;
  }

  return null;
}

export function groupOwnersByJobName(owners: Owner[]): Record<string, Owner> {
  const grouped: Record<string, Owner> = {};
  for (const owner of owners) {
    grouped[owner.jobName] = owner;
  }
  return grouped;
}
