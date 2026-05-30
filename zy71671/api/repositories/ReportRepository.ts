import { getDb } from '../db/connection';
import type { CheckReport, ValidationResult } from '../../shared/types';

const rowToReport = (row: Record<string, unknown>): CheckReport => {
  const summary = JSON.parse(row.summary_json as string);
  const validations = JSON.parse(row.validations_json as string);
  return {
    id: row.id as string,
    setlistId: row.setlist_id as string,
    generatedAt: row.generated_at as string,
    generatedBy: (row.generated_by as string) || 'system',
    summary: {
      total: validations.length,
      passed: summary.passed ?? 0,
      warnings: summary.warnings ?? 0,
      errors: summary.errors ?? 0,
      byType: summary.byType ?? {},
      ...summary,
    },
    keyChecks: JSON.parse(row.key_checks_json as string),
    durationAnalysis: JSON.parse(row.duration_analysis_json as string),
    durationBreakdown: row.duration_breakdown_json
      ? JSON.parse(row.duration_breakdown_json as string)
      : { total: 0, limit: 0, songDurations: [] },
    conflicts: JSON.parse(row.conflicts_json as string),
    validations,
  };
};

export const ReportRepository = {
  create: (
    id: string,
    setlistId: string,
    report: Omit<CheckReport, 'id' | 'setlistId' | 'generatedAt'>
  ): CheckReport => {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO check_reports (
        id, setlist_id, generated_at, generated_by, summary_json, key_checks_json,
        duration_analysis_json, duration_breakdown_json, conflicts_json, validations_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, setlistId, now, report.generatedBy,
      JSON.stringify(report.summary),
      JSON.stringify(report.keyChecks),
      JSON.stringify(report.durationAnalysis),
      JSON.stringify(report.durationBreakdown),
      JSON.stringify(report.conflicts),
      JSON.stringify(report.validations)
    );

    const insertValidation = db.prepare(`
      INSERT INTO validation_results (
        report_id, song_id, song_name, passed, severity, check_type, 
        message, suggestion, details_json, checks_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((validations: ValidationResult[]) => {
      for (const v of validations) {
        insertValidation.run(
          id, v.songId, v.songName,
          v.passed ? 1 : 0,
          v.severity,
          v.checkType,
          v.message,
          v.suggestion || null,
          v.details ? JSON.stringify(v.details) : null,
          JSON.stringify(v.checks)
        );
      }
    });
    tx(report.validations);

    return ReportRepository.findById(id)!;
  },

  findById: (id: string): CheckReport | null => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM check_reports WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToReport(row) : null;
  },

  findBySetlistId: (setlistId: string): CheckReport[] => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM check_reports 
      WHERE setlist_id = ? 
      ORDER BY generated_at DESC
    `).all(setlistId) as Record<string, unknown>[];
    return rows.map(rowToReport);
  },

  findLatestBySetlistId: (setlistId: string): CheckReport | null => {
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM check_reports 
      WHERE setlist_id = ? 
      ORDER BY generated_at DESC 
      LIMIT 1
    `).get(setlistId) as Record<string, unknown> | undefined;
    return row ? rowToReport(row) : null;
  },

  getValidationResults: (reportId: string): ValidationResult[] => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM validation_results WHERE report_id = ?
    `).all(reportId) as Record<string, unknown>[];
    return rows.map((row) => ({
      songId: row.song_id as string,
      songName: row.song_name as string,
      passed: row.passed === 1,
      severity: row.severity as 'error' | 'warning',
      checkType: row.check_type as string,
      message: row.message as string,
      suggestion: row.suggestion as string | undefined,
      details: row.details_json ? JSON.parse(row.details_json as string) : undefined,
      checks: JSON.parse(row.checks_json as string),
    }));
  },

  delete: (id: string): boolean => {
    const db = getDb();
    const result = db.prepare('DELETE FROM check_reports WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

export default ReportRepository;
