import db from '../db/index.js';
import type {
  DashboardStats,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  Tier
} from '../../shared/types.js';

export class DashboardService {
  static getDashboardStats(): DashboardStats {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const todayDrills = this.getTodayDrills(todayStart);
    const totalHits = this.getTotalHits(thirtyDaysAgo);
    const activeAnomalies = this.getActiveAnomalies();
    const affectedCustomers = this.getAffectedCustomers(thirtyDaysAgo);
    const hitTrend = this.getHitTrend(thirtyDaysAgo);
    const tierDistribution = this.getTierDistribution();
    const recentAnomalies = this.getRecentAnomalies();

    return {
      todayDrills,
      totalHits,
      activeAnomalies,
      affectedCustomers,
      hitTrend,
      tierDistribution,
      recentAnomalies
    };
  }

  private static getTodayDrills(todayStart: string): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM drill_reports
      WHERE createdAt >= ?
    `);

    const row = stmt.get(todayStart) as { count: number };
    return row.count;
  }

  private static getTotalHits(since: string): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM hit_results
      WHERE requestTimestamp >= ?
    `);

    const row = stmt.get(since) as { count: number };
    return row.count;
  }

  private static getActiveAnomalies(): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM anomalies
      WHERE resolved = 0
    `);

    const row = stmt.get() as { count: number };
    return row.count;
  }

  private static getAffectedCustomers(since: string): number {
    const stmt = db.prepare(`
      SELECT COUNT(DISTINCT customerId) as count
      FROM hit_results
      WHERE wouldBlock = 1
        AND requestTimestamp >= ?
    `);

    const row = stmt.get(since) as { count: number };
    return row.count;
  }

  private static getHitTrend(since: string): Array<{ date: string; hits: number; drills: number }> {
    const stmt = db.prepare(`
      SELECT
        DATE(requestTimestamp) as date,
        COUNT(*) as hits
      FROM hit_results
      WHERE requestTimestamp >= ?
      GROUP BY DATE(requestTimestamp)
      ORDER BY date DESC
      LIMIT 30
    `);

    const hitRows = stmt.all(since) as Array<{ date: string; hits: number }>;

    const drillStmt = db.prepare(`
      SELECT
        DATE(createdAt) as date,
        COUNT(*) as drills
      FROM drill_reports
      WHERE createdAt >= ?
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
      LIMIT 30
    `);

    const drillRows = drillStmt.all(since) as Array<{ date: string; drills: number }>;

    const hitMap = new Map<string, number>();
    for (const row of hitRows) {
      hitMap.set(row.date, row.hits);
    }

    const drillMap = new Map<string, number>();
    for (const row of drillRows) {
      drillMap.set(row.date, row.drills);
    }

    const allDates = new Set([...hitMap.keys(), ...drillMap.keys()]);
    const sortedDates = Array.from(allDates).sort().reverse().slice(0, 30);

    return sortedDates.map(date => ({
      date,
      hits: hitMap.get(date) || 0,
      drills: drillMap.get(date) || 0
    })).reverse();
  }

  private static getTierDistribution(): Array<{ tier: Tier; count: number; hitCount: number }> {
    const tiers: Tier[] = ['S', 'A', 'B', 'C'];

    return tiers.map(tier => {
      const customerStmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM customers
        WHERE tier = ?
      `);
      const customerRow = customerStmt.get(tier) as { count: number };

      const hitStmt = db.prepare(`
        SELECT COUNT(*) as hitCount
        FROM hit_results h
        JOIN customers c ON h.customerId = c.id
        WHERE c.tier = ?
          AND h.wouldBlock = 1
          AND h.requestTimestamp >= datetime('now', '-30 days')
      `);
      const hitRow = hitStmt.get(tier) as { hitCount: number };

      return {
        tier,
        count: customerRow.count,
        hitCount: hitRow.hitCount
      };
    });
  }

  private static getRecentAnomalies(): Anomaly[] {
    const stmt = db.prepare(`
      SELECT id, type, severity, message, affectedEntities, recommendation, resolved, resolution, createdAt
      FROM anomalies
      ORDER BY createdAt DESC
      LIMIT 10
    `);

    const rows = stmt.all() as Array<{
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
}

export default DashboardService;
