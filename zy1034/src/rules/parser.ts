import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { RulesConfig, ValidationResult, RuleValidationError, ConflictStrategy, OperationType, Rule } from '../types';

const DEFAULT_CONFLICT_STRATEGY: ConflictStrategy = 'error';
const DEFAULT_OPERATION: OperationType = 'move';
const CURRENT_VERSION = '1.0';

export class RuleParser {
  private readonly validConflictStrategies: ConflictStrategy[] = ['rename', 'skip', 'error'];
  private readonly validOperations: OperationType[] = ['move', 'copy'];

  async parseFile(filePath: string): Promise<RulesConfig> {
    this.validateFilePath(filePath);
    
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      throw new Error(`规则文件不存在: ${filePath}`);
    }

    const fileContent = await fs.readFile(filePath, 'utf-8');
    const extension = path.extname(filePath).toLowerCase();

    let config: any;
    try {
      if (extension === '.yaml' || extension === '.yml') {
        config = yaml.load(fileContent) as any;
      } else if (extension === '.json') {
        config = JSON.parse(fileContent);
      } else {
        throw new Error(`不支持的文件格式: ${extension}。支持的格式: .yaml, .yml, .json`);
      }
    } catch (error: any) {
      if (error instanceof yaml.YAMLException) {
        const err = error as any;
        throw new Error(`YAML 解析错误: ${error.message}\n行 ${err.line || '未知'}, 列 ${err.column || '未知'}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`JSON 解析错误: ${error.message}`);
      }
      throw error;
    }

    if (!config) {
      throw new Error('规则文件内容为空');
    }

    return this.validateAndNormalizeConfig(config);
  }

  parseSync(filePath: string): RulesConfig {
    this.validateFilePath(filePath);
    
    const fileExists = fs.existsSync(filePath);
    if (!fileExists) {
      throw new Error(`规则文件不存在: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const extension = path.extname(filePath).toLowerCase();

    let config: any;
    try {
      if (extension === '.yaml' || extension === '.yml') {
        config = yaml.load(fileContent) as any;
      } else if (extension === '.json') {
        config = JSON.parse(fileContent);
      } else {
        throw new Error(`不支持的文件格式: ${extension}。支持的格式: .yaml, .yml, .json`);
      }
    } catch (error: any) {
      if (error instanceof yaml.YAMLException) {
        throw new Error(`YAML 解析错误: ${error.message}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`JSON 解析错误: ${error.message}`);
      }
      throw error;
    }

    if (!config) {
      throw new Error('规则文件内容为空');
    }

    return this.validateAndNormalizeConfig(config);
  }

  validate(config: any): ValidationResult {
    const errors: RuleValidationError[] = [];

    if (!config) {
      errors.push({
        field: 'config',
        message: '配置对象为空'
      });
      return { valid: false, errors };
    }

    if (!config.version) {
      errors.push({
        field: 'version',
        message: '缺少 version 字段'
      });
    } else if (typeof config.version !== 'string') {
      errors.push({
        field: 'version',
        message: `version 必须是字符串，当前类型: ${typeof config.version}`
      });
    }

    if (!config.rules) {
      errors.push({
        field: 'rules',
        message: '缺少 rules 数组'
      });
    } else if (!Array.isArray(config.rules)) {
      errors.push({
        field: 'rules',
        message: `rules 必须是数组，当前类型: ${typeof config.rules}`
      });
    } else {
      config.rules.forEach((rule: any, index: number) => {
        const ruleErrors = this.validateRule(rule, index);
        errors.push(...ruleErrors);
      });
    }

    if (config.defaultConflictStrategy) {
      if (!this.validConflictStrategies.includes(config.defaultConflictStrategy)) {
        errors.push({
          field: 'defaultConflictStrategy',
          message: `无效的冲突策略: ${config.defaultConflictStrategy}。有效值: ${this.validConflictStrategies.join(', ')}`
        });
      }
    }

    if (config.defaultOperation) {
      if (!this.validOperations.includes(config.defaultOperation)) {
        errors.push({
          field: 'defaultOperation',
          message: `无效的操作类型: ${config.defaultOperation}。有效值: ${this.validOperations.join(', ')}`
        });
      }
    }

    if (config.excludePatterns) {
      if (!Array.isArray(config.excludePatterns)) {
        errors.push({
          field: 'excludePatterns',
          message: `excludePatterns 必须是数组，当前类型: ${typeof config.excludePatterns}`
        });
      } else {
        config.excludePatterns.forEach((pattern: any, index: number) => {
          if (typeof pattern !== 'string') {
            errors.push({
              field: `excludePatterns[${index}]`,
              message: `排除模式必须是字符串，当前类型: ${typeof pattern}`
            });
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateRule(rule: any, index: number): RuleValidationError[] {
    const errors: RuleValidationError[] = [];
    const ruleName = rule?.name || `规则 #${index + 1}`;

    if (!rule) {
      errors.push({
        field: `rules[${index}]`,
        message: '规则对象为空',
        ruleIndex: index,
        ruleName
      });
      return errors;
    }

    if (!rule.name) {
      errors.push({
        field: `rules[${index}].name`,
        message: '缺少规则名称 (name)',
        ruleIndex: index,
        ruleName
      });
    } else if (typeof rule.name !== 'string') {
      errors.push({
        field: `rules[${index}].name`,
        message: `规则名称必须是字符串，当前类型: ${typeof rule.name}`,
        ruleIndex: index,
        ruleName: typeof rule.name === 'string' ? rule.name : undefined
      });
    }

    if (!rule.condition) {
      errors.push({
        field: `rules[${index}].condition`,
        message: '缺少规则条件 (condition)',
        ruleIndex: index,
        ruleName
      });
    } else if (typeof rule.condition !== 'object' || Array.isArray(rule.condition)) {
      errors.push({
        field: `rules[${index}].condition`,
        message: `规则条件必须是对象，当前类型: ${typeof rule.condition}`,
        ruleIndex: index,
        ruleName
      });
    } else {
      const conditionErrors = this.validateCondition(rule.condition, index, ruleName);
      errors.push(...conditionErrors);
    }

    if (!rule.destination) {
      errors.push({
        field: `rules[${index}].destination`,
        message: '缺少目标目录 (destination)',
        ruleIndex: index,
        ruleName
      });
    } else if (typeof rule.destination !== 'string') {
      errors.push({
        field: `rules[${index}].destination`,
        message: `目标目录必须是字符串，当前类型: ${typeof rule.destination}`,
        ruleIndex: index,
        ruleName
      });
    }

    if (rule.priority !== undefined && rule.priority !== null) {
      if (typeof rule.priority !== 'number') {
        errors.push({
          field: `rules[${index}].priority`,
          message: `优先级必须是数字，当前类型: ${typeof rule.priority}`,
          ruleIndex: index,
          ruleName
        });
      } else if (!Number.isInteger(rule.priority)) {
        errors.push({
          field: `rules[${index}].priority`,
          message: '优先级必须是整数',
          ruleIndex: index,
          ruleName
        });
      }
    }

    return errors;
  }

  private validateCondition(condition: any, ruleIndex: number, ruleName: string): RuleValidationError[] {
    const errors: RuleValidationError[] = [];
    const prefix = `rules[${ruleIndex}].condition`;

    const hasAnyCondition = [
      condition.extensions,
      condition.keywords,
      condition.minSize,
      condition.maxSize,
      condition.modifiedAfter,
      condition.modifiedBefore,
      condition.createdAfter,
      condition.createdBefore
    ].some(val => val !== undefined && val !== null);

    if (!hasAnyCondition) {
      errors.push({
        field: `${prefix}`,
        message: '规则条件为空，至少需要指定一个匹配条件',
        ruleIndex,
        ruleName
      });
    }

    if (condition.extensions !== undefined) {
      if (!Array.isArray(condition.extensions)) {
        errors.push({
          field: `${prefix}.extensions`,
          message: `扩展名必须是数组，当前类型: ${typeof condition.extensions}`,
          ruleIndex,
          ruleName
        });
      } else {
        condition.extensions.forEach((ext: any, i: number) => {
          if (typeof ext !== 'string') {
            errors.push({
              field: `${prefix}.extensions[${i}]`,
              message: `扩展名必须是字符串，当前类型: ${typeof ext}`,
              ruleIndex,
              ruleName
            });
          }
        });
      }
    }

    if (condition.keywords !== undefined) {
      if (!Array.isArray(condition.keywords)) {
        errors.push({
          field: `${prefix}.keywords`,
          message: `关键词必须是数组，当前类型: ${typeof condition.keywords}`,
          ruleIndex,
          ruleName
        });
      } else {
        condition.keywords.forEach((kw: any, i: number) => {
          if (typeof kw !== 'string') {
            errors.push({
              field: `${prefix}.keywords[${i}]`,
              message: `关键词必须是字符串，当前类型: ${typeof kw}`,
              ruleIndex,
              ruleName
            });
          }
        });
      }
    }

    if (condition.minSize !== undefined && condition.minSize !== null) {
      if (typeof condition.minSize !== 'number') {
        errors.push({
          field: `${prefix}.minSize`,
          message: `最小大小必须是数字，当前类型: ${typeof condition.minSize}`,
          ruleIndex,
          ruleName
        });
      } else if (condition.minSize < 0) {
        errors.push({
          field: `${prefix}.minSize`,
          message: '最小大小不能为负数',
          ruleIndex,
          ruleName
        });
      }
    }

    if (condition.maxSize !== undefined && condition.maxSize !== null) {
      if (typeof condition.maxSize !== 'number') {
        errors.push({
          field: `${prefix}.maxSize`,
          message: `最大大小必须是数字，当前类型: ${typeof condition.maxSize}`,
          ruleIndex,
          ruleName
        });
      } else if (condition.maxSize < 0) {
        errors.push({
          field: `${prefix}.maxSize`,
          message: '最大大小不能为负数',
          ruleIndex,
          ruleName
        });
      }
    }

    if (condition.minSize !== undefined && condition.minSize !== null && 
        condition.maxSize !== undefined && condition.maxSize !== null) {
      if (condition.minSize > condition.maxSize) {
        errors.push({
          field: `${prefix}`,
          message: 'minSize 不能大于 maxSize',
          ruleIndex,
          ruleName
        });
      }
    }

    const dateFields = ['modifiedAfter', 'modifiedBefore', 'createdAfter', 'createdBefore'];
    dateFields.forEach(field => {
      const value = condition[field];
      if (value !== undefined && value !== null) {
        if (typeof value !== 'string') {
          errors.push({
            field: `${prefix}.${field}`,
            message: `${field} 必须是 ISO 日期字符串，当前类型: ${typeof value}`,
            ruleIndex,
            ruleName
          });
        } else {
          const parsed = new Date(value);
          if (isNaN(parsed.getTime())) {
            errors.push({
              field: `${prefix}.${field}`,
              message: `${field} 不是有效的日期格式: ${value}`,
              ruleIndex,
              ruleName
            });
          }
        }
      }
    });

    return errors;
  }

  private validateAndNormalizeConfig(config: any): RulesConfig {
    const validation = this.validate(config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e, i) => 
        `[${i + 1}] ${e.ruleName ? `规则 "${e.ruleName}": ` : ''}${e.field}: ${e.message}`
      ).join('\n');
      throw new Error(`规则文件验证失败:\n${errorMessages}`);
    }

    const normalizedRules: Rule[] = config.rules.map((rule: any) => ({
      name: rule.name,
      condition: this.normalizeCondition(rule.condition),
      destination: rule.destination,
      description: rule.description,
      priority: rule.priority !== undefined ? rule.priority : 0
    }));

    return {
      version: config.version || CURRENT_VERSION,
      rules: normalizedRules,
      defaultConflictStrategy: config.defaultConflictStrategy || DEFAULT_CONFLICT_STRATEGY,
      defaultOperation: config.defaultOperation || DEFAULT_OPERATION,
      excludePatterns: config.excludePatterns || []
    };
  }

  private normalizeCondition(condition: any): any {
    const normalized: any = {};
    
    if (condition.extensions) {
      normalized.extensions = condition.extensions.map((ext: string) => 
        ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
      );
    }
    
    if (condition.keywords) {
      normalized.keywords = [...condition.keywords];
    }
    
    if (condition.minSize !== undefined) {
      normalized.minSize = condition.minSize;
    }
    
    if (condition.maxSize !== undefined) {
      normalized.maxSize = condition.maxSize;
    }
    
    const dateFields = ['modifiedAfter', 'modifiedBefore', 'createdAfter', 'createdBefore'];
    dateFields.forEach(field => {
      if (condition[field]) {
        normalized[field] = condition[field];
      }
    });

    return normalized;
  }

  private validateFilePath(filePath: string): void {
    if (!filePath) {
      throw new Error('文件路径为空');
    }
    if (typeof filePath !== 'string') {
      throw new Error(`文件路径必须是字符串，当前类型: ${typeof filePath}`);
    }
  }
}
