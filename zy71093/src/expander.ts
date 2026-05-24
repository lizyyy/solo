import * as yaml from 'js-yaml';
import { ExpansionContext, ExpansionResult, AnchorInfo, MergeKeyInfo, OverrideInfo } from './types';

interface MergeKeyLocation {
  line: number;
  path: string;
  sources: string[];
}

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

function deepClone<T>(obj: T, visited: WeakMap<object, any> = new WeakMap()): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;

  if (visited.has(obj as object)) {
    return visited.get(obj as object);
  }

  if (obj instanceof Array) {
    const arrClone: any[] = [];
    visited.set(obj as object, arrClone);
    for (const item of obj) {
      arrClone.push(deepClone(item, visited));
    }
    return arrClone as unknown as T;
  }

  const cloned = {} as T;
  visited.set(obj as object, cloned);
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key], visited);
    }
  }
  return cloned;
}

function scanYamlStructure(content: string): {
  anchorDefs: Map<string, { line: number; path: string }>;
  aliasRefs: Array<{ name: string; line: number; path: string }>;
  mergeKeyLocations: MergeKeyLocation[];
} {
  const anchorDefs = new Map<string, { line: number; path: string }>();
  const aliasRefs: Array<{ name: string; line: number; path: string }> = [];
  const mergeKeyLocations: MergeKeyLocation[] = [];

  const lines = content.split('\n');
  const pathStack: Array<{ key: string; indent: number }> = [];
  let inSequence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indentMatch = line.match(/^(\s*)/);
    const currentIndent = indentMatch ? indentMatch[1].length : 0;

    while (pathStack.length > 0 && pathStack[pathStack.length - 1].indent >= currentIndent) {
      pathStack.pop();
    }

    const sequenceItemMatch = line.match(/^\s*-\s+/);
    if (sequenceItemMatch) {
      inSequence = true;
    }

    const keyMatch = line.match(/^\s*([^:\s\-][^:]*):\s*/);
    if (keyMatch) {
      const key = keyMatch[1];
      pathStack.push({ key, indent: currentIndent });
      inSequence = false;
    }

    const currentPath = pathStack.map(p => p.key).join('.');

    const anchorMatch = line.match(/&(\w+)/);
    if (anchorMatch) {
      const name = anchorMatch[1];
      anchorDefs.set(name, { line: lineNum, path: currentPath });
    }

    const aliasMatches = line.matchAll(/\*(\w+)/g);
    for (const match of aliasMatches) {
      aliasRefs.push({ name: match[1], line: lineNum, path: currentPath });
    }

    const mergeMatch = line.match(/<<:?\s*\[?([^\]]*)\]?/);
    if (mergeMatch) {
      const sourcesStr = mergeMatch[1] || '';
      const sources = sourcesStr
        .split(',')
        .map(s => s.trim().replace(/^\*/, ''))
        .filter(s => s);
      mergeKeyLocations.push({ line: lineNum, path: currentPath, sources });
    }
  }

  return { anchorDefs, aliasRefs, mergeKeyLocations };
}

function getValueAtPath(obj: any, path: string): any {
  if (!path) return obj;
  const parts = path.split('.').filter(p => p);
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function safeIsEqual(a: any, b: any, visited: WeakMap<object, Set<object>> = new WeakMap()): boolean {
  if (a === b) return true;

  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const aVisited = visited.get(a) || new Set();
  if (aVisited.has(b)) return true;
  aVisited.add(b);
  visited.set(a, aVisited);

  const bVisited = visited.get(b) || new Set();
  if (bVisited.has(a)) return true;
  bVisited.add(a);
  visited.set(b, bVisited);

  if (Array.isArray(a)) {
    if (a.length !== (b as any[]).length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!safeIsEqual(a[i], (b as any[])[i], visited)) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!safeIsEqual(a[key], b[key], visited)) return false;
  }

  return true;
}

function findMergedKeys(
  targetObj: any,
  sourceAnchors: Map<string, any>,
  mergeSources: string[]
): string[] {
  const mergedKeys: string[] = [];
  if (!targetObj || typeof targetObj !== 'object') return mergedKeys;

  for (const sourceName of mergeSources) {
    const sourceValue = sourceAnchors.get(sourceName);
    if (sourceValue && typeof sourceValue === 'object') {
      for (const key of Object.keys(sourceValue)) {
        if (Object.prototype.hasOwnProperty.call(targetObj, key)) {
          if (safeIsEqual(targetObj[key], sourceValue[key]) && !mergedKeys.includes(key)) {
            mergedKeys.push(key);
          }
        }
      }
    }
  }

  return mergedKeys;
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

  const { anchorDefs, aliasRefs, mergeKeyLocations } = scanYamlStructure(content);

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

  const anchorValues = new Map<string, any>();
  for (const [name, def] of anchorDefs.entries()) {
    const value = getValueAtPath(original, def.path);
    anchorValues.set(name, value);

    ctx.anchors.set(name, {
      name,
      path: def.path,
      value: deepClone(value),
      referencedBy: [],
      sourceType: 'anchor',
    });
  }

  for (const alias of aliasRefs) {
    const anchor = ctx.anchors.get(alias.name);
    if (anchor) {
      anchor.referencedBy.push(alias.path || `line:${alias.line}`);
    } else {
      ctx.anchors.set(alias.name, {
        name: alias.name,
        path: alias.path,
        value: null,
        referencedBy: [alias.path || `line:${alias.line}`],
        sourceType: 'alias',
      });
      warnings.push(`未定义的 anchor 引用: ${alias.name} (行 ${alias.line})`);
    }
  }

  for (const mk of mergeKeyLocations) {
    const targetPath = mk.path.replace(/\.<<$/, '');
    const targetObj = getValueAtPath(original, targetPath);
    const mergedKeys = findMergedKeys(targetObj, anchorValues, mk.sources);
    trackMergeKey(ctx, targetPath, mk.sources, mergedKeys);
  }

  const expanded = deepClone(original);

  function expandValue(
    obj: any,
    path: string,
    visitedObjects: WeakSet<object>,
    pathStack: string[]
  ): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (visitedObjects.has(obj)) {
      const cyclePath = pathStack.join(' → ');
      warnings.push(`检测到循环引用: ${cyclePath}`);
      return { __cycle_detected__: cyclePath };
    }

    visitedObjects.add(obj);
    pathStack.push(path);

    try {
      if (Array.isArray(obj)) {
        return obj.map((item, i) =>
          expandValue(item, pathJoin(path, i), visitedObjects, [...pathStack])
        );
      }

      const result: Record<string, any> = {};

      for (const [key, value] of Object.entries(obj)) {
        const keyPath = pathJoin(path, key);
        result[key] = expandValue(value, keyPath, visitedObjects, [...pathStack]);
      }

      return result;
    } finally {
      visitedObjects.delete(obj);
      pathStack.pop();
    }
  }

  const finalExpanded = expandValue(expanded, '', new WeakSet(), []);

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

function sanitizeForDump(obj: any, visited: WeakSet<object> = new WeakSet()): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (visited.has(obj)) {
    return '__cycle_detected__';
  }

  visited.add(obj);

  try {
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeForDump(item, visited));
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeForDump(value, visited);
    }
    return result;
  } finally {
    visited.delete(obj);
  }
}

export function toYamlString(obj: any): string {
  const sanitized = sanitizeForDump(obj);
  return yaml.dump(sanitized, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}
