// 字段归一化引擎
import type { MaterialItem } from '@/types';
import { fieldMappings, lockedFieldNames } from '@/data/mappings/fieldMappings';

interface NormalizeResult {
  normalized: Partial<MaterialItem>;
  originalFields: Record<string, unknown>;
  matchedMap: Record<string, string>;
}

// 标准化 key：去空格 + 转小写
function normalizeKey(key: string): string {
  return key.replace(/\s+/g, '').toLowerCase();
}

// 构建反向索引：同义名 -> 标准字段名
function buildReverseIndex(): Map<string, string> {
  const reverseMap = new Map<string, string>();
  for (const [standardField, synonyms] of Object.entries(fieldMappings)) {
    for (const syn of synonyms) {
      reverseMap.set(normalizeKey(syn), standardField);
    }
    reverseMap.set(normalizeKey(standardField), standardField);
  }
  return reverseMap;
}

const reverseIndex = buildReverseIndex();

// 深度克隆对象
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map((item) => deepClone(item)) as unknown as T;
  if (obj instanceof Object) {
    const cloned = {} as Record<string, unknown>;
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
    return cloned as T;
  }
  return obj;
}

/**
 * 将原始数据对象的字段归一化为标准字段
 * - 对每个原始字段 key 做包含匹配（大小写不敏感 + 去空格）
 * - source 和 processingStatus 一旦识别则加入 lockedFields 标记，不可被覆盖
 * - 所有原始字段深拷贝到 originalFields 防丢失
 */
export function normalizeFields(original: Record<string, unknown>): NormalizeResult {
  const normalized: Partial<MaterialItem> = {};
  const matchedMap: Record<string, string> = {};
  const lockedFields: ('source' | 'processingStatus')[] = [];

  // 深拷贝原始字段，防止引用丢失
  const originalFields = deepClone(original);

  // 遍历原始字段，逐个匹配
  for (const [origKey, origValue] of Object.entries(original)) {
    const normalizedOrigKey = normalizeKey(origKey);
    let matchedStandardField: string | null = null;

    // 精确匹配优先
    if (reverseIndex.has(normalizedOrigKey)) {
      matchedStandardField = reverseIndex.get(normalizedOrigKey)!;
    } else {
      // 包含匹配：遍历所有同义词，检查是否被原始 key 包含，或反之
      for (const [synKey, stdField] of reverseIndex.entries()) {
        if (normalizedOrigKey.includes(synKey) || synKey.includes(normalizedOrigKey)) {
          matchedStandardField = stdField;
          break;
        }
      }
    }

    // 匹配到标准字段
    if (matchedStandardField) {
      // 检查锁定字段：已锁定的不可覆盖
      const isLocked = lockedFieldNames.includes(matchedStandardField as 'source' | 'processingStatus');
      if (isLocked && lockedFields.includes(matchedStandardField as 'source' | 'processingStatus')) {
        continue;
      }

      // 如果是锁定字段，首次匹配时加入锁定列表
      if (isLocked && !lockedFields.includes(matchedStandardField as 'source' | 'processingStatus')) {
        lockedFields.push(matchedStandardField as 'source' | 'processingStatus');
      }

      (normalized as Record<string, unknown>)[matchedStandardField] = origValue;
      matchedMap[matchedStandardField] = origKey;
    }
  }

  // 写入锁定字段标记
  if (lockedFields.length > 0) {
    normalized.lockedFields = lockedFields;
  }

  return {
    normalized,
    originalFields,
    matchedMap,
  };
}
