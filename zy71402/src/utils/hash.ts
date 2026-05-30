import hash from 'object-hash';

export function calculateDataHash(data: any): string {
  return hash(data, {
    algorithm: 'sha1',
    encoding: 'hex',
    respectType: false,
    unorderedArrays: false,
    unorderedSets: false,
    unorderedObjects: false,
  });
}

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}
