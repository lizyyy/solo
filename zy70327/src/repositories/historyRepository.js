const db = require('../config/database');

class HistoryRepository {
  async create(historyData) {
    const result = await db.query(
      `INSERT INTO history 
       (archive_id, action, old_value, new_value, operator, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        historyData.archive_id,
        historyData.action,
        historyData.old_value,
        historyData.new_value,
        historyData.operator,
        historyData.comment,
      ]
    );
    return result.rows[0];
  }

  async findByArchiveId(archiveId) {
    const result = await db.query(
      `SELECT * FROM history WHERE archive_id = $1 ORDER BY created_at DESC`,
      [archiveId]
    );
    return result.rows;
  }

  async getStatusHistory(archiveId) {
    const result = await db.query(
      `SELECT * FROM history 
       WHERE archive_id = $1 AND action = 'status_change'
       ORDER BY created_at ASC`,
      [archiveId]
    );
    return result.rows;
  }
}

module.exports = new HistoryRepository();
