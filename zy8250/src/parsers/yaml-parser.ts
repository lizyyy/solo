import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ExpectedJob, ValidationError, ValidationResult } from '../types';

const REQUIRED_FIELDS: (keyof ExpectedJob)[] = [
  'name', 'type', 'schedule', 'command', 'enabled', 'owner', 'sla', 'environment'
];

export function parseExpectedJobsYaml(filePath: string): { 
  jobs: ExpectedJob[]; 
  validation: ValidationResult;
} {
  const errors: ValidationError[] = [];
  const jobs: ExpectedJob[] = [];

  const fileError = validateYamlFile(filePath);
  if (fileError) {
    errors.push(fileError);
    return { jobs, validation: { valid: false, errors } };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(content, { 
      filename: filePath,
      onWarning: (warning) => {
        errors.push({
          file: filePath,
          line: warning.mark.line + 1,
          message: `YAML 警告: ${warning.message}`
        });
      }
    }) as unknown;

    if (!parsed) {
      errors.push({
        file: filePath,
        message: 'YAML 文件为空'
      });
      return { jobs, validation: { valid: false, errors } };
    }

    if (!Array.isArray(parsed)) {
      errors.push({
        file: filePath,
        message: 'YAML 根节点必须是数组'
      });
      return { jobs, validation: { valid: false, errors } };
    }

    parsed.forEach((item, index) => {
      const jobValidation = validateJobItem(item, filePath, index + 1);
      if (jobValidation.errors.length > 0) {
        errors.push(...jobValidation.errors);
      }
      if (jobValidation.job) {
        jobs.push(jobValidation.job);
      }
    });

  } catch (error) {
    const yamlError = error as yaml.YAMLException;
    errors.push({
      file: filePath,
      line: yamlError.mark?.line !== undefined ? yamlError.mark.line + 1 : undefined,
      message: `YAML 解析错误: ${yamlError.message}`
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

function validateYamlFile(filePath: string): ValidationError | null {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      message: `文件不存在: ${filePath}`
    };
  }
  if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) {
    return {
      file: filePath,
      message: `文件格式不正确，期望 .yaml 或 .yml 后缀`
    };
  }
  return null;
}

function validateJobItem(
  item: unknown, 
  filePath: string, 
  lineNumber: number
): { job: ExpectedJob | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (typeof item !== 'object' || item === null) {
    errors.push({
      file: filePath,
      line: lineNumber,
      message: `第 ${lineNumber} 个任务不是有效的对象`
    });
    return { job: null, errors };
  }

  const jobObj = item as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in jobObj)) {
      errors.push({
        file: filePath,
        line: lineNumber,
        field,
        message: `第 ${lineNumber} 个任务缺少必填字段: ${field}`
      });
    }
  }

  if (errors.length > 0) {
    return { job: null, errors };
  }

  if (jobObj.type !== 'launchagent' && jobObj.type !== 'cron') {
    errors.push({
      file: filePath,
      line: lineNumber,
      field: 'type',
      message: `第 ${lineNumber} 个任务的 type 字段值无效，必须是 'launchagent' 或 'cron'`
    });
  }

  if (typeof jobObj.enabled !== 'boolean') {
    errors.push({
      file: filePath,
      line: lineNumber,
      field: 'enabled',
      message: `第 ${lineNumber} 个任务的 enabled 字段必须是布尔值`
    });
  }

  if (typeof jobObj.sla !== 'number' || jobObj.sla <= 0) {
    errors.push({
      file: filePath,
      line: lineNumber,
      field: 'sla',
      message: `第 ${lineNumber} 个任务的 sla 字段必须是大于 0 的数字（秒）`
    });
  }

  if (typeof jobObj.environment !== 'object' || Array.isArray(jobObj.environment)) {
    errors.push({
      file: filePath,
      line: lineNumber,
      field: 'environment',
      message: `第 ${lineNumber} 个任务的 environment 字段必须是对象`
    });
  }

  if (errors.length > 0) {
    return { job: null, errors };
  }

  return {
    job: {
      name: jobObj.name as string,
      type: jobObj.type as 'launchagent' | 'cron',
      schedule: jobObj.schedule as string,
      command: jobObj.command as string,
      enabled: jobObj.enabled as boolean,
      owner: jobObj.owner as string,
      sla: jobObj.sla as number,
      environment: jobObj.environment as Record<string, string>,
      description: jobObj.description as string
    },
    errors
  };
}
