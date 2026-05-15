"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessReportDAO = void 0;
const database_1 = require("../utils/database");
class ProcessReportDAO {
    static create(report) {
        const id = `rpt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const generatedAt = new Date().toISOString();
        const stmt = database_1.db.prepare(`
      INSERT INTO process_reports (id, batch_id, before_stats, after_stats, execution_time, processed_count, next_suggestions, rule_version_used, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, report.batchId, JSON.stringify(report.beforeStats), JSON.stringify(report.afterStats), report.executionTime, report.processedCount, JSON.stringify(report.nextSuggestions), report.ruleVersionUsed, generatedAt);
        return this.getById(id);
    }
    static getById(id) {
        const row = database_1.db.prepare('SELECT * FROM process_reports WHERE id = ?').get(id);
        return row ? this.mapRow(row) : null;
    }
    static getByBatchId(batchId) {
        const rows = database_1.db.prepare('SELECT * FROM process_reports WHERE batch_id = ? ORDER BY generated_at DESC').all(batchId);
        return rows.map(row => this.mapRow(row));
    }
    static getAll(limit = 20) {
        const rows = database_1.db.prepare('SELECT * FROM process_reports ORDER BY generated_at DESC LIMIT ?').all(limit);
        return rows.map(row => this.mapRow(row));
    }
    static mapRow(row) {
        return {
            id: row.id,
            batchId: row.batch_id,
            beforeStats: JSON.parse(row.before_stats),
            afterStats: JSON.parse(row.after_stats),
            executionTime: Number(row.execution_time),
            processedCount: Number(row.processed_count),
            nextSuggestions: JSON.parse(row.next_suggestions),
            ruleVersionUsed: row.rule_version_used,
            generatedAt: new Date(row.generated_at)
        };
    }
}
exports.ProcessReportDAO = ProcessReportDAO;
//# sourceMappingURL=ProcessReportDAO.js.map