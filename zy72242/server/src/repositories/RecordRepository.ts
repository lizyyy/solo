import db from '../utils/database';
import { ReconciliationRecord, RecordStatus, ModificationType, ReconciliationNoteUpdate } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

class RecordRepository {
  findAll(): ReconciliationRecord[] {
    const stmt = db.prepare(`
      SELECT 
        id, trade_date as tradeDate, expected_arrival_date as expectedArrivalDate,
        actual_arrival_date as actualArrivalDate, amount, fund_code as fundCode,
        futures_code as futuresCode, status, has_manual_modification as hasManualModification,
        modification_type as modificationType, modified_by as modifiedBy, modified_at as modifiedAt,
        modification_reason as modificationReason, why_kept as whyKept,
        missing_materials as missingMaterials, next_action as nextAction,
        last_updated_by as lastUpdatedBy, last_updated_at as lastUpdatedAt,
        created_at as createdAt, updated_at as updatedAt
      FROM reconciliation_records
      ORDER BY trade_date DESC
    `);
    return stmt.all() as ReconciliationRecord[];
  }

  findById(id: string): ReconciliationRecord | undefined {
    const stmt = db.prepare(`
      SELECT 
        id, trade_date as tradeDate, expected_arrival_date as expectedArrivalDate,
        actual_arrival_date as actualArrivalDate, amount, fund_code as fundCode,
        futures_code as futuresCode, status, has_manual_modification as hasManualModification,
        modification_type as modificationType, modified_by as modifiedBy, modified_at as modifiedAt,
        modification_reason as modificationReason, why_kept as whyKept,
        missing_materials as missingMaterials, next_action as nextAction,
        last_updated_by as lastUpdatedBy, last_updated_at as lastUpdatedAt,
        created_at as createdAt, updated_at as updatedAt
      FROM reconciliation_records
      WHERE id = ?
    `);
    return stmt.get(id) as ReconciliationRecord | undefined;
  }

  create(data: {
    tradeDate: string;
    expectedArrivalDate: string;
    actualArrivalDate: string;
    amount: number;
    fundCode: string;
    futuresCode: string;
    hasManualModification: boolean;
    modificationType?: ModificationType;
    modifiedBy?: string;
    modifiedAt?: string;
    modificationReason?: string;
    whyKept: string;
    missingMaterials: string;
    nextAction: string;
  }): ReconciliationRecord {
    const id = uuidv4();
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const stmt = db.prepare(`
      INSERT INTO reconciliation_records (
        id, trade_date, expected_arrival_date, actual_arrival_date, amount,
        fund_code, futures_code, status, has_manual_modification, modification_type,
        modified_by, modified_at, modification_reason, why_kept, missing_materials,
        next_action, last_updated_by, last_updated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.tradeDate, data.expectedArrivalDate, data.actualArrivalDate, data.amount,
      data.fundCode, data.futuresCode, 'pending', data.hasManualModification ? 1 : 0,
      data.modificationType || null, data.modifiedBy || null, data.modifiedAt || null,
      data.modificationReason || null, data.whyKept, data.missingMaterials,
      data.nextAction, data.modifiedBy || '系统', data.modifiedAt || now, now, now
    );
    return this.findById(id)!;
  }

  updateStatus(id: string, status: RecordStatus): void {
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const stmt = db.prepare(`
      UPDATE reconciliation_records SET status = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(status, now, id);
  }

  updateReconciliationNote(id: string, note: ReconciliationNoteUpdate): void {
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const stmt = db.prepare(`
      UPDATE reconciliation_records SET
        why_kept = ?, missing_materials = ?, next_action = ?,
        last_updated_by = ?, last_updated_at = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      note.whyKept, note.missingMaterials, note.nextAction,
      note.updatedBy, now, now, id
    );
  }

  updateManualModification(
    id: string, 
    actualArrivalDate: string, 
    modifiedBy: string, 
    modificationReason: string
  ): void {
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const stmt = db.prepare(`
      UPDATE reconciliation_records SET
        actual_arrival_date = ?, has_manual_modification = 1,
        modification_type = 't1_to_t2', modified_by = ?, modified_at = ?,
        modification_reason = ?, status = 'reviewing', updated_at = ?
      WHERE id = ?
    `);
    stmt.run(actualArrivalDate, modifiedBy, now, modificationReason, now, id);
  }

  findByFundCode(fundCode: string): ReconciliationRecord[] {
    const stmt = db.prepare(`
      SELECT 
        id, trade_date as tradeDate, expected_arrival_date as expectedArrivalDate,
        actual_arrival_date as actualArrivalDate, amount, fund_code as fundCode,
        futures_code as futuresCode, status, has_manual_modification as hasManualModification,
        modification_type as modificationType, modified_by as modifiedBy, modified_at as modifiedAt,
        modification_reason as modificationReason, why_kept as whyKept,
        missing_materials as missingMaterials, next_action as nextAction,
        last_updated_by as lastUpdatedBy, last_updated_at as lastUpdatedAt,
        created_at as createdAt, updated_at as updatedAt
      FROM reconciliation_records
      WHERE fund_code = ?
      ORDER BY trade_date DESC
    `);
    return stmt.all(fundCode) as ReconciliationRecord[];
  }

  findWithManualModifications(): ReconciliationRecord[] {
    const stmt = db.prepare(`
      SELECT 
        id, trade_date as tradeDate, expected_arrival_date as expectedArrivalDate,
        actual_arrival_date as actualArrivalDate, amount, fund_code as fundCode,
        futures_code as futuresCode, status, has_manual_modification as hasManualModification,
        modification_type as modificationType, modified_by as modifiedBy, modified_at as modifiedAt,
        modification_reason as modificationReason, why_kept as whyKept,
        missing_materials as missingMaterials, next_action as nextAction,
        last_updated_by as lastUpdatedBy, last_updated_at as lastUpdatedAt,
        created_at as createdAt, updated_at as updatedAt
      FROM reconciliation_records
      WHERE has_manual_modification = 1
      ORDER BY modified_at DESC
    `);
    return stmt.all() as ReconciliationRecord[];
  }

  deleteAllDemoData(): void {
    db.prepare('DELETE FROM reconciliation_records WHERE id LIKE "demo-%"').run();
  }
}

export default new RecordRepository();
