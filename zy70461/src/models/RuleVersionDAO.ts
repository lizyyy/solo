import { db } from '../utils/database';
import { RuleVersion, RuleDefinition } from './types';

export class RuleVersionDAO {
  static create(rule: Omit<RuleVersion, 'id' | 'createdAt'>): RuleVersion {
    const id = `rule-${rule.version}-${Date.now()}`;
    const createdAt = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO rule_versions (id, version, name, description, rules, effective_from, effective_to, is_active, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      rule.version,
      rule.name,
      rule.description,
      JSON.stringify(rule.rules),
      rule.effectiveFrom.toISOString(),
      rule.effectiveTo?.toISOString() || null,
      rule.isActive ? 1 : 0,
      rule.createdBy,
      createdAt
    );

    return this.getById(id)!;
  }

  static getById(id: string): RuleVersion | null {
    const row = db.prepare('SELECT * FROM rule_versions WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getActiveRule(): RuleVersion | null {
    const row = db.prepare('SELECT * FROM rule_versions WHERE is_active = 1 ORDER BY effective_from DESC LIMIT 1').get() as any;
    return row ? this.mapRow(row) : null;
  }

  static getAll(): RuleVersion[] {
    const rows = db.prepare('SELECT * FROM rule_versions ORDER BY effective_from DESC').all() as any[];
    return rows.map(row => this.mapRow(row));
  }

  static getByDate(date: Date): RuleVersion | null {
    const dateStr = date.toISOString();
    const row = db.prepare(`
      SELECT * FROM rule_versions 
      WHERE effective_from <= ? 
      AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC LIMIT 1
    `).get(dateStr, dateStr) as any;
    return row ? this.mapRow(row) : null;
  }

  static deactivateOldVersions(newEffectiveFrom: Date): void {
    db.prepare(`
      UPDATE rule_versions 
      SET is_active = 0, effective_to = ?
      WHERE is_active = 1 AND effective_from < ?
    `).run(newEffectiveFrom.toISOString(), newEffectiveFrom.toISOString());
  }

  private static mapRow(row: any): RuleVersion {
    return {
      id: row.id,
      version: row.version,
      name: row.name,
      description: row.description,
      rules: JSON.parse(row.rules) as RuleDefinition,
      effectiveFrom: new Date(row.effective_from),
      effectiveTo: row.effective_to ? new Date(row.effective_to) : undefined,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      createdBy: row.created_by
    };
  }
}
