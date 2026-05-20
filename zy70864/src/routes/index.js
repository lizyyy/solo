const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const db = require('../database');
const { parseSendCSV, parseRecoveryJSON, parseRoomTypeConfig } = require('../utils/parser');

const upload = multer({ dest: path.join(__dirname, '..', '..', 'uploads') });

function logOperation(operationType, recordType, recordId, operator, action, reason, beforeStatus, afterStatus) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO operation_logs (operation_type, record_type, record_id, operator, action, reason, before_status, after_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [operationType, recordType, recordId, operator, action, reason, beforeStatus, afterStatus],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

router.post('/room-types/import', upload.single('file'), async (req, res) => {
  try {
    const data = await parseRoomTypeConfig(req.file.path);
    const results = [];
    
    for (const item of data) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO room_types (room_type, item_name, quantity, unit, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [item.room_type || item.roomType, item.item_name || item.itemName, 
           parseInt(item.quantity), item.unit || '件'],
          function(err) {
            if (err) reject(err);
            else {
              results.push({ id: this.lastID, ...item });
              resolve();
            }
          }
        );
      });
    }
    
    fs.unlinkSync(req.file.path);
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/room-types', (req, res) => {
  db.all(`SELECT * FROM room_types ORDER BY room_type, item_name`, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.post('/batches', upload.single('file'), async (req, res) => {
  try {
    const { batch_no, send_date, created_by } = req.body;
    const csvData = await parseSendCSV(req.file.path);
    
    db.run('BEGIN TRANSACTION');
    
    const batchResult = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO laundry_batches (batch_no, send_date, status, created_by)
         VALUES (?, ?, 'pending', ?)`,
        [batch_no, send_date, created_by],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
    
    let totalItems = 0;
    for (const item of csvData) {
      const qty = parseInt(item.quantity || item.send_quantity || 0);
      totalItems += qty;
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO laundry_items (batch_id, room_type, item_name, send_quantity)
           VALUES (?, ?, ?, ?)`,
          [batchResult.id, item.room_type || item.roomType, 
           item.item_name || item.itemName, qty],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE laundry_batches SET total_items = ? WHERE id = ?`,
        [totalItems, batchResult.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    await logOperation('batch', 'laundry_batches', batchResult.id, created_by, 
                      'create_batch', '导入送洗CSV创建批次', null, 'pending');
    
    db.run('COMMIT');
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      data: { batch_id: batchResult.id, batch_no, total_items: totalItems } 
    });
  } catch (err) {
    db.run('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/batches', (req, res) => {
  const { status, start_date, end_date } = req.query;
  let query = `SELECT * FROM laundry_batches WHERE 1=1`;
  const params = [];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (start_date) {
    query += ` AND send_date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND send_date <= ?`;
    params.push(end_date);
  }
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.get('/batches/:id', (req, res) => {
  db.get(`SELECT * FROM laundry_batches WHERE id = ?`, [req.params.id], (err, batch) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else if (!batch) {
      res.status(404).json({ success: false, error: '批次不存在' });
    } else {
      db.all(`SELECT * FROM laundry_items WHERE batch_id = ?`, [req.params.id], (err, items) => {
        if (err) {
          res.status(500).json({ success: false, error: err.message });
        } else {
          res.json({ success: true, data: { batch, items } });
        }
      });
    }
  });
});

router.post('/recovery', upload.single('file'), async (req, res) => {
  try {
    const { batch_id, handler } = req.body;
    const recoveryData = await parseRecoveryJSON(req.file.path);
    
    db.run('BEGIN TRANSACTION');
    
    const recoveryResult = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO recovery_records (batch_id, recovery_no, recovery_date, handler, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [batch_id, recoveryData.recovery_no || recoveryData.recoveryNo, 
         recoveryData.recovery_date || recoveryData.recoveryDate, handler],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
    
    for (const item of recoveryData.items || []) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO recovery_items (recovery_id, room_type, item_name, quantity)
           VALUES (?, ?, ?, ?)`,
          [recoveryResult.id, item.room_type || item.roomType, 
           item.item_name || item.itemName, parseInt(item.quantity || 0)],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    await logOperation('recovery', 'recovery_records', recoveryResult.id, handler,
                      'import_recovery', '导入回收单JSON', null, 'pending');
    
    db.run('COMMIT');
    fs.unlinkSync(req.file.path);
    
    res.json({ success: true, data: { recovery_id: recoveryResult.id } });
  } catch (err) {
    db.run('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/batches/:id/process', async (req, res) => {
  try {
    const { operator, action, reason, remark } = req.body;
    
    const batch = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM laundry_batches WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    
    let newStatus;
    let actionDesc;
    
    switch (action) {
      case 'approve':
        newStatus = 'approved';
        actionDesc = '审核通过';
        break;
      case 'reject':
        newStatus = 'rejected';
        actionDesc = '退回修改';
        break;
      case 'complete':
        newStatus = 'completed';
        actionDesc = '处理完成';
        break;
      default:
        return res.status(400).json({ success: false, error: '无效的操作类型' });
    }
    
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE laundry_batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newStatus, req.params.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    await logOperation('batch', 'laundry_batches', req.params.id, operator,
                      actionDesc, reason, batch.status, newStatus);
    
    if (remark) {
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE recovery_records SET remark = ?, status = ? WHERE batch_id = ?`,
          [remark, newStatus, req.params.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    res.json({ success: true, data: { batch_id: req.params.id, status: newStatus, action: actionDesc } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/compensation', async (req, res) => {
  try {
    const { batch_id, item_name, room_type, shortage_qty, damage_qty, duplicate_qty, 
            reason, handler, amount, remark } = req.body;
    
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO compensation_records 
         (batch_id, item_name, room_type, shortage_qty, damage_qty, duplicate_qty, 
          reason, handler, amount, status, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [batch_id, item_name, room_type, shortage_qty || 0, damage_qty || 0, 
         duplicate_qty || 0, reason, handler, amount || 0, remark],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
    
    await logOperation('compensation', 'compensation_records', result.id, handler,
                      'create_compensation', reason, null, 'pending');
    
    res.json({ success: true, data: { compensation_id: result.id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/compensations', (req, res) => {
  const { batch_id, status } = req.query;
  let query = `SELECT * FROM compensation_records WHERE 1=1`;
  const params = [];
  
  if (batch_id) {
    query += ` AND batch_id = ?`;
    params.push(batch_id);
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.get('/export/details', (req, res) => {
  const { batch_id, format = 'json' } = req.query;
  
  const query = `
    SELECT 
      b.batch_no,
      b.send_date,
      b.status as batch_status,
      i.room_type,
      i.item_name,
      i.send_quantity,
      i.recovery_quantity,
      (i.send_quantity - i.recovery_quantity) as difference
    FROM laundry_batches b
    JOIN laundry_items i ON b.id = i.batch_id
    WHERE (? IS NULL OR b.id = ?)
    ORDER BY b.batch_no, i.room_type, i.item_name
  `;
  
  db.all(query, [batch_id || null, batch_id || null], async (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else if (format === 'csv') {
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(rows);
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.attachment(`laundry_details_${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.json({ success: true, data: rows, count: rows.length });
    }
  });
});

router.get('/logs', (req, res) => {
  const { record_type, record_id, operator } = req.query;
  let query = `SELECT * FROM operation_logs WHERE 1=1`;
  const params = [];
  
  if (record_type) {
    query += ` AND record_type = ?`;
    params.push(record_type);
  }
  if (record_id) {
    query += ` AND record_id = ?`;
    params.push(record_id);
  }
  if (operator) {
    query += ` AND operator = ?`;
    params.push(operator);
  }
  query += ` ORDER BY created_at DESC LIMIT 100`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

module.exports = router;
