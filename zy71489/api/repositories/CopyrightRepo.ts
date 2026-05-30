import db from '../db/index.js';
import type { Copyright, SourceInfo } from '../../shared/types.js';

interface CopyrightRow {
  id: string;
  track_id: string;
  track_name: string;
  status: string;
  expired_at: string | null;
  warning_level: string;
  license_number: string | null;
  source: string;
  updated_at: string;
}

function rowToCopyright(row: CopyrightRow): Copyright {
  return {
    id: row.id,
    trackId: row.track_id,
    trackName: row.track_name,
    status: row.status as 'active' | 'expired' | 'pending' | 'restricted',
    expiredAt: row.expired_at ?? undefined,
    warningLevel: row.warning_level as 'high' | 'medium' | 'low',
    licenseNumber: row.license_number ?? undefined,
    source: JSON.parse(row.source) as SourceInfo,
    updatedAt: row.updated_at,
  };
}

export class CopyrightRepo {
  private db: typeof db;

  constructor() {
    this.db = db;
  }

  create(copyright: Omit<Copyright, 'updatedAt'>): Copyright {
    const stmt = this.db.prepare(`
      INSERT INTO copyrights (id, track_id, track_name, status, expired_at, warning_level, license_number, source)
      VALUES (@id, @trackId, @trackName, @status, @expiredAt, @warningLevel, @licenseNumber, @source)
    `);

    stmt.run({
      id: copyright.id,
      trackId: copyright.trackId,
      trackName: copyright.trackName,
      status: copyright.status,
      expiredAt: copyright.expiredAt ?? null,
      warningLevel: copyright.warningLevel,
      licenseNumber: copyright.licenseNumber ?? null,
      source: JSON.stringify(copyright.source),
    });

    return this.findById(copyright.id)!;
  }

  findById(id: string): Copyright | null {
    const stmt = this.db.prepare('SELECT * FROM copyrights WHERE id = ?');
    const row = stmt.get(id) as CopyrightRow | undefined;
    return row ? rowToCopyright(row) : null;
  }

  findAll(): Copyright[] {
    const stmt = this.db.prepare('SELECT * FROM copyrights ORDER BY updated_at DESC');
    const rows = stmt.all() as CopyrightRow[];
    return rows.map(rowToCopyright);
  }

  findByTrackId(trackId: string): Copyright | null {
    const stmt = this.db.prepare(`
      SELECT * FROM copyrights 
      WHERE track_id = ? 
      ORDER BY 
        CASE warning_level 
          WHEN 'high' THEN 0 
          WHEN 'medium' THEN 1 
          ELSE 2 
        END,
        updated_at DESC 
      LIMIT 1
    `);
    const row = stmt.get(trackId) as CopyrightRow | undefined;
    return row ? rowToCopyright(row) : null;
  }

  hasHighWarningByTrackId(trackId: string): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM copyrights WHERE track_id = ? AND warning_level = ?');
    const row = stmt.get(trackId, 'high') as { count: number };
    return row.count > 0;
  }

  findByWarningLevel(warningLevel: 'high' | 'medium' | 'low'): Copyright[] {
    const stmt = this.db.prepare('SELECT * FROM copyrights WHERE warning_level = ? ORDER BY updated_at DESC');
    const rows = stmt.all(warningLevel) as CopyrightRow[];
    return rows.map(rowToCopyright);
  }

  findHighRisk(): Copyright[] {
    return this.findByWarningLevel('high');
  }

  update(id: string, updates: Partial<Omit<Copyright, 'id' | 'trackId' | 'source' | 'updatedAt'>>): Copyright | null {
    const existing = this.findById(id);
    if (!existing) return null;

    if (existing.warningLevel === 'high') {
      return existing;
    }

    const fields: string[] = [];
    const values: Record<string, unknown> = { id };

    if (updates.trackName !== undefined) {
      fields.push('track_name = @trackName');
      values.trackName = updates.trackName;
    }
    if (updates.status !== undefined) {
      fields.push('status = @status');
      values.status = updates.status;
    }
    if (updates.expiredAt !== undefined) {
      fields.push('expired_at = @expiredAt');
      values.expiredAt = updates.expiredAt ?? null;
    }
    if (updates.warningLevel !== undefined) {
      fields.push('warning_level = @warningLevel');
      values.warningLevel = updates.warningLevel;
    }
    if (updates.licenseNumber !== undefined) {
      fields.push('license_number = @licenseNumber');
      values.licenseNumber = updates.licenseNumber ?? null;
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = datetime(\'now\')');

    const stmt = this.db.prepare(`
      UPDATE copyrights
      SET ${fields.join(', ')}
      WHERE id = @id
    `);

    stmt.run(values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) return false;

    if (existing.warningLevel === 'high') {
      return false;
    }

    const stmt = this.db.prepare('DELETE FROM copyrights WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM copyrights');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  countExpired(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM copyrights WHERE warning_level = ?');
    const row = stmt.get('high') as { count: number };
    return row.count;
  }

  findByStatus(status: 'active' | 'expired' | 'pending' | 'restricted'): Copyright[] {
    const stmt = this.db.prepare('SELECT * FROM copyrights WHERE status = ? ORDER BY updated_at DESC');
    const rows = stmt.all(status) as CopyrightRow[];
    return rows.map(rowToCopyright);
  }
}

export default CopyrightRepo;
