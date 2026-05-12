const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { checkDuplicateRequest } = require('../middleware/duplicatePrevention');

router.post('/', checkDuplicateRequest('inspections'), (req, res) => {
  const {
    bed_id, device_id, inspector_id, inspector_name, inspection_time, status = 'normal', remarks } = req.body;
  const requestId = req.requestId;
  
  db.get('SELECT * FROM devices WHERE id = ?', [device_id], (err, device) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }
    
    if (device.current_bed_id !== bed_id) {
      return res.status(400).json({ success: false, message: '该设备不在此床位上' });
    }
    
    const id = uuidv4();
    const inspectionNo = `INSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    db.run(
      `INSERT INTO inspections (id, inspection_no, bed_id, device_id, inspector_id, inspector_name, inspection_time, status, remarks, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, inspectionNo, bed_id, device_id, inspector_id, inspector_name, inspection_time, status, remarks, requestId],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
        }
        res.status(201).json({
          success: true,
          data: { id, inspection_no: inspectionNo, bed_id, device_id, status }
        });
      }
    );
  });
});

router.get('/', (req, res) => {
  const { bed_id, device_id, inspector_id, status, start_date, end_date } = req.query;
  let query = 'SELECT * FROM inspections WHERE 1=1';
  const params = [];
  
  if (bed_id) {
    query += ' AND bed_id = ?';
    params.push(bed_id);
  }
  if (device_id) {
    query += ' AND device_id = ?';
    params.push(device_id);
  }
  if (inspector_id) {
    query += ' AND inspector_id = ?';
    params.push(inspector_id);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (start_date) {
    query += ' AND inspection_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND inspection_time <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY inspection_time DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM inspections WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: '巡检记录不存在' });
    }
    res.json({ success: true, data: row });
  });
});

module.exports = router;
