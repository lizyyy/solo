import db from '../db';
import { Arrangement, Assignment, SwapLog, Conflict } from '../../shared/types';
import { BaseRepository } from './BaseRepository';

export class ArrangementRepository extends BaseRepository<Arrangement> {
  constructor() {
    super('arrangements');
  }

  create(
    arrangement: Omit<Arrangement, 'id' | 'createdAt'>
  ): Arrangement {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO arrangements (id, version, name, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      arrangement.version,
      arrangement.name,
      arrangement.note,
      arrangement.createdBy,
      now
    );
    return this.findById(id)!;
  }

  update(
    id: string,
    arrangement: Partial<Omit<Arrangement, 'id' | 'createdAt' | 'createdBy'>>
  ): Arrangement | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    const snakeArrangement = this.toSnakeCase(arrangement);
    for (const [key, value] of Object.entries(snakeArrangement)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'created_by') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    values.push(id);

    db.prepare(
      `UPDATE arrangements SET ${fields.join(', ')} WHERE id = ?`
    ).run(...values);

    return this.findById(id);
  }

  findLatest(): Arrangement | undefined {
    const row = db
      .prepare(`SELECT * FROM arrangements ORDER BY created_at DESC LIMIT 1`)
      .get();
    return row ? this.toCamelCase(row) : undefined;
  }

  findByVersion(version: string): Arrangement | undefined {
    const row = db
      .prepare(`SELECT * FROM arrangements WHERE version = ?`)
      .get(version);
    return row ? this.toCamelCase(row) : undefined;
  }
}

export class AssignmentRepository extends BaseRepository<Assignment> {
  constructor() {
    super('assignments');
  }

  create(
    assignment: Omit<Assignment, 'id' | 'assignedAt'>
  ): Assignment {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO assignments (id, arrangement_id, stall_id, vendor_id, source, assigned_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      assignment.arrangementId,
      assignment.stallId,
      assignment.vendorId,
      assignment.source,
      now
    );
    return this.findById(id)!;
  }

  findByArrangement(arrangementId: string): Assignment[] {
    const rows = db
      .prepare(`SELECT * FROM assignments WHERE arrangement_id = ?`)
      .all(arrangementId);
    return rows.map((row) => this.toCamelCase(row));
  }

  findByStall(arrangementId: string, stallId: string): Assignment | undefined {
    const row = db
      .prepare(
        `SELECT * FROM assignments WHERE arrangement_id = ? AND stall_id = ?`
      )
      .get(arrangementId, stallId);
    return row ? this.toCamelCase(row) : undefined;
  }

  findByVendor(arrangementId: string, vendorId: string): Assignment | undefined {
    const row = db
      .prepare(
        `SELECT * FROM assignments WHERE arrangement_id = ? AND vendor_id = ?`
      )
      .get(arrangementId, vendorId);
    return row ? this.toCamelCase(row) : undefined;
  }

  deleteByStall(arrangementId: string, stallId: string): boolean {
    const result = db
      .prepare(
        `DELETE FROM assignments WHERE arrangement_id = ? AND stall_id = ?`
      )
      .run(arrangementId, stallId);
    return result.changes > 0;
  }

  deleteByArrangement(arrangementId: string): void {
    db.prepare(`DELETE FROM assignments WHERE arrangement_id = ?`).run(
      arrangementId
    );
  }

  bulkCreate(
    assignments: Omit<Assignment, 'id' | 'assignedAt'>[]
  ): Assignment[] {
    const result: Assignment[] = [];
    const insert = db.prepare(
      `INSERT INTO assignments (id, arrangement_id, stall_id, vendor_id, source, assigned_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const transaction = db.transaction((assignmentList) => {
      for (const assignment of assignmentList) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        insert.run(
          id,
          assignment.arrangementId,
          assignment.stallId,
          assignment.vendorId,
          assignment.source,
          now
        );
        result.push(this.findById(id)!);
      }
    });

    transaction(assignments);
    return result;
  }
}

export class SwapLogRepository extends BaseRepository<SwapLog> {
  constructor() {
    super('swap_logs');
  }

  create(swapLog: Omit<SwapLog, 'id' | 'createdAt'>): SwapLog {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO swap_logs (id, arrangement_id, stall_a, stall_b, reason, operator, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      swapLog.arrangementId,
      swapLog.stallA,
      swapLog.stallB,
      swapLog.reason,
      swapLog.operator,
      now
    );
    return this.findById(id)!;
  }

  findByArrangement(arrangementId: string): SwapLog[] {
    const rows = db
      .prepare(`SELECT * FROM swap_logs WHERE arrangement_id = ? ORDER BY created_at DESC`)
      .all(arrangementId);
    return rows.map((row) => this.toCamelCase(row));
  }
}

export class ConflictRepository extends BaseRepository<Conflict> {
  constructor() {
    super('conflicts');
  }

  create(conflict: Omit<Conflict, 'id' | 'createdAt'>): Conflict {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO conflicts (id, arrangement_id, type, severity, message, affected_items, source, row_number, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      conflict.arrangementId,
      conflict.type,
      conflict.severity,
      conflict.message,
      JSON.stringify(conflict.affectedItems),
      conflict.source,
      conflict.rowNumber,
      now
    );
    return this.findById(id)!;
  }

  protected toCamelCase(row: any): Conflict {
    const result = super.toCamelCase(row) as Conflict;
    if (result.affectedItems && typeof result.affectedItems === 'string') {
      try {
        result.affectedItems = JSON.parse(result.affectedItems);
      } catch {
        result.affectedItems = [];
      }
    }
    return result;
  }

  findByArrangement(arrangementId: string): Conflict[] {
    const rows = db
      .prepare(`SELECT * FROM conflicts WHERE arrangement_id = ? ORDER BY severity DESC, created_at DESC`)
      .all(arrangementId);
    return rows.map((row) => this.toCamelCase(row));
  }

  deleteByArrangement(arrangementId: string): void {
    db.prepare(`DELETE FROM conflicts WHERE arrangement_id = ?`).run(
      arrangementId
    );
  }

  bulkCreate(conflicts: Omit<Conflict, 'id' | 'createdAt'>[]): Conflict[] {
    const result: Conflict[] = [];
    const insert = db.prepare(
      `INSERT INTO conflicts (id, arrangement_id, type, severity, message, affected_items, source, row_number, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const transaction = db.transaction((conflictList) => {
      for (const conflict of conflictList) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        insert.run(
          id,
          conflict.arrangementId,
          conflict.type,
          conflict.severity,
          conflict.message,
          JSON.stringify(conflict.affectedItems),
          conflict.source,
          conflict.rowNumber,
          now
        );
        result.push(this.findById(id)!);
      }
    });

    transaction(conflicts);
    return result;
  }
}
