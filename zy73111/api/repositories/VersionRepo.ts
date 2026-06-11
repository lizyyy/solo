import type { ChangeType, FieldDiff, VersionSnapshot } from '../../shared/types.js';
import { db } from '../db/index.js';

export class VersionRepo {
  rowToSnapshot(row: any): VersionSnapshot {
    return {
      ...row,
      fieldDiffs: (row.fieldDiffs ?? []) as FieldDiff[],
    };
  }

  listByCollision(collisionId: string): VersionSnapshot[] {
    const rows = (db.all('version_snapshot') as any[]).filter(
      (r) => r.collisionId === collisionId,
    );
    return rows
      .map((r) => this.rowToSnapshot(r))
      .sort((a, b) => b.version - a.version);
  }

  getByVersion(collisionId: string, version: number): VersionSnapshot | null {
    const r = (db.all('version_snapshot') as any[]).find(
      (r) => r.collisionId === collisionId && r.version === version,
    );
    return r ? this.rowToSnapshot(r) : null;
  }

  insert(s: VersionSnapshot): void {
    db.insert('version_snapshot', structuredClone(s));
  }

  nextVersion(collisionId: string): number {
    const list = (db.all('version_snapshot') as any[]).filter(
      (r) => r.collisionId === collisionId,
    );
    const maxV = list.reduce((m, r) => Math.max(m, r.version || 0), 0);
    return maxV + 1;
  }
}
