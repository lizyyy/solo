const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const { Parser } = require('json2csv');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./agricultural_inspection.db');

const STATUS_FLOW = {
  CREATED: '已创建',
  SAMPLED: '已留样',
  INSPECTED: '已送检',
  NORMAL: '检测正常',
  ABNORMAL: '检测异常',
  TAKEN_OFF: '已下架',
  REINSPECTION: '复检中',
  REINSPECTION_PASS: '复检通过',
  REINSPECTION_FAIL: '复检未通过'
};

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    vendor_name TEXT NOT NULL,
    stall_no TEXT NOT NULL,
    product_name TEXT NOT NULL,
    origin TEXT,
    quantity REAL,
    unit TEXT,
    arrival_date TEXT NOT NULL,
    status TEXT DEFAULT '已创建',
    sample_time TEXT,
    sample_operator TEXT,
    inspection_time TEXT,
    inspection_agency TEXT,
    inspection_no TEXT,
    result_time TEXT,
    result_items TEXT,
    result_summary TEXT,
    is_abnormal INTEGER DEFAULT 0,
    take_off_time TEXT,
    take_off_operator TEXT,
    reinspection_time TEXT,
    reinspection_operator TEXT,
    reinspection_agency TEXT,
    reinspection_no TEXT,
    reinspection_result_time TEXT,
    reinspection_result_summary TEXT,
    reinspection_pass INTEGER,
    restore_time TEXT,
    restore_operator TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    operation TEXT NOT NULL,
    operator TEXT,
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  )`);

  const sampleData = [
    {
      batch_no: 'NC20260501001',
      vendor_name: '张三农',
      stall_no: 'A-01',
      product_name: '生菜',
      origin: '山东寿光',
      quantity: 50,
      unit: 'kg',
      arrival_date: '2026-05-01',
      status: '检测正常',
      sample_time: '2026-05-01 08:30:00',
      sample_operator: '李检测',
      inspection_time: '2026-05-01 09:00:00',
      inspection_agency: '市农检中心',
      inspection_no: 'JJ20260501001',
      result_time: '2026-05-01 14:00:00',
      result_items: '毒死蜱:0.01mg/kg,氧乐果:未检出',
      result_summary: '检测合格',
      is_abnormal: 0
    },
    {
      batch_no: 'NC20260502002',
      vendor_name: '李四农',
      stall_no: 'A-02',
      product_name: '小白菜',
      origin: '广东佛山',
      quantity: 30,
      unit: 'kg',
      arrival_date: '2026-05-02',
      status: '检测异常',
      sample_time: '2026-05-02 08:15:00',
      sample_operator: '李检测',
      inspection_time: '2026-05-02 09:30:00',
      inspection_agency: '市农检中心',
      inspection_no: 'JJ20260502002',
      result_time: '2026-05-02 15:30:00',
      result_items: '毒死蜱:0.25mg/kg(超标),氧乐果:0.05mg/kg(超标)',
      result_summary: '农残超标，检测不合格',
      is_abnormal: 1
    },
    {
      batch_no: 'NC20260503003',
      vendor_name: '王五',
      stall_no: 'B-05',
      product_name: '西红柿',
      origin: '云南昆明',
      quantity: 80,
      unit: 'kg',
      arrival_date: '2026-05-03',
      status: '已留样',
      sample_time: '2026-05-03 10:00:00',
      sample_operator: '王检测'
    },
    {
      batch_no: 'NC20260504004',
      vendor_name: '赵六',
      stall_no: 'C-03',
      product_name: '黄瓜',
      origin: '河北保定',
      quantity: 60,
      unit: 'kg',
      arrival_date: '2026-05-04',
      status: '已创建'
    },
    {
      batch_no: 'NC20260505005',
      vendor_name: '钱七',
      stall_no: 'A-05',
      product_name: '芹菜',
      origin: '山东聊城',
      quantity: 45,
      unit: 'kg',
      arrival_date: '2026-05-05',
      status: '已下架',
      sample_time: '2026-05-05 08:00:00',
      sample_operator: '李检测',
      inspection_time: '2026-05-05 09:00:00',
      inspection_agency: '市农检中心',
      inspection_no: 'JJ20260505005',
      result_time: '2026-05-05 14:30:00',
      result_items: '克百威:0.08mg/kg(超标)',
      result_summary: '农残超标',
      is_abnormal: 1,
      take_off_time: '2026-05-05 15:00:00',
      take_off_operator: '张管理'
    },
    {
      batch_no: 'NC20260506006',
      vendor_name: '孙八',
      stall_no: 'B-02',
      product_name: '菠菜',
      origin: '河南商丘',
      quantity: 35,
      unit: 'kg',
      arrival_date: '2026-05-06',
      status: '复检中',
      sample_time: '2026-05-06 07:30:00',
      sample_operator: '李检测',
      inspection_time: '2026-05-06 09:00:00',
      inspection_agency: '市农检中心',
      inspection_no: 'JJ20260506006',
      result_time: '2026-05-06 14:00:00',
      result_items: '灭蝇胺:0.15mg/kg(超标)',
      result_summary: '农残超标',
      is_abnormal: 1,
      take_off_time: '2026-05-06 14:30:00',
      take_off_operator: '张管理',
      reinspection_time: '2026-05-07 09:00:00',
      reinspection_operator: '王检测',
      reinspection_agency: '省农检中心'
    },
    {
      batch_no: 'NC20260507007',
      vendor_name: '周九',
      stall_no: 'D-01',
      product_name: '油麦菜',
      origin: '福建漳州',
      quantity: 40,
      unit: 'kg',
      arrival_date: '2026-05-07',
      status: '复检通过',
      sample_time: '2026-05-07 08:00:00',
      sample_operator: '李检测',
      inspection_time: '2026-05-07 09:00:00',
      inspection_agency: '市农检中心',
      inspection_no: 'JJ20260507007',
      result_time: '2026-05-07 15:00:00',
      result_items: '吡虫啉:0.06mg/kg(超标)',
      result_summary: '农残超标',
      is_abnormal: 1,
      take_off_time: '2026-05-07 15:30:00',
      take_off_operator: '张管理',
      reinspection_time: '2026-05-08 09:00:00',
      reinspection_operator: '王检测',
      reinspection_agency: '省农检中心',
      reinspection_no: 'FJ20260508001',
      reinspection_result_time: '2026-05-08 16:00:00',
      reinspection_result_summary: '复检合格，农残符合标准',
      reinspection_pass: 1
    }
  ];

  const stmt = db.prepare(`INSERT OR IGNORE INTO batches 
    (batch_no, vendor_name, stall_no, product_name, origin, quantity, unit, arrival_date, status,
     sample_time, sample_operator, inspection_time, inspection_agency, inspection_no,
     result_time, result_items, result_summary, is_abnormal, take_off_time, take_off_operator,
     reinspection_time, reinspection_operator, reinspection_agency, reinspection_no,
     reinspection_result_time, reinspection_result_summary, reinspection_pass)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  sampleData.forEach(d => {
    stmt.run(d.batch_no, d.vendor_name, d.stall_no, d.product_name, d.origin, d.quantity, d.unit,
      d.arrival_date, d.status, d.sample_time, d.sample_operator, d.inspection_time, d.inspection_agency,
      d.inspection_no, d.result_time, d.result_items, d.result_summary, d.is_abnormal, d.take_off_time,
      d.take_off_operator, d.reinspection_time, d.reinspection_operator, d.reinspection_agency,
      d.reinspection_no, d.reinspection_result_time, d.reinspection_result_summary, d.reinspection_pass);
  });
  stmt.finalize();
});

