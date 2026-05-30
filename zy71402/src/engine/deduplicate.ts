import { diff } from 'deep-object-diff';
import type { Material, UpdateDetectionResult, MaterialType } from '../types';
import { calculateDataHash } from '../utils/hash';

function getKeyFieldsForType(type: MaterialType): string[] {
  switch (type) {
    case 'product_terms':
      return ['productCode', 'underlyingCode'];
    case 'customer_position':
      return ['productCode', 'customerId', 'startDate'];
    case 'underlying_price':
      return ['underlyingCode', 'startDate', 'endDate'];
    default:
      return [];
  }
}

function extractKeyData(material: Material): Record<string, any> {
  const keyFields = getKeyFieldsForType(material.type);
  const keyData: Record<string, any> = { type: material.type };
  
  for (const field of keyFields) {
    if (material.content[field] !== undefined) {
      keyData[field] = material.content[field];
    }
  }
  
  return keyData;
}

function getChangeDescription(path: string, oldVal: any, newVal: any): string {
  const fieldName = path.split('.').pop() || path;
  if (oldVal === undefined) {
    return `新增字段 "${fieldName}": ${newVal}`;
  }
  if (newVal === undefined) {
    return `删除字段 "${fieldName}": ${oldVal}`;
  }
  return `字段 "${fieldName}" 变更: ${oldVal} → ${newVal}`;
}

function flattenDiff(
  diffObj: Record<string, any>,
  prefix: string = ''
): { path: string; oldVal: any; newVal: any }[] {
  const results: { path: string; oldVal: any; newVal: any }[] = [];
  
  for (const [key, value] of Object.entries(diffObj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('oldValue' in value && 'newValue' in value) {
        results.push({
          path: currentPath,
          oldVal: value.oldValue,
          newVal: value.newValue,
        });
      } else {
        results.push(...flattenDiff(value, currentPath));
      }
    } else {
      results.push({
        path: currentPath,
        oldVal: undefined,
        newVal: value,
      });
    }
  }
  
  return results;
}

export function detectMaterialUpdate(
  newMaterial: Material,
  existingMaterials: Material[]
): UpdateDetectionResult {
  const sameTypeMaterials = existingMaterials.filter(m => m.type === newMaterial.type);
  
  if (sameTypeMaterials.length === 0) {
    return {
      status: 'new',
      changes: ['新增材料'],
    };
  }
  
  const newKeyData = extractKeyData(newMaterial);
  const newKeyHash = calculateDataHash(newKeyData);
  
  for (const existing of sameTypeMaterials) {
    const existingKeyData = extractKeyData(existing);
    const existingKeyHash = calculateDataHash(existingKeyData);
    
    if (newKeyHash === existingKeyHash) {
      if (newMaterial.dataHash === existing.dataHash) {
        return {
          status: 'duplicate',
          existingMaterialId: existing.id,
          changes: ['数据完全一致，重复提交'],
        };
      }
      
      const diffResult = diff(existing.content, newMaterial.content);
      const flattened = flattenDiff(diffResult);
      
      if (flattened.length === 0) {
        return {
          status: 'duplicate',
          existingMaterialId: existing.id,
          changes: ['数据完全一致，重复提交'],
        };
      }
      
      const changes = flattened.map(f => 
        getChangeDescription(f.path, f.oldVal, f.newVal)
      );
      
      return {
        status: 'updated',
        existingMaterialId: existing.id,
        diff: diffResult,
        changes,
      };
    }
  }
  
  return {
    status: 'supplementary',
    changes: ['补充材料，与现有材料关键字段不同'],
  };
}

export function compareMaterials(
  material1: Material,
  material2: Material
): { isSame: boolean; changes: string[]; diff: Record<string, any> } {
  const diffResult = diff(material1.content, material2.content);
  const flattened = flattenDiff(diffResult);
  
  const changes = flattened.map(f => 
    getChangeDescription(f.path, f.oldVal, f.newVal)
  );
  
  return {
    isSame: material1.dataHash === material2.dataHash,
    changes,
    diff: diffResult,
  };
}
