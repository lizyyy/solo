import { getDb } from '../db/database.js';
import type { SummaryStat, Specialty } from '../../shared/types.js';

const SPECIALTIES: Specialty[] = ['HVAC', 'ELECTRICAL', 'PLUMBING', 'FIRE'];

export class SummaryService {
  static getSummary(): SummaryStat {
    const d = getDb();

    const statusCounts = d.prepare(`
      SELECT status, COUNT(*) as c FROM materials GROUP BY status
    `).all() as Array<{ status: string; c: number }>;

    const byStatus: Record<string, number> = {};
    statusCounts.forEach((row) => {
      byStatus[row.status] = row.c;
    });

    const total = statusCounts.reduce((s, r) => s + r.c, 0);

    const bySpecialtyRows = d.prepare(`
      SELECT
        specialty,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PROCESSED' THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN status = 'MISSING' THEN 1 ELSE 0 END) as missing
      FROM materials GROUP BY specialty
    `).all() as Array<{ specialty: Specialty; total: number; processed: number; missing: number }>;

    const bySpecialty: SummaryStat['bySpecialty'] = {
      HVAC: { total: 0, processed: 0, missing: 0 },
      ELECTRICAL: { total: 0, processed: 0, missing: 0 },
      PLUMBING: { total: 0, processed: 0, missing: 0 },
      FIRE: { total: 0, processed: 0, missing: 0 },
    };
    SPECIALTIES.forEach((sp) => {
      const row = bySpecialtyRows.find((r) => r.specialty === sp);
      if (row) {
        bySpecialty[sp] = { total: row.total, processed: row.processed, missing: row.missing };
      }
    });

    return {
      processed: byStatus['PROCESSED'] ?? 0,
      pending: byStatus['PENDING'] ?? 0,
      suspended: byStatus['SUSPENDED'] ?? 0,
      missing: byStatus['MISSING'] ?? 0,
      awaitingPm: byStatus['AWAITING_PM'] ?? 0,
      total,
      bySpecialty,
    };
  }
}