const addLog = (batchId, operation, operator, remark = '') => {
  db.run(`INSERT INTO operation_logs (batch_id, operation, operator, remark) VALUES (?, ?, ?, ?)`,
    [batchId, operation, operator, remark]);
};

const VALID_TRANSITIONS = {
  '已创建': ['已留样'],
  '已留样': ['已送检'],
  '已送检': ['检测正常', '检测异常'],
  '检测异常': ['已下架'],
  '已下架': ['复检中'],
  '复检中': ['复检通过', '复检未通过'],
  '复检通过': [],
  '复检未通过': [],
  '检测正常': []
};

const ACTION_TO_STATUS = {
  sample: '已留样',
  inspect: '已送检',
  result_normal: '检测正常',
  result_abnormal: '检测异常',
  takeoff: '已下架',
  reinspect: '复检中',
  reinspect_pass: '复检通过',
  reinspect_fail: '复检未通过'
};

const ACTION_NAMES = {
  sample: '留样登记',
  inspect: '送检登记',
  result: '录入检测结果',
  takeoff: '商品下架',
  reinspect: '申请复检',
  reinspect_result: '录入复检结果',
  restore: '恢复上架'
};

const validateTransition = (currentStatus, targetStatus) => {
  const validNext = VALID_TRANSITIONS[currentStatus] || [];
  return validNext.includes(targetStatus);
};

