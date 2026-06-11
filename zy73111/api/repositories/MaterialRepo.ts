import type { Material, MaterialType } from '../../shared/types.js';
import { materialTypeLabel } from '../utils.js';
import { db } from '../db/index.js';

export class MaterialRepo {
  rowToMaterial(row: any, isModified: boolean): Material {
    return {
      ...row,
      typeLabel: materialTypeLabel(row.type),
      isModifiedSinceLast: isModified,
    };
  }

  listByCollision(collisionId: string): Material[] {
    const rows = (db.all('material') as any[]).filter((r) => r.collisionId === collisionId);
    const byType = new Map<string, any[]>();
    for (const r of rows) {
      if (!byType.has(r.type)) byType.set(r.type, []);
      byType.get(r.type)!.push(r);
    }
    const modifiedSet = new Set<string>();
    for (const list of byType.values()) {
      list.sort((a, b) => b.version - a.version);
      for (let i = 0; i < list.length - 1; i++) {
        if (list[i].md5 !== list[i + 1].md5) modifiedSet.add(list[i].id);
      }
    }
    return rows
      .map((r) => this.rowToMaterial(r, modifiedSet.has(r.id)))
      .sort(
        (a, b) =>
          a.type.localeCompare(b.type) ||
          b.version - a.version ||
          +new Date(b.uploadedAt) - +new Date(a.uploadedAt),
      );
  }

  getLatestByType(collisionId: string, type: MaterialType): Material | null {
    const list = (db.all('material') as any[]).filter(
      (r) => r.collisionId === collisionId && r.type === type,
    );
    if (!list.length) return null;
    list.sort((a, b) => b.version - a.version);
    return this.rowToMaterial(list[0], false);
  }

  insert(m: Omit<Material, 'typeLabel' | 'isModifiedSinceLast'>): void {
    db.insert('material', structuredClone(m));
  }

  nextVersion(collisionId: string, type: MaterialType): number {
    const list = (db.all('material') as any[]).filter(
      (r) => r.collisionId === collisionId && r.type === type,
    );
    const maxV = list.reduce((m, r) => Math.max(m, r.version || 0), 0);
    return maxV + 1;
  }

  getPreviousId(collisionId: string, type: MaterialType): string | undefined {
    const list = (db.all('material') as any[]).filter(
      (r) => r.collisionId === collisionId && r.type === type,
    );
    if (!list.length) return undefined;
    list.sort((a, b) => b.version - a.version);
    return list[0].id;
  }
}
