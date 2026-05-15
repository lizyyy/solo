import { db } from '../utils/database';
import { ProcessReport, ProcessStats } from './types';

export class ProcessReportDAO {
  static create(report: Omit<ProcessReport, 'id' | 'generatedAt'>): ProcessReport {
    const id = `rpt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const generatedAt = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO process_reports (id, batch_id, before_stats, after_stats, execution_time, processed_count, next_suggestions, rule_version_used, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      report.batchId,
      JSON.stringify(report.beforeStats),
      JSON.stringify(report.afterStats),
      report.executionTime,
      report.processedCount,
      JSON.stringify(report.nextSuggestions),
      report.ruleVersionUsed,
      generatedAt
    );

    return this.getById(id)!;
  }

  static getById(id: string): ProcessReport | null {
    const row = db.prepare('SELECT * FROM process_reports WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getByBatchId(batchId: string): ProcessReport[] {
    const rows = db.prepare('SELECT * FROM process_reports WHERE batch_id = ? ORDER BY generated_at DESC').all(batchId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static getAll(limit: number = 20): ProcessReport[] {
    const rows = db.prepare('SELECT * FROM process_reports ORDER BY generated_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(row => this.mapRow(row));
  }

  private static mapRow(row: any): ProcessReport {
    return {
      id: row.id,
      batchId: row.batch_id,
      beforeStats: JSON.parse(row.before_stats) as ProcessStats,
      afterStats: JSON.parse(row.after_stats) as ProcessStats,
      executionTime: Number(row.execution_time),
      processedCount: Number(row.processed_count),
      nextSuggestions: JSON.parse(row.next_suggestions) as string[],
      ruleVersionUsed: row.rule_version_used,
      generatedAt: new Date(row.generated_at)
    };
  }
}
