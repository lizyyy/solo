const db = require('../config/database');
const { RETURN_STATUS, RETURN_STATUS_LABELS, RETURN_REASONS, RETURN_REASON_LABELS, PRESCRIPTION_STATUS, PRESCRIPTION_STATUS_LABELS, BATCH_STATUS, BATCH_STATUS_LABELS } = require('../utils/enums');

class Report {
  static async getOverallStats() {
    const [prescriptionStats, batchStats, returnStats] = await Promise.all([
      this._getPrescriptionStats(),
      this._getBatchStats(),
      this._getReturnStats()
    ]);
    
    return {
      prescriptions: prescriptionStats,
      batches: batchStats,
      returns: returnStats
    };
  }

  static _getPrescriptionStats() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as in_production,
          SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as returned,
          SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as rework_in_progress,
          SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as delivered,
          SUM(return_count) as total_returns
        FROM prescriptions
      `, [
        PRESCRIPTION_STATUS.PENDING,
        PRESCRIPTION_STATUS.IN_PRODUCTION,
        PRESCRIPTION_STATUS.COMPLETED,
        PRESCRIPTION_STATUS.RETURNED,
        PRESCRIPTION_STATUS.REWORK_IN_PROGRESS,
        PRESCRIPTION_STATUS.DELIVERED
      ], (err, row) => {
        if (err) return reject(err);
        resolve({
          total: row.total || 0,
          byStatus: {
            pending: row.pending || 0,
            inProduction: row.in_production || 0,
            completed: row.completed || 0,
            returned: row.returned || 0,
            reworkInProgress: row.rework_in_progress || 0,
            delivered: row.delivered || 0
          },
          totalReturns: row.total_returns || 0,
          returnRate: row.total > 0 ? ((row.total_returns || 0) / row.total * 100).toFixed(2) + '%' : '0%'
        });
      });
    });
  }

  static _getBatchStats() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(*) as total,
          SUM(rework_count) as total_reworks,
          SUM(CASE WHEN rework_count > 0 THEN 1 ELSE 0 END) as batches_with_reworks
        FROM batches
      `, [], (err, row) => {
        if (err) return reject(err);
        resolve({
          total: row.total || 0,
          totalReworks: row.total_reworks || 0,
          batchesWithReworks: row.batches_with_reworks || 0,
          reworkRate: row.total > 0 ? ((row.batches_with_reworks || 0) / row.total * 100).toFixed(2) + '%' : '0%'
        });
      });
    });
  }

  static _getReturnStats() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          r.reason,
          COUNT(*) as count,
          SUM(CASE WHEN r.status = ? THEN 1 ELSE 0 END) as open_count,
          SUM(CASE WHEN r.status = ? THEN 1 ELSE 0 END) as resolved_count
        FROM returns r
        GROUP BY r.reason
        ORDER BY count DESC
      `, [RETURN_STATUS.SUBMITTED, RETURN_STATUS.RESOLVED], (err, rows) => {
        if (err) return reject(err);
        
        const totalOpen = rows.reduce((sum, r) => sum + (r.open_count || 0), 0);
        const totalResolved = rows.reduce((sum, r) => sum + (r.resolved_count || 0), 0);
        
        resolve({
          total: rows.reduce((sum, r) => sum + (r.count || 0), 0),
          totalOpen,
          totalResolved,
          byReason: rows.map(row => ({
            reason: row.reason,
            reasonLabel: RETURN_REASON_LABELS[row.reason] || row.reason,
            count: row.count,
            openCount: row.open_count,
            resolvedCount: row.resolved_count
          }))
        });
      });
    });
  }

  static async getResponsibilityReport() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          res.primary_department as department,
          COUNT(*) as responsibility_count,
          SUM(CASE WHEN res.severity = 'high' THEN 1 ELSE 0 END) as high_severity,
          SUM(CASE WHEN res.severity = 'medium' THEN 1 ELSE 0 END) as medium_severity,
          SUM(CASE WHEN res.severity = 'low' THEN 1 ELSE 0 END) as low_severity
        FROM responsibilities res
        GROUP BY res.primary_department
        ORDER BY responsibility_count DESC
      `, [], (err, rows) => {
        if (err) return reject(err);
        
        const total = rows.reduce((sum, r) => sum + (r.responsibility_count || 0), 0);
        
        resolve({
          total,
          byDepartment: rows.map(row => ({
            department: row.department,
            departmentLabel: require('../utils/enums').DEPARTMENT_LABELS[row.department] || row.department,
            count: row.responsibility_count,
            highSeverity: row.high_severity,
            mediumSeverity: row.medium_severity,
            lowSeverity: row.low_severity,
            percentage: total > 0 ? ((row.responsibility_count / total) * 100).toFixed(2) + '%' : '0%'
          }))
        });
      });
    });
  }

  static async getPrescriptionReturnHistory(prescriptionId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          r.*,
          res.primary_department,
          res.description as responsibility_description,
          res.severity
        FROM returns r
        LEFT JOIN responsibilities res ON r.id = res.return_id
        WHERE r.prescription_id = ?
        ORDER BY r.created_at DESC
      `, [prescriptionId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => ({
          returnId: row.id,
          reason: row.reason,
          reasonLabel: RETURN_REASON_LABELS[row.reason],
          reasonDetail: row.reason_detail,
          returnedBy: row.returned_by,
          status: row.status,
          statusLabel: RETURN_STATUS_LABELS[row.status],
          primaryDepartment: row.primary_department,
          primaryDepartmentLabel: row.primary_department ? require('../utils/enums').DEPARTMENT_LABELS[row.primary_department] : null,
          responsibilityDescription: row.responsibility_description,
          severity: row.severity,
          createdAt: row.created_at
        })));
      });
    });
  }
}

module.exports = Report;
