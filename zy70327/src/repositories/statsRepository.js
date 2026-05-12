const db = require('../config/database');

class StatsRepository {
  async getWeeklyStats() {
    const result = await db.query(`
      WITH weekly_new AS (
        SELECT COUNT(*) as new_count
        FROM archives
        WHERE first_seen_at >= date_trunc('week', NOW())
      ),
      weekly_recurrence AS (
        SELECT COUNT(*) as recurrence_count
        FROM archives
        WHERE status = 'resolved'
          AND last_seen_at >= date_trunc('week', NOW())
          AND first_seen_at < date_trunc('week', NOW())
      )
      SELECT 
        COALESCE(wn.new_count, 0) as new_count,
        COALESCE(wr.recurrence_count, 0) as recurrence_count
      FROM weekly_new wn
      CROSS JOIN weekly_recurrence wr
    `);
    return result.rows[0];
  }

  async getCategoryStats() {
    const result = await db.query(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(occurrence_count) as total_occurrences
      FROM archives
      GROUP BY category
      ORDER BY count DESC
    `);
    return result.rows;
  }

  async getStatusStats() {
    const result = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM archives
      GROUP BY status
      ORDER BY count DESC
    `);
    return result.rows;
  }

  async getTrendReport(days = 7) {
    const result = await db.query(`
      SELECT 
        date_trunc('day', created_at) as date,
        COUNT(*) as new_archives
      FROM archives
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY date_trunc('day', created_at)
      ORDER BY date ASC
    `);
    return result.rows;
  }

  async getTopSlowAPIs(limit = 10) {
    const result = await db.query(`
      SELECT 
        api_path,
        http_method,
        category,
        status,
        occurrence_count,
        last_seen_at,
        first_seen_at
      FROM archives
      ORDER BY occurrence_count DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }
}

module.exports = new StatsRepository();
