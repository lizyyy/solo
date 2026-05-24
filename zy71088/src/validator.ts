import * as fs from 'fs';
import * as path from 'path';
import { ValidationError, CliOptions, ProgrammingLanguage } from './types';

export function validateInput(options: CliOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!options.flags) {
    errors.push({
      field: 'flags',
      message: '必须指定 flag 定义文件路径',
      severity: 'error',
    });
  } else {
    const flagsPath = path.resolve(options.flags);
    if (!fs.existsSync(flagsPath)) {
      errors.push({
        field: 'flags',
        message: `Flag 定义文件不存在: ${flagsPath}`,
        severity: 'error',
      });
    } else if (path.extname(flagsPath).toLowerCase() !== '.json') {
      errors.push({
        field: 'flags',
        message: 'Flag 定义文件必须是 JSON 格式',
        severity: 'warning',
      });
    }
  }

  if (!options.source) {
    errors.push({
      field: 'source',
      message: '必须指定源码目录',
      severity: 'error',
    });
  } else {
    const sourcePath = path.resolve(options.source);
    if (!fs.existsSync(sourcePath)) {
      errors.push({
        field: 'source',
        message: `源码目录不存在: ${sourcePath}`,
        severity: 'error',
      });
    } else if (!fs.statSync(sourcePath).isDirectory()) {
      errors.push({
        field: 'source',
        message: `源码路径不是目录: ${sourcePath}`,
        severity: 'error',
      });
    }
  }

  if (options.output) {
    const outputPath = path.resolve(options.output);
    if (fs.existsSync(outputPath) && !fs.statSync(outputPath).isDirectory()) {
      errors.push({
        field: 'output',
        message: `输出路径不是目录: ${outputPath}`,
        severity: 'error',
      });
    }
  }

  if (options.languages) {
    const validLanguages: ProgrammingLanguage[] = [
      'typescript', 'javascript', 'python', 'go', 'java', 'kotlin', 'swift', 'rust', 'other'
    ];
    const languages = options.languages.split(',').map(l => l.trim().toLowerCase());
    const invalid = languages.filter(l => !validLanguages.includes(l as ProgrammingLanguage));
    
    if (invalid.length > 0) {
      errors.push({
        field: 'languages',
        message: `无效的语言: ${invalid.join(', ')}. 有效值: ${validLanguages.join(', ')}`,
        severity: 'error',
      });
    }
  }

  if (options.format) {
    const validFormats = ['all', 'terminal', 'json', 'markdown'];
    const formats = options.format.split(',').map(f => f.trim().toLowerCase());
    const invalid = formats.filter(f => !validFormats.includes(f));
    
    if (invalid.length > 0) {
      errors.push({
        field: 'format',
        message: `无效的格式: ${invalid.join(', ')}. 有效值: ${validFormats.join(', ')}`,
        severity: 'error',
      });
    }
  }

  return errors;
}

export function hasCriticalErrors(errors: ValidationError[]): boolean {
  return errors.some(e => e.severity === 'error');
}

export function formatValidationErrors(errors: ValidationError[]): string {
  const lines: string[] = [];
  const criticalErrors = errors.filter(e => e.severity === 'error');
  const warnings = errors.filter(e => e.severity === 'warning');

  if (criticalErrors.length > 0) {
    lines.push('❌ 错误:');
    criticalErrors.forEach(e => {
      lines.push(`  [${e.field}] ${e.message}`);
    });
  }

  if (warnings.length > 0) {
    lines.push('');
    lines.push('⚠️  警告:');
    warnings.forEach(e => {
      lines.push(`  [${e.field}] ${e.message}`);
    });
  }

  return lines.join('\n');
}
