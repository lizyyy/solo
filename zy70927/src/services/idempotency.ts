import CryptoJS from 'crypto-js';
import { getDatabase } from '../database';

function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((result: any, key) => {
        result[key] = sortObjectKeys(obj[key]);
        return result;
      }, {});
  }
  return obj;
}

export function calculateMaterialHash(materials: any[]): string {
  const sorted = JSON.stringify(sortObjectKeys(materials));
  return CryptoJS.SHA256(sorted).toString();
}

export async function findDuplicateBatch(hash: string): Promise<{ batchId: string; createdAt: string } | null> {
  const db = getDatabase();
  const row = await db.get(
    'SELECT batch_id, created_at FROM batches WHERE material_hash = ?',
    hash
  );
  if (!row) return null;
  return {
    batchId: row.batch_id,
    createdAt: row.created_at,
  };
}
