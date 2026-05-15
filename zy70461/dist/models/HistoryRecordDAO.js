"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryRecordDAO = void 0;
const database_1 = require("../utils/database");
class HistoryRecordDAO {
    static create(record) {
        const id = `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const changedAt = new Date().toISOString();
        const stmt = database_1.db.prepare(`
      INSERT INTO history_records (id, submission_id, field_name, old_value, new_value, change_reason, source_system, changed_by, changed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, record.submissionId, record.fieldName, record.oldValue || null, record.newValue || null, record.changeReason, record.sourceSystem, record.changedBy, changedAt);
        return this.getById(id);
    }
    static getById(id) {
        const row = database_1.db.prepare('SELECT * FROM history_records WHERE id = ?').get(id);
        return row ? this.mapRow(row) : null;
    }
    static getBySubmissionId(submissionId) {
        const rows = database_1.db.prepare('SELECT * FROM history_records WHERE submission_id = ? ORDER BY changed_at DESC').all(submissionId);
        return rows.map(row => this.mapRow(row));
    }
    static getBySourceSystem(sourceSystem) {
        const rows = database_1.db.prepare('SELECT * FROM history_records WHERE source_system = ? ORDER BY changed_at DESC').all(sourceSystem);
        return rows.map(row => this.mapRow(row));
    }
    static getAll(limit = 100) {
        const rows = database_1.db.prepare('SELECT * FROM history_records ORDER BY changed_at DESC LIMIT ?').all(limit);
        return rows.map(row => this.mapRow(row));
    }
    static mapRow(row) {
        return {
            id: row.id,
            submissionId: row.submission_id,
            fieldName: row.field_name,
            oldValue: row.old_value,
            newValue: row.new_value,
            changeReason: row.change_reason,
            sourceSystem: row.source_system,
            changedBy: row.changed_by,
            changedAt: new Date(row.changed_at)
        };
    }
}
exports.HistoryRecordDAO = HistoryRecordDAO;
//# sourceMappingURL=HistoryRecordDAO.js.map