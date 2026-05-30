import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { ModificationService } from './ModificationService.js';
import type { RateLimitRule, RuleVersion, CreateRuleRequest, UpdateRuleRequest, Tier, RuleStatus } from '../../shared/types.js';

interface RuleWithWhitelist extends RateLimitRule {
  whitelistCount: number;
}

export class RuleService {
  static getRules(): RateLimitRule[] {
    const stmt = db.prepare(`
      SELECT id, name, path, method, windowSize, "limit", tier, status, currentVersion, createdAt, updatedAt
      FROM rules
      ORDER BY createdAt DESC
    `);

    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      path: string;
      method: string;
      windowSize: number;
      limit: number;
      tier: string;
      status: string;
      currentVersion: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map(row => ({
      ...row,
      method: row.method as RateLimitRule['method'],
      tier: row.tier as Tier,
      status: row.status as RuleStatus
    }));
  }

  static getRule(id: string): RuleWithWhitelist | null {
    const stmt = db.prepare(`
      SELECT r.id, r.name, r.path, r.method, r.windowSize, r."limit", r.tier, r.status, r.currentVersion, r.createdAt, r.updatedAt,
             COUNT(c.id) as whitelistCount
      FROM rules r
      LEFT JOIN customers c ON c.tier = r.tier AND c.isWhitelisted = 1
      WHERE r.id = ?
      GROUP BY r.id
    `);

    const row = stmt.get(id) as {
      id: string;
      name: string;
      path: string;
      method: string;
      windowSize: number;
      limit: number;
      tier: string;
      status: string;
      currentVersion: number;
      createdAt: string;
      updatedAt: string;
      whitelistCount: number;
    } | undefined;

    if (!row) return null;

    return {
      ...row,
      method: row.method as RateLimitRule['method'],
      tier: row.tier as Tier,
      status: row.status as RuleStatus
    };
  }

