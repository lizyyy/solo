import { MaskerConfig, FileConfig, RiskItem } from '../types';
import { FileReader, FileReadResult } from '../io/file-reader';

export class RiskChecker {
  static checkAll(config: MaskerConfig): RiskItem[] {
    const risks: RiskItem[] = [];

    risks.push(...this.checkSaltSecurity(config));
    risks.push(...this.checkFieldCoverage(config));
    risks.push(...this.checkDataPatterns(config));
    risks.push(...this.checkOutputDir(config));

    return risks;
  }

  private static checkSaltSecurity(config: MaskerConfig): RiskItem[] {
    const risks: RiskItem[] = [];

    if (!config.salt) {
      risks.push({
        level: 'high',
        category: 'security',
        message: '未配置 salt 值，无法保证映射一致性',
        suggestion: '请在配置文件中设置 salt 字段，建议使用随机字符串'
      });
    } else {
      if (config.salt.length < 8) {
        risks.push({
          level: 'medium',
          category: 'security',
          message: `Salt 长度较短 (${config.salt.length} 字符)，可能影响映射唯一性`,
          suggestion: '建议使用至少 16 个字符的随机字符串作为 salt'
        });
      }

      if (config.salt.toLowerCase().includes('default') || 
          config.salt.toLowerCase().includes('salt')) {
        risks.push({
          level: 'medium',
          category: 'security',
          message: 'Salt 包含默认关键词，映射结果可能被预测',
          suggestion: '请使用唯一的、无意义的随机字符串作为 salt'
        });
      }
    }

    return risks;
  }

  private static checkFieldCoverage(config: MaskerConfig): RiskItem[] {
    const risks: RiskItem[] = [];

    for (const fileConfig of config.files) {
      try {
        const fileData = FileReader.read(fileConfig);
        const fileRisks = this.checkSingleFileCoverage(fileConfig, fileData, config.globalIgnoreFields || []);
        risks.push(...fileRisks);
      } catch (e) {
        risks.push({
          level: 'high',
          category: 'io',
          message: `无法读取文件进行风险检查: ${fileConfig.path}`,
          suggestion: `请检查文件是否存在且格式正确: ${(e as Error).message}`
        });
      }
    }

    return risks;
  }

  private static checkSingleFileCoverage(
    fileConfig: FileConfig,
    fileData: FileReadResult,
    globalIgnoreFields: string[] = []
  ): RiskItem[] {
    const risks: RiskItem[] = [];
    const fileName = fileConfig.path;
    const configuredFields = Object.keys(fileConfig.fields);
    const actualFields = fileData.headers;

    const sensitiveFieldPatterns = [
      { pattern: /phone|mobile|电话|手机|手机号/i, type: 'phone' },
      { pattern: /email|mail|邮箱|邮件/i, type: 'email' },
      { pattern: /name|姓名|用户名|真实名/i, type: 'name' },
      { pattern: /address|地址|收货地址|住址/i, type: 'address' },
      { pattern: /order|订单号|订单编号/i, type: 'order_number' },
      { pattern: /ticket|工单|工单号|ticket_no/i, type: 'ticket_number' },
      { pattern: /remark|comment|note|备注|说明/i, type: 'free_text' },
      { pattern: /idcard|身份证|证件号/i, type: 'other' },
      { pattern: /bank|银行卡|银行账号/i, type: 'other' },
    ];

    const allIgnoreFields = new Set([
      ...(fileConfig.ignoreFields || []),
      ...globalIgnoreFields,
    ]);

    for (const field of actualFields) {
      if (allIgnoreFields.has(field)) {
        continue;
      }

      if (configuredFields.includes(field)) {
        continue;
      }

      for (const sensitive of sensitiveFieldPatterns) {
        if (sensitive.pattern.test(field)) {
          risks.push({
            level: 'high',
            category: 'privacy',
            message: `字段 "${field}" 可能包含敏感信息但未配置脱敏`,
            file: fileName,
            field: field,
            suggestion: `建议将该字段配置为 "${sensitive.type}" 类型，或添加到 ignoreFields`
          });
          break;
        }
      }
    }

    for (const field of configuredFields) {
      if (!actualFields.includes(field)) {
        risks.push({
          level: 'medium',
          category: 'config',
          message: `配置的字段 "${field}" 在文件中不存在`,
          file: fileName,
          field: field,
          suggestion: '请检查字段名拼写或移除该配置'
        });
      }
    }

    return risks;
  }

