import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import type { ParameterVersion, VersionStatus } from '../../shared/types';

export class VersionRepository {
  create(
    versionNo: string,
    weightBatchId: string,
    hasGap: boolean,
    createdBy: string
  ): ParameterVersion {
    const id = uuidv4();
    const status: VersionStatus = hasGap ? 'pending_review' : 'draft';
    const stmt = db.prepare(`
      INSERT INTO parameter_version (id, version_no, status, weight_batch_id, has_gap, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, versionNo, status, weightBatchId, hasGap ? 1 : 0, createdBy);
    return this.findById(id) as ParameterVersion;
  }

  findById(id: string): ParameterVersion | null {
    const stmt = db.prepare('SELECT * FROM parameter_version WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapToModel(row) : null;
  }

  findAll(): ParameterVersion[] {
    const stmt = db.prepare('SELECT * FROM parameter_version ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapToModel(row));
  }

  findLatest(): ParameterVersion | null {
    const stmt = db.prepare('SELECT * FROM parameter_version ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get() as any;
    return row ? this.mapToModel(row) : null;
  }

  publish(id: string): ParameterVersion | null {
    const stmt = db.prepare(`
      UPDATE parameter_version 
      SET status = 'published', published_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(id);
    return this.findById(id);
  }

  updateStatus(id: string, status: VersionStatus): ParameterVersion | null {
    const stmt = db.prepare(`
      UPDATE parameter_version 
      SET status = ?
      WHERE id = ?
    `);
    stmt.run(status, id);
    return this.findById(id);
  }

  private mapToModel(row: any): ParameterVersion {
    return {
      id: row.id,
      versionNo: row.version_no,
      status: row.status as VersionStatus,
      weightBatchId: row.weight_batch_id,
      hasGap: row.has_gap === 1,
      createdBy: row.created_by,
      createdAt: row.created_at,
      publishedAt: row.published_at,
    };
  }
}

export const versionRepository = new VersionRepository();
