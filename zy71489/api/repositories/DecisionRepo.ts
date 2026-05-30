import db from '../db/index.js';
import type { Decision, FilterCriteria, DedupeRule, Track, Vote, Copyright } from '../../shared/types.js';

interface DecisionRow {
  id: string;
  name: string;
  selected_track_ids: string;
  total_duration: number;
  total_votes: number;
  avg_stamina: number;
  copyright_risk: string;
  filters: string;
  deduplication_rules: string;
  snapshot: string;
  decision_reason: string | null;
  created_at: string;
  created_by: string;
}

interface DecisionSnapshot {
  tracks: Track[];
  votes: Vote[];
  copyrights: Copyright[];
}

function rowToDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    name: row.name,
    selectedTrackIds: JSON.parse(row.selected_track_ids) as string[],
    totalDuration: row.total_duration,
    totalVotes: row.total_votes,
    avgStamina: row.avg_stamina,
    copyrightRisk: row.copyright_risk as 'none' | 'low' | 'medium' | 'high',
    filters: JSON.parse(row.filters) as FilterCriteria,
    deduplicationRules: JSON.parse(row.deduplication_rules) as DedupeRule[],
    snapshot: JSON.parse(row.snapshot) as DecisionSnapshot,
    decisionReason: row.decision_reason ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export class DecisionRepo {
  private db: typeof db;

  constructor() {
    this.db = db;
  }

  create(decision: Omit<Decision, 'createdAt'>): Decision {
    const insertStmt = this.db.prepare(`
      INSERT INTO decisions (
        id, name, selected_track_ids, total_duration, total_votes, avg_stamina,
        copyright_risk, filters, deduplication_rules, snapshot, decision_reason, created_by
      ) VALUES (
        @id, @name, @selectedTrackIds, @totalDuration, @totalVotes, @avgStamina,
        @copyrightRisk, @filters, @deduplicationRules, @snapshot, @decisionReason, @createdBy
      )
    `);

    const insertTrackStmt = this.db.prepare(`
      INSERT OR IGNORE INTO decision_tracks (decision_id, track_id)
      VALUES (?, ?)
    `);

    const tx = this.db.transaction((d: Omit<Decision, 'createdAt'>) => {
      insertStmt.run({
        id: d.id,
        name: d.name,
        selectedTrackIds: JSON.stringify(d.selectedTrackIds),
        totalDuration: d.totalDuration,
        totalVotes: d.totalVotes,
        avgStamina: d.avgStamina,
        copyrightRisk: d.copyrightRisk,
        filters: JSON.stringify(d.filters),
        deduplicationRules: JSON.stringify(d.deduplicationRules),
        snapshot: JSON.stringify(d.snapshot),
        decisionReason: d.decisionReason ?? null,
        createdBy: d.createdBy,
      });

      for (const trackId of d.selectedTrackIds) {
        insertTrackStmt.run(d.id, trackId);
      }
    });

    tx(decision);
    return this.findById(decision.id)!;
  }

  findById(id: string): Decision | null {
    const stmt = this.db.prepare('SELECT * FROM decisions WHERE id = ?');
    const row = stmt.get(id) as DecisionRow | undefined;
    return row ? rowToDecision(row) : null;
  }

  findAll(): Decision[] {
    const stmt = this.db.prepare('SELECT * FROM decisions ORDER BY created_at DESC');
    const rows = stmt.all() as DecisionRow[];
    return rows.map(rowToDecision);
  }

  findRecent(limit: number = 10): Decision[] {
    const stmt = this.db.prepare('SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit) as DecisionRow[];
    return rows.map(rowToDecision);
  }

  findByCreatedBy(createdBy: string): Decision[] {
    const stmt = this.db.prepare('SELECT * FROM decisions WHERE created_by = ? ORDER BY created_at DESC');
    const rows = stmt.all(createdBy) as DecisionRow[];
    return rows.map(rowToDecision);
  }

  getTrackIdsForDecision(decisionId: string): string[] {
    const stmt = this.db.prepare('SELECT track_id FROM decision_tracks WHERE decision_id = ?');
    const rows = stmt.all(decisionId) as { track_id: string }[];
    return rows.map(row => row.track_id);
  }

  addTrackToDecision(decisionId: string, trackId: string): boolean {
    const existing = this.findById(decisionId);
    if (!existing) return false;

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO decision_tracks (decision_id, track_id)
      VALUES (?, ?)
    `);

    const result = stmt.run(decisionId, trackId);

    if (result.changes > 0) {
      const trackIds = this.getTrackIdsForDecision(decisionId);
      const updateStmt = this.db.prepare(`
        UPDATE decisions SET selected_track_ids = ? WHERE id = ?
      `);
      updateStmt.run(JSON.stringify(trackIds), decisionId);
    }

    return result.changes > 0;
  }

  removeTrackFromDecision(decisionId: string, trackId: string): boolean {
    const existing = this.findById(decisionId);
    if (!existing) return false;

    const stmt = this.db.prepare(`
      DELETE FROM decision_tracks WHERE decision_id = ? AND track_id = ?
    `);

    const result = stmt.run(decisionId, trackId);

    if (result.changes > 0) {
      const trackIds = this.getTrackIdsForDecision(decisionId);
      const updateStmt = this.db.prepare(`
        UPDATE decisions SET selected_track_ids = ? WHERE id = ?
      `);
      updateStmt.run(JSON.stringify(trackIds), decisionId);
    }

    return result.changes > 0;
  }

  update(id: string, updates: Partial<Omit<Decision, 'id' | 'createdAt' | 'createdBy' | 'snapshot'>>): Decision | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: Record<string, unknown> = { id };

    if (updates.name !== undefined) {
      fields.push('name = @name');
      values.name = updates.name;
    }
    if (updates.selectedTrackIds !== undefined) {
      fields.push('selected_track_ids = @selectedTrackIds');
      values.selectedTrackIds = JSON.stringify(updates.selectedTrackIds);
    }
    if (updates.totalDuration !== undefined) {
      fields.push('total_duration = @totalDuration');
      values.totalDuration = updates.totalDuration;
    }
    if (updates.totalVotes !== undefined) {
      fields.push('total_votes = @totalVotes');
      values.totalVotes = updates.totalVotes;
    }
    if (updates.avgStamina !== undefined) {
      fields.push('avg_stamina = @avgStamina');
      values.avgStamina = updates.avgStamina;
    }
    if (updates.copyrightRisk !== undefined) {
      fields.push('copyright_risk = @copyrightRisk');
      values.copyrightRisk = updates.copyrightRisk;
    }
    if (updates.filters !== undefined) {
      fields.push('filters = @filters');
      values.filters = JSON.stringify(updates.filters);
    }
    if (updates.deduplicationRules !== undefined) {
      fields.push('deduplication_rules = @deduplicationRules');
      values.deduplicationRules = JSON.stringify(updates.deduplicationRules);
    }
    if (updates.decisionReason !== undefined) {
      fields.push('decision_reason = @decisionReason');
      values.decisionReason = updates.decisionReason ?? null;
    }

    if (fields.length === 0) return existing;

    const stmt = this.db.prepare(`
      UPDATE decisions
      SET ${fields.join(', ')}
      WHERE id = @id
    `);

    stmt.run(values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const deleteTracksStmt = this.db.prepare('DELETE FROM decision_tracks WHERE decision_id = ?');
    const deleteDecisionStmt = this.db.prepare('DELETE FROM decisions WHERE id = ?');

    const tx = this.db.transaction((decisionId: string) => {
      deleteTracksStmt.run(decisionId);
      const result = deleteDecisionStmt.run(decisionId);
      return result.changes > 0;
    });

    return tx(id);
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM decisions');
    const row = stmt.get() as { count: number };
    return row.count;
  }
}

export default DecisionRepo;
