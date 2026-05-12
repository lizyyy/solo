const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

const recordOperation = (operation_type, operation_no, device_id, bed_id, operator_id, operator_name, operation_time, before_state, after_state, request_id) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      `INSERT INTO operation_history (id, operation_type, operation_no, device_id, bed_id, operator_id, operator_name, operation_time, before_state, after_state, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, operation_type, operation_no, device_id, bed_id, operator_id, operator_name, operation_time, JSON.stringify(before_state), JSON.stringify(after_state), request_id],
      function(err) {
        if (err) reject(err);
        else resolve(id);
      }
    );
  });
};

router.get('/', (req, res) => {
  const { device_id, bed_id, operator_id, operation_type, is_reverted, start_date, end_date } = req.query;
  let query = 'SELECT * FROM operation_history WHERE 1=1';
  const params = [];
  
  if (device_id) {
    query += ' AND device_id = ?';
    params.push(device_id);
  }
  if (bed_id) {
    query += ' AND bed_id = ?';
    params.push(bed_id);
  }
  if (operator_id) {
    query += ' AND operator_id = ?';
    params.push(operator_id);
  }
  if (operation_type) {
    query += ' AND operation_type = ?';
    params.push(operation_type);
  }
  if (is_reverted !== undefined) {
    query += ' AND is_reverted = ?';
    params.push(is_reverted ? 1 : 0);
  }
  if (start_date) {
    query += ' AND operation_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND operation_time <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY operation_time DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    const parsedRows = rows.map(row => ({
      ...row,
      before_state: row.before_state ? JSON.parse(row.before_state) : null,
      after_state: row.after_state ? JSON.parse(row.after_state) : null
    }));
    res.json({ success: true, data: parsedRows });
  });
});

router.post('/:id/revert', (req, res) => {
  const historyId = req.params.id;
  const { operator_id, operator_name } = req.body;
  
  db.get('SELECT * FROM operation_history WHERE id = ?', [historyId], (err, history) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!history) {
      return res.status(404).json({ success: false, message: '操作记录不存在' });
    }
    if (history.is_reverted) {
      return res.status(400).json({ success: false, message: '该操作已被撤销' });
    }
    
    const beforeState = JSON.parse(history.before_state);
    
    db.run(
      'UPDATE devices SET status = ?, current_bed_id = ?, is_backup = ? WHERE id = ?',
      [beforeState.status, beforeState.current_bed_id, beforeState.is_backup, history.device_id],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: '恢复设备状态失败', error: err.message });
        }
        
        db.run(
          'UPDATE operation_history SET is_reverted = 1, revert_time = CURRENT_TIMESTAMP WHERE id = ?',
          [historyId],
          function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: '更新操作记录失败', error: err.message });
            }
            
            res.json({
              success: true,
              message: '操作已撤销',
              data: {
                history_id: historyId,
                device_id: history.device_id,
                reverted_to: beforeState
              }
            });
          }
        );
      }
    );
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM operation_history WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: '操作记录不存在' });
    }
    const parsedRow = {
      ...row,
      before_state: row.before_state ? JSON.parse(row.before_state) : null,
      after_state: row.after_state ? JSON.parse(row.after_state) : null
    };
    res.json({ success: true, data: parsedRow });
  });
});

module.exports = { router, recordOperation };
