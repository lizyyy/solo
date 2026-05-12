const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { checkDuplicateRequest } = require('../middleware/duplicatePrevention');
const { DEVICE_STATUSES } = require('./devices');
const { recordOperation } = require('./history');

router.post('/', checkDuplicateRequest('faults'), (req, res) => {
  const {
    device_id, bed_id, reporter_id, reporter_name, report_time, fault_type, description, severity = 'medium' } = req.body;
  const requestId = req.requestId;
  
  db.get('SELECT * FROM devices WHERE id = ?', [device_id], (err, device) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }
    
    if (device.status === DEVICE_STATUSES.FAULTY) {
      return res.status(400).json({ success: false, message: '该设备已报故障' });
    }
    
    const id = uuidv4();
    const faultNo = `FAULT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const beforeState = { status: device.status, current_bed_id: device.current_bed_id, is_backup: device.is_backup };
    const afterState = { status: DEVICE_STATUSES.FAULTY, current_bed_id: device.current_bed_id, is_backup: device.is_backup };
    
    db.run(
      `INSERT INTO faults (id, fault_no, device_id, bed_id, reporter_id, reporter_name, report_time, fault_type, description, severity, status, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, faultNo, device_id, bed_id, reporter_id, reporter_name, report_time, fault_type, description, severity, 'reported', requestId],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
        }
        
        db.run(
          'UPDATE devices SET status = ? WHERE id = ?',
          [DEVICE_STATUSES.FAULTY, device_id],
          async (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ success: false, message: '更新设备状态失败', error: updateErr.message });
            }
            
            try {
              await recordOperation('fault_report', faultNo, device_id, bed_id, reporter_id, reporter_name, report_time, beforeState, afterState, requestId);
            } catch (recordErr) {
              console.error('记录操作历史失败:', recordErr);
            }
            
            res.status(201).json({
              success: true,
              data: { id, fault_no: faultNo, device_id, bed_id, status: 'reported' }
            });
          }
        );
      }
    );
  });
});

router.post('/:id/replace-device', checkDuplicateRequest('device_replacements'), (req, res) => {
  const faultId = req.params.id;
  const { replacement_device_id, operator_id, operator_name, operation_time, original_device_destination } = req.body;
  const requestId = req.requestId;
  
  if (!original_device_destination) {
    return res.status(400).json({ success: false, message: '必须指定原设备去向' });
  }
  
  db.get('SELECT * FROM faults WHERE id = ?', [faultId], (err, fault) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!fault) {
      return res.status(404).json({ success: false, message: '故障记录不存在' });
    }
    if (fault.status === 'resolved') {
      return res.status(400).json({ success: false, message: '该故障已处理，无需更换设备' });
    }
    
    db.get('SELECT * FROM devices WHERE id = ?', [fault.device_id], (err, originalDevice) => {
      if (err) {
        return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
      }
      if (!originalDevice) {
        return res.status(404).json({ success: false, message: '原设备不存在' });
      }
      
      db.get('SELECT * FROM devices WHERE id = ?', [replacement_device_id], (err, replacementDevice) => {
        if (err) {
          return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
        }
        if (!replacementDevice) {
          return res.status(404).json({ success: false, message: '备用设备不存在' });
        }
        
        if (!replacementDevice.is_backup) {
          return res.status(400).json({ success: false, message: '该设备不是备用机' });
        }
        if (replacementDevice.status !== DEVICE_STATUSES.IN_STORAGE) {
          return res.status(400).json({ success: false, message: '该备用机不在可用状态' });
        }
        
        const replacementId = uuidv4();
        const replacementNo = `REPL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        const originalBeforeState = { status: originalDevice.status, current_bed_id: originalDevice.current_bed_id, is_backup: originalDevice.is_backup };
        const originalAfterState = { status: DEVICE_STATUSES.IN_DISINFECTION, current_bed_id: null, is_backup: originalDevice.is_backup };
        const replacementBeforeState = { status: replacementDevice.status, current_bed_id: replacementDevice.current_bed_id, is_backup: replacementDevice.is_backup };
        const replacementAfterState = { status: DEVICE_STATUSES.IN_USE, current_bed_id: fault.bed_id, is_backup: false };
        
        db.run(
          `INSERT INTO device_replacements (id, replacement_no, fault_id, original_device_id, replacement_device_id, bed_id, operator_id, operator_name, operation_time, original_device_destination, request_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [replacementId, replacementNo, faultId, fault.device_id, replacement_device_id, fault.bed_id, operator_id, operator_name, operation_time, original_device_destination, requestId],
          function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
            }
            
            db.run(
              'UPDATE devices SET current_bed_id = NULL, status = ? WHERE id = ?',
              [DEVICE_STATUSES.IN_DISINFECTION, fault.device_id],
              (err1) => {
                if (err1) {
                  return res.status(500).json({ success: false, message: '更新原设备状态失败', error: err1.message });
                }
                
                db.run(
                  'UPDATE devices SET current_bed_id = ?, status = ?, is_backup = 0 WHERE id = ?',
                  [fault.bed_id, DEVICE_STATUSES.IN_USE, replacement_device_id],
                  (err2) => {
                    if (err2) {
                      return res.status(500).json({ success: false, message: '更新备用设备状态失败', error: err2.message });
                    }
                    
                    db.run(
                      'UPDATE faults SET status = ?, replacement_device_id = ? WHERE id = ?',
                      ['replaced', replacement_device_id, faultId],
                      async (err3) => {
                        if (err3) {
                          return res.status(500).json({ success: false, message: '更新故障状态失败', error: err3.message });
                        }
                        
                        try {
                          await recordOperation('device_replacement_original', replacementNo, fault.device_id, fault.bed_id, operator_id, operator_name, operation_time, originalBeforeState, originalAfterState, requestId);
                          await recordOperation('device_replacement_new', replacementNo, replacement_device_id, fault.bed_id, operator_id, operator_name, operation_time, replacementBeforeState, replacementAfterState, requestId + '-new');
                        } catch (recordErr) {
                          console.error('记录操作历史失败:', recordErr);
                        }
                        
                        res.status(201).json({
                          success: true,
                          data: {
                            id: replacementId,
                            replacement_no: replacementNo,
                            original_device_id: fault.device_id,
                            replacement_device_id,
                            bed_id: fault.bed_id,
                            original_device_destination
                          }
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      });
    });
  });
});

router.get('/', (req, res) => {
  const { device_id, bed_id, status, severity, start_date, end_date } = req.query;
  let query = 'SELECT * FROM faults WHERE 1=1';
  const params = [];
  
  if (device_id) {
    query += ' AND device_id = ?';
    params.push(device_id);
  }
  if (bed_id) {
    query += ' AND bed_id = ?';
    params.push(bed_id);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (severity) {
    query += ' AND severity = ?';
    params.push(severity);
  }
  if (start_date) {
    query += ' AND report_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND report_time <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY report_time DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM faults WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: '故障记录不存在' });
    }
    res.json({ success: true, data: row });
  });
});

module.exports = router;
