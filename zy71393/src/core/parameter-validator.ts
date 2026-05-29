import { ParameterSchema, EventLogEntry, Issue, IssueSeverity, ParameterType } from '../types';
import { ValidationConfig } from '../types';

export interface ParameterValidationResult {
  parameterName: string;
  status: 'pass' | 'fail' | 'warning' | 'missing';
  message?: string;
  expectedType?: ParameterType;
  actualType?: string;
  expected?: any;
  actual?: any;
}

export class ParameterValidator {
  private config: ValidationConfig;

  constructor(config: ValidationConfig) {
    this.config = config;
  }

  validate(
    schema: ParameterSchema[],
    entries: EventLogEntry[]
  ): { results: ParameterValidationResult[]; issues: Issue[] } {
    const results: ParameterValidationResult[] = [];
    const issues: Issue[] = [];

    const requiredParams = schema.filter(p => p.required);
    const optionalParams = schema.filter(p => !p.required);

    for (const param of requiredParams) {
      const result = this.validateRequiredParam(param, entries);
      results.push(result);
      
      if (result.status === 'fail' || result.status === 'missing') {
        issues.push(this.createParameterIssue(param, result, entries));
      }
    }

    if (this.config.allowOptionalParameters) {
      for (const param of optionalParams) {
        const result = this.validateOptionalParam(param, entries);
        results.push(result);
        
        if (result.status === 'warning') {
          issues.push(this.createParameterIssue(param, result, entries));
        }
      }
    }

    const allParamNames = new Set(schema.map(p => p.name));
    const undefinedParams = this.findUndefinedParams(allParamNames, entries);
    for (const undefinedParam of undefinedParams) {
      results.push({
        parameterName: undefinedParam,
        status: 'warning',
        message: `参数 "${undefinedParam}" 不在Schema定义中`
      });
    }

    return { results, issues };
  }

  private validateRequiredParam(
    param: ParameterSchema,
    entries: EventLogEntry[]
  ): ParameterValidationResult {
    const values = entries
      .map(e => e.parameters[param.name])
      .filter(v => v !== undefined);

    if (values.length === 0) {
      return {
        parameterName: param.name,
        status: 'missing',
        message: `必填参数 "${param.name}" 在所有日志中都缺失`,
        expectedType: param.type
      };
    }

    const typeCheckResults = values.map(v => this.checkType(param, v));
    const failedCount = typeCheckResults.filter(r => !r.valid).length;

    if (failedCount > 0) {
      const firstFail = typeCheckResults.find(r => !r.valid)!;
      return {
        parameterName: param.name,
        status: 'fail',
        message: `参数 "${param.name}" 类型错误: 期望 ${param.type}，实际 ${firstFail.actualType} (${failedCount}/${entries.length} 条记录)`,
        expectedType: param.type,
        actualType: firstFail.actualType,
        actual: firstFail.value
      };
    }

    const enumCheck = this.checkEnum(param, values);
    if (!enumCheck.valid) {
      return {
        parameterName: param.name,
        status: 'fail',
        message: `参数 "${param.name}" 值不在枚举范围内: ${enumCheck.invalidValue}`,
        expected: param.enum,
        actual: enumCheck.invalidValue
      };
    }

    const rangeCheck = this.checkRange(param, values);
    if (!rangeCheck.valid) {
      return {
        parameterName: param.name,
        status: 'fail',
        message: `参数 "${param.name}" 值超出范围: ${rangeCheck.invalidValue}`,
        actual: rangeCheck.invalidValue
      };
    }

    return {
      parameterName: param.name,
      status: 'pass',
      expectedType: param.type
    };
  }

  private validateOptionalParam(
    param: ParameterSchema,
    entries: EventLogEntry[]
  ): ParameterValidationResult {
    const values = entries
      .map(e => e.parameters[param.name])
      .filter(v => v !== undefined);

    if (values.length === 0) {
      return {
        parameterName: param.name,
        status: 'warning',
        message: `可选参数 "${param.name}" 在所有日志中都缺失`,
        expectedType: param.type
      };
    }

    const typeCheckResults = values.map(v => this.checkType(param, v));
    const failedCount = typeCheckResults.filter(r => !r.valid).length;

    if (failedCount > 0 && this.config.strictTypeChecking) {
      const firstFail = typeCheckResults.find(r => !r.valid)!;
      return {
        parameterName: param.name,
        status: 'warning',
        message: `可选参数 "${param.name}" 类型不一致: 期望 ${param.type}，实际 ${firstFail.actualType} (${failedCount}/${entries.length} 条记录)`,
        expectedType: param.type,
        actualType: firstFail.actualType
      };
    }

    return {
      parameterName: param.name,
      status: 'pass',
      expectedType: param.type
    };
  }

