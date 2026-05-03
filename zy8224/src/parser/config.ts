import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import csvParser from 'csv-parser';
import { EnvironmentManifest, EnvironmentInfo, SecretWhitelist, ApprovalRule, ApprovalPolicy } from '../types';

export class ConfigParser {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.cwd();
  }

  async parseEnvironmentsCsv(csvPath: string): Promise<EnvironmentManifest> {
    const fullPath = path.resolve(this.baseDir, csvPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`环境清单文件不存在: ${fullPath}`);
    }

    return new Promise((resolve, reject) => {
      const environments: EnvironmentInfo[] = [];
      
      fs.createReadStream(fullPath)
        .pipe(csvParser())
        .on('data', (row: Record<string, string>) => {
          const env = this.parseEnvironmentRow(row);
          if (env) {
            environments.push(env);
          }
        })
        .on('end', () => {
          resolve({ environments });
        })
        .on('error', (error: Error) => {
          reject(new Error(`解析环境清单 CSV 失败: ${error.message}`));
        });
    });
  }

  private parseEnvironmentRow(row: Record<string, string>): EnvironmentInfo | null {
    const name = this.normalizeValue(row['name'] || row['environment'] || row['env']);
    const type = this.normalizeValue(row['type'] || row['environment_type']);
    const branchesStr = this.normalizeValue(row['branches'] || row['allowed_branches']);
    const description = this.normalizeValue(row['description']);

    if (!name) {
      console.warn('警告: 跳过缺少 name 的环境行');
      return null;
    }

    const branches = branchesStr 
      ? branchesStr.split(',').map(b => b.trim()).filter(b => b.length > 0)
      : [];

    const environmentType: 'prod' | 'non-prod' = 
      type && ['prod', 'production', 'prd'].includes(type.toLowerCase())
        ? 'prod'
        : 'non-prod';

    return {
      name,
      type: environmentType,
      branches,
      description
    };
  }

  async parseSecretWhitelist(jsonPath: string): Promise<SecretWhitelist> {
    const fullPath = path.resolve(this.baseDir, jsonPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Secret 白名单文件不存在: ${fullPath}`);
    }

    let content: string;
    try {
      content = await fs.promises.readFile(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(`读取 Secret 白名单文件失败: ${(error as Error).message}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`解析 Secret 白名单 JSON 失败: ${(error as Error).message}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Secret 白名单格式无效');
    }

    const obj = parsed as Record<string, unknown>;

    return {
      prodSecrets: this.parseStringArray(obj['prodSecrets'] || obj['prod_secrets']),
      nonProdSecrets: this.parseStringArray(obj['nonProdSecrets'] || obj['non_prod_secrets']),
      environmentSecrets: this.parseEnvironmentSecrets(obj['environmentSecrets'] || obj['environment_secrets'])
    };
  }

  private parseStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  private parseEnvironmentSecrets(value: unknown): Record<string, string[]> {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const result: Record<string, string[]> = {};
    const obj = value as Record<string, unknown>;

    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val)) {
        result[key] = val.filter((item): item is string => typeof item === 'string');
      }
    }

    return result;
  }

  async parseApprovalRules(yamlPath: string): Promise<ApprovalRule> {
    const fullPath = path.resolve(this.baseDir, yamlPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`审批规则文件不存在: ${fullPath}`);
    }

    let content: string;
    try {
      content = await fs.promises.readFile(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(`读取审批规则文件失败: ${(error as Error).message}`);
    }

    let parsed: unknown;
    try {
      parsed = yaml.load(content, { filename: path.basename(fullPath) });
    } catch (error) {
      throw new Error(`解析审批规则 YAML 失败: ${(error as Error).message}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('审批规则格式无效');
    }

    const obj = parsed as Record<string, unknown>;
    const rules = this.parseApprovalPolicies(obj['rules']);

    return { rules };
  }

  private parseApprovalPolicies(value: unknown): ApprovalPolicy[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map(item => this.parseApprovalPolicy(item));
  }

  private parseApprovalPolicy(item: Record<string, unknown>): ApprovalPolicy {
    const environment = this.normalizeValue(item['environment']);
    const triggerType = this.parseStringArray(item['triggerType'] || item['trigger_type'] || item['triggers']);
    const requiresApproval = typeof item['requiresApproval'] === 'boolean' 
      ? item['requiresApproval'] 
      : typeof item['requires_approval'] === 'boolean'
        ? item['requires_approval']
        : true;
    const approvers = this.parseStringArray(item['approvers']);
    const minApprovals = typeof item['minApprovals'] === 'number' 
      ? item['minApprovals']
      : typeof item['min_approvals'] === 'number'
        ? item['min_approvals']
        : undefined;

    if (!environment) {
      throw new Error('审批规则缺少 environment 字段');
    }

    return {
      environment,
      triggerType: triggerType.length > 0 ? triggerType : ['*'],
      requiresApproval,
      approvers: approvers.length > 0 ? approvers : undefined,
      minApprovals
    };
  }

  private normalizeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return String(value).trim();
  }

  isProdEnvironment(envName: string, environments: EnvironmentManifest): boolean {
    const env = environments.environments.find(e => 
      e.name.toLowerCase() === envName.toLowerCase()
    );
    return env?.type === 'prod';
  }

  getEnvironmentForBranch(branch: string, environments: EnvironmentManifest): EnvironmentInfo | null {
    for (const env of environments.environments) {
      if (this.matchesBranchPattern(branch, env.branches)) {
        return env;
      }
    }
    return null;
  }

  private matchesBranchPattern(branch: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (this.matchGlob(branch, pattern)) {
        return true;
      }
    }
    return false;
  }

  private matchGlob(str: string, pattern: string): boolean {
    if (pattern === '*') return true;
    
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }

  isProdSecret(secretName: string, whitelist: SecretWhitelist): boolean {
    return whitelist.prodSecrets.includes(secretName) ||
           Object.values(whitelist.environmentSecrets).some(secrets => 
             secrets.includes(secretName)
           );
  }

  isSecretAllowedForEnvironment(secretName: string, environmentName: string, whitelist: SecretWhitelist): boolean {
    if (whitelist.nonProdSecrets.includes(secretName)) {
      return true;
    }

    const envSecrets = whitelist.environmentSecrets[environmentName];
    if (envSecrets?.includes(secretName)) {
      return true;
    }

    if (whitelist.prodSecrets.includes(secretName)) {
      return false;
    }

    return true;
  }

  requiresApproval(environment: string, triggerType: string, approvalRules: ApprovalRule): boolean {
    for (const rule of approvalRules.rules) {
      if (rule.environment === '*' || rule.environment === environment) {
        const triggerMatch = rule.triggerType.includes('*') || 
                            rule.triggerType.includes(triggerType);
        if (triggerMatch) {
          return rule.requiresApproval;
        }
      }
    }

    return true;
  }
}
