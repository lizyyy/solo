import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import type {
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  Customer,
  Tier
} from '../../shared/types.js';

export class AnomalyService {
  static detectAnomalies(): Anomaly[] {
    const detected: Anomaly[] = [];

    detected.push(...this.detectExpiredWhitelists());
    detected.push(...this.detectWindowOverlaps());
    detected.push(...this.detectFalsePositives());

    const existingStmt = db.prepare(`
      SELECT id, type, affectedEntities
      FROM anomalies
      WHERE resolved = 0
    `);
    const existing = existingStmt.all() as Array<{
      id: string;
      type: string;
      affectedEntities: string;
    }>;

    const existingKeys = new Set(
      existing.map(e => `${e.type}-${e.affectedEntities}`)
    );

    const newAnomalies = detected.filter(
      a => !existingKeys.has(`${a.type}-${JSON.stringify(a.affectedEntities)}`)
    );

    for (const anomaly of newAnomalies) {
      this.saveAnomaly(anomaly);
    }

    return newAnomalies;
  }

  private static detectExpiredWhitelists(): Anomaly[] {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      SELECT id, name, tier, whitelistExpiresAt
      FROM customers
      WHERE isWhitelisted = 1
        AND whitelistExpiresAt IS NOT NULL
        AND whitelistExpiresAt < ?
    `);

    const expired = stmt.all(now) as Array<{
      id: string;
      name: string;
      tier: string;
      whitelistExpiresAt: string;
    }>;

    if (expired.length === 0) return [];

    const byTier: Record<string, typeof expired> = {};
    for (const c of expired) {
      if (!byTier[c.tier]) byTier[c.tier] = [];
      byTier[c.tier].push(c);
    }

    const anomalies: Anomaly[] = [];
    for (const [tier, customers] of Object.entries(byTier)) {
      const tierLabels: Record<string, string> = {
        S: '战略客户',
        A: '重要客户',
        B: '普通客户',
        C: '长尾客户'
      };

      const severity: AnomalySeverity = tier === 'S' ? 'critical' : tier === 'A' ? 'warning' : 'info';

      anomalies.push({
        id: uuidv4(),
        type: 'whitelist_expired',
        severity,
        message: `检测到 ${customers.length} 个${tierLabels[tier] || tier}级客户的白名单已过期`,
        affectedEntities: customers.map(c => c.id),
        recommendation: `请检查这些客户的白名单配置，考虑续期或调整规则`,
        resolved: false,
        createdAt: new Date().toISOString()
      });
    }

    return anomalies;
  }

  private static detectWindowOverlaps(): Anomaly[] {
    const stmt = db.prepare(`
      SELECT r.id, r.name, r.windowSize, r."limit", COUNT(h.id) as overlapCount
      FROM rules r
      JOIN hit_results h ON r.id = h.ruleId
      WHERE h.hitReason = 'window_overlap'
        AND h.requestTimestamp >= datetime('now', '-7 days')
      GROUP BY r.id
      HAVING overlapCount > 10
    `);

    const overlapping = stmt.all() as Array<{
      id: string;
      name: string;
      windowSize: number;
      limit: number;
      overlapCount: number;
    }>;

    return overlapping.map(rule => ({
      id: uuidv4(),
      type: 'window_overlap',
      severity: 'warning' as AnomalySeverity,
      message: `规则「${rule.name}」最近7天检测到 ${rule.overlapCount} 次时间窗重叠命中`,
      affectedEntities: [rule.id],
      recommendation: `当前窗口大小 ${rule.windowSize}秒，阈值 ${rule.limit}。建议调整窗口大小或使用滑动窗口算法`,
      resolved: false,
      createdAt: new Date().toISOString()
    }));
  }

  private static detectFalsePositives(): Anomaly[] {
    const stmt = db.prepare(`
      SELECT h.customerId, h.customerName, h.customerTier, COUNT(h.id) as fpCount
      FROM hit_results h
      WHERE h.hitReason = 'false_positive'
        AND h.wouldBlock = 1
        AND h.requestTimestamp >= datetime('now', '-7 days')
      GROUP BY h.customerId
      HAVING fpCount > 5
    `);

    const falsePositives = stmt.all() as Array<{
      customerId: string;
      customerName: string;
      customerTier: string;
      fpCount: number;
    }>;

    if (falsePositives.length === 0) return [];

    const highTierFPs = falsePositives.filter(fp => fp.customerTier === 'S' || fp.customerTier === 'A');

    if (highTierFPs.length > 0) {
      return [{
        id: uuidv4(),
        type: 'false_positive',
        severity: 'warning' as AnomalySeverity,
        message: `检测到 ${highTierFPs.length} 个重要客户存在疑似误杀，共 ${highTierFPs.reduce((a, b) => a + b.fpCount, 0)} 次`,
        affectedEntities: highTierFPs.map(fp => fp.customerId),
        recommendation: `建议人工复核这些命中，考虑为重要客户调整阈值或增加白名单`,
        resolved: false,
        createdAt: new Date().toISOString()
      }];
    }

    return falsePositives.map(fp => ({
      id: uuidv4(),
      type: 'false_positive',
      severity: 'info' as AnomalySeverity,
      message: `客户「${fp.customerName}」最近7天有 ${fp.fpCount} 次疑似误杀`,
      affectedEntities: [fp.customerId],
      recommendation: `建议复核这些命中，评估是否需要调整规则`,
      resolved: false,
      createdAt: new Date().toISOString()
    }));
  }

  private static saveAnomaly(anomaly: Anomaly): void {
    const stmt = db.prepare(`
      INSERT INTO anomalies (id, type, severity, message, affectedEntities, recommendation, resolved, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      anomaly.id,
      anomaly.type,
      anomaly.severity,
      anomaly.message,
      JSON.stringify(anomaly.affectedEntities),
      anomaly.recommendation,
      0,
      anomaly.createdAt
    );
  }

