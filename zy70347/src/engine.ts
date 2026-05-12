import * as crypto from 'crypto';
import {
  FeatureFlag,
  Rule,
  UserAttributes,
  Environment,
  EvaluationResult,
  ExplainResult,
} from './types';
import * as store from './store';

function stableHash(key: string, seed: string = ''): number {
  const hash = crypto.createHash('sha256');
  hash.update(seed + key);
  const hex = hash.digest('hex');
  return parseInt(hex.substring(0, 12), 16);
}

function calculateBucket(userId: string, flagId: string): number {
  const hash = stableHash(userId, flagId);
  return (hash % 100) + 1;
}

function matchEnvironment(rule: Rule, environment: Environment): boolean {
  if (rule.environment === 'all') return true;
  return rule.environment === environment;
}

function matchWhitelist(rule: Rule, user: UserAttributes): boolean {
  if (!rule.whitelist || rule.whitelist.length === 0) return false;
  const identifiers = [
    user.userId,
    user.email,
    user.phone,
  ].filter(Boolean) as string[];
  return identifiers.some((id) => rule.whitelist!.includes(id));
}

function matchBlacklist(rule: Rule, user: UserAttributes): boolean {
  if (!rule.blacklist || rule.blacklist.length === 0) return false;
  const identifiers = [
    user.userId,
    user.email,
    user.phone,
  ].filter(Boolean) as string[];
  return identifiers.some((id) => rule.blacklist!.includes(id));
}

function matchAttributes(rule: Rule, user: UserAttributes): boolean {
  if (!rule.attributes) return true;
  
  for (const [key, condition] of Object.entries(rule.attributes)) {
    const userValue = user[key];
    
    if (condition.eq !== undefined) {
      if (userValue !== condition.eq) return false;
    }
    
    if (condition.neq !== undefined) {
      if (userValue === condition.neq) return false;
    }
    
    if (condition.in !== undefined) {
      if (!condition.in.includes(userValue)) return false;
    }
    
    if (condition.notIn !== undefined) {
      if (condition.notIn.includes(userValue)) return false;
    }
    
    if (condition.contains !== undefined) {
      if (typeof userValue !== 'string' || !userValue.includes(condition.contains)) {
        return false;
      }
    }
  }
  
  return true;
}

function matchPercentage(
  rule: Rule,
  user: UserAttributes,
  flagId: string
): { matches: boolean; bucket: number } {
  if (rule.percentage === undefined || rule.percentage >= 100) {
    return { matches: true, bucket: 100 };
  }
  
  if (rule.percentage <= 0) {
    return { matches: false, bucket: calculateBucket(user.userId, flagId) };
  }
  
  const bucket = calculateBucket(user.userId, flagId);
  return { matches: bucket <= rule.percentage, bucket };
}

function evaluateRule(
  rule: Rule,
  user: UserAttributes,
  environment: Environment,
  flagId: string
): { matches: boolean; reason: string; bucket?: number; percentage?: number } {
  if (!rule.enabled) {
    return { matches: false, reason: '规则未启用' };
  }
  
  if (!matchEnvironment(rule, environment)) {
    return { matches: false, reason: '环境不匹配' };
  }
  
  if (matchBlacklist(rule, user)) {
    return { matches: false, reason: '命中黑名单' };
  }
  
  if (matchWhitelist(rule, user)) {
    return { matches: true, reason: '命中白名单' };
  }
  
  if (!matchAttributes(rule, user)) {
    return { matches: false, reason: '用户属性不匹配' };
  }
  
  const percentageResult = matchPercentage(rule, user, flagId);
  if (!percentageResult.matches) {
    return {
      matches: false,
      reason: `分桶未命中 (bucket=${percentageResult.bucket}, percentage=${rule.percentage})`,
      bucket: percentageResult.bucket,
      percentage: rule.percentage,
    };
  }
  
  return {
    matches: true,
    reason: '所有条件满足',
    bucket: percentageResult.bucket,
    percentage: rule.percentage,
  };
}

export function evaluate(
  flagId: string,
  user: UserAttributes,
  environment: Environment
): EvaluationResult {
  const flag = store.getFlag(flagId);
  
  if (!flag) {
    throw new Error(`Flag ${flagId} not found`);
  }
  
  const version = store.getLatestVersion(flagId);
  const path: string[] = [];
  const envOverride = store.getEnvOverride(flagId, environment);
  
  const computedFields: EvaluationResult['computedFields'] = {
    userId: user.userId,
    environment,
  };

  path.push('开始评估');

  if (flag.globallyDisabled) {
    path.push('检查全局开关');
    path.push('→ 全局关闭');
    return {
      enabled: false,
      flag,
      reason: '全局关闭',
      path,
      computedFields,
      version,
    };
  }

  path.push('检查全局开关 → 通过');

  if (envOverride) {
    path.push('检查环境覆盖');
    path.push(`→ 找到环境覆盖 (enabled=${envOverride.enabled})`);
    
    if (envOverride.enabled && envOverride.percentage !== undefined) {
      const bucket = calculateBucket(user.userId, flagId);
      computedFields.bucket = bucket;
      computedFields.percentage = envOverride.percentage;
      
      if (bucket <= envOverride.percentage) {
        path.push(`→ 分桶命中 (bucket=${bucket}, percentage=${envOverride.percentage})`);
        return {
          enabled: true,
          flag,
          reason: '环境覆盖 + 分桶命中',
          path,
          computedFields,
          version,
        };
      } else {
        path.push(`→ 分桶未命中 (bucket=${bucket}, percentage=${envOverride.percentage})`);
        return {
          enabled: false,
          flag,
          reason: '环境覆盖但分桶未命中',
          path,
          computedFields,
          version,
        };
      }
    }
    
    return {
      enabled: envOverride.enabled,
      flag,
      reason: `环境覆盖 (enabled=${envOverride.enabled})`,
      path,
      computedFields,
      version,
    };
  }

  path.push('检查环境覆盖 → 无');
  path.push('开始匹配规则');

  for (const rule of flag.rules) {
    path.push(`  检查规则: ${rule.name}`);
    const result = evaluateRule(rule, user, environment, flagId);
    path.push(`    → ${result.reason}`);
    
    if (result.matches) {
      computedFields.bucket = result.bucket;
      computedFields.percentage = result.percentage;
      return {
        enabled: true,
        flag,
        matchedRule: rule,
        reason: result.reason,
        path,
        computedFields,
        version,
      };
    }
  }

  path.push('→ 无匹配规则');
  
  return {
    enabled: false,
    flag,
    reason: '无匹配规则',
    path,
    computedFields,
    version,
  };
}

export function explain(
  flagId: string,
  user: UserAttributes,
  environment: Environment
): ExplainResult {
  const evaluation = evaluate(flagId, user, environment);
  const flag = evaluation.flag;
  const envOverride = store.getEnvOverride(flagId, environment);

  return {
    ...evaluation,
    allRules: flag.rules,
    environment,
    globalDisabled: flag.globallyDisabled,
    envOverride,
  };
}

export function debugBucket(
  userId: string,
  flagId: string,
  percentage?: number
): { bucket: number; willHit: boolean } {
  const bucket = calculateBucket(userId, flagId);
  const willHit = percentage === undefined ? true : bucket <= percentage;
  return { bucket, willHit };
}
