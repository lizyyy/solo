export function generateId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

export function generateAssetCode(category: string, sequence: number): string {
  const prefix = category.substring(0, 3).toUpperCase();
  const seqStr = String(sequence).padStart(4, '0');
  return `${prefix}-${seqStr}`;
}
