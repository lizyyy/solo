"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleVersionDAO = void 0;
const database_1 = require("../utils/database");
class RuleVersionDAO {
    static create(rule) {
        const id = `rule-${rule.version}-${Date.now()}`;
        const createdAt = new Date().toISOString();
        const stmt = database_1.db.prepare(`
      INSERT INTO rule_versions (id, version, name, description, rules, effective_from, effective_to, is_active, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, rule.version, rule.name, rule.description, JSON.stringify(rule.rules), rule.effectiveFrom.toISOString(), rule.effectiveTo?.toISOString() || null, rule.isActive ? 1 : 0, rule.createdBy, createdAt);
        return this.getById(id);
    }
    static getById(id) {
        const row = database_1.db.prepare('SELECT * FROM rule_versions WHERE id = ?').get(id);
        return row ? this.mapRow(row) : null;
    }
    static getActiveRule() {
        const row = database_1.db.prepare('SELECT * FROM rule_versions WHERE is_active = 1 ORDER BY effective_from DESC LIMIT 1').get();
        return row ? this.mapRow(row) : null;
    }
    static getAll() {
        const rows = database_1.db.prepare('SELECT * FROM rule_versions ORDER BY effective_from DESC').all();
        return rows.map(row => this.mapRow(row));
    }
    static getByDate(date) {
        const dateStr = date.toISOString();
        const row = database_1.db.prepare(`
      SELECT * FROM rule_versions 
      WHERE effective_from <= ? 
      AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC LIMIT 1
    `).get(dateStr, dateStr);
        return row ? this.mapRow(row) : null;
    }
    static deactivateOldVersions(newEffectiveFrom) {
        database_1.db.prepare(`
      UPDATE rule_versions 
      SET is_active = 0, effective_to = ?
      WHERE is_active = 1 AND effective_from < ?
    `).run(newEffectiveFrom.toISOString(), newEffectiveFrom.toISOString());
    }
    static mapRow(row) {
        return {
            id: row.id,
            version: row.version,
            name: row.name,
            description: row.description,
            rules: JSON.parse(row.rules),
            effectiveFrom: new Date(row.effective_from),
            effectiveTo: row.effective_to ? new Date(row.effective_to) : undefined,
            isActive: Boolean(row.is_active),
            createdAt: new Date(row.created_at),
            createdBy: row.created_by
        };
    }
}
exports.RuleVersionDAO = RuleVersionDAO;
//# sourceMappingURL=RuleVersionDAO.js.map