const executeStateTransition = (batchId, action, targetStatus, operator, updateData, remark = '') => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id, status, batch_no FROM batches WHERE id = ?`, [batchId], (err, batch) => {
      if (err) {
        return reject({ status: 500, error: err.message });
      }
      if (!batch) {
        return reject({ status: 404, error: '批次不存在' });
      }

      if (batch.status === targetStatus) {
        return resolve({ 
          idempotent: true, 
          message: `已${ACTION_NAMES[action]}，无需重复操作`,
          batch_no: batch.batch_no
        });
      }

      if (!validateTransition(batch.status, targetStatus)) {
        return reject({ 
          status: 400, 
          error: `状态流转不合法，当前状态「${batch.status}」不能执行「${ACTION_NAMES[action]}」` 
        });
      }

      db.run(updateData.sql, updateData.params, function(updateErr) {
        if (updateErr) {
          return reject({ status: 500, error: updateErr.message });
        }
        
        if (this.changes === 0) {
          return resolve({ 
            idempotent: true, 
            message: '数据未变更，可能已操作' 
          });
        }

        addLog(batchId, ACTION_NAMES[action], operator, remark);
        resolve({ 
          idempotent: false, 
          message: `${ACTION_NAMES[action]}成功`,
          batch_no: batch.batch_no
        });
      });
    });
  });
};

app.get('/api/batches', (req, res) => {
  const { status, is_abnormal, keyword, stall_no, start_date, end_date } = req.query;
  let query = `SELECT * FROM batches WHERE 1=1`;
  let params = [];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (is_abnormal === '1') {
    query += ` AND is_abnormal = 1`;
  }
  if (is_abnormal === '0') {
    query += ` AND is_abnormal = 0`;
  }
  if (stall_no) {
    query += ` AND stall_no LIKE ?`;
    params.push(`%${stall_no}%`);
  }
  if (start_date) {
    query += ` AND arrival_date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND arrival_date <= ?`;
    params.push(end_date);
  }
  if (keyword) {
    query += ` AND (batch_no LIKE ? OR vendor_name LIKE ? OR product_name LIKE ? OR stall_no LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  query += ` ORDER BY created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/batches/stats', (req, res) => {
  db.get(`SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status IN ('已创建') THEN 1 ELSE 0 END) as not_sampled,
    SUM(CASE WHEN is_abnormal = 1 AND status NOT IN ('已下架', '复检中', '复检通过', '复检未通过') THEN 1 ELSE 0 END) as not_taken_off,
    SUM(CASE WHEN status = '复检通过' AND restore_time IS NULL THEN 1 ELSE 0 END) as not_restored
  FROM batches`, (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row);
  });
});

app.get('/api/batches/:id', (req, res) => {
  db.get(`SELECT * FROM batches WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else if (!row) res.status(404).json({ error: '批次不存在' });
    else res.json(row);
  });
});

app.post('/api/batches', (req, res) => {
  const { batch_no, vendor_name, stall_no, product_name, origin, quantity, unit, arrival_date } = req.body;
  
  if (!batch_no || !vendor_name || !stall_no || !product_name || !arrival_date) {
    return res.status(400).json({ error: '必填字段不能为空' });
  }

  db.run(`INSERT INTO batches 
    (batch_no, vendor_name, stall_no, product_name, origin, quantity, unit, arrival_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '已创建')`,
    [batch_no, vendor_name, stall_no, product_name, origin, quantity, unit, arrival_date],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: '批次号已存在，请勿重复录入' });
        }
        return res.status(500).json({ error: err.message });
      }
      addLog(this.lastID, '创建批次', req.body.operator || '系统', `批次号: ${batch_no}`);
      res.json({ id: this.lastID, message: '创建成功' });
    });
});

app.post('/api/batches/:id/sample', async (req, res) => {
  const { sample_operator, sample_time } = req.body;
  const operator = sample_operator || '系统';
  const finalTime = sample_time || new Date().toISOString();
  
  try {
    const result = await executeStateTransition(
      req.params.id,
      'sample',
      '已留样',
      operator,
      {
        sql: `UPDATE batches SET status = '已留样', sample_time = ?, sample_operator = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params: [finalTime, operator, req.params.id]
      },
      ''
    );
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error });
  }
});

app.post('/api/batches/:id/inspect', async (req, res) => {
  const { inspection_agency, inspection_no, inspection_time, operator } = req.body;
  const finalTime = inspection_time || new Date().toISOString();
  
  try {
    const result = await executeStateTransition(
      req.params.id,
      'inspect',
      '已送检',
      operator || '系统',
      {
        sql: `UPDATE batches SET status = '已送检', inspection_time = ?, inspection_agency = ?, inspection_no = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params: [finalTime, inspection_agency, inspection_no, req.params.id]
      },
      `检测机构: ${inspection_agency}`
    );
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error });
  }
});

