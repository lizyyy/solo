const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const moment = require('moment');
const ExcelJS = require('exceljs');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

function generateNo(prefix) {
  return prefix + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
}

function logOperation(module, operationType, recordId, operator, oldValue, newValue, remark) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO operation_logs (module, operation_type, record_id, operator, old_value, new_value, remark) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [module, operationType, recordId, operator, JSON.stringify(oldValue), JSON.stringify(newValue), remark],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

app.get('/api/properties', (req, res) => {
  db.all(`SELECT * FROM properties ORDER BY property_no`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/properties', (req, res) => {
  const { property_no, building_no, unit_no, room_no, area, price, operator } = req.body;
  db.run(
    `INSERT INTO properties (property_no, building_no, unit_no, room_no, area, price) VALUES (?, ?, ?, ?, ?, ?)`,
    [property_no, building_no, unit_no, room_no, area, price],
    async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      await logOperation('property', 'create', this.lastID, operator, null, req.body, '创建房源');
      res.json({ id: this.lastID, message: '创建成功' });
    }
  );
});

app.put('/api/properties/:id', (req, res) => {
  const { id } = req.params;
  const { status, operator } = req.body;
  
  db.get(`SELECT * FROM properties WHERE id = ?`, [id], async (err, oldProp) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(`UPDATE properties SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id], async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      await logOperation('property', 'update', id, operator, oldProp, { ...oldProp, status }, '更新房源状态');
      res.json({ message: '更新成功' });
    });
  });
});

app.get('/api/subscriptions', (req, res) => {
  db.all(`
    SELECT s.*, p.property_no, p.building_no, p.unit_no, p.room_no 
    FROM subscriptions s 
    JOIN properties p ON s.property_id = p.id 
    ORDER BY s.apply_time DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/subscriptions', (req, res) => {
  const { property_id, customer_name, customer_phone, id_card, intended_price, applicant } = req.body;
  const subscription_no = generateNo('SUB');

  db.get(`SELECT * FROM properties WHERE id = ? AND status = 'available'`, [property_id], (err, property) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!property) return res.status(400).json({ error: '房源不可用' });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      db.run(
        `INSERT INTO subscriptions (subscription_no, property_id, customer_name, customer_phone, id_card, intended_price, applicant) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [subscription_no, property_id, customer_name, customer_phone, id_card, intended_price, applicant],
        async function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          
          const subId = this.lastID;
          
          db.run(`UPDATE properties SET status = 'reserved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [property_id], async (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            
            await logOperation('subscription', 'create', subId, applicant, null, req.body, '创建认购申请');
            db.run('COMMIT');
            res.json({ id: subId, subscription_no, message: '申请提交成功' });
          });
        }
      );
    });
  });
});

app.put('/api/subscriptions/:id/review', (req, res) => {
  const { id } = req.params;
  const { status, reviewer, review_comment } = req.body;

  db.get(`SELECT * FROM subscriptions WHERE id = ?`, [id], async (err, oldSub) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldSub) return res.status(404).json({ error: '认购申请不存在' });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(
        `UPDATE subscriptions SET status = ?, reviewer = ?, review_time = CURRENT_TIMESTAMP, review_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, reviewer, review_comment, id],
        async (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          if (status === 'rejected') {
            db.run(`UPDATE properties SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [oldSub.property_id], async (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }
              await logOperation('subscription', 'review', id, reviewer, oldSub, { ...oldSub, status }, status === 'approved' ? '审核通过' : '审核拒绝');
              db.run('COMMIT');
              res.json({ message: '审核完成' });
            });
          } else {
            await logOperation('subscription', 'review', id, reviewer, oldSub, { ...oldSub, status }, '审核通过');
            db.run('COMMIT');
            res.json({ message: '审核完成' });
          }
        }
      );
    });
  });
});

