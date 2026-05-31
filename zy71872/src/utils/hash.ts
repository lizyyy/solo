import SHA256 from 'crypto-js/sha256';

export function computeHash(data: unknown): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return SHA256(str).toString();
}

export function validateHash(data: unknown, expectedHash: string): boolean {
  return computeHash(data) === expectedHash;
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
