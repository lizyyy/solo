const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

const DEVICE_STATUSES = {
  IN_STORAGE: 'in_storage',
  IN_USE: 'in_use',
  FAULTY: 'faulty',
  IN_DISINFECTION: 'in_disinfection',
  MAINTENANCE: 'maintenance',
  RETIRED: 'retired'
};

const validateStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    [DEVICE_STATUSES.IN_STORAGE]: [DEVICE_STATUSES.IN_USE, DEVICE_STATUSES.MAINTENANCE, DEVICE_STATUSES.RETIRED],
    [DEVICE_STATUSES.IN_USE]: [DEVICE_STATUSES.FAULTY, DEVICE_STATUSES.IN_STORAGE, DEVICE_STATUSES.IN_DISINFECTION],
    [DEVICE_STATUSES.FAULTY]: [DEVICE_STATUSES.MAINTENANCE, DEVICE_STATUSES.IN_DISINFECTION, DEVICE_STATUSES.RETIRED],
    [DEVICE_STATUSES.IN_DISINFECTION]: [DEVICE_STATUSES.IN_STORAGE, DEVICE_STATUSES.IN_USE],
    [DEVICE_STATUSES.MAINTENANCE]: [DEVICE_STATUSES.IN_STORAGE, DEVICE_STATUSES.RETIRED],
    [DEVICE_STATUSES.RETIRED]: []
  };
  
  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
};

router.post('/', (req, res) => {
  const { 
    device_code, device_name, device_type, model, 
    manufacturer, purchase_date, status = DEVICE_STATUSES.IN_STORAGE,
    current_bed_id, is_backup = false
  } = req.body;
  
  const id = uuidv4();
  
  db.run(
    `INSERT INTO devices (id, device_code, device_name, device_type, model, manufacturer, purchase_date, status, current_bed_id, is_backup) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, device_code, device_name, device_type, model, manufacturer, purchase_date, status, current_bed_id, is_backup ? 1 : 0],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ success: false, message: '设备编码已存在' });
        }
        return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
      }
      res.status(201).json({
        success: true,
        data: { id, device_code, device_name, device_type, status, is_backup }
      });
    }
  );
});

router.get('/', (req, res) => {
  const { device_type, status, is_backup, current_bed_id } = req.query;
  let query = 'SELECT * FROM devices WHERE 1=1';
  const params = [];
  
  if (device_type) {
    query += ' AND device_type = ?';
    params.push(device_type);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (is_backup !== undefined) {
    query += ' AND is_backup = ?';
    params.push(is_backup ? 1 : 0);
  }
  if (current_bed_id) {
    query += ' AND current_bed_id = ?';
    params.push(current_bed_id);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM devices WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }
    res.json({ success: true, data: row });
  });
});

router.put('/:id/status', (req, res) => {
  const { new_status, remarks } = req.body;
  const deviceId = req.params.id;
  
  db.get('SELECT * FROM devices WHERE id = ?', [deviceId], (err, device) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }
    
    if (!validateStatusTransition(device.status, new_status)) {
      return res.status(400).json({ 
        success: false, 
        message: `不允许从 ${device.status} 变更到 ${new_status}`,
        valid_next_statuses: Object.values(DEVICE_STATUSES).filter(s => validateStatusTransition(device.status, s))
      });
    }
    
    db.run(
      'UPDATE devices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [new_status, deviceId],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
        }
        res.json({ 
          success: true, 
          message: '状态更新成功',
          data: { device_id: deviceId, old_status: device.status, new_status }
        });
      }
    );
  });
});

router.put('/:id/bind-bed', (req, res) => {
  const { bed_id } = req.body;
  const deviceId = req.params.id;
  
  db.get('SELECT * FROM devices WHERE id = ?', [deviceId], (err, device) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }
    
    if (device.status === DEVICE_STATUSES.FAULTY) {
      return res.status(400).json({ success: false, message: '故障设备不能绑定到床位' });
    }
    
    if (device.status === DEVICE_STATUSES.IN_DISINFECTION) {
      return res.status(400).json({ success: false, message: '未消毒设备不能投入使用' });
    }
    
    db.get('SELECT * FROM beds WHERE id = ?', [bed_id], (err, bed) => {
      if (err) {
        return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
      }
      if (!bed) {
        return res.status(404).json({ success: false, message: '床位不存在' });
      }
      
      db.run(
        'UPDATE devices SET current_bed_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [bed_id, DEVICE_STATUSES.IN_USE, deviceId],
        function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
          }
          res.json({ 
            success: true, 
            message: '设备绑定床位成功',
            data: { device_id: deviceId, bed_id, new_status: DEVICE_STATUSES.IN_USE }
          });
        }
      );
    });
  });
});

router.put('/:id/unbind-bed', (req, res) => {
  const deviceId = req.params.id;
  
  db.get('SELECT * FROM devices WHERE id = ?', [deviceId], (err, device) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }
    
    if (!device.current_bed_id) {
      return res.status(400).json({ success: false, message: '设备未绑定任何床位' });
    }
    
    db.run(
      'UPDATE devices SET current_bed_id = NULL, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [DEVICE_STATUSES.IN_STORAGE, deviceId],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
        }
        res.json({ 
          success: true, 
          message: '设备解绑床位成功',
          data: { device_id: deviceId, new_status: DEVICE_STATUSES.IN_STORAGE }
        });
      }
    );
  });
});

router.get('/:id/history', (req, res) => {
  const deviceId = req.params.id;
  db.all(
    `SELECT * FROM operation_history 
     WHERE device_id = ? 
     ORDER BY operation_time DESC`,
    [deviceId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
      }
      res.json({ success: true, data: rows });
    }
  );
});

module.exports = { router, DEVICE_STATUSES, validateStatusTransition };
