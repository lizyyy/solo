import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ReleaseScopeConfig, RiskLevel, BlockingLevel } from '../types';

const VALID_VERSIONS = ['1.0'];
const VALID_RISK_LEVELS: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
const VALID_BLOCKING_LEVELS: BlockingLevel[] = ['required', 'recommended', 'optional'];

export interface ConfigValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationError[];
}

export class ConfigParser {
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  static parseFromString(content: string, format: 'yaml' | 'json' = 'yaml'): ReleaseScopeConfig {
    let config: ReleaseScopeConfig;
    
    if (format === 'json') {
      config = JSON.parse(content);
    } else {
      config = yaml.load(content) as ReleaseScopeConfig;
    }
    
    return config;
  }

  async parse(): Promise<ReleaseScopeConfig> {
    const content = await fs.promises.readFile(this.configPath, 'utf-8');
    const ext = path.extname(this.configPath).toLowerCase();
    
    let config: ReleaseScopeConfig;
    
    if (ext === '.json') {
      config = JSON.parse(content);
    } else {
      config = yaml.load(content) as ReleaseScopeConfig;
    }
    
    return this.applyDefaults(config);
  }

  async validate(): Promise<ConfigValidationResult> {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];
    
    try {
      const config = await this.parse();
      
      if (!config.version) {
        errors.push({
          field: 'version',
          message: '配置缺少必填字段: version',
          severity: 'error'
        });
      } else if (!VALID_VERSIONS.includes(config.version)) {
        errors.push({
          field: 'version',
          message: `不支持的版本: ${config.version}，支持的版本: ${VALID_VERSIONS.join(', ')}`,
          severity: 'error'
        });
      }

      if (!config.projectName) {
        errors.push({
          field: 'projectName',
          message: '配置缺少必填字段: projectName',
          severity: 'error'
        });
      }

      if (!config.modules || !Array.isArray(config.modules)) {
        errors.push({
          field: 'modules',
          message: '配置缺少必填字段: modules (应为数组)',
          severity: 'error'
        });
      } else {
        const moduleNames = new Set<string>();
        config.modules.forEach((module, index) => {
          if (!module.name) {
            errors.push({
              field: `modules[${index}].name`,
              message: `模块缺少必填字段: name`,
              severity: 'error'
            });
          } else {
            if (moduleNames.has(module.name)) {
              errors.push({
                field: `modules[${index}].name`,
                message: `重复的模块名称: ${module.name}`,
                severity: 'error'
              });
            }
            moduleNames.add(module.name);
          }

          if (!module.paths || !Array.isArray(module.paths) || module.paths.length === 0) {
            errors.push({
              field: `modules[${index}].paths`,
              message: `模块 ${module.name || index} 缺少必填字段: paths (应为非空数组)`,
              severity: 'error'
            });
          }

          if (!module.owners || !Array.isArray(module.owners) || module.owners.length === 0) {
            warnings.push({
              field: `modules[${index}].owners`,
              message: `模块 ${module.name || index} 没有指定负责人`,
              severity: 'warning'
            });
          }

          if (!module.defaultCheckCommands || !Array.isArray(module.defaultCheckCommands)) {
            warnings.push({
              field: `modules[${index}].defaultCheckCommands`,
              message: `模块 ${module.name || index} 没有指定默认检查命令`,
              severity: 'warning'
            });
          }

          if (module.riskLevel && !VALID_RISK_LEVELS.includes(module.riskLevel)) {
            errors.push({
              field: `modules[${index}].riskLevel`,
              message: `模块 ${module.name || index} 的风险级别无效: ${module.riskLevel}，有效值: ${VALID_RISK_LEVELS.join(', ')}`,
              severity: 'error'
            });
          }
        });
      }

      if (!config.rules || !Array.isArray(config.rules)) {
        warnings.push({
          field: 'rules',
          message: '配置没有指定规则，将使用默认风险评估',
          severity: 'warning'
        });
      } else {
        const ruleIds = new Set<string>();
        config.rules.forEach((rule, index) => {
          if (!rule.id) {
            errors.push({
              field: `rules[${index}].id`,
              message: `规则缺少必填字段: id`,
              severity: 'error'
            });
          } else {
            if (ruleIds.has(rule.id)) {
              errors.push({
                field: `rules[${index}].id`,
                message: `重复的规则 ID: ${rule.id}`,
                severity: 'error'
              });
            }
            ruleIds.add(rule.id);
          }

          if (!rule.name) {
            errors.push({
              field: `rules[${index}].name`,
              message: `规则 ${rule.id || index} 缺少必填字段: name`,
              severity: 'error'
            });
          }

          if (!rule.riskLevel) {
            errors.push({
              field: `rules[${index}].riskLevel`,
              message: `规则 ${rule.id || rule.name || index} 缺少必填字段: riskLevel`,
              severity: 'error'
            });
          } else if (!VALID_RISK_LEVELS.includes(rule.riskLevel)) {
            errors.push({
              field: `rules[${index}].riskLevel`,
              message: `规则 ${rule.id || rule.name || index} 的风险级别无效: ${rule.riskLevel}`,
              severity: 'error'
            });
          }

          if (!rule.blockingLevel) {
            errors.push({
              field: `rules[${index}].blockingLevel`,
              message: `规则 ${rule.id || rule.name || index} 缺少必填字段: blockingLevel`,
              severity: 'error'
            });
          } else if (!VALID_BLOCKING_LEVELS.includes(rule.blockingLevel)) {
            errors.push({
              field: `rules[${index}].blockingLevel`,
              message: `规则 ${rule.id || rule.name || index} 的阻断级别无效: ${rule.blockingLevel}`,
              severity: 'error'
            });
          }

          if (!rule.checkCommands || !Array.isArray(rule.checkCommands)) {
            warnings.push({
              field: `rules[${index}].checkCommands`,
              message: `规则 ${rule.id || rule.name || index} 没有指定检查命令`,
              severity: 'warning'
            });
          }

          const hasMatchers = 
            (rule.paths && rule.paths.length > 0) ||
            (rule.fileTypes && rule.fileTypes.length > 0) ||
            (rule.keywords && rule.keywords.length > 0) ||
            (rule.modules && rule.modules.length > 0) ||
            (rule.owners && rule.owners.length > 0);

          if (!hasMatchers) {
            warnings.push({
              field: `rules[${index}]`,
              message: `规则 ${rule.id || rule.name || index} 没有指定任何匹配条件（paths/fileTypes/keywords/modules/owners），将不会匹配任何文件`,
              severity: 'warning'
            });
          }
        });
      }

      if (config.defaultRiskLevel && !VALID_RISK_LEVELS.includes(config.defaultRiskLevel)) {
        errors.push({
          field: 'defaultRiskLevel',
          message: `默认风险级别无效: ${config.defaultRiskLevel}`,
          severity: 'error'
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
        errors.push({
          field: 'configFile',
          message: `配置文件不存在: ${this.configPath}`,
          severity: 'error'
        });
      } else if (errorMessage.includes('YAML') || errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        errors.push({
          field: 'configFile',
          message: `配置文件格式错误: ${errorMessage}`,
          severity: 'error'
        });
      } else {
        errors.push({
          field: 'configFile',
          message: `解析配置文件时出错: ${errorMessage}`,
          severity: 'error'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private applyDefaults(config: ReleaseScopeConfig): ReleaseScopeConfig {
    return {
      ...config,
      defaultRiskLevel: config.defaultRiskLevel || 'medium',
      modules: (config.modules || []).map(module => ({
        ...module,
        riskLevel: module.riskLevel || config.defaultRiskLevel || 'medium',
        defaultCheckCommands: module.defaultCheckCommands || [],
        owners: module.owners || []
      })),
      rules: (config.rules || []).map(rule => ({
        ...rule,
        paths: rule.paths || [],
        fileTypes: rule.fileTypes || [],
        keywords: rule.keywords || [],
        modules: rule.modules || [],
        owners: rule.owners || [],
        checkCommands: rule.checkCommands || [],
        confirmations: rule.confirmations || []
      })),
      globalCheckCommands: config.globalCheckCommands || []
    };
  }

  static getDefaultConfig(projectName: string): ReleaseScopeConfig {
    return {
      version: '1.0',
      projectName,
      modules: [],
      rules: [],
      globalCheckCommands: [],
      defaultRiskLevel: 'medium'
    };
  }
}
