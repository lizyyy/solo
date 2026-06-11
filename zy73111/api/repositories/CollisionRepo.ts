import type { Collision, CollisionQuery, CollisionStatus } from '../../shared/types.js';
import { nowISO } from '../utils.js';
import { db } from '../db/index.js';

export class CollisionRepo {
  rowToCollision(row: any): Collision {
    return row as Collision;
  }

  list(query: CollisionQuery = {}): Collision[] {
    let rows = db.all('collision');
    if (query.floor) rows = rows.filter((r: any) => r.floor === query.floor);
    if (query.discipline) rows = rows.filter((r: any) => r.discipline === query.discipline);
    if (query.status) rows = rows.filter((r: any) => r.status === query.status);
    if (typeof query.isAbnormal === 'boolean')
      rows = rows.filter((r: any) => Boolean(r.isAbnormal) === query.isAbnormal);
    if (query.keyword) {
      const k = query.keyword.toLowerCase();
      rows = rows.filter((r: any) =>
        [r.id, r.remark, r.conclusion, r.abnormalReason]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(k)),
      );
    }
    return (rows as Collision[]).sort(
      (a, b) => +new Date(b.lastModifiedAt) - +new Date(a.lastModifiedAt),
    );
  }

  getById(id: string): Collision | null {
    const rows = db.all('collision');
    const r = (rows as any[]).find((r) => r.id === id);
    return r ? this.rowToCollision(r) : null;
  }

  insert(c: Collision): void {
    db.insert('collision', structuredClone(c));
  }

  patch(
    id: string,
    patch: {
      remark?: string;
      status?: CollisionStatus;
      conclusion?: string;
      isAbnormal?: boolean;
      abnormalReason?: string | null;
      lastModifiedBy?: string;
      lastModifiedByName?: string;
      lastModifiedAt?: string;
      version: number;
    },
  ): void {
    const p: Record<string, any> = {};
    if (typeof patch.remark === 'string') p.remark = patch.remark;
    if (patch.status) p.status = patch.status;
    if (typeof patch.conclusion === 'string') p.conclusion = patch.conclusion;
    if (typeof patch.isAbnormal === 'boolean') p.isAbnormal = patch.isAbnormal;
    if (Object.prototype.hasOwnProperty.call(patch, 'abnormalReason'))
      p.abnormalReason = patch.abnormalReason ?? undefined;
    if (patch.lastModifiedBy) p.lastModifiedBy = patch.lastModifiedBy;
    if (patch.lastModifiedByName) p.lastModifiedByName = patch.lastModifiedByName;
    p.lastModifiedAt = patch.lastModifiedAt ?? nowISO();
    p.version = patch.version;
    db.update('collision', 'id', id, p);
  }
}
