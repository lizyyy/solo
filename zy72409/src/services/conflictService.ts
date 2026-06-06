import { db } from '../db';
import { ConflictType, DataSource, TicketType, ConflictEvidence } from '../types';

export function detectConflicts(batchId: number): ConflictEvidence[] {
  const conflicts: ConflictEvidence[] = [];

  const soundRecords = db.prepare(`
    SELECT * FROM ticket_records 
    WHERE batch_id = ? AND source = ?
  `).all(batchId, DataSource.SOUND_ENGINEER) as any[];

  const rehearsalRecords = db.prepare(`
    SELECT * FROM ticket_records 
    WHERE batch_id = ? AND source = ?
  `).all(batchId, DataSource.REHEARSAL_GROUP) as any[];

  if (soundRecords.length === 0 || rehearsalRecords.length === 0) {
    return conflicts;
  }

  const soundTotalQty = soundRecords.reduce((sum, r) => sum + r.quantity, 0);
  const rehearsalTotalQty = rehearsalRecords.reduce((sum, r) => sum + r.quantity, 0);
  if (soundTotalQty !== rehearsalTotalQty) {
    conflicts.push(createConflict(
      batchId,
      ConflictType.TICKET_COUNT_MISMATCH,
      String(soundTotalQty),
      String(rehearsalTotalQty),
      `总票数不一致：调音师记录 ${soundTotalQty} 张，排练群接龙 ${rehearsalTotalQty} 张`
    ));
  }

  const soundCompCount = soundRecords
    .filter(r => r.ticket_type === TicketType.COMP)
    .reduce((sum, r) => sum + r.quantity, 0);
  const rehearsalCompCount = rehearsalRecords
    .filter(r => r.ticket_type === TicketType.COMP)
    .reduce((sum, r) => sum + r.quantity, 0);
  if (soundCompCount !== rehearsalCompCount) {
    conflicts.push(createConflict(
      batchId,
      ConflictType.TICKET_TYPE_MISMATCH,
      String(soundCompCount),
      String(rehearsalCompCount),
      `赠票数量不一致：调音师记录 ${soundCompCount} 张赠票，排练群接龙 ${rehearsalCompCount} 张赠票`
    ));
  }

  const soundRevenue = soundRecords
    .filter(r => r.ticket_type === TicketType.PAID)
    .reduce((sum, r) => sum + (r.price * r.quantity), 0);
  const rehearsalRevenue = rehearsalRecords
    .filter(r => r.ticket_type === TicketType.PAID)
    .reduce((sum, r) => sum + (r.price * r.quantity), 0);
  if (Math.abs(soundRevenue - rehearsalRevenue) > 0.01) {
    conflicts.push(createConflict(
      batchId,
      ConflictType.REVENUE_MISMATCH,
      soundRevenue.toFixed(2),
      rehearsalRevenue.toFixed(2),
      `售票金额不一致：调音师记录 ¥${soundRevenue.toFixed(2)}，排练群接龙 ¥${rehearsalRevenue.toFixed(2)}`
    ));
  }

  const soundAttendees = new Set(soundRecords.map(r => r.attendee_name).filter(Boolean));
  const rehearsalAttendees = new Set(rehearsalRecords.map(r => r.attendee_name).filter(Boolean));
  
  const onlyInSound = [...soundAttendees].filter(a => !rehearsalAttendees.has(a));
  const onlyInRehearsal = [...rehearsalAttendees].filter(a => !soundAttendees.has(a));
  
  if (onlyInSound.length > 0 || onlyInRehearsal.length > 0) {
    conflicts.push(createConflict(
      batchId,
      ConflictType.ATTENDEE_MISMATCH,
      onlyInSound.length > 0 ? onlyInSound.join(', ') : '无差异',
      onlyInRehearsal.length > 0 ? onlyInRehearsal.join(', ') : '无差异',
      `人员名单不一致：调音师独有 [${onlyInSound.join(', ')}]，排练群独有 [${onlyInRehearsal.join(', ')}]`
    ));
  }

  saveConflicts(batchId, conflicts);

  return conflicts;
}

function createConflict(
  batchId: number,
  conflictType: ConflictType,
  soundEngineerValue: string,
  rehearsalGroupValue: string,
  description: string
): ConflictEvidence {
  return {
    id: 0,
    batchId,
    conflictType,
    soundEngineerValue,
    rehearsalGroupValue,
    description,
    resolved: false
  };
}

function saveConflicts(batchId: number, conflicts: ConflictEvidence[]) {
  db.prepare('DELETE FROM conflict_evidence WHERE batch_id = ? AND resolved = 0').run(batchId);

  const insertStmt = db.prepare(`
    INSERT INTO conflict_evidence 
    (batch_id, conflict_type, sound_engineer_value, rehearsal_group_value, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const conflict of conflicts) {
    const result = insertStmt.run(
      batchId,
      conflict.conflictType,
      conflict.soundEngineerValue,
      conflict.rehearsalGroupValue,
      conflict.description
    );
    conflict.id = Number(result.lastInsertRowid);
  }
}

export function resolveConflict(
  conflictId: number,
  resolution: 'confirm_sound_engineer' | 'confirm_rehearsal_group' | 'custom',
  resolvedBy: string,
  customValue?: string
): ConflictEvidence {
  const conflict = db.prepare('SELECT * FROM conflict_evidence WHERE id = ?').get(conflictId) as any;
  if (!conflict) {
    throw new Error(`冲突记录 ${conflictId} 不存在`);
  }

  db.prepare(`
    UPDATE conflict_evidence 
    SET resolved = 1, resolved_by = ?, resolved_at = datetime('now'), resolution = ?, custom_value = ?
    WHERE id = ?
  `).run(resolvedBy, resolution, customValue || null, conflictId);

  const batchId = conflict.batch_id;
  const unresolved = db.prepare(`
    SELECT COUNT(*) as count FROM conflict_evidence 
    WHERE batch_id = ? AND resolved = 0
  `).get(batchId) as any;

  if (unresolved.count === 0) {
    db.prepare(`
      UPDATE show_batches 
      SET needs_review = 0, status = 'draft', updated_at = datetime('now')
      WHERE id = ?
    `).run(batchId);
  }

  return db.prepare('SELECT * FROM conflict_evidence WHERE id = ?').get(conflictId) as any;
}

export function getConflicts(batchId: number): ConflictEvidence[] {
  return db.prepare(`
    SELECT * FROM conflict_evidence WHERE batch_id = ? ORDER BY id DESC
  `).all(batchId) as any[];
}
