import type { Database } from 'better-sqlite3';
import type { Material, MaterialStatus, ImportBatch } from '../../shared/types.js';
import { generateId } from '../db/init.js';

export class MaterialRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  createImportBatch(file_name: string, imported_by: string): ImportBatch {
    const id = generateId();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO import_batch (id, batch_id, file_name, total_count, new_count, reused_count, suspected_count, imported_by, imported_at, created_at)
      VALUES (?, ?, ?, 0, 0, 0, 0, ?, ?, ?)
    `);
    stmt.run(id, id, file_name, imported_by, now, now);
    return this.getImportBatch(id)!;
  }

  updateImportBatchCounts(
    batch_id: string,
    total: number,
    reused: number,
    new_count: number,
    conflict: number
  ): void {
    const stmt = this.db.prepare(`
      UPDATE import_batch
      SET total_count = ?, reused_count = ?, new_count = ?, suspected_count = ?
      WHERE id = ?
    `);
    stmt.run(total, reused, new_count, conflict, batch_id);
  }

  getImportBatch(id: string): ImportBatch | null {
    const stmt = this.db.prepare('SELECT * FROM import_batch WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapImportBatch(row) : null;
  }

  findAllForDuplicateCheck(): Array<Pick<Material, 'id' | 'material_name' | 'isrc_code' | 'license_start_date'>> {
    const stmt = this.db.prepare('SELECT id, material_name, isrc_code, license_start_date FROM material');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      material_name: row.material_name,
      isrc_code: row.isrc_code,
      license_start_date: row.license_start_date
    }));
  }

  findById(id: string): Material | null {
    const stmt = this.db.prepare('SELECT * FROM material WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapMaterial(row) : null;
  }

  findAll(status?: MaterialStatus): Material[] {
    let sql = 'SELECT * FROM material';
    const params: string[] = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.mapMaterial(row));
  }

  findByBatchId(batch_id: string): Material[] {
    const stmt = this.db.prepare('SELECT * FROM material WHERE batch_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(batch_id) as any[];
    return rows.map(row => this.mapMaterial(row));
  }

  create(
    data: Omit<Material, 'id' | 'created_at' | 'updated_at'>
  ): Material {
    const id = generateId();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO material (
        id, material_name, isrc_code, composer, project_name,
        license_start_date, license_end_date, episode_count,
        license_fee, revenue_ratio, error_tolerance,
        status, batch_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.material_name,
      data.isrc_code,
      data.composer,
      data.project_name,
      data.license_start_date,
      data.license_end_date,
      data.episode_count,
      data.license_fee,
      data.revenue_ratio,
      data.error_tolerance,
      data.status,
      data.batch_id,
      now,
      now
    );
    return this.findById(id)!;
  }

  updateStatus(id: string, status: MaterialStatus): void {
    const stmt = this.db.prepare(`
      UPDATE material SET status = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(status, new Date().toISOString(), id);
  }

  updateField(id: string, field_name: string, value: string | number): void {
    const dbField = this.toSnakeCase(field_name);
    const stmt = this.db.prepare(`
      UPDATE material SET ${dbField} = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(value, new Date().toISOString(), id);
  }

  updateBaseFeeAndRoyalty(id: string, license_fee: number, revenue_ratio: number): void {
    const stmt = this.db.prepare(`
      UPDATE material SET license_fee = ?, revenue_ratio = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(license_fee, revenue_ratio, new Date().toISOString(), id);
  }

  countByStatus(): Record<MaterialStatus, number> {
    const stmt = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM material GROUP BY status
    `);
    const rows = stmt.all() as Array<{ status: string; count: number }>;
    const result: Record<string, number> = {
      pending: 0,
      normal: 0,
      conflict: 0,
      rework_pending: 0,
      completed: 0
    };
    for (const row of rows) {
      result[row.status] = row.count;
    }
    return result as Record<MaterialStatus, number>;
  }

  findAllBatches(limit: number = 50): ImportBatch[] {
    const stmt = this.db.prepare(`
      SELECT * FROM import_batch ORDER BY created_at DESC LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.mapImportBatch(row));
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  private mapMaterial(row: any): Material {
    return {
      id: row.id,
      material_name: row.material_name,
      isrc_code: row.isrc_code,
      composer: row.composer || '',
      project_name: row.project_name,
      license_start_date: row.license_start_date,
      license_end_date: row.license_end_date,
      episode_count: row.episode_count,
      license_fee: row.license_fee,
      revenue_ratio: row.revenue_ratio,
      error_tolerance: row.error_tolerance || '',
      status: row.status as MaterialStatus,
      batch_id: row.batch_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private mapImportBatch(row: any): ImportBatch {
    return {
      id: row.id,
      batch_id: row.batch_id,
      file_name: row.file_name,
      total_count: row.total_count,
      new_count: row.new_count,
      reused_count: row.reused_count,
      suspected_count: row.suspected_count,
      imported_by: row.imported_by,
      imported_at: row.imported_at,
      created_at: row.created_at
    };
  }
}
