import * as yaml from 'js-yaml';
import { ExpansionContext, ExpansionResult, AnchorInfo, MergeKeyInfo, OverrideInfo } from './types';

function createContext(): ExpansionContext {
  return {
    anchors: new Map(),
    mergeKeys: [],
    overrides: [],
    visitedPaths: new Set(),
    currentPath: '',
    cycleDetection: new Set(),
  };
}

function pathJoin(base: string, key: string | number): string {
  if (!base) return String(key);
  if (typeof key === 'number') return `${base}[${key}]`;
  return `${base}.${key}`;
}

function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

function trackMergeKey(
  ctx: ExpansionContext,
  path: string,
  sources: string[],
  mergedKeys: string[]
): void {
  ctx.mergeKeys.push({
    path,
    sources,
    mergedKeys,
  });
}

function trackOverride(
  ctx: ExpansionContext,
  path: string,
  oldValue: any,
  newValue: any,
  source: string,
  order: number
): void {
  ctx.overrides.push({
    path,
    oldValue: deepClone(oldValue),
    newValue: deepClone(newValue),
    source,
    order,
  });
}

export function expandYaml(content: string, envOverrides?: string[]): ExpansionResult {
  const ctx = createContext();
  const warnings: string[] = [];
  const errors: string[] = [];

  let original: any;
  try {
    original = yaml.load(content);
  } catch (e) {
    errors.push(`YAML 解析失败: ${(e as Error).message}`);
    return {
      expanded: null,
      original: null,
      anchors: [],
      mergeKeys: [],
      overrides: [],
      warnings,
      errors,
      cycleDetected: false,
    };
  }

  const expanded = deepClone(original);

  function expandValue(obj: any, path: string, visited: Set<string>): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    const pathKey = path;
    if (visited.has(pathKey)) {
      warnings.push(`检测到循环引用: ${path}`);
      return { __cycle__: path };
    }
    visited.add(pathKey);

    try {
      if (Array.isArray(obj)) {
        return obj.map((item, i) => expandValue(item, pathJoin(path, i), new Set(visited)));
      }

      const result: Record<string, any> = {};
      const mergeItems: any[] = [];

      for (const [key, value] of Object.entries(obj)) {
        if (key === '<<' || key === '<<:') {
          mergeItems.push(value);
          continue;
        }

        const keyPath = pathJoin(path, key);
        result[key] = expandValue(value, keyPath, new Set(visited));
      }

      for (const mergeItem of mergeItems) {
        const sources = Array.isArray(mergeItem) ? mergeItem : [mergeItem];
        const sourceNames: string[] = [];
        const mergedKeys: string[] = [];

        for (const source of sources) {
          const expandedSource = expandValue(source, `${path}.<<`, new Set(visited));

          if (expandedSource && typeof expandedSource === 'object') {
            for (const [sKey, sValue] of Object.entries(expandedSource)) {
              if (!Object.prototype.hasOwnProperty.call(result, sKey)) {
                result[sKey] = sValue;
                mergedKeys.push(sKey);
              }
            }
          }
        }

        if (mergedKeys.length > 0) {
          trackMergeKey(ctx, path, sourceNames, mergedKeys);
        }
      }

      return result;
    } finally {
      visited.delete(pathKey);
    }
  }

  const finalExpanded = expandValue(expanded, '', new Set());

  let overrideOrder = 0;
  if (envOverrides && envOverrides.length > 0) {
    for (const envFile of envOverrides) {
      try {
        const envContent = require('fs').readFileSync(envFile, 'utf8');
        const envData = yaml.load(envContent);
        if (envData && typeof envData === 'object') {
          applyOverride(finalExpanded, envData, '', ctx, envFile, overrideOrder++);
        }
      } catch (e) {
        errors.push(`环境覆盖文件 ${envFile} 加载失败: ${(e as Error).message}`);
      }
    }
  }

  return {
    expanded: finalExpanded,
    original,
    anchors: Array.from(ctx.anchors.values()),
    mergeKeys: ctx.mergeKeys,
    overrides: ctx.overrides,
    warnings,
    errors,
    cycleDetected: warnings.some(w => w.includes('循环引用')),
  };
}

function applyOverride(
  target: any,
  override: any,
  path: string,
  ctx: ExpansionContext,
  source: string,
  order: number
): void {
  if (!override || typeof override !== 'object') return;

  for (const [key, value] of Object.entries(override)) {
    const keyPath = pathJoin(path, key);

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      applyOverride(target[key], value, keyPath, ctx, source, order);
    } else {
      const oldValue = target[key];
      target[key] = deepClone(value);
      trackOverride(ctx, keyPath, oldValue, value, source, order);
    }
  }
}

export function getValueByKeyPath(obj: any, keyPath: string): { value: any; found: boolean } {
  if (!keyPath) return { value: obj, found: true };

  const parts = keyPath.split('.').filter(p => p);
  let current = obj;

  for (const part of parts) {
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const arrKey = arrayMatch[1];
      const arrIndex = parseInt(arrayMatch[2], 10);
      if (!current[arrKey] || !Array.isArray(current[arrKey]) || arrIndex >= current[arrKey].length) {
        return { value: undefined, found: false };
      }
      current = current[arrKey][arrIndex];
    } else {
      if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(current, part)) {
        return { value: undefined, found: false };
      }
      current = current[part];
    }
  }

  return { value: current, found: true };
}

export function toYamlString(obj: any): string {
  return yaml.dump(obj, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}
