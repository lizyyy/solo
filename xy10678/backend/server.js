const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const ExcelJS = require('exceljs');
const { db, calculateExpiryRisk } = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const logOperation = (operationType, module, recordId, operator, beforeValues, afterValues, remarks = '') => {
  const logId = uuidv4();
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  db.run(`INSERT INTO operation_logs (id, operation_type, module, record_id, operator, operation_time, before_values, after_values, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [logId, operationType, module, recordId, operator, now,
     beforeValues ? JSON.stringify(beforeValues) : null,
     afterValues ? JSON.stringify(afterValues) : null,
     remarks]
  );
};

// 药箱位置 API
app.get('/api/boxes', (req, res) => {
  db.all(`SELECT * FROM medicine_boxes ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/boxes', (req, res) => {
  const { location_name, address, manager, phone } = req.body;
  const id = uuidv4();
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.run(`INSERT INTO medicine_boxes (id, location_name, address, manager, phone, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, location_name, address, manager, phone, now, now],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('create', 'medicine_box', id, manager, null, req.body, '创建药箱位置');
      res.json({ id, ...req.body, created_at: now, updated_at: now });
    }
  );
});

app.put('/api/boxes/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM medicine_boxes WHERE id = ?`, [id], (err, oldData) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldData) return res.status(404).json({ error: '记录不存在' });

    const { location_name, address, manager, phone, status } = req.body;
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    
    db.run(`UPDATE medicine_boxes SET location_name = ?, address = ?, manager = ?, phone = ?, status = ?, updated_at = ?
            WHERE id = ?`,
      [location_name, address, manager, phone, status, now, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logOperation('update', 'medicine_box', id, manager, oldData, req.body, '更新药箱位置');
        res.json({ success: true });
      }
    );
  });
});

// 药品批次 API
app.get('/api/batches', (req, res) => {
  db.all(`SELECT mb.*, mbl.location_name as box_name 
          FROM medicine_batches mb 
          LEFT JOIN medicine_boxes mbl ON mb.box_id = mbl.id 
          ORDER BY mb.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/batches', (req, res) => {
  const { box_id, medicine_name, batch_number, quantity, unit, production_date, expiry_date, supplier } = req.body;
  const id = uuidv4();
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.run(`INSERT INTO medicine_batches (id, box_id, medicine_name, batch_number, quantity, unit, production_date, expiry_date, supplier, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, box_id, medicine_name, batch_number, quantity, unit, production_date, expiry_date, supplier, now, now],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('create', 'medicine_batch', id, 'system', null, req.body, '创建药品批次');
      calculateExpiryRisk();
      res.json({ id, ...req.body, created_at: now, updated_at: now });
    }
  );
});

app.put('/api/batches/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM medicine_batches WHERE id = ?`, [id], (err, oldData) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldData) return res.status(404).json({ error: '记录不存在' });

    const { quantity, status } = req.body;
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    
    db.run(`UPDATE medicine_batches SET quantity = ?, status = ?, updated_at = ? WHERE id = ?`,
      [quantity, status, now, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logOperation('update', 'medicine_batch', id, 'system', oldData, req.body, '更新药品批次');
        res.json({ success: true });
      }
    );
  });
});

// 居民信息 API
app.get('/api/residents', (req, res) => {
  db.all(`SELECT * FROM residents ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/residents', (req, res) => {
  const { name, id_card, phone, address } = req.body;
  const id = uuidv4();
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.run(`INSERT INTO residents (id, name, id_card, phone, address, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, id_card, phone, address, now],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('create', 'resident', id, 'system', null, req.body, '创建居民信息');
      res.json({ id, ...req.body, created_at: now });
    }
  );
});

// 借用记录 API
app.get('/api/borrows', (req, res) => {
  db.all(`SELECT br.*, r.name as resident_name, mb.medicine_name, mbl.location_name as box_name
          FROM borrow_records br
          LEFT JOIN residents r ON br.resident_id = r.id
          LEFT JOIN medicine_batches mb ON br.batch_id = mb.id
          LEFT JOIN medicine_boxes mbl ON br.box_id = mbl.id
          ORDER BY br.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/borrows', (req, res) => {
  const { resident_id, batch_id, box_id, quantity, borrow_reason, borrow_date, expected_return_date, operator } = req.body;
  
  db.get(`SELECT quantity as available FROM medicine_batches WHERE id = ?`, [batch_id], (err, batch) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!batch || batch.available < quantity) {
      return res.status(400).json({ error: '库存不足', intercepted: true });
    }

    const id = uuidv4();
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    
    db.run(`INSERT INTO borrow_records (id, resident_id, batch_id, box_id, quantity, borrow_reason, borrow_date, expected_return_date, operator, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, resident_id, batch_id, box_id, quantity, borrow_reason, borrow_date, expected_return_date, operator, now, now],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run(`UPDATE medicine_batches SET quantity = quantity - ?, updated_at = ? WHERE id = ?`,
          [quantity, now, batch_id]);
        
        logOperation('create', 'borrow', id, operator, null, req.body, '创建借用记录');
        res.json({ id, ...req.body, created_at: now, updated_at: now });
      }
    );
  });
});

