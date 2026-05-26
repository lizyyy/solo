const db = require('../database/db');
const { generateBatchNo } = require('../utils/generator');

class BatchService {
  async createBatch(data) {
    const { source_type, source_name, created_by, remark } = data;
    const batch_no = generateBatchNo();
    
    const result = await db.run(
      `INSERT INTO batches (batch_no, source_type, source_name, created_by, remark)
       VALUES (?, ?, ?, ?, ?)`,
      [batch_no, source_type, source_name, created_by, remark || null]
    );
    
    return await this.getBatchById(result.id);
  }

  async getBatchById(id) {
    return await db.get('SELECT * FROM batches WHERE id = ?', [id]);
  }

  async getBatchByNo(batch_no) {
    return await db.get('SELECT * FROM batches WHERE batch_no = ?', [batch_no]);
  }

  async listBatches(params = {}) {
    let sql = 'SELECT * FROM batches WHERE 1=1';
    const queryParams = [];
    
    if (params.source_type) {
      sql += ' AND source_type = ?';
      queryParams.push(params.source_type);
    }
    if (params.created_by) {
      sql += ' AND created_by = ?';
      queryParams.push(params.created_by);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (params.limit) {
      sql += ' LIMIT ?';
      queryParams.push(parseInt(params.limit));
    }
    if (params.offset) {
      sql += ' OFFSET ?';
      queryParams.push(parseInt(params.offset));
    }
    
    return await db.all(sql, queryParams);
  }

  async updateBatchCount(batch_id, count) {
    await db.run(
      'UPDATE batches SET total_count = total_count + ? WHERE id = ?',
      [count, batch_id]
    );
  }
}

module.exports = new BatchService();
