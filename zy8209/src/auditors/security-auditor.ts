import { TerraformResource, IAMPolicy, Issue, IAMStatement } from '../types';
import { 
  generateId, 
  isWildcard, 
  normalizePrincipals, 
  isExternalAccount,
  isPublicPrincipal,
  arrayToString
} from '../utils';
import { getIamPolicyFromResource } from '../parsers/terraform';
import { extractStatements, getActionsFromStatement, getPrincipalsFromStatement } from '../parsers/iam';

export function detectWildcardPermissions(
  resources: TerraformResource[],
  iamPolicies: IAMPolicy[]
): Issue[] {
  const issues: Issue[] = [];
  
  for (const resource of resources) {
    const policies: IAMPolicy[] = [];
    
    const resourcePolicy = getIamPolicyFromResource(resource);
    if (resourcePolicy) {
      policies.push(resourcePolicy);
    }
    
    for (const policy of iamPolicies) {
      policies.push(policy);
    }
    
    for (const policy of policies) {
      const statements = extractStatements(policy);
      
      for (const statement of statements) {
        const actions = getActionsFromStatement(statement);
        const wildcardActions = actions.filter(action => isWildcard(action));
        
        if (wildcardActions.length > 0) {
          issues.push({
            id: generateId(),
            resource: resource.address,
            resource_type: resource.type,
            issue_type: 'wildcard_permission',
            severity: 'high',
            description: `发现通配符权限: ${wildcardActions.join(', ')}`,
            affected_actions: wildcardActions,
            is_exception: false
          });
        }
      }
    }
  }
  
  return issues;
}

export function detectCrossAccountTrust(
  resources: TerraformResource[],
  iamPolicies: IAMPolicy[]
): Issue[] {
  const issues: Issue[] = [];
  
  for (const resource of resources) {
    const policies: IAMPolicy[] = [];
    
    const resourcePolicy = getIamPolicyFromResource(resource);
    if (resourcePolicy) {
      policies.push(resourcePolicy);
    }
    
    for (const policy of iamPolicies) {
      policies.push(policy);
    }
    
    for (const policy of policies) {
      const statements = extractStatements(policy);
      
      for (const statement of statements) {
        const principals = getPrincipalsFromStatement(statement);
        
        const externalPrincipals = principals.filter(principal => {
          return isExternalAccount(principal) || 
                 (typeof principal === 'string' && principal.includes('arn:aws:iam::') && !principal.includes('arn:aws:iam::123456789012'));
        });
        
        if (externalPrincipals.length > 0) {
          issues.push({
            id: generateId(),
            resource: resource.address,
            resource_type: resource.type,
            issue_type: 'cross_account_trust',
            severity: 'critical',
            description: `发现跨账号信任关系，涉及外部账号: ${externalPrincipals.join(', ')}`,
            affected_principals: externalPrincipals,
            is_exception: false
          });
        }
      }
    }
  }
  
  return issues;
}

export function detectPublicBuckets(
  resources: TerraformResource[],
  iamPolicies: IAMPolicy[]
): Issue[] {
  const issues: Issue[] = [];
  
  for (const resource of resources) {
    const isBucket = resource.type === 'aws_s3_bucket' || 
                     resource.type === 'google_storage_bucket';
    
    const hasBucketPolicy = resource.type === 'aws_s3_bucket_policy' ||
                           resource.type === 'google_storage_bucket_iam_policy';
    
    if (!isBucket && !hasBucketPolicy) {
      continue;
    }
    
    const policies: IAMPolicy[] = [];
    
    const resourcePolicy = getIamPolicyFromResource(resource);
    if (resourcePolicy) {
      policies.push(resourcePolicy);
    }
    
    for (const policy of iamPolicies) {
      policies.push(policy);
    }
    
    for (const policy of policies) {
      const statements = extractStatements(policy);
      
      for (const statement of statements) {
        if (statement.Effect !== 'Allow') {
          continue;
        }
        
        const principals = statement.Principal;
        
        if (isPublicPrincipal(principals)) {
          const normalizedPrincipals = normalizePrincipals(principals);
          
          issues.push({
            id: generateId(),
            resource: resource.address,
            resource_type: resource.type,
            issue_type: 'public_bucket',
            severity: 'critical',
            description: `存储桶配置了公开访问权限，Principal 包含: ${normalizedPrincipals.join(', ')}`,
            affected_principals: normalizedPrincipals,
            is_exception: false
          });
        }
      }
    }
    
    if (isBucket) {
      const values = resource.values || {};
      
      if (values.acl === 'public-read' || values.acl === 'public-read-write') {
        issues.push({
          id: generateId(),
          resource: resource.address,
          resource_type: resource.type,
          issue_type: 'public_bucket',
          severity: 'critical',
          description: `存储桶 ACL 配置为公开: ${values.acl}`,
          is_exception: false
        });
      }
      
      if (values.public_access_block) {
        const block = values.public_access_block;
        if (!block.block_public_acls || 
            !block.block_public_policy || 
            !block.ignore_public_acls || 
            !block.restrict_public_buckets) {
          issues.push({
            id: generateId(),
            resource: resource.address,
            resource_type: resource.type,
            issue_type: 'public_bucket',
            severity: 'high',
            description: '存储桶公共访问阻止配置不完整',
            is_exception: false
          });
        }
      }
    }
  }
  
  return issues;
}

export function detectUnregisteredOwners(
  resources: TerraformResource[],
  ownerMap: Map<string, string>
): Issue[] {
  const issues: Issue[] = [];
  
  for (const resource of resources) {
    const key = `${resource.type}:${resource.name}`;
    
    if (!ownerMap.has(key)) {
      issues.push({
        id: generateId(),
        resource: resource.address,
        resource_type: resource.type,
        issue_type: 'unregistered_owner',
        severity: 'medium',
        description: `资源未在 owner 清单中登记: ${resource.type}:${resource.name}`,
        is_exception: false
      });
    }
  }
  
  return issues;
}

export function analyzeResourceChanges(
  resources: TerraformResource[],
  ownerMap: Map<string, string>,
  iamPolicies: IAMPolicy[]
): {
  totalResources: number;
  highRiskCount: number;
  securityIssues: Issue[];
} {
  const issues: Issue[] = [
    ...detectWildcardPermissions(resources, iamPolicies),
    ...detectCrossAccountTrust(resources, iamPolicies),
    ...detectPublicBuckets(resources, iamPolicies),
    ...detectUnregisteredOwners(resources, ownerMap),
  ];
  
  const highRiskCount = issues.filter(i => 
    i.severity === 'critical' || i.severity === 'high'
  ).length;
  
  return {
    totalResources: resources.length,
    highRiskCount,
    securityIssues: issues
  };
}
