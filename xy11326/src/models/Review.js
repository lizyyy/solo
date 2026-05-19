const { runQuery, getOne, getAll } = require('../database/connection');

class Review {
  static async create(data) {
    const now = new Date().toISOString();
    
    const result = await runQuery(`
      INSERT INTO reviews (
        workRecordId, reviewer, reviewResult, reviewComments, reviewDate, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      data.workRecordId,
      data.reviewer,
      data.reviewResult,
      data.reviewComments,
      data.reviewDate || now,
      now
    ]);
    
    return { id: result.id, ...data, createdAt: now };
  }

  static async findById(id) {
    return getOne(`
      SELECT r.*, wr.recordNo, o.name as operatorName
      FROM reviews r
      LEFT JOIN work_records wr ON r.workRecordId = wr.id
      LEFT JOIN operators o ON wr.operatorId = o.id
      WHERE r.id = ?
    `, [id]);
  }

  static async findByWorkRecordId(workRecordId) {
    return getAll(`
      SELECT r.*, wr.recordNo
      FROM reviews r
      LEFT JOIN work_records wr ON r.workRecordId = wr.id
      WHERE r.workRecordId = ?
      ORDER BY r.createdAt DESC
    `, [workRecordId]);
  }

  static async findAll(filters = {}) {
    let sql = `
      SELECT r.*, wr.recordNo, o.name as operatorName
      FROM reviews r
      LEFT JOIN work_records wr ON r.workRecordId = wr.id
      LEFT JOIN operators o ON wr.operatorId = o.id
      WHERE 1=1
    `;
    let params = [];
    
    if (filters.reviewResult) {
      sql += ' AND r.reviewResult = ?';
      params.push(filters.reviewResult);
    }
    if (filters.reviewer) {
      sql += ' AND r.reviewer = ?';
      params.push(filters.reviewer);
    }
    
    sql += ' ORDER BY r.createdAt DESC';
    return getAll(sql, params);
  }
}

module.exports = Review;
