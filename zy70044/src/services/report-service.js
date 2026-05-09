const database = require('../database');
const { RESPONSIBILITIES, RESPONSIBILITY_NAMES } = require('../utils');

class ReportService {
  getLiabilityStats(startTime, endTime) {
    const stats = {};
    for (const resp of RESPONSIBILITIES) {
      let sql = `SELECT COUNT(*) as cnt FROM liability_freezes lf WHERE lf.responsibility = ?`;
      const params = [resp];
      
      if (startTime) {
        sql += ' AND lf.frozen_at >= ?';
        params.push(startTime);
      }
      if (endTime) {
        sql += ' AND lf.frozen_at <= ?';
        params.push(endTime);
      }

      const count = database.prepare(sql).get(...params);

      stats[resp] = {
        name: RESPONSIBILITY_NAMES[resp],
        freeze_count: count ? count.cnt : 0
      };
    }

    const total = Object.values(stats).reduce((sum, s) => sum + s.freeze_count, 0);

    return {
      period: { start: startTime, end: endTime },
      total_freezes: total,
      by_responsibility: stats
    };
  }

  getCostStats(startTime, endTime, responsibility = null) {
    let sql = `
      SELECT 
        cr.responsibility,
        cr.cost_type,
        cr.currency,
        COUNT(*) as count,
        SUM(cr.amount) as total_amount
      FROM cost_records cr
      WHERE 1=1
    `;
    const params = [];

    if (startTime) {
      sql += ' AND cr.recorded_at >= ?';
      params.push(startTime);
    }
    if (endTime) {
      sql += ' AND cr.recorded_at <= ?';
      params.push(endTime);
    }
    if (responsibility) {
      sql += ' AND cr.responsibility = ?';
      params.push(responsibility);
    }

    sql += ' GROUP BY cr.responsibility, cr.cost_type, cr.currency ORDER BY cr.responsibility, cr.cost_type';

    const rows = database.prepare(sql).all(...params);

    const result = {};
    for (const row of rows) {
      const respName = RESPONSIBILITY_NAMES[row.responsibility] || row.responsibility;
      if (!result[row.responsibility]) {
        result[row.responsibility] = {
          name: respName,
          currency: row.currency,
          total_amount: 0,
          cost_count: 0,
          by_type: {}
        };
      }
      result[row.responsibility].total_amount += row.total_amount;
      result[row.responsibility].cost_count += row.count;
      result[row.responsibility].by_type[row.cost_type] = {
        count: row.count,
        amount: row.total_amount
      };
    }

    return {
      period: { start: startTime, end: endTime },
      by_responsibility: result
    };
  }

  getOrderStatusStats() {
    const sql = 'SELECT status, COUNT(*) as count FROM repair_orders GROUP BY status';
    const rows = database.prepare(sql).all();

    const stats = {};
    for (const row of rows) {
      stats[row.status] = row.count;
    }

    const totalResult = database.prepare('SELECT COUNT(*) as cnt FROM repair_orders').get();

    return {
      total_orders: totalResult ? totalResult.cnt : 0,
      by_status: stats
    };
  }

  getRejudgeStats(startTime, endTime) {
    let sql = `
      SELECT 
        rr.status,
        rr.new_responsibility,
        COUNT(*) as count
      FROM rejudge_records rr
      WHERE 1=1
    `;
    const params = [];

    if (startTime) {
      sql += ' AND rr.operated_at >= ?';
      params.push(startTime);
    }
    if (endTime) {
      sql += ' AND rr.operated_at <= ?';
      params.push(endTime);
    }

    sql += ' GROUP BY rr.status, rr.new_responsibility';

    const rows = database.prepare(sql).all(...params);

    const result = {
      pending: 0,
      approved: 0,
      rejected: 0,
      by_responsibility: {}
    };

    for (const row of rows) {
      if (row.status === 'PENDING') result.pending += row.count;
      if (row.status === 'APPROVED') result.approved += row.count;
      if (row.status === 'REJECTED') result.rejected += row.count;

      if (row.status === 'APPROVED') {
        const respName = RESPONSIBILITY_NAMES[row.new_responsibility] || row.new_responsibility;
        if (!result.by_responsibility[row.new_responsibility]) {
          result.by_responsibility[row.new_responsibility] = {
            name: respName,
            approved_count: 0
          };
        }
        result.by_responsibility[row.new_responsibility].approved_count += row.count;
      }
    }

    return {
      period: { start: startTime, end: endTime },
      total_rejudges: result.pending + result.approved + result.rejected,
      pending: result.pending,
      approved: result.approved,
      rejected: result.rejected,
      approved_by_responsibility: result.by_responsibility
    };
  }

  getFullReport(startTime, endTime) {
    return {
      liability: this.getLiabilityStats(startTime, endTime),
      cost: this.getCostStats(startTime, endTime),
      order_status: this.getOrderStatusStats(),
      rejudge: this.getRejudgeStats(startTime, endTime)
    };
  }
}

module.exports = new ReportService();
