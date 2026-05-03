import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { IAMPolicy, IAMStatement } from '../types';
import { normalizePrincipals } from '../utils';

export function parseIamPolicy(filePath: string): IAMPolicy[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const parsed = yaml.load(content) as any;
    
    const policies: IAMPolicy[] = [];
    
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const policy = validateAndNormalizePolicy(item);
        if (policy) {
          policies.push(policy);
        }
      }
    } else {
      const policy = validateAndNormalizePolicy(parsed);
      if (policy) {
        policies.push(policy);
      }
    }
    
    return policies;
  } catch (error: any) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`IAM 策略 YAML 解析失败: ${error.message}`);
    }
    throw error;
  }
}

function validateAndNormalizePolicy(policy: any): IAMPolicy | null {
  if (!policy) {
    return null;
  }

  if (!policy.Statement && !policy.statement) {
    console.warn('⚠️  警告: 策略缺少 Statement 字段');
    return null;
  }

  const statements = policy.Statement || policy.statement;
  
  if (!statements) {
    console.warn('⚠️  警告: 策略 Statement 为空');
    return null;
  }

  const normalizedStatements: IAMStatement[] = [];
  const statementList = Array.isArray(statements) ? statements : [statements];

  for (const stmt of statementList) {
    const normalizedStatement = normalizeStatement(stmt);
    if (normalizedStatement) {
      normalizedStatements.push(normalizedStatement);
    }
  }

  if (normalizedStatements.length === 0) {
    console.warn('⚠️  警告: 策略中没有有效的 Statement');
    return null;
  }

  return {
    Version: policy.Version || policy.version || '2012-10-17',
    Statement: normalizedStatements
  };
}

function normalizeStatement(stmt: any): IAMStatement | null {
  if (!stmt) {
    return null;
  }

  const effect = stmt.Effect || stmt.effect || 'Allow';
  const action = stmt.Action || stmt.action;
  const resource = stmt.Resource || stmt.resource;
  const principal = stmt.Principal || stmt.principal;
  const condition = stmt.Condition || stmt.condition;
  const sid = stmt.Sid || stmt.sid;

  if (!action) {
    console.warn('⚠️  警告: Statement 缺少 Action 字段，跳过');
    return null;
  }

  if (principal !== undefined && principal !== null) {
    const principals = normalizePrincipals(principal);
    const principalTypes = detectPrincipalTypes(principal);
    
    if (principalTypes.hasMultipleTypes) {
      console.warn(`⚠️  警告: Statement ${sid || '(无Sid)'} 中 Principal 类型混乱，包含: ${principalTypes.types.join(', ')}`);
    }
    
    if (principals.length === 0) {
      console.warn(`⚠️  警告: Statement ${sid || '(无Sid)'} 中 Principal 无法正确解析`);
    }
  }

  return {
    Sid: sid,
    Effect: effect,
    Action: action,
    Resource: resource,
    Principal: principal,
    Condition: condition
  };
}

function detectPrincipalTypes(principal: any): { types: string[]; hasMultipleTypes: boolean } {
  const types: string[] = [];

  if (typeof principal === 'string') {
    if (principal === '*') {
      types.push('Wildcard (*)');
    } else if (principal.startsWith('arn:aws:iam::')) {
      types.push('AWS ARN');
    } else if (principal.startsWith('arn:aws:sts::')) {
      types.push('STS ARN');
    } else {
      types.push('String');
    }
  } else if (Array.isArray(principal)) {
    for (const p of principal) {
      if (typeof p === 'string') {
        if (p === '*' && !types.includes('Wildcard (*)')) {
          types.push('Wildcard (*)');
        } else if (p.startsWith('arn:aws:iam::') && !types.includes('AWS ARN')) {
          types.push('AWS ARN');
        } else if (p.startsWith('arn:aws:sts::') && !types.includes('STS ARN')) {
          types.push('STS ARN');
        } else if (!types.includes('String')) {
          types.push('String');
        }
      }
    }
  } else if (typeof principal === 'object') {
    for (const key of Object.keys(principal)) {
      if (key === 'AWS' && !types.includes('AWS')) {
        types.push('AWS');
      } else if (key === 'Federated' && !types.includes('Federated')) {
        types.push('Federated');
      } else if (key === 'Service' && !types.includes('Service')) {
        types.push('Service');
      } else if (key === '*' && !types.includes('Wildcard (*)')) {
        types.push('Wildcard (*)');
      }
    }
  }

  return {
    types,
    hasMultipleTypes: types.length > 1
  };
}

export function extractStatements(policy: IAMPolicy): IAMStatement[] {
  const statements = policy.Statement;
  return Array.isArray(statements) ? statements : [statements];
}

export function getActionsFromStatement(statement: IAMStatement): string[] {
  const action = statement.Action;
  return Array.isArray(action) ? action : (action ? [action] : []);
}

export function getResourcesFromStatement(statement: IAMStatement): string[] {
  const resource = statement.Resource;
  return Array.isArray(resource) ? resource : (resource ? [resource] : []);
}

export function getPrincipalsFromStatement(statement: IAMStatement): string[] {
  return normalizePrincipals(statement.Principal);
}
