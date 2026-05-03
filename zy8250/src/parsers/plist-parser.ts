import * as fs from 'fs';
import * as plist from 'plist';
import { LaunchAgentPlist, ValidationError, ValidationResult } from '../types';

export function parsePlistFile(filePath: string): {
  plist: LaunchAgentPlist | null;
  validation: ValidationResult;
} {
  const errors: ValidationError[] = [];

  const fileError = validatePlistFile(filePath);
  if (fileError) {
    errors.push(fileError);
    return { plist: null, validation: { valid: false, errors } };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = plist.parse(content) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      errors.push({
        file: filePath,
        message: 'plist 文件内容不是有效的对象'
      });
      return { plist: null, validation: { valid: false, errors } };
    }

    const validation = validateLaunchAgentPlist(parsed as Record<string, unknown>, filePath);
    if (validation.errors.length > 0) {
      errors.push(...validation.errors);
    }

    return {
      plist: validation.plist,
      validation: {
        valid: errors.length === 0,
        errors
      }
    };

  } catch (error) {
    errors.push({
      file: filePath,
      message: `plist 解析错误: ${(error as Error).message}`
    });
    return { plist: null, validation: { valid: false, errors } };
  }
}

function validatePlistFile(filePath: string): ValidationError | null {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      message: `文件不存在: ${filePath}`
    };
  }
  if (!filePath.endsWith('.plist')) {
    return {
      file: filePath,
      message: `文件格式不正确，期望 .plist 后缀`
    };
  }
  return null;
}

function validateLaunchAgentPlist(
  obj: Record<string, unknown>,
  filePath: string
): { plist: LaunchAgentPlist | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!('Label' in obj)) {
    errors.push({
      file: filePath,
      field: 'Label',
      message: 'plist 缺少必填字段: Label'
    });
  }

  if (typeof obj.Label !== 'string') {
    errors.push({
      file: filePath,
      field: 'Label',
      message: 'Label 字段必须是字符串'
    });
  }

  const hasProgram = 'Program' in obj;
  const hasProgramArguments = 'ProgramArguments' in obj;
  
  if (!hasProgram && !hasProgramArguments) {
    errors.push({
      file: filePath,
      message: 'plist 缺少 Program 或 ProgramArguments 字段'
    });
  }

  if (hasProgram && typeof obj.Program !== 'string') {
    errors.push({
      file: filePath,
      field: 'Program',
      message: 'Program 字段必须是字符串'
    });
  }

  if (hasProgramArguments && !Array.isArray(obj.ProgramArguments)) {
    errors.push({
      file: filePath,
      field: 'ProgramArguments',
      message: 'ProgramArguments 字段必须是数组'
    });
  }

  const hasStartInterval = 'StartInterval' in obj;
  const hasStartCalendarInterval = 'StartCalendarInterval' in obj;
  
  if (!hasStartInterval && !hasStartCalendarInterval) {
    errors.push({
      file: filePath,
      message: 'plist 缺少 StartInterval 或 StartCalendarInterval 字段'
    });
  }

  if (hasStartInterval && typeof obj.StartInterval !== 'number') {
    errors.push({
      file: filePath,
      field: 'StartInterval',
      message: 'StartInterval 字段必须是数字'
    });
  }

  if (hasStartCalendarInterval) {
    const sci = obj.StartCalendarInterval;
    if (!Array.isArray(sci) && (typeof sci !== 'object' || sci === null)) {
      errors.push({
        file: filePath,
        field: 'StartCalendarInterval',
        message: 'StartCalendarInterval 字段必须是对象或数组'
      });
    }
  }

  if (errors.length > 0) {
    return { plist: null, errors };
  }

  const plistObj: LaunchAgentPlist = {
    Label: obj.Label as string
  };

  if (obj.Program !== undefined) {
    plistObj.Program = obj.Program as string;
  }

  if (obj.ProgramArguments !== undefined) {
    plistObj.ProgramArguments = obj.ProgramArguments as string[];
  }

  if (obj.StartInterval !== undefined) {
    plistObj.StartInterval = obj.StartInterval as number;
  }

  if (obj.StartCalendarInterval !== undefined) {
    const sci = obj.StartCalendarInterval;
    if (Array.isArray(sci)) {
      plistObj.StartCalendarInterval = sci as LaunchAgentPlist['StartCalendarInterval'];
    } else if (typeof sci === 'object' && sci !== null) {
      plistObj.StartCalendarInterval = [sci as NonNullable<LaunchAgentPlist['StartCalendarInterval']>[0]];
    }
  }

  if (obj.RunAtLoad !== undefined) {
    plistObj.RunAtLoad = obj.RunAtLoad as boolean;
  }

  if (obj.KeepAlive !== undefined) {
    plistObj.KeepAlive = obj.KeepAlive as boolean | Record<string, unknown>;
  }

  if (obj.EnvironmentVariables !== undefined) {
    plistObj.EnvironmentVariables = obj.EnvironmentVariables as Record<string, string>;
  }

  if (obj.Disabled !== undefined) {
    plistObj.Disabled = obj.Disabled as boolean;
  }

  return { plist: plistObj, errors };
}

export function convertPlistToSchedule(plist: LaunchAgentPlist): string {
  if (plist.StartInterval) {
    return `每 ${plist.StartInterval} 秒`;
  }

  if (plist.StartCalendarInterval && plist.StartCalendarInterval.length > 0) {
    const intervals = plist.StartCalendarInterval.map(ci => {
      const parts: string[] = [];
      if (ci.Minute !== undefined) parts.push(`分钟: ${ci.Minute}`);
      if (ci.Hour !== undefined) parts.push(`小时: ${ci.Hour}`);
      if (ci.Day !== undefined) parts.push(`日期: ${ci.Day}`);
      if (ci.Weekday !== undefined) parts.push(`周几: ${ci.Weekday}`);
      if (ci.Month !== undefined) parts.push(`月份: ${ci.Month}`);
      return parts.join(', ') || '每天';
    });
    return intervals.join('; ');
  }

  return '未知计划';
}

export function convertPlistToCommand(plist: LaunchAgentPlist): string {
  if (plist.ProgramArguments && plist.ProgramArguments.length > 0) {
    return plist.ProgramArguments.join(' ');
  }
  if (plist.Program) {
    return plist.Program;
  }
  return '';
}
