"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionDAO = void 0;
const database_1 = require("../utils/database");
const types_1 = require("./types");
class SubmissionDAO {
    static create(submission) {
        const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        const stmt = database_1.db.prepare(`
      INSERT INTO submissions (id, batch_id, student_id, student_name, course_code, course_name, content, attachments, rule_version_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, submission.batchId, submission.studentId, submission.studentName, submission.courseCode, submission.courseName, submission.content, JSON.stringify(submission.attachments), submission.ruleVersionId, submission.status, now, now);
        return this.getById(id);
    }
    static getById(id) {
        const row = database_1.db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
        return row ? this.mapRow(row) : null;
    }
    static getByBatchId(batchId) {
        const rows = database_1.db.prepare('SELECT * FROM submissions WHERE batch_id = ? ORDER BY created_at DESC').all(batchId);
        return rows.map(row => this.mapRow(row));
    }
    static getByStatus(status) {
        const rows = database_1.db.prepare('SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC').all(status);
        return rows.map(row => this.mapRow(row));
    }
    static getAll(limit = 100, offset = 0) {
        const rows = database_1.db.prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
        return rows.map(row => this.mapRow(row));
    }
    static update(id, updates) {
        const fields = [];
        const values = [];
        Object.entries(updates).forEach(([key, value]) => {
            const dbField = this.toSnakeCase(key);
            if (key === 'attachments') {
                fields.push(`${dbField} = ?`);
                values.push(JSON.stringify(value));
            }
            else if (key === 'updatedAt' || (typeof value === 'object' && value instanceof Date)) {
                fields.push(`${dbField} = ?`);
                values.push(value.toISOString());
            }
            else {
                fields.push(`${dbField} = ?`);
                values.push(value);
            }
        });
        fields.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);
        const stmt = database_1.db.prepare(`UPDATE submissions SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);
        return this.getById(id);
    }
    static getStats(batchId) {
        let whereClause = '';
        const params = [];
        if (batchId) {
            whereClause = 'WHERE batch_id = ?';
            params.push(batchId);
        }
        const rows = database_1.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM submissions 
      ${whereClause}
      GROUP BY status
    `).all(...params);
        const stats = { total: 0, pending: 0, approved: 0, rejected: 0, attachmentExpired: 0 };
        rows.forEach((row) => {
            const count = Number(row.count);
            stats.total += count;
            if (row.status === types_1.SubmissionStatus.PENDING)
                stats.pending = count;
            if (row.status === types_1.SubmissionStatus.APPROVED)
                stats.approved = count;
            if (row.status === types_1.SubmissionStatus.REJECTED)
                stats.rejected = count;
            if (row.status === types_1.SubmissionStatus.ATTACHMENT_EXPIRED)
                stats.attachmentExpired = count;
        });
        return stats;
    }
    static getDistinctBatchIds() {
        const rows = database_1.db.prepare('SELECT DISTINCT batch_id FROM submissions ORDER BY batch_id DESC').all();
        return rows.map(row => row.batch_id);
    }
    static toSnakeCase(str) {
        return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
    static mapRow(row) {
        const attachments = JSON.parse(row.attachments);
        attachments.forEach(att => {
            att.uploadedAt = new Date(att.uploadedAt);
            att.expireAt = new Date(att.expireAt);
            att.isExpired = att.expireAt < new Date();
        });
        return {
            id: row.id,
            batchId: row.batch_id,
            studentId: row.student_id,
            studentName: row.student_name,
            courseCode: row.course_code,
            courseName: row.course_name,
            content: row.content,
            attachments,
            ruleVersionId: row.rule_version_id,
            status: row.status,
            summary: row.summary,
            conclusion: row.conclusion,
            processingTime: row.processing_time ? Number(row.processing_time) : undefined,
            processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
exports.SubmissionDAO = SubmissionDAO;
//# sourceMappingURL=SubmissionDAO.js.map