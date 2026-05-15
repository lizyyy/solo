"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyChangeDAO = void 0;
const database_1 = require("../utils/database");
class DependencyChangeDAO {
    static create(change) {
        const id = `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const requestedAt = new Date().toISOString();
        const stmt = database_1.db.prepare(`
      INSERT INTO dependency_changes (id, dependency_name, old_version, new_version, change_reason, requester, approver, requested_at, approved_at, status, both_confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
        stmt.run(id, change.dependencyName, change.oldVersion, change.newVersion, change.changeReason, change.requester, change.approver || null, requestedAt, change.approvedAt?.toISOString() || null, change.status);
        return this.getById(id);
    }
    static getById(id) {
        const row = database_1.db.prepare('SELECT * FROM dependency_changes WHERE id = ?').get(id);
        return row ? this.mapRow(row) : null;
    }
    static getAll(status) {
        let query = 'SELECT * FROM dependency_changes ORDER BY requested_at DESC';
        const params = [];
        if (status) {
            query = 'SELECT * FROM dependency_changes WHERE status = ? ORDER BY requested_at DESC';
            params.push(status);
        }
        const rows = database_1.db.prepare(query).all(...params);
        return rows.map(row => this.mapRow(row));
    }
    static approve(id, approver) {
        const approvedAt = new Date().toISOString();
        database_1.db.prepare(`
      UPDATE dependency_changes 
      SET status = 'approved', approver = ?, approved_at = ?, both_confirmed = 1
      WHERE id = ?
    `).run(approver, approvedAt, id);
        return this.getById(id);
    }
    static reject(id, approver) {
        database_1.db.prepare(`
      UPDATE dependency_changes 
      SET status = 'rejected', approver = ?
      WHERE id = ?
    `).run(approver, id);
        return this.getById(id);
    }
    static mapRow(row) {
        return {
            id: row.id,
            dependencyName: row.dependency_name,
            oldVersion: row.old_version,
            newVersion: row.new_version,
            changeReason: row.change_reason,
            requester: row.requester,
            approver: row.approver,
            requestedAt: new Date(row.requested_at),
            approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
            status: row.status,
            bothConfirmed: Boolean(row.both_confirmed)
        };
    }
}
exports.DependencyChangeDAO = DependencyChangeDAO;
//# sourceMappingURL=DependencyChangeDAO.js.map