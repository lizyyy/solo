const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const { Parser } = require('json2csv');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const dbPath = path.join(__dirname, 'data', 'settlement.db');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

let db;

function checkDatabase(req, res, next) {
  if (!fs.existsSync(dbPath)) {
    return res.status(500).json({
      error: '数据库未初始化',
      message: '请先运行 "npm run init-db" 初始化数据库',
      hint: '数据库文件路径: ' + dbPath
    });
  }
  if (!db) {
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({
          error: '数据库连接失败',
          message: err.message,
          hint: '请确保已运行初始化脚本'
        });
      }
    });
  }
  next();
}

app.use(checkDatabase);

const STATUS_MAP = {
  'PENDING': '待分账',
  'COMPENSATING': '补偿中',
  'COMPENSATED': '已补偿',
  'MANUAL_REQUIRED': '需人工',
  'CONFLICT': '冲突',
  'IMPORT_ERROR': '导入失败'
};

app.get('/api/records', (req, res) => {
  const { page = 1, pageSize = 20, status, transactionNo, batchNo } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = 'SELECT * FROM compensation_records WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM compensation_records WHERE 1=1';
  let params = [];
  let countParams = [];

  if (status) {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }
  if (transactionNo) {
    query += ' AND transaction_no LIKE ?';
    countQuery += ' AND transaction_no LIKE ?';
    params.push(`%${transactionNo}%`);
    countParams.push(`%${transactionNo}%`);
  }
  if (batchNo) {
    query += ' AND batch_no LIKE ?';
    countQuery += ' AND batch_no LIKE ?';
    params.push(`%${batchNo}%`);
    countParams.push(`%${batchNo}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.get(countQuery, countParams, (err, countResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      rows.forEach(row => {
        row.status_name = STATUS_MAP[row.status] || row.status;
        if (row.evidence) {
          try {
            row.evidence = JSON.parse(row.evidence);
          } catch (e) {}
        }
      });
      res.json({
        data: rows,
        total: countResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });
    });
  });
});

app.get('/api/records/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM compensation_records WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '记录不存在' });
    }
    row.status_name = STATUS_MAP[row.status] || row.status;
    if (row.evidence) {
      try {
        row.evidence = JSON.parse(row.evidence);
      } catch (e) {}
    }
    res.json({ data: row });
  });
});

app.get('/api/records/:id/history', (req, res) => {
  const { id } = req.params;
  db.all('SELECT * FROM compensation_history WHERE record_id = ? ORDER BY created_at ASC', [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    rows.forEach(row => {
      row.old_status_name = STATUS_MAP[row.old_status] || row.old_status || '-';
      row.new_status_name = STATUS_MAP[row.new_status] || row.new_status;
      if (row.old_evidence) {
        try {
          row.old_evidence = JSON.parse(row.old_evidence);
        } catch (e) {}
      }
      if (row.new_evidence) {
        try {
          row.new_evidence = JSON.parse(row.new_evidence);
        } catch (e) {}
      }
    });
    res.json({ data: rows });
  });
});

app.post('/api/records', (req, res) => {
  const { transaction_no, batch_no, recipient_id, recipient_name, recipient_type, amount, fail_reason, operator, remark } = req.body;
  
  if (!transaction_no || !batch_no || !recipient_id || !amount) {
    return res.status(400).json({ 
      error: '参数缺失', 
      required: ['transaction_no', 'batch_no', 'recipient_id', 'amount'] 
    });
  }

  const evidence = JSON.stringify({
    createTime: new Date().toISOString(),
    operator: operator || 'system',
    source: 'API'
  });

  db.run(`
    INSERT INTO compensation_records 
    (transaction_no, batch_no, recipient_id, recipient_name, recipient_type, amount, fail_reason, status, evidence, evidence_version, operator, remark, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 1, ?, ?, CURRENT_TIMESTAMP)
  `, [transaction_no, batch_no, recipient_id, recipient_name || recipient_id, recipient_type || 'MERCHANT', 
      amount, fail_reason || '', evidence, operator || 'system', remark || ''], 
  function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ 
          error: '记录已存在',
          message: '该交易号、分账方、补偿批次的组合已存在，防止重复登记'
        });
      }
      return res.status(500).json({ error: err.message });
    }

    const recordId = this.lastID;
    db.run(`
      INSERT INTO compensation_history 
      (record_id, transaction_no, batch_no, recipient_id, old_status, new_status, new_evidence, evidence_version, operation_type, operator, operation_remark, source)
      VALUES (?, ?, ?, ?, NULL, 'PENDING', ?, 1, 'CREATE', ?, '新建补偿登记', 'API')
    `, [recordId, transaction_no, batch_no, recipient_id, evidence, operator || 'system']);

    res.status(201).json({ 
      data: { id: recordId },
      message: '创建成功'
    });
  });
});

app.put('/api/records/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, operator, remark, evidence } = req.body;

  if (!status) {
    return res.status(400).json({ error: '状态不能为空' });
  }

  db.get('SELECT * FROM compensation_records WHERE id = ?', [id], (err, oldRecord) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!oldRecord) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const newEvidenceVersion = oldRecord.evidence_version + 1;
    const newEvidence = evidence ? JSON.stringify({
      ...(typeof evidence === 'string' ? {} : evidence),
      updateTime: new Date().toISOString(),
      operator: operator || 'system'
    }) : oldRecord.evidence;

    db.run(`
      UPDATE compensation_records 
      SET status = ?, evidence = ?, evidence_version = ?, operator = ?, remark = COALESCE(?, remark), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, newEvidence, newEvidenceVersion, operator || 'system', remark, id], 
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      db.run(`
        INSERT INTO compensation_history 
        (record_id, transaction_no, batch_no, recipient_id, old_status, new_status, old_evidence, new_evidence, evidence_version, operation_type, operator, operation_remark, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'STATUS_CHANGE', ?, ?, 'API')
      `, [id, oldRecord.transaction_no, oldRecord.batch_no, oldRecord.recipient_id,
          oldRecord.status, status, oldRecord.evidence, newEvidence, newEvidenceVersion,
          operator || 'system', remark || '状态变更']);

      res.json({ 
        message: '更新成功',
        evidence_version: newEvidenceVersion
      });
    });
  });
});

