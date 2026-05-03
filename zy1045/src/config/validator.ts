import * as fs from 'fs';
import * as path from 'path';
import { MaskerConfig, ValidationResult, RiskItem, FieldType } from '../types';

const VALID_FIELD_TYPES: FieldType[] = [
  'phone', 'email', 'address', 'name', 
  'order_number', 'ticket_number', 'free_text'
];

export class ConfigValidator {
  static validate(config: MaskerConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const risks: RiskItem[] = [];

    this.validateVersion(config, errors, warnings);
    this.validateSalt(config, errors, warnings, risks);
    this.validateOutputDir(config, errors, warnings);
    this.validateFiles(config, errors, warnings, risks);
    this.validateFieldConsistency(config, errors, warnings, risks);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      risks,
    };
  }

  private static validateVersion(
    config: MaskerConfig,
    errors: string[],
    warnings: string[]
  ): void {
    if (!config.version) {
      warnings.push('配置未指定版本号，默认为 1.0');
    }
  }

  private static validateSalt(
    config: MaskerConfig,
    errors: string[],
    warnings: string[],
    risks: RiskItem[]
  ): void {
    if (!config.salt) {
      errors.push('必须配置 salt 值以确保一致性映射');
    } else if (config.salt.length < 8) {
      warnings.push('salt 长度较短，建议使用至少 8 个字符');
      risks.push({
        level: 'low',
        category: 'security',
        message: 'Salt 值较短，可能影响映射的唯一性',
        suggestion: '建议使用更长的随机字符串作为 salt'
      });
    } else if (config.salt.toLowerCase().includes('default')) {
      warnings.push('使用了默认 salt，建议配置自定义 salt');
      risks.push({
        level: 'medium',
        category: 'security',
        message: '使用默认 salt 可能导致映射结果可预测',
        suggestion: '在配置文件中设置唯一的自定义 salt 值'
      });
    }
  }

  private static validateOutputDir(
    config: MaskerConfig,
    errors: string[],
    warnings: string[]
  ): void {
    if (!config.outputDir) {
      errors.push('必须配置输出目录 (outputDir)');
    }
    
    try {
      const outputParent = path.dirname(config.outputDir);
      if (!fs.existsSync(outputParent)) {
        warnings.push(`输出目录的父目录不存在: ${outputParent}，执行时会自动创建`);
      }
    } catch (e) {
      warnings.push(`无法检查输出目录: ${(e as Error).message}`);
    }
  }

  private static validateFiles(
    config: MaskerConfig,
    errors: string[],
    warnings: string[],
    risks: RiskItem[]
  ): void {
    if (!config.files || config.files.length === 0) {
      errors.push('配置中未指定任何文件 (files 数组为空)');
      return;
    }

    for (const fileConfig of config.files) {
      const filePath = fileConfig.path;
      
      if (!fs.existsSync(filePath)) {
        errors.push(`文件不存在: ${filePath}`);
        continue;
      }

      if (!fileConfig.type) {
        warnings.push(`文件未指定类型，将根据扩展名推断: ${path.basename(filePath)}`);
      }

      if (!fileConfig.fields || Object.keys(fileConfig.fields).length === 0) {
        warnings.push(`文件未配置任何脱敏字段: ${path.basename(filePath)}`);
        risks.push({
          level: 'high',
          category: 'privacy',
          message: `文件未配置脱敏字段，所有字段将原样输出`,
          file: filePath,
          suggestion: '请检查是否遗漏了需要脱敏的字段配置'
        });
      } else {
        for (const [fieldName, fieldConfig] of Object.entries(fileConfig.fields)) {
          if (!VALID_FIELD_TYPES.includes(fieldConfig.type)) {
            errors.push(`不支持的字段类型 "${fieldConfig.type}"，字段: ${fieldName}，文件: ${path.basename(filePath)}`);
          }
        }
      }
    }
  }

  private static validateFieldConsistency(
    config: MaskerConfig,
    errors: string[],
    warnings: string[],
    risks: RiskItem[]
  ): void {
    const fieldTypeMap: Map<string, Set<string>> = new Map();
    const allFields: Map<string, { file: string; type: FieldType }[]> = new Map();

    for (const fileConfig of config.files) {
      const fileName = path.basename(fileConfig.path);
      
      for (const [fieldName, fieldConfig] of Object.entries(fileConfig.fields)) {
        const key = `${fieldName}:${fieldConfig.type}`;
        
        if (!fieldTypeMap.has(key)) {
          fieldTypeMap.set(key, new Set());
        }
        fieldTypeMap.get(key)!.add(fileName);

        if (!allFields.has(fieldName)) {
          allFields.set(fieldName, []);
        }
        allFields.get(fieldName)!.push({ file: fileName, type: fieldConfig.type });
      }
    }

    for (const [fieldName, fieldInfos] of allFields.entries()) {
      const types = new Set(fieldInfos.map(f => f.type));
      
      if (types.size > 1) {
        const typeDetails = fieldInfos.map(f => `${f.file}: ${f.type}`).join(', ');
        warnings.push(`同名字段 "${fieldName}" 在不同文件中被标记为不同类型: ${typeDetails}`);
        risks.push({
          level: 'high',
          category: 'consistency',
          message: `字段 "${fieldName}" 类型不一致，可能导致跨文件映射不一致`,
          suggestion: `请统一该字段的类型配置，当前配置: ${typeDetails}`
        });
      }
    }

    for (const [key, files] of fieldTypeMap.entries()) {
      if (files.size > 1) {
        const [fieldName, fieldType] = key.split(':');
        const filesList = Array.from(files).join(', ');
        
        if (['phone', 'email', 'name'].includes(fieldType)) {
          warnings.push(`检测到跨文件一致性字段: ${fieldName} (${fieldType}) 出现在: ${filesList}`);
        }
      }
    }
  }

  static getRiskSummary(risks: RiskItem[]): { high: number; medium: number; low: number } {
    return {
      high: risks.filter(r => r.level === 'high').length,
      medium: risks.filter(r => r.level === 'medium').length,
      low: risks.filter(r => r.level === 'low').length,
    };
  }
}