  static getAnomalies(includeResolved = false): Anomaly[] {
    let sql = `
      SELECT id, type, severity, message, affectedEntities, recommendation, resolved, resolution, createdAt
      FROM anomalies
    `;
    const params: number[] = [];

    if (!includeResolved) {
      sql += ' WHERE resolved = ?';
      params.push(0);
    }

    sql += ' ORDER BY createdAt DESC';

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: string;
      type: string;
      severity: string;
      message: string;
      affectedEntities: string;
      recommendation: string;
      resolved: number;
      resolution?: string;
      createdAt: string;
    }>;

    return rows.map(row => ({
      ...row,
      type: row.type as AnomalyType,
      severity: row.severity as AnomalySeverity,
      affectedEntities: JSON.parse(row.affectedEntities),
      resolved: row.resolved === 1
    }));
  }

  static resolveAnomaly(id: string, resolution: string, modifiedBy: string): Anomaly | null {
    const now = new Date().toISOString();

    const checkStmt = db.prepare(`
      SELECT id, type, severity, message, affectedEntities, recommendation, resolved, resolution, createdAt
      FROM anomalies
      WHERE id = ?
    `);

    const existing = checkStmt.get(id) as {
      id: string;
      type: string;
      severity: string;
      message: string;
      affectedEntities: string;
      recommendation: string;
      resolved: number;
      resolution?: string;
      createdAt: string;
    } | undefined;

    if (!existing) return null;

    const updateStmt = db.prepare(`
      UPDATE anomalies
      SET resolved = ?, resolution = ?, createdAt = ?
      WHERE id = ?
    `);

    updateStmt.run(1, resolution, now, id);

    const resolved: Anomaly = {
      ...existing,
      type: existing.type as AnomalyType,
      severity: existing.severity as AnomalySeverity,
      affectedEntities: JSON.parse(existing.affectedEntities),
      resolved: true,
      resolution
    };

    return resolved;
  }
}

export default AnomalyService;
