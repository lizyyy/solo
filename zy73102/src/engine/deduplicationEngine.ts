// 去重算法引擎
import type { CollisionPoint } from '@/types';

/**
 * FNV-1a 32位 哈希算法
 * 用于快速生成碰撞点的去重哈希值
 */
export function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis for 32-bit
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // FNV prime for 32-bit: 2^24 + 2^8 + 0x93 = 16777619
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  // 转为无符号 32 位整数
  return hash >>> 0;
}

interface DeduplicateResult {
  unique: CollisionPoint[];
  duplicateCount: number;
  duplicatesByHash: Record<number, CollisionPoint[]>;
}

// confidence 权重，用于比较保留哪条
const confidenceWeight: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * 对碰撞点数组进行去重
 * 去重 key：involvedMaterialIds 排序后 join('|') + originalQuote 前20字符 -> fnv1a 哈希
 * 同 hash 保留 confidence 最高的一条
 */
export function deduplicateCollisions(
  items: CollisionPoint[]
): DeduplicateResult {
  const hashGroups = new Map<number, CollisionPoint[]>();

  // 按哈希分组
  for (const item of items) {
    let hash: number;
    if (typeof item.deduplicationHash === 'number' && item.deduplicationHash !== 0) {
      hash = item.deduplicationHash;
    } else {
      // 重新计算哈希
      const sortedIds = [...item.involvedMaterialIds].sort().join('|');
      const quoteSlice = item.originalQuote ? item.originalQuote.slice(0, 20) : '';
      hash = fnv1aHash(`${sortedIds}|${quoteSlice}`);
    }

    if (!hashGroups.has(hash)) {
      hashGroups.set(hash, []);
    }
    hashGroups.get(hash)!.push(item);
  }

  const unique: CollisionPoint[] = [];
  const duplicatesByHash: Record<number, CollisionPoint[]> = {};
  let duplicateCount = 0;

  // 对每组选择 confidence 最高的一条
  for (const [hash, group] of hashGroups.entries()) {
    if (group.length === 1) {
      unique.push({ ...group[0], deduplicationHash: hash });
    } else {
      duplicatesByHash[hash] = group;
      duplicateCount += group.length - 1;

      // 按 confidence 权重降序排序，同权重按 originalQuote 长度降序
      const sorted = [...group].sort((a, b) => {
        const weightA = confidenceWeight[a.confidence] || 0;
        const weightB = confidenceWeight[b.confidence] || 0;
        if (weightB !== weightA) return weightB - weightA;
        return (b.originalQuote?.length || 0) - (a.originalQuote?.length || 0);
      });

      unique.push({ ...sorted[0], deduplicationHash: hash });
    }
  }

  return {
    unique,
    duplicateCount,
    duplicatesByHash,
  };
}