  static createRule(data: CreateRuleRequest, modifiedBy: string): RateLimitRule {
    const id = uuidv4();
    const now = new Date().toISOString();

    const rule: RateLimitRule = {
      id,
      name: data.name,
      path: data.path,
      method: data.method,
      windowSize: data.windowSize,
      limit: data.limit,
      tier: data.tier,
      status: 'draft',
      currentVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    const insertStmt = db.prepare(`
      INSERT INTO rules (id, name, path, method, windowSize, "limit", tier, status, currentVersion, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      rule.id,
      rule.name,
      rule.path,
      rule.method,
      rule.windowSize,
      rule.limit,
      rule.tier,
      rule.status,
      rule.currentVersion,
      rule.createdAt,
      rule.updatedAt
    );

    this.createVersion(id, 1, rule, data.changeReason, modifiedBy, now);

    ModificationService.logModification(
      'rule',
      id,
      'status',
      '',
      'draft',
      data.changeReason,
      modifiedBy
    );

    return rule;
  }

  static updateRule(id: string, data: UpdateRuleRequest, modifiedBy: string): RateLimitRule | null {
    const existing = this.getRule(id);
    if (!existing) return null;

    const newVersion = existing.currentVersion + 1;
    const now = new Date().toISOString();

    const updatedRule: RateLimitRule = {
      ...existing,
      name: data.name ?? existing.name,
      path: data.path ?? existing.path,
      method: data.method ?? existing.method,
      windowSize: data.windowSize ?? existing.windowSize,
      limit: data.limit ?? existing.limit,
      tier: data.tier ?? existing.tier,
      status: data.status ?? existing.status,
      currentVersion: newVersion,
      updatedAt: now
    };

    const updateStmt = db.prepare(`
      UPDATE rules
      SET name = ?, path = ?, method = ?, windowSize = ?, "limit" = ?, tier = ?, status = ?, currentVersion = ?, updatedAt = ?
      WHERE id = ?
    `);

    updateStmt.run(
      updatedRule.name,
      updatedRule.path,
      updatedRule.method,
      updatedRule.windowSize,
      updatedRule.limit,
      updatedRule.tier,
      updatedRule.status,
      updatedRule.currentVersion,
      updatedRule.updatedAt,
      id
    );

    this.createVersion(id, newVersion, updatedRule, data.changeReason, modifiedBy, now);

    const fields: Array<keyof UpdateRuleRequest> = ['name', 'path', 'method', 'windowSize', 'limit', 'tier', 'status'];
    for (const field of fields) {
      if (field in data && field !== 'changeReason') {
        const oldVal = String(existing[field as keyof RateLimitRule] ?? '');
        const newVal = String(updatedRule[field as keyof RateLimitRule] ?? '');
        if (oldVal !== newVal) {
          ModificationService.logModification(
            'rule',
            id,
            field,
            oldVal,
            newVal,
            data.changeReason,
            modifiedBy
          );
        }
      }
    }

    return updatedRule;
  }

  private static createVersion(
    ruleId: string,
    version: number,
    snapshot: RateLimitRule,
    changeReason: string,
    modifiedBy: string,
    createdAt: string
  ): void {
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO rule_versions (id, ruleId, version, snapshot, changeReason, modifiedBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, ruleId, version, JSON.stringify(snapshot), changeReason, modifiedBy, createdAt);
  }

  static getRuleVersions(ruleId: string): RuleVersion[] {
    const stmt = db.prepare(`
      SELECT id, ruleId, version, snapshot, changeReason, modifiedBy, createdAt
      FROM rule_versions
      WHERE ruleId = ?
      ORDER BY version DESC
    `);

    const rows = stmt.all(ruleId) as Array<{
      id: string;
      ruleId: string;
      version: number;
      snapshot: string;
      changeReason: string;
      modifiedBy: string;
      createdAt: string;
    }>;

    return rows.map(row => ({
      ...row,
      snapshot: JSON.parse(row.snapshot)
    }));
  }

  static getRuleVersion(ruleId: string, version: number): RuleVersion | null {
    const stmt = db.prepare(`
      SELECT id, ruleId, version, snapshot, changeReason, modifiedBy, createdAt
      FROM rule_versions
      WHERE ruleId = ? AND version = ?
    `);

    const row = stmt.get(ruleId, version) as {
      id: string;
      ruleId: string;
      version: number;
      snapshot: string;
      changeReason: string;
      modifiedBy: string;
      createdAt: string;
    } | undefined;

    if (!row) return null;

    return {
      ...row,
      snapshot: JSON.parse(row.snapshot)
    };
  }

  static rollbackRule(ruleId: string, version: number, modifiedBy: string, reason: string): RateLimitRule | null {
    const targetVersion = this.getRuleVersion(ruleId, version);
    if (!targetVersion) return null;

    const currentRule = this.getRule(ruleId);
    if (!currentRule) return null;

    const snapshot = targetVersion.snapshot;
    const newVersion = currentRule.currentVersion + 1;
    const now = new Date().toISOString();

    const rolledBackRule: RateLimitRule = {
      ...snapshot,
      id: ruleId,
      currentVersion: newVersion,
      updatedAt: now,
      createdAt: currentRule.createdAt
    };

    const updateStmt = db.prepare(`
      UPDATE rules
      SET name = ?, path = ?, method = ?, windowSize = ?, "limit" = ?, tier = ?, status = ?, currentVersion = ?, updatedAt = ?
      WHERE id = ?
    `);

    updateStmt.run(
      rolledBackRule.name,
      rolledBackRule.path,
      rolledBackRule.method,
      rolledBackRule.windowSize,
      rolledBackRule.limit,
      rolledBackRule.tier,
      rolledBackRule.status,
      rolledBackRule.currentVersion,
      rolledBackRule.updatedAt,
      ruleId
    );

    this.createVersion(ruleId, newVersion, rolledBackRule, reason, modifiedBy, now);

    ModificationService.logModification(
      'rule',
      ruleId,
      'rollback',
      String(currentRule.currentVersion),
      String(version),
      reason,
      modifiedBy
    );

    return rolledBackRule;
  }
}

export default RuleService;
