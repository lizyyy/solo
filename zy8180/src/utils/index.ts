export function parseAddress(address: string): bigint {
  const trimmed = address.trim().toLowerCase();
  
  if (trimmed.startsWith('0x')) {
    return BigInt(trimmed);
  }
  
  if (trimmed.includes('h') || trimmed.includes('H')) {
    const hexPart = trimmed.replace(/[hH]/g, '');
    return BigInt('0x' + hexPart);
  }
  
  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length > 1 && /[a-f]/i.test(trimmed)) {
    return BigInt('0x' + trimmed);
  }
  
  return BigInt(trimmed);
}

export function parseSize(sizeStr: string): bigint {
  const trimmed = sizeStr.trim().toLowerCase();
  const multipliers: Record<string, bigint> = {
    'k': 1024n,
    'kb': 1024n,
    'm': 1024n * 1024n,
    'mb': 1024n * 1024n,
    'g': 1024n * 1024n * 1024n,
    'gb': 1024n * 1024n * 1024n,
  };
  
  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (trimmed.endsWith(suffix)) {
      const numPart = trimmed.slice(0, -suffix.length).trim();
      return BigInt(numPart) * multiplier;
    }
  }
  
  return parseAddress(trimmed);
}

export function formatHex(value: bigint, prefix: boolean = true): string {
  const hex = value.toString(16).toUpperCase();
  return prefix ? `0x${hex}` : hex;
}

export function formatSize(value: bigint): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = Number(value);
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function isOverlap(start1: bigint, end1: bigint, start2: bigint, end2: bigint): boolean {
  return !(end1 <= start2 || end2 <= start1);
}

export function getOverlap(start1: bigint, end1: bigint, start2: bigint, end2: bigint): { start: bigint; end: bigint; size: bigint } | null {
  if (!isOverlap(start1, end1, start2, end2)) {
    return null;
  }
  
  const overlapStart = start1 > start2 ? start1 : start2;
  const overlapEnd = end1 < end2 ? end1 : end2;
  
  return {
    start: overlapStart,
    end: overlapEnd,
    size: overlapEnd - overlapStart
  };
}

export function generateId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(4, '0')}`;
}
