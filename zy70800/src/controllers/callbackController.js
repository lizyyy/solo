const db = require('../config/database');
const fs = require('fs');

class CallbackController {
  async importJSON(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请上传JSON文件' });
      }

      const data = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
      const callbacks = Array.isArray(data) ? data : [data];
      let count = 0;

      for (const cb of callbacks) {
        let criticalValueId = cb.critical_value_id;
        
        if (!criticalValueId && cb.patient_id && cb.test_item) {
          const cv = await db.get(
            `SELECT id FROM critical_values 
             WHERE patient_id = ? AND test_item = ? 
             ORDER BY report_time DESC LIMIT 1`,
            [cb.patient_id, cb.test_item]
          );
          if (cv) criticalValueId = cv.id;
        }

        if (criticalValueId) {
          await db.run(
            `INSERT INTO callbacks 
             (critical_value_id, call_time, caller, receiver, receiver_role, 
              callback_content, callback_status, confirm_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              criticalValueId,
              cb.call_time || cb.通话时间,
              cb.caller || cb. caller || cb.致电人,
              cb.receiver || cb.接听人,
              cb.receiver_role || cb.接听人角色,
              cb.callback_content || cb.回告内容,
              cb.callback_status || 'pending',
              cb.confirm_time || null
            ]
          );
          count++;
        }
      }

      fs.unlinkSync(req.file.path);
      res.json({ success: true, message: `成功导入 ${count} 条回告记录`, count });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getCallbacks(req, res) {
    try {
      const { critical_value_id, callback_status, receiver_role } = req.query;
      let sql = `SELECT * FROM callbacks WHERE 1=1`;
      let params = [];

      if (critical_value_id) {
        sql += ` AND critical_value_id = ?`;
        params.push(critical_value_id);
      }
      if (callback_status) {
        sql += ` AND callback_status = ?`;
        params.push(callback_status);
      }
      if (receiver_role) {
        sql += ` AND receiver_role = ?`;
        params.push(receiver_role);
      }
      sql += ` ORDER BY created_at DESC`;

      const callbacks = await db.all(sql, params);
      res.json({ success: true, data: callbacks });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async confirmCallback(req, res) {
    try {
      const { id } = req.params;
      const { confirmer, confirm_time } = req.body;

      await db.run(
        `UPDATE callbacks SET callback_status = 'confirmed', confirm_time = ? WHERE id = ?`,
        [confirm_time || new Date().toISOString(), id]
      );

      const callback = await db.get(`SELECT * FROM callbacks WHERE id = ?`, [id]);
      
      await db.run(
        `INSERT INTO processing_records 
         (critical_value_id, action, operator, operator_role, reason, previous_status, new_status)
         VALUES (?, 'confirm_callback', ?, 'doctor', '医生已确认回告', NULL, NULL)`,
        [callback.critical_value_id, confirmer]
      );

      res.json({ success: true, message: '回告确认成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createCallback(req, res) {
    try {
      const { 
        critical_value_id, call_time, caller, receiver, 
        receiver_role, callback_content 
      } = req.body;

      const result = await db.run(
        `INSERT INTO callbacks 
         (critical_value_id, call_time, caller, receiver, receiver_role, callback_content, callback_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [critical_value_id, call_time, caller, receiver, receiver_role, callback_content, 'pending']
      );

      const callback = await db.get(`SELECT * FROM callbacks WHERE id = ?`, [result.lastID]);
      res.status(201).json({ success: true, data: callback });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new CallbackController();
