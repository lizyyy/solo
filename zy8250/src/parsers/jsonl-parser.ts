import * as fs from 'fs';
import { LastRun, ValidationError, ValidationResult } from '../types';

const REQUIRED_FIELDS: (keyof LastRun)[] = [
  'jobName', 'timestamp', 'exitCode', 'duration'
];

export function parseLastRunsJsonl(filePath: string): {
  runs: LastRun[];
  validation: ValidationResult;
} {
  const errors: ValidationError[] = [];
  const runs: LastRun[] = [];

  const fileError = validateJsonlFile(filePath);
  if (fileError) {
    errors.push(fileError);
    return { runs, validation: { valid: false, errors } };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      try {
        const parsed = JSON.parse(line) as unknown;
        const validation = validateLastRunItem(parsed, filePath, lineNumber);
        
        if (validation.errors.length > 0) {
          errors.push(...validation.errors);
        }
        
        if (validation.run) {
          runs.push(validation.run);
        }

      } catch (error) {
        errors.push({
          file: filePath,
          line: lineNumber,
          message: `JSONL 第 ${lineNumber} 行解析错误: ${(error as Error).message}`
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
    runs,
    validation: {
      valid: errors.length === 0,
      errors
    }
  };
}

function validateJsonlFile(filePath: string): ValidationError | null {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      message: `文件不存在: ${filePath}`
    };
  }
  if (!filePath.endsWith('.jsonl')) {
    return {
      file: filePath,
      message: `文件格式不正确，期望 .jsonl 后缀`
    };
  }
  return null;
}

function validateLastRunItem(
  item: unknown,
  filePath: string,
  lineNumber: number
): { run: LastRun | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (typeof item !== 'object' || item === null) {
    errors.push({
      file: filePath,
      line: lineNumber,
      message: `第 ${lineNumber} 行不是有效的 JSON 对象`
    });
    return { run: null, errors };
  }

  const runObj = item as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in runObj)) {
      errors.push({
        file: filePath,
        line: lineNumber,
        field,
        message: `第 ${lineNumber} 行缺少必填字段: ${field}`
      });
    }
  }

  if (errors.length > 0) {
    return { run: null, errors };
  }

  if (typeof runObj.jobName !== 'string') {
    errors.push({
      file: filePath,
      line: lineNumber,
      field: 'jobName',
      message: `第 ${lineNumber} 行 jobName 必须是字符串`
    });
  }

  if (typeof runObj.timestamp !== 'number' || runObj.timestamp <= 0) {
    errors.push({
      file: filePath,
      line: lineNumber,
      field: 'timestamp',
      message: `第 ${lineNumber} 行 timestamp 必须是大于 0 的数字`
    });
  }

  if (typeof runObj.exitCode !== 'number') {
    errors.push({
      file: filePath,
      line: lineNumber,
      field: 'exitCode',
      message: `第 ${lineNumber} 行 exitCode 必须是数字`
    });
  }

  if (typeof runObj.duration !== 'number' || runObj.duration < 0) {
    errors.push({
      file: filePath,
      line: lineNumber,
      field: 'duration',
      message: `第 ${lineNumber} 行 duration 必须是大于等于 0 的数字`
    });
  }

  if (errors.length > 0) {
    return { run: null, errors };
  }

  const run: LastRun = {
    jobName: runObj.jobName as string,
    timestamp: runObj.timestamp as number,
    exitCode: runObj.exitCode as number,
    duration: runObj.duration as number
  };

  if (runObj.output !== undefined) {
    run.output = String(runObj.output);
  }

  if (runObj.error !== undefined) {
    run.error = String(runObj.error);
  }

  return { run, errors };
}

export function getLastRunForJob(runs: LastRun[], jobName: string): LastRun | null {
  const jobRuns = runs.filter(run => run.jobName === jobName);
  if (jobRuns.length === 0) {
    return null;
  }
  jobRuns.sort((a, b) => b.timestamp - a.timestamp);
  return jobRuns[0];
}

export function groupRunsByJobName(runs: LastRun[]): Record<string, LastRun[]> {
  const grouped: Record<string, LastRun[]> = {};
  for (const run of runs) {
    if (!grouped[run.jobName]) {
      grouped[run.jobName] = [];
    }
    grouped[run.jobName].push(run);
  }
  return grouped;
}
