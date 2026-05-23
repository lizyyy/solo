const { run, get, all } = require('../config/dbUtils');

class ReconciliationSummary {
  static async create(data) {
    const result = await run(
      `INSERT OR REPLACE INTO reconciliation_summaries 
       (summary_date, total_renewals, renewal_amount, total_temporary_deductions, 
        temporary_amount, total_gate_events, total_supplementary, supplementary_amount, 
        discrepancy_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.summary_date,
        data.total_renewals || 0,
        data.renewal_amount || 0.00,
        data.total_temporary_deductions || 0,
        data.temporary_amount || 0.00,
        data.total_gate_events || 0,
        data.total_supplementary || 0,
        data.supplementary_amount || 0.00,
        data.discrepancy_amount || 0.00,
        data.status || 'pending'
      ]
    );
    return result.lastID;
  }

  static async findByDate(summaryDate) {
    return await get('SELECT * FROM reconciliation_summaries WHERE summary_date = ?', [summaryDate]);
  }

  static async listByDateRange(startDate, endDate) {
    return await all(
      `SELECT * FROM reconciliation_summaries 
       WHERE summary_date >= ? AND summary_date <= ?
       ORDER BY summary_date DESC`,
      [startDate, endDate]
    );
  }

  static async updateStatus(summaryDate, status) {
    return await run(
      `UPDATE reconciliation_summaries SET status = ? WHERE summary_date = ?`,
      [status, summaryDate]
    );
  }
}

module.exports = ReconciliationSummary;
