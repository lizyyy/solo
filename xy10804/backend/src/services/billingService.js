const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');

class BillingService {
  static async generateBillingSummary(tenantId, periodType = 'monthly') {
    return new Promise((resolve, reject) => {
      const now = new Date();
      let periodStart, periodEnd;

      if (periodType === 'daily') {
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }

      db.get(`
        SELECT 
          COUNT(*) as total_calls,
          SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as limited_calls
        FROM rate_limit_events
        WHERE tenant_id = ? AND triggered_at >= ? AND triggered_at < ?
      `, [tenantId, periodStart.toISOString(), periodEnd.toISOString()], (err, eventRow) => {
        if (err) return reject(err);

        db.get(`
          SELECT SUM(amount) as compensation_amount
          FROM compensation_records
          WHERE tenant_id = ? AND created_at >= ? AND created_at < ?
        `, [tenantId, periodStart.toISOString(), periodEnd.toISOString()], (err, compRow) => {
          if (err) return reject(err);

          const summaryId = uuidv4();
          db.run(`
            INSERT INTO billing_summaries (
              id, tenant_id, period_type, period_start, period_end,
              total_calls, limited_calls, compensation_amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generated')
          `, [
            summaryId, tenantId, periodType,
            periodStart.toISOString(), periodEnd.toISOString(),
            eventRow.total_calls || 0,
            eventRow.limited_calls || 0,
            compRow.compensation_amount || 0
          ], function(err) {
            if (err) reject(err);
            else resolve({ id: summaryId, tenantId, periodType, periodStart, periodEnd });
          });
        });
      });
    });
  }

  static async exportBillingToCSV(summaryId) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM billing_summaries WHERE id = ?`, [summaryId], (err, summary) => {
        if (err) return reject(err);
        if (!summary) return reject(new Error('账单摘要不存在'));

        db.all(`
          SELECT 
            rle.triggered_at as event_time,
            rle.event_type,
            rle.reason,
            rle.resolved,
            ag.name as api_group,
            t.name as tenant_name,
            cr.amount as compensation,
            cr.reason as compensation_reason,
            cr.operator
          FROM rate_limit_events rle
          LEFT JOIN api_groups ag ON rle.api_group_id = ag.id
          LEFT JOIN tenants t ON rle.tenant_id = t.id
          LEFT JOIN compensation_records cr ON rle.id = cr.rate_limit_event_id
          WHERE rle.tenant_id = ? AND rle.triggered_at >= ? AND rle.triggered_at < ?
          ORDER BY rle.triggered_at DESC
        `, [summary.tenant_id, summary.period_start, summary.period_end], (err, events) => {
          if (err) return reject(err);

          const fields = [
            'event_time', 'tenant_name', 'api_group', 'event_type',
            'reason', 'resolved', 'compensation', 'compensation_reason', 'operator'
          ];
          const json2csvParser = new Parser({ fields });
          const csv = json2csvParser.parse(events);

          db.run(`
            UPDATE billing_summaries SET exported = 1, exported_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [summaryId], (err) => {
            if (err) reject(err);
            else resolve({ csv, summary });
          });
        });
      });
    });
  }

  static getBillingSummaries(tenantId = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT bs.*, t.name as tenant_name
        FROM billing_summaries bs
        LEFT JOIN tenants t ON bs.tenant_id = t.id
      `;
      const params = [];
      if (tenantId) {
        query += ` WHERE bs.tenant_id = ?`;
        params.push(tenantId);
      }
      query += ` ORDER BY bs.created_at DESC`;
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = BillingService;