app.post('/api/batches/:id/result', async (req, res) => {
  const { result_items, result_summary, is_abnormal, result_time, operator } = req.body;
  const status = is_abnormal ? '检测异常' : '检测正常';
  const finalTime = result_time || new Date().toISOString();
  const actionType = is_abnormal ? '检测异常' : '检测正常';
  
  try {
    const result = await executeStateTransition(
      req.params.id,
      'result',
      status,
      operator || '系统',
      {
        sql: `UPDATE batches SET status = ?, result_time = ?, result_items = ?, result_summary = ?, is_abnormal = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params: [status, finalTime, result_items, result_summary, is_abnormal ? 1 : 0, req.params.id]
      },
      actionType
    );
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error });
  }
});

app.post('/api/batches/:id/takeoff', async (req, res) => {
  const { take_off_operator, take_off_time } = req.body;
  const operator = take_off_operator || '系统';
  const finalTime = take_off_time || new Date().toISOString();
  
  try {
    const result = await executeStateTransition(
      req.params.id,
      'takeoff',
      '已下架',
      operator,
      {
        sql: `UPDATE batches SET status = '已下架', take_off_time = ?, take_off_operator = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params: [finalTime, operator, req.params.id]
      },
      '农残异常商品已下架'
    );
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error });
  }
});

app.post('/api/batches/:id/reinspect', async (req, res) => {
  const { reinspection_operator, reinspection_agency, reinspection_time } = req.body;
  const finalTime = reinspection_time || new Date().toISOString();
  
  try {
    const result = await executeStateTransition(
      req.params.id,
      'reinspect',
      '复检中',
      reinspection_operator || '系统',
      {
        sql: `UPDATE batches SET status = '复检中', reinspection_time = ?, reinspection_operator = ?, reinspection_agency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params: [finalTime, reinspection_operator, reinspection_agency, req.params.id]
      },
      `复检机构: ${reinspection_agency}`
    );
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error });
  }
});

app.post('/api/batches/:id/reinspect-result', async (req, res) => {
  const { reinspection_no, reinspection_result_summary, reinspection_pass, operator } = req.body;
  const status = reinspection_pass ? '复检通过' : '复检未通过';
  const remark = reinspection_pass ? '复检通过' : '复检未通过';
  
  try {
    const result = await executeStateTransition(
      req.params.id,
      'reinspect_result',
      status,
      operator || '系统',
      {
        sql: `UPDATE batches SET status = ?, reinspection_no = ?, reinspection_result_time = CURRENT_TIMESTAMP, reinspection_result_summary = ?, reinspection_pass = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params: [status, reinspection_no, reinspection_result_summary, reinspection_pass ? 1 : 0, req.params.id]
      },
      remark
    );
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error });
  }
});

app.post('/api/batches/:id/restore', async (req, res) => {
  const { restore_operator } = req.body;
  const batchId = req.params.id;
  
  try {
    const batch = await new Promise((resolve, reject) => {
      db.get(`SELECT id, status, restore_time FROM batches WHERE id = ?`, [batchId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    if (batch.status !== '复检通过') {
      return res.status(400).json({ error: `状态流转不合法，当前状态「${batch.status}」不能执行「恢复上架」` });
    }

    if (batch.restore_time) {
      return res.json({ idempotent: true, message: '已恢复上架，无需重复操作' });
    }

    db.run(
      `UPDATE batches SET restore_time = CURRENT_TIMESTAMP, restore_operator = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [restore_operator || '系统', batchId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          return res.json({ idempotent: true, message: '数据未变更，可能已恢复' });
        }
        addLog(batchId, '恢复上架', restore_operator, '复检通过后恢复上架');
        res.json({ idempotent: false, message: '恢复上架成功' });
      }
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/batches/:id/logs', (req, res) => {
  db.all(`SELECT * FROM operation_logs WHERE batch_id = ? ORDER BY created_at DESC`, [req.params.id], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/export/batches', (req, res) => {
  const { status, is_abnormal, keyword } = req.query;
  let query = `SELECT * FROM batches WHERE 1=1`;
  let params = [];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (is_abnormal === '1') {
    query += ` AND is_abnormal = 1`;
  }
  if (keyword) {
    query += ` AND (batch_no LIKE ? OR vendor_name LIKE ? OR product_name LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  query += ` ORDER BY created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else {
      try {
        const parser = new Parser();
        const csv = parser.parse(rows);
        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment(`农残检测批次_${new Date().toISOString().split('T')[0]}.csv`);
        res.send('\uFEFF' + csv);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`农产品留样送检台服务运行在 http://localhost:${PORT}`);
});
