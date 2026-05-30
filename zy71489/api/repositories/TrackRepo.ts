import db from '../db/index.js';
import type { Track, SourceInfo } from '../../shared/types.js';

interface TrackRow {
  id: string;
  name: string;
  artist: string;
  duration: number;
  stamina_level: number;
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

function rowToTrack(row: TrackRow): Track {
  return {
    id: row.id,
    name: row.name,
    artist: row.artist,
    duration: row.duration,
    staminaLevel: row.stamina_level as 1 | 2 | 3 | 4 | 5,
    notes: row.notes ?? undefined,
    source: JSON.parse(row.source) as SourceInfo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TrackRepo {
  private db: typeof db;

  constructor() {
    this.db = db;
  }

  create(track: Omit<Track, 'createdAt' | 'updatedAt'>): Track {
    const stmt = this.db.prepare(`
      INSERT INTO tracks (id, name, artist, duration, stamina_level, notes, source)
      VALUES (@id, @name, @artist, @duration, @staminaLevel, @notes, @source)
    `);

    stmt.run({
      id: track.id,
      name: track.name,
      artist: track.artist,
      duration: track.duration,
      staminaLevel: track.staminaLevel,
      notes: track.notes ?? null,
      source: JSON.stringify(track.source),
    });

    return this.findById(track.id)!;
  }

  findById(id: string): Track | null {
    const stmt = this.db.prepare('SELECT * FROM tracks WHERE id = ?');
    const row = stmt.get(id) as TrackRow | undefined;
    return row ? rowToTrack(row) : null;
  }

  findAll(): Track[] {
    const stmt = this.db.prepare('SELECT * FROM tracks ORDER BY created_at DESC');
    const rows = stmt.all() as TrackRow[];
    return rows.map(rowToTrack);
  }

  findByKeyword(keyword: string): Track[] {
    const searchTerm = `%${keyword}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM tracks
      WHERE name LIKE ? OR artist LIKE ? OR notes LIKE ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(searchTerm, searchTerm, searchTerm) as TrackRow[];
    return rows.map(rowToTrack);
  }

  update(id: string, updates: Partial<Omit<Track, 'id' | 'createdAt' | 'updatedAt' | 'source'>>): Track | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: Record<string, unknown> = { id };

    if (updates.name !== undefined) {
      fields.push('name = @name');
      values.name = updates.name;
    }
    if (updates.artist !== undefined) {
      fields.push('artist = @artist');
      values.artist = updates.artist;
    }
    if (updates.duration !== undefined) {
      fields.push('duration = @duration');
      values.duration = updates.duration;
    }
    if (updates.staminaLevel !== undefined) {
      fields.push('stamina_level = @staminaLevel');
      values.staminaLevel = updates.staminaLevel;
    }
    if (updates.notes !== undefined) {
      fields.push('notes = @notes');
      values.notes = updates.notes ?? null;
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = datetime(\'now\')');

    const stmt = this.db.prepare(`
      UPDATE tracks
      SET ${fields.join(', ')}
      WHERE id = @id
    `);

    stmt.run(values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tracks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM tracks');
    const row = stmt.get() as { count: number };
    return row.count;
  }
}

export default TrackRepo;
