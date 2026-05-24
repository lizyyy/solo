import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SecretRule, ExceptionItem, ValidationError, ScanOptions } from '../types';
import { defaultRules } from '../config/default-rules';

export function loadRules(rulesPath?: string): SecretRule[] {
  if (!rulesPath) {
    return defaultRules;
  }

  if (!fs.existsSync(rulesPath)) {
    throw new Error(`规则文件不存在: ${rulesPath}`);
  }

  const content = fs.readFileSync(rulesPath, 'utf-8');
  const parsed = yaml.load(content) as Record<string, unknown>;

  if (!parsed.rules || !Array.isArray(parsed.rules)) {
    throw new Error('规则文件格式错误: 缺少 rules 数组');
  }

  return parsed.rules as SecretRule[];
}

export function loadExceptions(exceptionsPath?: string): ExceptionItem[] {
  if (!exceptionsPath) {
    return [];
  }

  if (!fs.existsSync(exceptionsPath)) {
    throw new Error(`例外配置文件不存在: ${exceptionsPath}`);
  }

  const content = fs.readFileSync(exceptionsPath, 'utf-8');
  const parsed = yaml.load(content) as Record<string, unknown>;

  if (!parsed.exceptions || !Array.isArray(parsed.exceptions)) {
    throw new Error('例外配置文件格式错误: 缺少 exceptions 数组');
  }

  return parsed.exceptions as ExceptionItem[];
}

export function validateOptions(options: Record<string, unknown> | ScanOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!options.valuesPath) {
    errors.push({ field: 'valuesPath', message: 'values 文件路径是必需的' });
  } else if (typeof options.valuesPath === 'string' && !fs.existsSync(options.valuesPath)) {
    errors.push({ field: 'valuesPath', message: `values 文件不存在: ${options.valuesPath}` });
  }

  if (options.templateDir && typeof options.templateDir === 'string' && !fs.existsSync(options.templateDir)) {
    errors.push({ field: 'templateDir', message: `模板目录不存在: ${options.templateDir}` });
  }

  if (options.rulesPath && typeof options.rulesPath === 'string' && !fs.existsSync(options.rulesPath)) {
    errors.push({ field: 'rulesPath', message: `规则文件不存在: ${options.rulesPath}` });
  }

  if (options.exceptionsPath && typeof options.exceptionsPath === 'string' && !fs.existsSync(options.exceptionsPath)) {
    errors.push({ field: 'exceptionsPath', message: `例外配置文件不存在: ${options.exceptionsPath}` });
  }

  if (!options.environment) {
    errors.push({ field: 'environment', message: '环境名是必需的 (如: prod, staging, test)' });
  }

  const validSeverities = ['critical', 'high', 'medium', 'low'];
  if (options.failOnSeverity && Array.isArray(options.failOnSeverity)) {
    for (const s of options.failOnSeverity) {
      if (!validSeverities.includes(s)) {
        errors.push({ field: 'failOnSeverity', message: `无效的严重级别: ${s}。有效值: ${validSeverities.join(', ')}` });
      }
    }
  }

  return errors;
}

export function ensureOutputDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}
