import type { Difference, DifferenceType, PresetParameters, Severity } from '@/types';

function isObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function determineSeverity(type: DifferenceType, field: string, baseValue: any, targetValue: any): Severity {
  if (type === 'null') {
    return 'high';
  }
  if (type === 'duplicate' || type === 'boundary') {
    return 'medium';
  }
  if (type === 'added' || type === 'removed') {
    return 'medium';
  }
  
  if (typeof baseValue === 'number' && typeof targetValue === 'number') {
    const diff = Math.abs(baseValue - targetValue);
    if (diff > 50) return 'high';
    if (diff > 20) return 'medium';
  }
  
  return 'low';
}

function createDifference(
  field: string,
  baseValue: any,
  targetValue: any,
  type: DifferenceType
): Difference {
  return {
    field,
    baseValue,
    targetValue,
    type,
    severity: determineSeverity(type, field, baseValue, targetValue),
  };
}

function findNullValues(obj: any, prefix: string = ''): Difference[] {
  const differences: Difference[] = [];
  
  if (obj === null || obj === undefined) {
    differences.push(createDifference(prefix || 'root', obj, null, 'null'));
    return differences;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const field = `${prefix}[${index}]`;
      if (item === null || item === undefined) {
        differences.push(createDifference(field, item, null, 'null'));
      } else if (isObject(item) || Array.isArray(item)) {
        differences.push(...findNullValues(item, field));
      }
    });
  } else if (isObject(obj)) {
    Object.entries(obj).forEach(([key, value]) => {
      const field = prefix ? `${prefix}.${key}` : key;
      if (value === null || value === undefined) {
        differences.push(createDifference(field, value, null, 'null'));
      } else if (isObject(value) || Array.isArray(value)) {
        differences.push(...findNullValues(value, field));
      }
    });
  }
  
  return differences;
}

function findDuplicates(arr: any[], prefix: string): Difference[] {
  const differences: Difference[] = [];
  const seen = new Map<string, number[]>();
  
  arr.forEach((item, index) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) {
      seen.get(key)!.push(index);
    } else {
      seen.set(key, [index]);
    }
  });
  
  seen.forEach((indices, key) => {
    if (indices.length > 1) {
      differences.push(createDifference(
        `${prefix}[${indices.join(',')}]`,
        key,
        key,
        'duplicate'
      ));
    }
  });
  
  return differences;
}

function findBoundaryValues(obj: any, prefix: string = ''): Difference[] {
  const differences: Difference[] = [];
  
  if (typeof obj === 'number') {
    if (obj === 0 || obj === 100 || obj >= 99.9 || obj <= 0.1) {
      differences.push(createDifference(prefix || 'root', obj, obj, 'boundary'));
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const field = `${prefix}[${index}]`;
      differences.push(...findBoundaryValues(item, field));
    });
  } else if (isObject(obj)) {
    Object.entries(obj).forEach(([key, value]) => {
      const field = prefix ? `${prefix}.${key}` : key;
      differences.push(...findBoundaryValues(value, field));
    });
  }
  
  return differences;
}

function deepCompare(
  baseObj: any,
  targetObj: any,
  prefix: string = ''
): Difference[] {
  const differences: Difference[] = [];
  
  if (baseObj === targetObj) {
    return differences;
  }
  
  if (baseObj === null || baseObj === undefined || targetObj === null || targetObj === undefined) {
    if (baseObj === null || baseObj === undefined) {
      differences.push(createDifference(prefix || 'root', baseObj, targetObj, 'added'));
    } else {
      differences.push(createDifference(prefix || 'root', baseObj, targetObj, 'removed'));
    }
    return differences;
  }
  
  if (Array.isArray(baseObj) && Array.isArray(targetObj)) {
    const maxLen = Math.max(baseObj.length, targetObj.length);
    for (let i = 0; i < maxLen; i++) {
      const field = prefix ? `${prefix}[${i}]` : `[${i}]`;
      if (i >= baseObj.length) {
        differences.push(createDifference(field, undefined, targetObj[i], 'added'));
      } else if (i >= targetObj.length) {
        differences.push(createDifference(field, baseObj[i], undefined, 'removed'));
      } else {
        differences.push(...deepCompare(baseObj[i], targetObj[i], field));
      }
    }
    return differences;
  }
  
  if (isObject(baseObj) && isObject(targetObj)) {
    const allKeys = new Set([...Object.keys(baseObj), ...Object.keys(targetObj)]);
    
    allKeys.forEach((key) => {
      const field = prefix ? `${prefix}.${key}` : key;
      if (!(key in baseObj)) {
        differences.push(createDifference(field, undefined, targetObj[key], 'added'));
      } else if (!(key in targetObj)) {
        differences.push(createDifference(field, baseObj[key], undefined, 'removed'));
      } else {
        differences.push(...deepCompare(baseObj[key], targetObj[key], field));
      }
    });
    return differences;
  }
  
  differences.push(createDifference(prefix || 'root', baseObj, targetObj, 'changed'));
  return differences;
}

export function comparePresets(
  baseParameters: PresetParameters,
  targetParameters: PresetParameters
): Difference[] {
  const differences: Difference[] = [];
  
  differences.push(...deepCompare(baseParameters, targetParameters));
  differences.push(...findNullValues(baseParameters, 'base'));
  differences.push(...findNullValues(targetParameters, 'target'));
  
  if (baseParameters.oscillators) {
    differences.push(...findDuplicates(baseParameters.oscillators, 'base.oscillators'));
  }
  if (targetParameters.oscillators) {
    differences.push(...findDuplicates(targetParameters.oscillators, 'target.oscillators'));
  }
  
  differences.push(...findBoundaryValues(baseParameters, 'base'));
  differences.push(...findBoundaryValues(targetParameters, 'target'));
  
  const uniqueDiffs = new Map<string, Difference>();
  differences.forEach((diff) => {
    const key = `${diff.field}-${diff.type}`;
    if (!uniqueDiffs.has(key)) {
      uniqueDiffs.set(key, diff);
    }
  });
  
  return Array.from(uniqueDiffs.values()).sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function groupDifferencesByType(differences: Difference[]): Record<DifferenceType, Difference[]> {
  const groups: Record<DifferenceType, Difference[]> = {
    changed: [],
    added: [],
    removed: [],
    null: [],
    duplicate: [],
    boundary: [],
  };
  
  differences.forEach((diff) => {
    groups[diff.type].push(diff);
  });
  
  return groups;
}

export function getDifferenceStats(differences: Difference[]): Record<Severity, number> {
  const stats: Record<Severity, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  
  differences.forEach((diff) => {
    stats[diff.severity]++;
  });
  
  return stats;
}
