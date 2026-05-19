const db = require('../config/database');
const moment = require('moment');
const csv = require('csv-parser');
const fs = require('fs');

class CriticalValueController {
  async importCSV(req, res) {
    try {
      const { batch_id } = req.body;
      const results = [];

      if (!req.file) {
        return res.status(400).json({ success: false, message: '请上传CSV文件' });
      }

      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          try {
            const insertedIds = [];
            
            for (const row of results) {
              const result = await db.run(
                `INSERT INTO critical_values 
                 (batch_id, patient_id, patient_name, ward, bed_no, test_item, test_result, 
                  reference_range, critical_level, report_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  batch_id,
                  row.patient_id || row.患者ID,
                  row.patient_name || row.患者姓名,
                  row.ward || row.科室,
                  row.bed_no || row.床号,
                  row.test_item || row.检验项目,
                  row.test_result || row.结果,
                  row.reference_range || row.参考范围,
                  row.critical_level || row.危急等级,
                  row.report_time || row.报告时间
                ]
              );
              insertedIds.push(result.lastID);
            }

            await this.checkMultipleRecords(batch_id);
            await this.checkTimeout(batch_id);

            fs.unlinkSync(req.file.path);

            res.json({
              success: true,
              message: `成功导入 ${insertedIds.length} 条危急值记录`,
              count: insertedIds.length
            });
          } catch (error) {
            res.status(500).json({ success: false, message: error.message });
          }
        });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async checkMultipleRecords(batch_id) {
    const patients = await db.all(
      `SELECT patient_id, COUNT(*) as count 
       FROM critical_values 
       WHERE batch_id = ? 
       GROUP BY patient_id 
       HAVING count > 1`,
      [batch_id]
    );

    for (const p of patients) {
      await db.run(
        `UPDATE critical_values SET has_multiple_records = 1 WHERE batch_id = ? AND patient_id = ?`,
        [batch_id, p.patient_id]
      );
    }
  }

  async checkTimeout(batch_id) {
    const THRESHOLD_MINUTES = 30;
    
    await db.run(
      `UPDATE critical_values 
       SET timeout_flag = 1 
       WHERE batch_id = ? 
       AND (strftime('%s', 'now') - strftime('%s', report_time)) / 60 > ?`,
      [batch_id, THRESHOLD_MINUTES]
    );
  }

  async getCriticalValues(req, res) {
    try {
      const { 
        batch_id, status, patient_id, patient_name, 
        has_multiple_records, timeout_flag, handover_gap 
      } = req.query;
      
      let sql = `SELECT cv.*, b.batch_no, b.import_time FROM critical_values cv 
                 LEFT JOIN batches b ON cv.batch_id = b.id WHERE 1=1`;
      let params = [];

      if (batch_id) {
        sql += ` AND cv.batch_id = ?`;
        params.push(batch_id);
      }
      if (status) {
        sql += ` AND cv.status = ?`;
        params.push(status);
      }
      if (patient_id) {
        sql += ` AND cv.patient_id LIKE ?`;
        params.push(`%${patient_id}%`);
      }
      if (patient_name) {
        sql += ` AND cv.patient_name LIKE ?`;
        params.push(`%${patient_name}%`);
      }
      if (has_multiple_records) {
        sql += ` AND cv.has_multiple_records = ?`;
        params.push(has_multiple_records);
      }
      if (timeout_flag) {
        sql += ` AND cv.timeout_flag = ?`;
        params.push(timeout_flag);
      }
      if (handover_gap) {
        sql += ` AND cv.handover_gap = ?`;
        params.push(handover_gap);
      }
      sql += ` ORDER BY cv.created_at DESC`;

      const values = await db.all(sql, params);
      res.json({ success: true, data: values, count: values.length });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getCriticalValueById(req, res) {
    try {
      const { id } = req.params;
      const value = await db.get(
        `SELECT cv.*, b.batch_no FROM critical_values cv 
         LEFT JOIN batches b ON cv.batch_id = b.id WHERE cv.id = ?`,
        [id]
      );

      if (!value) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      const callbacks = await db.all(
        `SELECT * FROM callbacks WHERE critical_value_id = ? ORDER BY created_at DESC`,
        [id]
      );

      const processing = await db.all(
        `SELECT * FROM processing_records WHERE critical_value_id = ? ORDER BY created_at DESC`,
        [id]
      );

      res.json({ 
        success: true, 
        data: { ...value, callbacks, processing_records: processing } 
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async processCriticalValue(req, res) {
    try {
      const { id } = req.params;
      const { action, operator, operator_role, reason, new_status } = req.body;

      const current = await db.get(`SELECT status FROM critical_values WHERE id = ?`, [id]);
      if (!current) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      await db.run(
        `INSERT INTO processing_records 
         (critical_value_id, action, operator, operator_role, reason, previous_status, new_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, action, operator, operator_role, reason, current.status, new_status || current.status]
      );

      if (new_status) {
        await db.run(
          `UPDATE critical_values SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [new_status, id]
        );
      }

      res.json({ 
        success: true, 
        message: '处理成功',
        action: action
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async markHandoverGap(req, res) {
    try {
      const { id } = req.params;
      const { operator, reason } = req.body;

      await db.run(
        `UPDATE critical_values SET handover_gap = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
      );

      await db.run(
        `INSERT INTO processing_records 
         (critical_value_id, action, operator, operator_role, reason, previous_status, new_status)
         VALUES (?, 'mark_handover_gap', ?, 'nurse', ?, NULL, NULL)`,
        [id, operator, reason]
      );

      res.json({ success: true, message: '已标记交接缺口' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new CriticalValueController();