app.get('/api/export', (req, res) => {
  const { status, format = 'json' } = req.query;
  
  let query = 'SELECT * FROM compensation_records WHERE 1=1';
  let params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    rows.forEach(row => {
      row.status_name = STATUS_MAP[row.status] || row.status;
      if (row.evidence) {
        try {
          row.evidence = JSON.parse(row.evidence);
          row.evidence_str = JSON.stringify(row.evidence, null, 2);
        } catch (e) {
          row.evidence_str = row.evidence;
        }
      }
    });

    if (format === 'csv') {
      const fields = ['id', 'transaction_no', 'batch_no', 'recipient_id', 'recipient_name', 
                      'recipient_type', 'amount', 'fail_reason', 'status', 'status_name',
                      'evidence_version', 'operator', 'remark', 'created_at', 'updated_at'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(rows);
      
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.attachment(`compensation_records_${new Date().toISOString().split('T')[0]}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({ data: rows, total: rows.length });
    }
  });
});

app.get('/api/stats', (req, res) => {
  db.all(`
    SELECT status, COUNT(*) as count 
    FROM compensation_records 
    GROUP BY status
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const stats = {};
    rows.forEach(row => {
      stats[row.status] = {
        count: row.count,
        name: STATUS_MAP[row.status] || row.status
      };
    });
    res.json({ data: stats });
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`支付清结算服务分账失败补偿登记系统`);
  console.log(`========================================`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 文档:`);
  console.log(`  GET  /api/records      - 列表（支持分页、筛选）`);
  console.log(`  GET  /api/records/:id  - 详情`);
  console.log(`  GET  /api/records/:id/history - 历史记录`);
  console.log(`  POST /api/records      - 新建登记`);
  console.log(`  PUT  /api/records/:id/status - 更新状态`);
  console.log(`  GET  /api/export       - 导出（?format=csv）`);
  console.log(`  GET  /api/stats        - 统计`);
  console.log(`========================================`);
  
  if (!fs.existsSync(dbPath)) {
    console.log(`\n⚠️  警告: 数据库未初始化!`);
    console.log(`   请先运行: npm run init-db`);
  } else {
    console.log(`\n✅ 数据库已就绪`);
  }
  console.log(`========================================\n`);
});
