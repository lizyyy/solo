import db from '../db/index.js';
import type { Vote, SourceInfo } from '../../shared/types.js';

interface VoteRow {
  id: string;
  track_id: string;
  track_name: string;
  voter_id: string | null;
  voter_name: string | null;
  voted_at: string;
  is_duplicate: number;
  duplicate_of: string | null;
  source: string;
  created_at: string;
}

function rowToVote(row: VoteRow): Vote {
  return {
    id: row.id,
    trackId: row.track_id,
    trackName: row.track_name,
    voterId: row.voter_id ?? undefined,
    voterName: row.voter_name ?? undefined,
    votedAt: row.voted_at,
    isDuplicate: row.is_duplicate === 1,
    duplicateOf: row.duplicate_of ?? undefined,
    source: JSON.parse(row.source) as SourceInfo,
  };
}

export class VoteRepo {
  private db: typeof db;

  constructor() {
    this.db = db;
  }

  create(vote: Omit<Vote, 'createdAt'>): Vote {
    const stmt = this.db.prepare(`
      INSERT INTO votes (id, track_id, track_name, voter_id, voter_name, voted_at, is_duplicate, duplicate_of, source)
      VALUES (@id, @trackId, @trackName, @voterId, @voterName, @votedAt, @isDuplicate, @duplicateOf, @source)
    `);

    stmt.run({
      id: vote.id,
      trackId: vote.trackId,
      trackName: vote.trackName,
      voterId: vote.voterId ?? null,
      voterName: vote.voterName ?? null,
      votedAt: vote.votedAt,
      isDuplicate: vote.isDuplicate ? 1 : 0,
      duplicateOf: vote.duplicateOf ?? null,
      source: JSON.stringify(vote.source),
    });

    return this.findById(vote.id)!;
  }

  findById(id: string): Vote | null {
    const stmt = this.db.prepare('SELECT * FROM votes WHERE id = ?');
    const row = stmt.get(id) as VoteRow | undefined;
    return row ? rowToVote(row) : null;
  }

  findAll(): Vote[] {
    const stmt = this.db.prepare('SELECT * FROM votes ORDER BY created_at DESC');
    const rows = stmt.all() as VoteRow[];
    return rows.map(rowToVote);
  }

  findByTrackId(trackId: string): Vote[] {
    const stmt = this.db.prepare('SELECT * FROM votes WHERE track_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(trackId) as VoteRow[];
    return rows.map(rowToVote);
  }

  findDuplicates(): Vote[] {
    const stmt = this.db.prepare('SELECT * FROM votes WHERE is_duplicate = 1 ORDER BY created_at DESC');
    const rows = stmt.all() as VoteRow[];
    return rows.map(rowToVote);
  }

  findNonDuplicates(): Vote[] {
    const stmt = this.db.prepare('SELECT * FROM votes WHERE is_duplicate = 0 ORDER BY created_at DESC');
    const rows = stmt.all() as VoteRow[];
    return rows.map(rowToVote);
  }

  findByDuplicateStatus(isDuplicate: boolean): Vote[] {
    const stmt = this.db.prepare('SELECT * FROM votes WHERE is_duplicate = ? ORDER BY created_at DESC');
    const rows = stmt.all(isDuplicate ? 1 : 0) as VoteRow[];
    return rows.map(rowToVote);
  }

  markAsDuplicate(id: string, duplicateOf: string): Vote | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const stmt = this.db.prepare(`
      UPDATE votes
      SET is_duplicate = 1, duplicate_of = ?
      WHERE id = ?
    `);

    stmt.run(duplicateOf, id);
    return this.findById(id);
  }

  update(id: string, updates: Partial<Omit<Vote, 'id' | 'trackId' | 'source' | 'createdAt'>>): Vote | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: Record<string, unknown> = { id };

    if (updates.trackName !== undefined) {
      fields.push('track_name = @trackName');
      values.trackName = updates.trackName;
    }
    if (updates.voterId !== undefined) {
      fields.push('voter_id = @voterId');
      values.voterId = updates.voterId ?? null;
    }
    if (updates.voterName !== undefined) {
      fields.push('voter_name = @voterName');
      values.voterName = updates.voterName ?? null;
    }
    if (updates.votedAt !== undefined) {
      fields.push('voted_at = @votedAt');
      values.votedAt = updates.votedAt;
    }
    if (updates.isDuplicate !== undefined) {
      fields.push('is_duplicate = @isDuplicate');
      values.isDuplicate = updates.isDuplicate ? 1 : 0;
    }
    if (updates.duplicateOf !== undefined) {
      fields.push('duplicate_of = @duplicateOf');
      values.duplicateOf = updates.duplicateOf ?? null;
    }

    if (fields.length === 0) return existing;

    const stmt = this.db.prepare(`
      UPDATE votes
      SET ${fields.join(', ')}
      WHERE id = @id
    `);

    stmt.run(values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM votes WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM votes');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  countByTrackId(trackId: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM votes WHERE track_id = ? AND is_duplicate = 0');
    const row = stmt.get(trackId) as { count: number };
    return row.count;
  }

  countDuplicates(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM votes WHERE is_duplicate = 1');
    const row = stmt.get() as { count: number };
    return row.count;
  }
}

export default VoteRepo;
