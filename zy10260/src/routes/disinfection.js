const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { checkDuplicateRequest } = require('../middleware/duplicatePrevention');
const { DEVICE_STATUSES } = require('./devices');
const { recordOperation } = require('./history');

router.post('/', checkDuplicateRequest('disinfection_records'), (req, res) => {
  const { device_id, operator_id, operator_name, disinfection_time, disinfection_method } = req.body;
  const requestId = req.requestId;
  
  db.get('SELECT * FROM devices WHERE id = ?', [device_id], (err, device) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }
    
    const id = uuidv4();
    const disinfectionNo = `DISINF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const beforeState = { status: device.status, current_bed_id: device.current_bed_id, is_backup: device.is_backup };
    const afterState = { status: DEVICE_STATUSES.IN_STORAGE, current_bed_id: device.current_bed_id, is_backup: device.is_backup };
    
    db.run(
      `INSERT INTO disinfection_records (id, disinfection_no, device_id, operator_id, operator_name, disinfection_time, disinfection_method, status, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, disinfectionNo, device_id, operator_id, operator_name, disinfection_time, disinfection_method, 'completed', requestId],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
        }
        
        db.run(
          'UPDATE devices SET status = ? WHERE id = ?',
          [DEVICE_STATUSES.IN_STORAGE, device_id],
          async (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ success: false, message: '更新设备状态失败', error: updateErr.message });
            }
            
            try {
              await recordOperation('disinfection', disinfectionNo, device_id, null, operator_id, operator_name, disinfection_time, beforeState, afterState, requestId);
            } catch (recordErr) {
              console.error('记录操作历史失败:', recordErr);
            }
            
            res.status(201).json({
              success: true,
              data: { id, disinfection_no: disinfectionNo, device_id, status: 'completed' }
            });
          }
        );
      }
    );
  });
});

router.get('/', (req, res) => {
  const { device_id, operator_id, start_date, end_date } = req.query;
  let query = 'SELECT * FROM disinfection_records WHERE 1=1';
  const params = [];
  
  if (device_id) {
    query += ' AND device_id = ?';
    params.push(device_id);
  }
  if (operator_id) {
    query += ' AND operator_id = ?';
    params.push(operator_id);
  }
  if (start_date) {
    query += ' AND disinfection_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND disinfection_time <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY disinfection_time DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

module.exports = router;
