import * as fs from 'fs';
import { CronJob, ValidationError, ValidationResult } from '../types';

export function parseCronDump(filePath: string): {
  jobs: CronJob[];
  validation: ValidationResult;
} {
  const errors: ValidationError[] = [];
  const jobs: CronJob[] = [];

  const fileError = validateCronFile(filePath);
  if (fileError) {
    errors.push(fileError);
    return { jobs, validation: { valid: false, errors } };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        return;
      }

      if (trimmedLine.startsWith('MAILTO=') || 
          trimmedLine.startsWith('SHELL=') || 
          trimmedLine.startsWith('PATH=') ||
          trimmedLine.startsWith('HOME=')) {
        return;
      }

      const job = parseCronLine(trimmedLine, filePath, lineNumber);
      if (job) {
        jobs.push(job);
      } else {
        errors.push({
          file: filePath,
          line: lineNumber,
          message: `无法解析 cron 行: ${trimmedLine}`
        });
      }
    });

  } catch (error) {
    errors.push({
      file: filePath,
      message: `读取文件错误: ${(error as Error).message}`
    });
  }

  return {
    jobs,
    validation: {
      valid: errors.length === 0,
      errors
    }
  };
}

function validateCronFile(filePath: string): ValidationError | null {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      message: `文件不存在: ${filePath}`
    };
  }
  return null;
}

function parseCronLine(
  line: string, 
  filePath: string, 
  lineNumber: number
): CronJob | null {
  const parts = line.split(/\s+/);

  if (parts.length < 6) {
    return null;
  }

  const [minute, hour, day, month, weekday, ...commandParts] = parts;

  const validation = validateCronFields(
    { minute, hour, day, month, weekday },
    filePath,
    lineNumber
  );

  if (validation.errors.length > 0) {
    return null;
  }

  return {
    minute,
    hour,
    day,
    month,
    weekday,
    command: commandParts.join(' '),
    lineNumber
  };
}

function validateCronFields(
  fields: {
    minute: string;
    hour: string;
    day: string;
    month: string;
    weekday: string;
  },
  filePath: string,
  lineNumber: number
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  const fieldValidators: Record<string, (value: string) => boolean> = {
    minute: isCronFieldValid,
    hour: isCronFieldValid,
    day: isCronFieldValid,
    month: isCronFieldValid,
    weekday: isCronFieldValid
  };

  for (const [field, validator] of Object.entries(fieldValidators)) {
    const value = fields[field as keyof typeof fields];
    if (!validator(value)) {
      errors.push({
        file: filePath,
        line: lineNumber,
        field,
        message: `cron ${field} 字段值无效: ${value}`
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function isCronFieldValid(value: string): boolean {
  if (value === '*') {
    return true;
  }

  if (value.startsWith('*/')) {
    const step = value.slice(2);
    return /^\d+$/.test(step);
  }

  if (value.includes(',')) {
    const values = value.split(',');
    return values.every(v => isCronFieldValid(v));
  }

  if (value.includes('-')) {
    const [start, end] = value.split('-');
    return /^\d+$/.test(start) && /^\d+$/.test(end);
  }

  return /^\d+$/.test(value);
}

export function convertCronToSchedule(cron: CronJob): string {
  return `${cron.minute} ${cron.hour} ${cron.day} ${cron.month} ${cron.weekday}`;
}

export function normalizeCronExpression(expr: string): string {
  const parts = expr.split(/\s+/);
  if (parts.length !== 5) {
    return expr;
  }
  return parts.join(' ');
}

export function areCronExpressionsEquivalent(expr1: string, expr2: string): boolean {
  const norm1 = normalizeCronExpression(expr1);
  const norm2 = normalizeCronExpression(expr2);
  return norm1 === norm2;
}