app.get('/api/deposits', (req, res) => {
  db.all(`
    SELECT d.*, s.subscription_no, s.customer_name, p.property_no 
    FROM deposits d 
    JOIN subscriptions s ON d.subscription_id = s.id 
    JOIN properties p ON s.property_id = p.id 
    ORDER BY d.created_at DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/deposits', (req, res) => {
  const { subscription_id, amount, payment_method, transaction_no, operator } = req.body;
  const deposit_no = generateNo('DEP');

  db.get(`SELECT * FROM subscriptions WHERE id = ? AND status = 'approved'`, [subscription_id], (err, sub) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!sub) return res.status(400).json({ error: '认购申请未审核通过' });

    db.get(`SELECT * FROM deposits WHERE subscription_id = ? AND status = 'confirmed'`, [subscription_id], (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });
      if (existing) return res.status(400).json({ error: '该认购已支付定金' });

      db.run(
        `INSERT INTO deposits (deposit_no, subscription_id, amount, payment_method, transaction_no, status, operator, payment_time) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, CURRENT_TIMESTAMP)`,
        [deposit_no, subscription_id, amount, payment_method, transaction_no, operator],
        async function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          await logOperation('deposit', 'create', this.lastID, operator, null, req.body, '定金支付');
          
          db.get(`SELECT * FROM deal_status WHERE subscription_id = ?`, [subscription_id], (err, deal) => {
            if (!deal) {
              db.run(`INSERT INTO deal_status (subscription_id, status, deal_time, operator) VALUES (?, 'deposit_paid', CURRENT_TIMESTAMP, ?)`,
                [subscription_id, operator]);
            }
          });
          
          res.json({ id: this.lastID, deposit_no, message: '支付成功' });
        }
      );
    });
  });
});

app.get('/api/room-changes', (req, res) => {
  db.all(`
    SELECT rc.*, s.subscription_no, s.customer_name, 
           p1.property_no as old_property_no, 
           p2.property_no as new_property_no 
    FROM room_changes rc 
    JOIN subscriptions s ON rc.subscription_id = s.id 
    JOIN properties p1 ON rc.old_property_id = p1.id 
    JOIN properties p2 ON rc.new_property_id = p2.id 
    ORDER BY rc.apply_time DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/room-changes', (req, res) => {
  const { subscription_id, new_property_id, reason, applicant } = req.body;
  const change_no = generateNo('CHG');

  db.get(`SELECT * FROM subscriptions WHERE id = ?`, [subscription_id], (err, sub) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!sub) return res.status(404).json({ error: '认购申请不存在' });

    db.get(`SELECT * FROM properties WHERE id = ? AND status = 'available'`, [new_property_id], (err, newProp) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!newProp) return res.status(400).json({ error: '新房源不可用' });

      db.get(`SELECT price FROM properties WHERE id = ?`, [sub.property_id], (err, oldProp) => {
        const price_diff = newProp.price - oldProp.price;

        db.run(
          `INSERT INTO room_changes (change_no, subscription_id, old_property_id, new_property_id, reason, price_diff, applicant) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [change_no, subscription_id, sub.property_id, new_property_id, reason, price_diff, applicant],
          async function(err) {
            if (err) return res.status(500).json({ error: err.message });
            await logOperation('room_change', 'create', this.lastID, applicant, null, req.body, '换房申请');
            res.json({ id: this.lastID, change_no, message: '申请提交成功' });
          }
        );
      });
    });
  });
});

app.put('/api/room-changes/:id/review', (req, res) => {
  const { id } = req.params;
  const { status, reviewer, review_comment } = req.body;

  db.get(`SELECT * FROM room_changes WHERE id = ?`, [id], async (err, oldChange) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldChange) return res.status(404).json({ error: '换房申请不存在' });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(
        `UPDATE room_changes SET status = ?, reviewer = ?, review_time = CURRENT_TIMESTAMP, review_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, reviewer, review_comment, id],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          if (status === 'approved') {
            db.run(`UPDATE properties SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [oldChange.old_property_id]);
            db.run(`UPDATE properties SET status = 'reserved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [oldChange.new_property_id]);
            db.run(`UPDATE subscriptions SET property_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [oldChange.new_property_id, oldChange.subscription_id]);
          }

          logOperation('room_change', 'review', id, reviewer, oldChange, { ...oldChange, status }, status === 'approved' ? '审核通过' : '审核拒绝');
          db.run('COMMIT');
          res.json({ message: '审核完成' });
        }
      );
    });
  });
});

app.get('/api/refunds', (req, res) => {
  db.all(`
    SELECT r.*, s.subscription_no, s.customer_name, d.deposit_no, d.amount as deposit_amount 
    FROM refunds r 
    JOIN subscriptions s ON r.subscription_id = s.id 
    JOIN deposits d ON r.deposit_id = d.id 
    ORDER BY r.apply_time DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/refunds', (req, res) => {
  const { subscription_id, deposit_id, amount, reason, applicant } = req.body;
  const refund_no = generateNo('REF');

  db.get(`SELECT * FROM deposits WHERE id = ? AND status = 'confirmed'`, [deposit_id], (err, deposit) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!deposit) return res.status(400).json({ error: '定金记录不存在或未确认' });

    db.run(
      `INSERT INTO refunds (refund_no, subscription_id, deposit_id, amount, reason, applicant) VALUES (?, ?, ?, ?, ?, ?)`,
      [refund_no, subscription_id, deposit_id, amount, reason, applicant],
      async function(err) {
        if (err) return res.status(500).json({ error: err.message });
        await logOperation('refund', 'create', this.lastID, applicant, null, req.body, '退定申请');
        res.json({ id: this.lastID, refund_no, message: '申请提交成功' });
      }
    );
  });
});

app.put('/api/refunds/:id/review', (req, res) => {
  const { id } = req.params;
  const { status, reviewer, review_comment } = req.body;

  db.get(`SELECT * FROM refunds WHERE id = ?`, [id], async (err, oldRefund) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRefund) return res.status(404).json({ error: '退定申请不存在' });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(
        `UPDATE refunds SET status = ?, reviewer = ?, review_time = CURRENT_TIMESTAMP, review_comment = ?, refund_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, reviewer, review_comment, id],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          if (status === 'approved') {
            db.run(`UPDATE deposits SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [oldRefund.deposit_id]);
            db.run(`UPDATE subscriptions SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [oldRefund.subscription_id]);
            db.get(`SELECT property_id FROM subscriptions WHERE id = ?`, [oldRefund.subscription_id], (err, sub) => {
              if (sub) {
                db.run(`UPDATE properties SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sub.property_id]);
              }
            });
            db.run(`UPDATE deal_status SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE subscription_id = ?`, [oldRefund.subscription_id]);
          }

          logOperation('refund', 'review', id, reviewer, oldRefund, { ...oldRefund, status }, status === 'approved' ? '审核通过' : '审核拒绝');
          db.run('COMMIT');
          res.json({ message: '审核完成' });
        }
      );
    });
  });
});

