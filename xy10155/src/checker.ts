import { Storage } from './storage';
import { RiskRule, RiskIssue, EnvConfig } from './types';

export class Checker {
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  async runChecks(): Promise<RiskIssue[]> {
    const rules = await this.storage.getRules();
    const environments = await this.storage.listEnvironments();
    const issues: RiskIssue[] = [];

    const envDataMap: Record<string, EnvConfig> = {};
    for (const env of environments) {
      envDataMap[env.name] = await this.storage.getEnvData(env.name);
    }

    for (const rule of rules) {
      const ruleIssues = await this.checkRule(rule, envDataMap, environments.map(e => e.name));
      issues.push(...ruleIssues);
    }

    return issues.sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private async checkRule(
    rule: RiskRule,
    envDataMap: Record<string, EnvConfig>,
    allEnvs: string[]
  ): Promise<RiskIssue[]> {
    const issues: RiskIssue[] = [];

    switch (rule.type) {
      case 'value-mismatch':
        issues.push(...this.checkValueMismatch(rule, envDataMap));
        break;
      case 'missing-key':
        issues.push(...this.checkMissingKey(rule, envDataMap, allEnvs));
        break;
      case 'extra-key':
        issues.push(...this.checkExtraKey(rule, envDataMap, allEnvs));
        break;
      case 'critical-key':
        issues.push(...this.checkCriticalKey(rule, envDataMap, allEnvs));
        break;
    }

    return issues;
  }

  private checkValueMismatch(
    rule: RiskRule,
    envDataMap: Record<string, EnvConfig>
  ): RiskIssue[] {
    const issues: RiskIssue[] = [];
    const targetEnvs = rule.config.environments || Object.keys(envDataMap);
    const keyPattern = rule.config.keyPattern ? new RegExp(rule.config.keyPattern) : null;
    const expectedValue = rule.config.expectedValue;

    for (const env of targetEnvs) {
      const config = envDataMap[env];
      if (!config) continue;

      for (const key of Object.keys(config)) {
        if (keyPattern && !keyPattern.test(key)) continue;

        const value = String(config[key]);
        if (expectedValue !== undefined && value !== expectedValue) {
          issues.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `环境 "${env}" 的配置项 "${key}" 值为 "${value}"，但期望为 "${expectedValue}"`,
            environment: env,
            key,
            details: { actual: value, expected: expectedValue }
          });
        }
      }
    }

    return issues;
  }

  private checkMissingKey(
    rule: RiskRule,
    envDataMap: Record<string, EnvConfig>,
    allEnvs: string[]
  ): RiskIssue[] {
    const issues: RiskIssue[] = [];
    const mustExist = rule.config.mustExist || [];

    for (const key of mustExist) {
      const missingEnvs: string[] = [];
      for (const env of allEnvs) {
        const config = envDataMap[env];
        if (!config || config[key] === undefined) {
          missingEnvs.push(env);
        }
      }

      if (missingEnvs.length > 0) {
        issues.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: `关键配置项 "${key}" 在以下环境中缺失: ${missingEnvs.join(', ')}`,
          affectedEnvironments: missingEnvs,
          key,
          details: { missingEnvs }
        });
      }
    }

    return issues;
  }

  private checkExtraKey(
    rule: RiskRule,
    envDataMap: Record<string, EnvConfig>,
    allEnvs: string[]
  ): RiskIssue[] {
    const issues: RiskIssue[] = [];
    const allKeys = new Set<string>();

    for (const env of allEnvs) {
      const config = envDataMap[env];
      if (config) {
        for (const key of Object.keys(config)) {
          allKeys.add(key);
        }
      }
    }

    for (const key of allKeys) {
      const hasKeyEnvs: string[] = [];
      const missingEnvs: string[] = [];

      for (const env of allEnvs) {
        const config = envDataMap[env];
        if (config && config[key] !== undefined) {
          hasKeyEnvs.push(env);
        } else {
          missingEnvs.push(env);
        }
      }

      if (hasKeyEnvs.length > 0 && missingEnvs.length > 0) {
        issues.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: `配置项 "${key}" 在环境间不一致: 存在于 ${hasKeyEnvs.join(', ')}，缺失于 ${missingEnvs.join(', ')}`,
          key,
          affectedEnvironments: [...hasKeyEnvs, ...missingEnvs],
          details: { hasKeyEnvs, missingEnvs }
        });
      }
    }

    return issues;
  }

  private checkCriticalKey(
    rule: RiskRule,
    envDataMap: Record<string, EnvConfig>,
    allEnvs: string[]
  ): RiskIssue[] {
    const issues: RiskIssue[] = [];
    const mustExist = rule.config.mustExist || [];

    for (const key of mustExist) {
      const values: Record<string, string> = {};
      for (const env of allEnvs) {
        const config = envDataMap[env];
        if (config && config[key] !== undefined) {
          values[env] = String(config[key]);
        }
      }

      const uniqueValues = Array.from(new Set(Object.values(values)));
      if (uniqueValues.length > 1) {
        issues.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: `关键配置项 "${key}" 在不同环境中值不一致: ${JSON.stringify(values)}`,
          key,
          affectedEnvironments: Object.keys(values),
          details: { values, uniqueValues }
        });
      }
    }

    return issues;
  }
}
