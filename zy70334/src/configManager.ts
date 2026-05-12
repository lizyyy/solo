import * as fs from 'fs';
import * as path from 'path';
import JSON5 from 'json5';
import { ErrorCodeMapping, SuppressionRule } from './types';

export class ConfigManager {
  private configDir: string;
  private errorCodeMappingPath: string;
  private suppressionRulesPath: string;
  private knownErrorCodesPath: string;

  constructor(configDir?: string) {
    this.configDir = configDir || path.join(process.cwd(), '.exception-sampler');
    this.ensureConfigDir();
    
    this.errorCodeMappingPath = path.join(this.configDir, 'error-code-mapping.json');
    this.suppressionRulesPath = path.join(this.configDir, 'suppression-rules.json');
    this.knownErrorCodesPath = path.join(this.configDir, 'known-error-codes.json');
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  public loadErrorCodeMapping(): ErrorCodeMapping {
    if (fs.existsSync(this.errorCodeMappingPath)) {
      try {
        const content = fs.readFileSync(this.errorCodeMappingPath, 'utf-8');
        return JSON5.parse(content);
      } catch (e) {
        console.warn(`警告: 错误码映射文件解析失败`);
      }
    }
    return this.getDefaultErrorCodeMapping();
  }

  private getDefaultErrorCodeMapping(): ErrorCodeMapping {
    return {
      'PAYMENT_FAILED': {
        description: '支付失败',
        category: 'Payment',
        severity: 'critical'
      },
      'INSUFFICIENT_BALANCE': {
        description: '余额不足',
        category: 'Payment',
        severity: 'high'
      },
      'INVENTORY_DEDUCT_FAILED': {
        description: '库存扣减失败',
        category: 'Inventory',
        severity: 'high'
      },
      'INSUFFICIENT_STOCK': {
        description: '库存不足',
        category: 'Inventory',
        severity: 'medium'
      },
      'CALLBACK_TIMEOUT': {
        description: '回调超时',
        category: 'Integration',
        severity: 'medium'
      },
      'CALLBACK_FAILED': {
        description: '回调失败',
        category: 'Integration',
        severity: 'medium'
      },
      'NETWORK_ERROR': {
        description: '网络错误',
        category: 'System',
        severity: 'low'
      },
      'TIMEOUT': {
        description: '请求超时',
        category: 'System',
        severity: 'low'
      },
      'INVALID_PARAMETER': {
        description: '参数错误',
        category: 'Validation',
        severity: 'low'
      },
      'RATE_LIMITED': {
        description: '限流',
        category: 'System',
        severity: 'low'
      }
    };
  }

  public saveErrorCodeMapping(mapping: ErrorCodeMapping): void {
    fs.writeFileSync(this.errorCodeMappingPath, JSON.stringify(mapping, null, 2), 'utf-8');
  }

  public loadSuppressionRules(): SuppressionRule[] {
    if (fs.existsSync(this.suppressionRulesPath)) {
      try {
        const content = fs.readFileSync(this.suppressionRulesPath, 'utf-8');
        const rules = JSON5.parse(content);
        return this.filterActiveRules(rules);
      } catch (e) {
        console.warn(`警告: 抑制规则文件解析失败`);
      }
    }
    return [];
  }

  private filterActiveRules(rules: SuppressionRule[]): SuppressionRule[] {
    const now = new Date();
    return rules.filter(rule => {
      const expireDate = new Date(rule.expireAt);
      return expireDate >= now;
    });
  }

  public saveSuppressionRules(rules: SuppressionRule[]): void {
    fs.writeFileSync(this.suppressionRulesPath, JSON.stringify(rules, null, 2), 'utf-8');
  }

  public addSuppressionRule(rule: Omit<SuppressionRule, 'id'>): SuppressionRule {
    const rules = this.loadSuppressionRules();
    const newRule: SuppressionRule = {
      ...rule,
      id: `rule-${Date.now()}`
    };
    rules.push(newRule);
    this.saveSuppressionRules(rules);
    return newRule;
  }

  public removeSuppressionRule(ruleId: string): boolean {
    const rules = this.loadSuppressionRules();
    const index = rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      rules.splice(index, 1);
      this.saveSuppressionRules(rules);
      return true;
    }
    return false;
  }

  public loadKnownErrorCodes(): Set<string> {
    if (fs.existsSync(this.knownErrorCodesPath)) {
      try {
        const content = fs.readFileSync(this.knownErrorCodesPath, 'utf-8');
        const codes = JSON5.parse(content);
        return new Set(codes);
      } catch (e) {
        console.warn(`警告: 已知错误码文件解析失败`);
      }
    }
    return new Set();
  }

  public saveKnownErrorCodes(codes: Set<string>): void {
    fs.writeFileSync(this.knownErrorCodesPath, JSON.stringify(Array.from(codes), null, 2), 'utf-8');
  }

  public addKnownErrorCode(code: string): void {
    const codes = this.loadKnownErrorCodes();
    codes.add(code);
    this.saveKnownErrorCodes(codes);
  }

  public getConfigDir(): string {
    return this.configDir;
  }
}