app.get('/api/deal-status', (req, res) => {
  db.all(`
    SELECT ds.*, s.subscription_no, s.customer_name, p.property_no 
    FROM deal_status ds 
    JOIN subscriptions s ON ds.subscription_id = s.id 
    JOIN properties p ON s.property_id = p.id 
    ORDER BY ds.updated_at DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/logs', (req, res) => {
  const { operator, startDate, endDate } = req.query;
  let query = `SELECT * FROM operation_logs WHERE 1=1`;
  let params = [];

  if (operator) {
    query += ` AND operator = ?`;
    params.push(operator);
  }
  if (startDate) {
    query += ` AND operation_time >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND operation_time <= ?`;
    params.push(endDate + ' 23:59:59');
  }
  query += ` ORDER BY operation_time DESC`;

  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/export', async (req, res) => {
  const { operator, startDate, endDate } = req.query;
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '售楼系统';
  
  const logSheet = workbook.addWorksheet('操作日志');
  logSheet.columns = [
    { header: '模块', key: 'module', width: 15 },
    { header: '操作类型', key: 'operation_type', width: 15 },
    { header: '操作人', key: 'operator', width: 15 },
    { header: '操作时间', key: 'operation_time', width: 20 },
    { header: '原值', key: 'old_value', width: 50 },
    { header: '新值', key: 'new_value', width: 50 },
    { header: '备注', key: 'remark', width: 30 }
  ];

  let query = `SELECT * FROM operation_logs WHERE 1=1`;
  let params = [];

  if (operator) {
    query += ` AND operator = ?`;
    params.push(operator);
  }
  if (startDate) {
    query += ` AND operation_time >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND operation_time <= ?`;
    params.push(endDate + ' 23:59:59');
  }
  query += ` ORDER BY operation_time DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    logSheet.addRows(rows);
    
    const subSheet = workbook.addWorksheet('认购记录');
    subSheet.columns = [
      { header: '认购编号', key: 'subscription_no', width: 20 },
      { header: '客户姓名', key: 'customer_name', width: 15 },
      { header: '房源', key: 'property_no', width: 15 },
      { header: '状态', key: 'status', width: 10 },
      { header: '申请人', key: 'applicant', width: 15 },
      { header: '申请时间', key: 'apply_time', width: 20 }
    ];

    db.all(`SELECT s.*, p.property_no FROM subscriptions s JOIN properties p ON s.property_id = p.id ORDER BY apply_time DESC`, (err, subs) => {
      if (err) return res.status(500).json({ error: err.message });
      subSheet.addRows(subs);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=销售数据.xlsx');
      workbook.xlsx.write(res);
    });
  });
});

app.post('/api/sample-data', async (req, res) => {
  const { operator } = req.body;
  
  db.serialize(async () => {
    db.run('BEGIN TRANSACTION');

    const properties = [
      { property_no: 'B1-1-101', building_no: '1号楼', unit_no: '1单元', room_no: '101', area: 89.5, price: 1790000, status: 'available' },
      { property_no: 'B1-1-102', building_no: '1号楼', unit_no: '1单元', room_no: '102', area: 110.2, price: 2204000, status: 'available' },
      { property_no: 'B1-1-201', building_no: '1号楼', unit_no: '1单元', room_no: '201', area: 89.5, price: 1850000, status: 'available' },
      { property_no: 'B1-2-301', building_no: '1号楼', unit_no: '2单元', room_no: '301', area: 125.8, price: 2850000, status: 'available' },
      { property_no: 'B2-1-502', building_no: '2号楼', unit_no: '1单元', room_no: '502', area: 95.3, price: 1990000, status: 'available' }
    ];

    for (const prop of properties) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO properties (property_no, building_no, unit_no, room_no, area, price, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [prop.property_no, prop.building_no, prop.unit_no, prop.room_no, prop.area, prop.price, prop.status],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    db.run('COMMIT');
    res.json({ message: '样例数据导入成功' });
  });
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
});
