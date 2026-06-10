// ID生成工具与哈希函数

/**
 * FNV-1a 32位 哈希算法
 */
export function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return hash >>> 0;
}

/**
 * 生成唯一ID
 * @param prefix 可选前缀
 * @returns 拼接了随机串与时间戳的唯一ID
 */
export const genId = (prefix = ''): string => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36).slice(-4);
  return prefix + randomPart + timePart;
};

/**
 * 生成碰撞点去重哈希（供 mock 数据使用）
 */
export function genDeduplicationHash(materialIds: string[], quote: string): number {
  const sortedIds = [...materialIds].sort().join('|');
  const quoteSlice = quote.slice(0, 20);
  return fnv1aHash(`${sortedIds}|${quoteSlice}`);
}