  private static checkDataPatterns(config: MaskerConfig): RiskItem[] {
    const risks: RiskItem[] = [];

    const phonePattern = /1[3-9]\d{9}/;
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const idCardPattern = /\d{17}[\dXx]/;

    for (const fileConfig of config.files) {
      const configuredFields = new Set(Object.keys(fileConfig.fields));
      const allIgnoreFields = new Set([
        ...(fileConfig.ignoreFields || []),
        ...(config.globalIgnoreFields || []),
      ]);

      try {
        const fileData = FileReader.read(fileConfig);
        const sampleSize = Math.min(fileData.records.length, 100);
        const sampleRecords = fileData.records.slice(0, sampleSize);

        const suspiciousFields: Map<string, { phone: number; email: number; idCard: number }> = new Map();

        for (const record of sampleRecords) {
          for (const [field, value] of Object.entries(record)) {
            if (configuredFields.has(field) || allIgnoreFields.has(field)) {
              continue;
            }

            const strValue = String(value || '');
            let counts = suspiciousFields.get(field);
            if (!counts) {
              counts = { phone: 0, email: 0, idCard: 0 };
              suspiciousFields.set(field, counts);
            }

            if (phonePattern.test(strValue)) counts.phone++;
            if (emailPattern.test(strValue)) counts.email++;
            if (idCardPattern.test(strValue)) counts.idCard++;
          }
        }

        for (const [field, counts] of suspiciousFields.entries()) {
          const totalPatterns = counts.phone + counts.email + counts.idCard;
          if (totalPatterns > sampleSize * 0.3) {
            const patterns: string[] = [];
            if (counts.phone > 0) patterns.push(`手机号(${counts.phone}次)`);
            if (counts.email > 0) patterns.push(`邮箱(${counts.email}次)`);
            if (counts.idCard > 0) patterns.push(`身份证(${counts.idCard}次)`);

            risks.push({
              level: 'high',
              category: 'data',
              message: `字段 "${field}" 在采样数据中发现大量敏感模式: ${patterns.join(', ')}`,
              file: fileConfig.path,
              field: field,
              suggestion: '建议立即将该字段添加到脱敏配置中'
            });
          }
        }
      } catch (e) {
        risks.push({
          level: 'medium',
          category: 'io',
          message: `无法分析文件数据: ${fileConfig.path}`,
          suggestion: `错误详情: ${(e as Error).message}`
        });
      }
    }

    return risks;
  }

  private static checkOutputDir(config: MaskerConfig): RiskItem[] {
    const risks: RiskItem[] = [];
    const outputDir = config.outputDir;

    if (outputDir && outputDir.includes('..')) {
      risks.push({
        level: 'medium',
        category: 'security',
        message: '输出目录路径包含上级目录引用 (..)',
        suggestion: '建议使用绝对路径或当前目录下的相对路径'
      });
    }

    return risks;
  }

  static summarizeRisks(risks: RiskItem[]): {
    high: RiskItem[];
    medium: RiskItem[];
    low: RiskItem[];
    byCategory: { [category: string]: RiskItem[] };
  } {
    const high = risks.filter(r => r.level === 'high');
    const medium = risks.filter(r => r.level === 'medium');
    const low = risks.filter(r => r.level === 'low');
    
    const byCategory: { [category: string]: RiskItem[] } = {};
    for (const risk of risks) {
      if (!byCategory[risk.category]) {
        byCategory[risk.category] = [];
      }
      byCategory[risk.category].push(risk);
    }

    return { high, medium, low, byCategory };
  }
}