  private checkType(param: ParameterSchema, value: any): { valid: boolean; actualType: string; value: any } {
    const actualType = this.getType(value);
    
    if (param.type === 'any') {
      return { valid: true, actualType, value };
    }

    if (param.type === 'null' && value === null) {
      return { valid: true, actualType, value };
    }

    if (param.type === 'array' && Array.isArray(value)) {
      return { valid: true, actualType, value };
    }

    if (param.type === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return { valid: true, actualType, value };
    }

    if (param.type === actualType) {
      return { valid: true, actualType, value };
    }

    return { valid: false, actualType, value };
  }

  private getType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private checkEnum(param: ParameterSchema, values: any[]): { valid: boolean; invalidValue?: any } {
    if (!param.enum) return { valid: true };
    
    const enumValues = param.enum as any[];
    for (const value of values) {
      if (!enumValues.includes(value)) {
        return { valid: false, invalidValue: value };
      }
    }
    return { valid: true };
  }

  private checkRange(param: ParameterSchema, values: any[]): { valid: boolean; invalidValue?: any } {
    if (param.type !== 'number') return { valid: true };
    
    for (const value of values) {
      if (param.minimum !== undefined && value < param.minimum) {
        return { valid: false, invalidValue: value };
      }
      if (param.maximum !== undefined && value > param.maximum) {
        return { valid: false, invalidValue: value };
      }
    }
    return { valid: true };
  }

  private findUndefinedParams(schemaNames: Set<string>, entries: EventLogEntry[]): string[] {
    const undefinedParams = new Set<string>();
    
    for (const entry of entries) {
      for (const paramName of Object.keys(entry.parameters)) {
        if (!schemaNames.has(paramName)) {
          undefinedParams.add(paramName);
        }
      }
    }
    
    return Array.from(undefinedParams);
  }

  private createParameterIssue(
    param: ParameterSchema,
    result: ParameterValidationResult,
    entries: EventLogEntry[]
  ): Issue {
    const eventIds = [...new Set(entries.map(e => e.eventId))];
    const eventNames = [...new Set(entries.map(e => e.eventName))];

    let issueType: 'parameter_missing' | 'parameter_type_changed' | 'parameter_value_invalid';
    let severity: IssueSeverity;

    if (result.status === 'missing') {
      issueType = 'parameter_missing';
      severity = param.required ? 'high' : 'medium';
    } else if (result.status === 'fail') {
      issueType = 'parameter_type_changed';
      severity = param.required ? 'high' : 'medium';
    } else {
      issueType = 'parameter_value_invalid';
      severity = 'medium';
    }

    return {
      id: `param-${issueType}-${param.name}-${Date.now()}`,
      type: issueType,
      severity,
      eventId: eventIds[0],
      eventName: eventNames[0],
      message: result.message || `参数 "${param.name}" 校验失败`,
      reason: this.getIssueReason(issueType, param, result),
      impactScope: [
        `参数名: ${param.name}`,
        `必填: ${param.required ? '是' : '否'}`,
        `影响事件数: ${entries.length}`,
        `事件ID: ${eventIds.join(', ')}`
      ],
      nextActions: this.getNextActions(issueType, param, result),
      expected: result.expectedType || result.expected,
      actual: result.actualType || result.actual,
      parameterName: param.name
    };
  }

  private getIssueReason(
    type: string,
    param: ParameterSchema,
    result: ParameterValidationResult
  ): string {
    switch (type) {
      case 'parameter_missing':
        return `参数 "${param.name}" 定义为必填，但在采集的日志中完全缺失。可能是前端代码未传递该参数，或参数名拼写错误。`;
      case 'parameter_type_changed':
        return `参数类型不匹配。Schema定义为 ${result.expectedType}，但实际采集到 ${result.actualType}。可能是前端数据类型转换问题或Schema定义过时。`;
      case 'parameter_value_invalid':
        return `参数值不符合约束条件。${param.enum ? `枚举值应为 [${param.enum.join(', ')}]` : ''}${param.minimum !== undefined ? `最小值为 ${param.minimum}` : ''}${param.maximum !== undefined ? `最大值为 ${param.maximum}` : ''}`;
      default:
        return '参数校验失败';
    }
  }

  private getNextActions(
    type: string,
    param: ParameterSchema,
    result: ParameterValidationResult
  ): string[] {
    switch (type) {
      case 'parameter_missing':
        return [
          `1. 检查前端代码中事件调用是否包含参数 "${param.name}"`,
          `2. 确认参数名拼写是否正确（区分大小写）`,
          `3. 验证参数是否在所有触发场景中都有值`,
          `4. 如非必需，可将参数改为可选`
        ];
      case 'parameter_type_changed':
        return [
          `1. 检查前端代码中该参数的数据类型`,
          `2. 确认是否存在隐式类型转换（如字符串转数字）`,
          `3. 如是Schema过时，更新Schema定义为 ${result.actualType}`,
          `4. 添加类型校验逻辑确保数据一致性`
        ];
      case 'parameter_value_invalid':
        return [
          `1. 检查前端代码中参数值的生成逻辑`,
          `2. 确认是否需要更新枚举值范围`,
          `3. 添加前端参数值校验`,
          `4. 如是合法新值，更新Schema定义`
        ];
      default:
        return ['检查参数定义和采集代码'];
    }
  }
}
