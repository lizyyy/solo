const db = require('../config/database');
const moment = require('moment');

class BatchController {
  async createBatch(req, res) {
    try {
      const { import_by, shift_type, remark } = req.body;
      const batch_no = `BATCH${moment().format('YYYYMMDDHHmmss')}`;
      
      const result = await db.run(
        `INSERT INTO batches (batch_no, import_by, shift_type, remark) VALUES (?, ?, ?, ?)`,
        [batch_no, import_by, shift_type, remark]
      );

      const batch = await db.get(`SELECT * FROM batches WHERE id = ?`, [result.lastID]);
      
      res.status(201).json({
        success: true,
        message: '批次创建成功',
        data: batch
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getBatches(req, res) {
    try {
      const { status, shift_type, start_date, end_date } = req.query;
      let sql = `SELECT * FROM batches WHERE 1=1`;
      let params = [];

      if (status) {
        sql += ` AND status = ?`;
        params.push(status);
      }
      if (shift_type) {
        sql += ` AND shift_type = ?`;
        params.push(shift_type);
      }
      if (start_date) {
        sql += ` AND date(import_time) >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND date(import_time) <= ?`;
        params.push(end_date);
      }
      sql += ` ORDER BY import_time DESC`;

      const batches = await db.all(sql, params);
      res.json({ success: true, data: batches });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getBatchById(req, res) {
    try {
      const { id } = req.params;
      const batch = await db.get(`SELECT * FROM batches WHERE id = ?`, [id]);
      
      if (!batch) {
        return res.status(404).json({ success: false, message: '批次不存在' });
      }

      const criticalValues = await db.all(
        `SELECT cv.*, 
          (SELECT COUNT(*) FROM callbacks WHERE critical_value_id = cv.id) as callback_count
         FROM critical_values cv WHERE cv.batch_id = ?`,
        [id]
      );

      res.json({ 
        success: true, 
        data: { ...batch, critical_values: criticalValues } 
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateBatchStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, operator, reason } = req.body;

      await db.run(
        `UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id]
      );

      const batch = await db.get(`SELECT * FROM batches WHERE id = ?`, [id]);
      res.json({ success: true, message: '批次状态更新成功', data: batch });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new BatchController();
