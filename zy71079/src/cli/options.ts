import * as fs from 'fs';
import * as path from 'path';
import { CliOptions } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateOptions(options: Partial<CliOptions>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!options.dist && !options.sourcemap && !options.js) {
    errors.push('必须指定至少一个扫描目标: --dist, --sourcemap, 或 --js');
  }

  if (options.dist) {
    if (!fs.existsSync(options.dist)) {
      errors.push(`dist 目录不存在: ${options.dist}`);
    } else if (!fs.statSync(options.dist).isDirectory()) {
      errors.push(`--dist 必须是一个目录: ${options.dist}`);
    }
  }

  if (options.sourcemap) {
    if (!fs.existsSync(options.sourcemap)) {
      errors.push(`sourcemap 文件/目录不存在: ${options.sourcemap}`);
    }
  }

  if (options.js) {
    if (!fs.existsSync(options.js)) {
      errors.push(`JS 文件/目录不存在: ${options.js}`);
    }
  }

  if (options.exceptions && fs.existsSync(options.exceptions)) {
    try {
      const content = fs.readFileSync(options.exceptions, 'utf-8');
      JSON.parse(content);
    } catch (error) {
      errors.push(`例外规则文件格式无效 (必须是 JSON): ${options.exceptions}`);
    }
  }

  if (options.output) {
    try {
      const outputDir = path.dirname(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch (error) {
      errors.push(`无法创建输出目录: ${(error as Error).message}`);
    }
  }

  if (options.publicPath && !isValidPublicPath(options.publicPath)) {
    warnings.push(`公开路径格式可能不正确: ${options.publicPath}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

function isValidPublicPath(publicPath: string): boolean {
  if (publicPath.startsWith('http://') || publicPath.startsWith('https://')) {
    return true;
  }
  if (publicPath.startsWith('/')) {
    return true;
  }
  if (publicPath === '') {
    return true;
  }
  return false;
}

export function normalizeOptions(options: Partial<CliOptions>): CliOptions {
  return {
    dist: options.dist || '',
    sourcemap: options.sourcemap,
    js: options.js,
    publicPath: options.publicPath || '/',
    exceptions: options.exceptions || '',
    output: options.output || './sourcemap-report',
    failOnLeak: options.failOnLeak ?? true,
    verbose: options.verbose ?? false,
    quiet: options.quiet ?? false,
  };
}

export function getScanTargets(options: CliOptions): string[] {
  const targets: string[] = [];

  if (options.dist) {
    targets.push(path.resolve(options.dist));
  }
  if (options.sourcemap) {
    targets.push(path.resolve(options.sourcemap));
  }
  if (options.js) {
    targets.push(path.resolve(options.js));
  }

  return [...new Set(targets)];
}
