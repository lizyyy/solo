import scriptRepository from '../repositories/scriptRepository.js';
import exceptionRepository from '../repositories/exceptionRepository.js';
import reportRepository from '../repositories/reportRepository.js';
import activityRepository from '../repositories/activityRepository.js';
import db from '../db/init.js';
import type { DashboardStats } from '../types/index.js';

class DashboardService {
  getStats(): DashboardStats {
    const scriptCount = scriptRepository.count();
    const apiCallResult = db.prepare('SELECT COUNT(*) as count FROM api_call').get() as { count: number };
    const permissionResult = db.prepare('SELECT COUNT(*) as count FROM permission').get() as { count: number };
    const highRiskResult = db.prepare('SELECT COUNT(*) as count FROM risk_score WHERE total_score >= 70').get() as { count: number };
    const exceptionPending = exceptionRepository.countByStatus('pending');
    const reportDraft = reportRepository.countByStatus('draft');

    return {
      script_count: scriptCount,
      api_call_count: apiCallResult.count,
      permission_count: permissionResult.count,
      high_risk_count: highRiskResult.count,
      exception_pending_count: exceptionPending,
      report_draft_count: reportDraft,
    };
  }

  getActivities(limit = 20) {
    return activityRepository.list(limit);
  }

  getPermissionDistribution() {
    const rows = db.prepare('SELECT service, COUNT(*) as count FROM permission GROUP BY service ORDER BY count DESC LIMIT 10').all() as Array<{ service: string; count: number }>;
    return rows.map(r => ({ name: r.service, value: r.count }));
  }
}

export default new DashboardService();