app.put('/api/borrows/:id/review', (req, res) => {
  const { id } = req.params;
  const { reviewer, review_comment, status } = req.body;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.get(`SELECT * FROM borrow_records WHERE id = ?`, [id], (err, oldData) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(`UPDATE borrow_records SET reviewer = ?, review_comment = ?, review_time = ?, status = ?, updated_at = ? WHERE id = ?`,
      [reviewer, review_comment, now, status, now, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logOperation('review', 'borrow', id, reviewer, oldData, req.body, '复核借用记录');
        res.json({ success: true });
      }
    );
  });
});

// 归还验收 API
app.get('/api/returns', (req, res) => {
  db.all(`SELECT ri.*, br.id as borrow_id, r.name as resident_name, mb.medicine_name
          FROM return_inspections ri
          LEFT JOIN borrow_records br ON ri.borrow_id = br.id
          LEFT JOIN residents r ON br.resident_id = r.id
          LEFT JOIN medicine_batches mb ON br.batch_id = mb.id
          ORDER BY ri.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/returns', (req, res) => {
  const { borrow_id, inspector, quantity_actual, condition, remarks } = req.body;
  const id = uuidv4();
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.run(`INSERT INTO return_inspections (id, borrow_id, inspection_date, inspector, quantity_actual, condition, remarks, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, borrow_id, now, inspector, quantity_actual, condition, remarks, now],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get(`SELECT batch_id, quantity FROM borrow_records WHERE id = ?`, [borrow_id], (err, borrow) => {
        if (borrow) {
          db.run(`UPDATE medicine_batches SET quantity = quantity + ?, updated_at = ? WHERE id = ?`,
            [quantity_actual, now, borrow.batch_id]);
          db.run(`UPDATE borrow_records SET actual_return_date = ?, status = 'returned', updated_at = ? WHERE id = ?`,
            [now, now, borrow_id]);
        }
      });
      
      logOperation('create', 'return', id, inspector, null, req.body, '创建归还验收记录');
      res.json({ id, ...req.body, inspection_date: now, created_at: now });
    }
  );
});

// 补给计划 API
app.get('/api/supplies', (req, res) => {
  db.all(`SELECT sp.*, mbl.location_name as box_name
          FROM supply_plans sp
          LEFT JOIN medicine_boxes mbl ON sp.box_id = mbl.id
          ORDER BY sp.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/supplies', (req, res) => {
  const { box_id, medicine_name, planned_quantity, unit, planned_date, supplier, responsible_person, remarks } = req.body;
  const id = uuidv4();
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.run(`INSERT INTO supply_plans (id, box_id, medicine_name, planned_quantity, unit, planned_date, supplier, responsible_person, remarks, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, box_id, medicine_name, planned_quantity, unit, planned_date, supplier, responsible_person, remarks, now, now],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('create', 'supply_plan', id, responsible_person, null, req.body, '创建补给计划');
      res.json({ id, ...req.body, created_at: now, updated_at: now });
    }
  );
});

app.put('/api/supplies/:id', (req, res) => {
  const { id } = req.params;
  const { status, actual_date } = req.body;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.get(`SELECT * FROM supply_plans WHERE id = ?`, [id], (err, oldData) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(`UPDATE supply_plans SET status = ?, actual_date = ?, updated_at = ? WHERE id = ?`,
      [status, actual_date || now, now, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logOperation('update', 'supply_plan', id, oldData.responsible_person, oldData, req.body, '更新补给计划状态');
        res.json({ success: true });
      }
    );
  });
});

// 操作日志 API
app.get('/api/logs', (req, res) => {
  db.all(`SELECT * FROM operation_logs ORDER BY operation_time DESC LIMIT 200`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(row => ({
      ...row,
      before_values: row.before_values ? JSON.parse(row.before_values) : null,
      after_values: row.after_values ? JSON.parse(row.after_values) : null
    })));
  });
});

// 效期风险 API
app.get('/api/expiry-risks', (req, res) => {
  calculateExpiryRisk();
  db.all(`SELECT er.*, mb.medicine_name, mb.batch_number, mbl.location_name as box_name
          FROM expiry_risk_records er
          LEFT JOIN medicine_batches mb ON er.batch_id = mb.id
          LEFT JOIN medicine_boxes mbl ON mb.box_id = mbl.id
          ORDER BY er.risk_date DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 导出报告 API
app.get('/api/export', (req, res) => {
  const { responsible_person, start_date, end_date, type } = req.query;
  
  let query = `SELECT * FROM operation_logs WHERE 1=1`;
  let params = [];
  
  if (responsible_person) {
    query += ` AND operator = ?`;
    params.push(responsible_person);
  }
  
  if (start_date) {
    query += ` AND operation_time >= ?`;
    params.push(start_date + ' 00:00:00');
  }
  
  if (end_date) {
    query += ` AND operation_time <= ?`;
    params.push(end_date + ' 23:59:59');
  }
  
  query += ` ORDER BY operation_time DESC`;
  
  db.all(query, params, async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('操作日志');
    
    worksheet.columns = [
      { header: '操作时间', key: 'operation_time', width: 20 },
      { header: '操作人', key: 'operator', width: 15 },
      { header: '模块', key: 'module', width: 15 },
      { header: '操作类型', key: 'operation_type', width: 15 },
      { header: '备注', key: 'remarks', width: 30 }
    ];
    
    rows.forEach(row => {
      worksheet.addRow({
        operation_time: row.operation_time,
        operator: row.operator,
        module: row.module,
        operation_type: row.operation_type,
        remarks: row.remarks
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=operation_logs.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  calculateExpiryRisk();
});
