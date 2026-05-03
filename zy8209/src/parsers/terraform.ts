import * as fs from 'fs';
import { TerraformPlan, TerraformResource } from '../types';

export function parseTerraformPlan(filePath: string): TerraformPlan {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const plan = JSON.parse(content) as TerraformPlan;
    
    if (!plan.format_version) {
      throw new Error('无效的 Terraform plan 格式: 缺少 format_version 字段');
    }
    
    return plan;
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new Error(`Terraform plan JSON 解析失败: ${error.message}`);
    }
    throw error;
  }
}

export function getNewResources(plan: TerraformPlan): TerraformResource[] {
  const resources: TerraformResource[] = [];
  
  if (plan.resource_changes) {
    for (const change of plan.resource_changes) {
      const actions = change.change.actions;
      
      if (actions.includes('create') && !actions.includes('update') && !actions.includes('delete')) {
        const values = change.change.after || {};
        resources.push({
          address: change.address,
          type: change.type,
          name: change.name,
          provider_name: '',
          values: values
        });
      }
    }
  }
  
  if (plan.planned_values?.root_module?.resources) {
    const existingAddresses = new Set(resources.map(r => r.address));
    
    for (const resource of plan.planned_values.root_module.resources) {
      if (!existingAddresses.has(resource.address)) {
        resources.push(resource);
      }
    }
  }
  
  if (plan.planned_values?.root_module?.child_modules) {
    const existingAddresses = new Set(resources.map(r => r.address));
    
    for (const childModule of plan.planned_values.root_module.child_modules) {
      if (childModule.resources) {
        for (const resource of childModule.resources) {
          if (!existingAddresses.has(resource.address)) {
            resources.push(resource);
          }
        }
      }
    }
  }
  
  return resources;
}

export function getModifiedResources(plan: TerraformPlan): TerraformResource[] {
  const resources: TerraformResource[] = [];
  
  if (plan.resource_changes) {
    for (const change of plan.resource_changes) {
      const actions = change.change.actions;
      
      if (actions.includes('update') || (actions.includes('create') && actions.includes('delete'))) {
        const values = change.change.after || {};
        resources.push({
          address: change.address,
          type: change.type,
          name: change.name,
          provider_name: '',
          values: values
        });
      }
    }
  }
  
  return resources;
}

export function extractResourceValues(resource: TerraformResource): Record<string, any> {
  return resource.values || {};
}

export function getResourceType(resource: TerraformResource): string {
  return resource.type;
}

export function getResourceName(resource: TerraformResource): string {
  return resource.name;
}

export function getResourceAddress(resource: TerraformResource): string {
  return resource.address;
}

export function hasS3BucketPolicy(resource: TerraformResource): boolean {
  const values = extractResourceValues(resource);
  return resource.type === 'aws_s3_bucket_policy' || 
         (resource.type === 'aws_s3_bucket' && values.policy);
}

export function getIamPolicyFromResource(resource: TerraformResource): any {
  const values = extractResourceValues(resource);
  
  if (resource.type === 'aws_iam_policy' && values.policy) {
    try {
      return typeof values.policy === 'string' ? JSON.parse(values.policy) : values.policy;
    } catch {
      return null;
    }
  }
  
  if (resource.type === 'aws_s3_bucket_policy' && values.policy) {
    try {
      return typeof values.policy === 'string' ? JSON.parse(values.policy) : values.policy;
    } catch {
      return null;
    }
  }
  
  if (resource.type === 'aws_s3_bucket' && values.policy) {
    try {
      return typeof values.policy === 'string' ? JSON.parse(values.policy) : values.policy;
    } catch {
      return null;
    }
  }
  
  return null;
}
