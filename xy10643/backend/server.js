const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

app.get('/api/dashboard/stats', (req, res) => {
  db.serialize(() => {
    const results = {};
    
    db.get(`SELECT COUNT(*) as total FROM refunds WHERE return_status = 'exception'`, (err, row) => {
      results.pendingExceptions = row.total;
    });
    
    db.get(`SELECT COUNT(*) as total FROM verifications WHERE is_blocked = 1`, (err, row) => {
      results.blockedVerifications = row.total;
    });
    
    db.get(`SELECT COUNT(*) as total FROM refunds WHERE DATE(refund_time) = DATE('now')`, (err, row) => {
      results.todayRefunds = row.total;
    });
    
    db.get(`SELECT COUNT(*) as total FROM verifications WHERE DATE(verification_time) = DATE('now')`, (err, row) => {
      results.todayVerifications = row.total;
    });
    
    db.get(`SELECT COUNT(*) as total FROM members`, (err, row) => {
      results.totalMembers = row.total;
    });
    
    db.get(`SELECT COUNT(*) as total FROM coupons WHERE status = 'available'`, (err, row) => {
      results.availableCoupons = row.total;
      
      res.json(results);
    });
  });
});

app.get('/api/dashboard/exceptions', (req, res) => {
  const query = `
    SELECT r.*, m.name as member_name, m.member_no, s.name as store_name, c.coupon_no
    FROM refunds r
    LEFT JOIN members m ON r.member_id = m.id
    LEFT JOIN stores s ON r.store_id = s.id
    LEFT JOIN coupons c ON r.coupon_id = c.id
    WHERE r.return_status IN ('exception', 'handling')
    ORDER BY r.refund_time DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/members', (req, res) => {
  const { level, keyword } = req.query;
  let query = `SELECT * FROM members WHERE 1=1`;
  const params = [];
  
  if (level) {
    query += ` AND level = ?`;
    params.push(level);
  }
  
  if (keyword) {
    query += ` AND (name LIKE ? OR member_no LIKE ? OR phone LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/members/:id', (req, res) => {
  db.get(`SELECT * FROM members WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

app.put('/api/members/:id', (req, res) => {
  const { level, operator } = req.body;
  
  db.get(`SELECT * FROM members WHERE id = ?`, [req.params.id], (err, member) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run(
      `UPDATE members SET level = ?, level_before = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [level, member.level, req.params.id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run(
          `INSERT INTO audit_logs (operation_type, target_type, target_id, operator, old_value, new_value, remark) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['update', 'member', req.params.id, operator, member.level, level, '会员等级修改'],
          function(err) {
            if (err) {
              console.error('审计日志记录失败:', err);
            }
          }
        );
        
        res.json({ success: true, changes: this.changes });
      }
    );
  });
});

app.get('/api/coupon-packages', (req, res) => {
  const { memberId, status } = req.query;
  let query = `
    SELECT cp.*, m.name as member_name, m.member_no
    FROM coupon_packages cp
    LEFT JOIN members m ON cp.member_id = m.id
    WHERE 1=1
  `;
  const params = [];
  
  if (memberId) {
    query += ` AND cp.member_id = ?`;
    params.push(memberId);
  }
  
  if (status) {
    query += ` AND cp.status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY cp.created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/coupons', (req, res) => {
  const { packageId, memberId, status } = req.query;
  let query = `SELECT * FROM coupons WHERE 1=1`;
  const params = [];
  
  if (packageId) {
    query += ` AND package_id = ?`;
    params.push(packageId);
  }
  
  if (memberId) {
    query += ` AND member_id = ?`;
    params.push(memberId);
  }
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/verifications', (req, res) => {
  const { storeId, memberId, isBlocked, startDate, endDate } = req.query;
  let query = `
    SELECT v.*, m.name as member_name, m.member_no, s.name as store_name, c.coupon_no, c.type as coupon_type
    FROM verifications v
    LEFT JOIN members m ON v.member_id = m.id
    LEFT JOIN stores s ON v.store_id = s.id
    LEFT JOIN coupons c ON v.coupon_id = c.id
    WHERE 1=1
  `;
  const params = [];
  
  if (storeId) {
    query += ` AND v.store_id = ?`;
    params.push(storeId);
  }
  
  if (memberId) {
    query += ` AND v.member_id = ?`;
    params.push(memberId);
  }
  
  if (isBlocked !== undefined) {
    query += ` AND v.is_blocked = ?`;
    params.push(isBlocked);
  }
  
  if (startDate) {
    query += ` AND DATE(v.verification_time) >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND DATE(v.verification_time) <= ?`;
    params.push(endDate);
  }
  
  query += ` ORDER BY v.verification_time DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.put('/api/verifications/:id/block', (req, res) => {
  const { blocked, reason, operator } = req.body;
  
  db.get(`SELECT * FROM verifications WHERE id = ?`, [req.params.id], (err, verification) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run(
      `UPDATE verifications SET is_blocked = ?, block_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [blocked ? 1 : 0, reason, req.params.id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run(
          `INSERT INTO audit_logs (operation_type, target_type, target_id, operator, old_value, new_value, remark) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['update', 'verification', req.params.id, operator, JSON.stringify({ is_blocked: verification.is_blocked }), JSON.stringify({ is_blocked: blocked, reason }), blocked ? '核销拦截' : '解除拦截'],
          function(err) {
            if (err) {
              console.error('审计日志记录失败:', err);
            }
          }
        );
        
        res.json({ success: true, changes: this.changes });
      }
    );
  });
});

app.get('/api/refunds', (req, res) => {
  const { storeId, memberId, returnStatus, handler, startDate, endDate } = req.query;
  let query = `
    SELECT r.*, m.name as member_name, m.member_no, s.name as store_name, c.coupon_no
    FROM refunds r
    LEFT JOIN members m ON r.member_id = m.id
    LEFT JOIN stores s ON r.store_id = s.id
    LEFT JOIN coupons c ON r.coupon_id = c.id
    WHERE 1=1
  `;
  const params = [];
  
  if (storeId) {
    query += ` AND r.store_id = ?`;
    params.push(storeId);
  }
  
  if (memberId) {
    query += ` AND r.member_id = ?`;
    params.push(memberId);
  }
  
  if (returnStatus) {
    query += ` AND r.return_status = ?`;
    params.push(returnStatus);
  }
  
  if (handler) {
    query += ` AND r.handler = ?`;
    params.push(handler);
  }
  
  if (startDate) {
    query += ` AND DATE(r.handle_time) >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND DATE(r.handle_time) <= ?`;
    params.push(endDate);
  }
  
  query += ` ORDER BY r.refund_time DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.put('/api/refunds/:id/handle', (req, res) => {
  const { handler, handleResult, returnStatus, operator } = req.body;
  
  db.get(`SELECT * FROM refunds WHERE id = ?`, [req.params.id], (err, refund) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run(
      `UPDATE refunds SET handler = ?, handle_time = CURRENT_TIMESTAMP, handle_result = ?, return_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [handler, handleResult, returnStatus, req.params.id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run(
          `INSERT INTO audit_logs (operation_type, target_type, target_id, operator, old_value, new_value, remark) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['handle', 'refund', req.params.id, operator, JSON.stringify({ return_status: refund.return_status }), JSON.stringify({ return_status: returnStatus, handler, handleResult }), '异常处理'],
          function(err) {
            if (err) {
              console.error('审计日志记录失败:', err);
            }
          }
        );
        
        res.json({ success: true, changes: this.changes });
      }
    );
  });
});

app.get('/api/stores', (req, res) => {
  db.all(`SELECT * FROM stores ORDER BY store_no`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/audit-logs', (req, res) => {
  const { targetType, targetId, operator, startDate, endDate } = req.query;
  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];
  
  if (targetType) {
    query += ` AND target_type = ?`;
    params.push(targetType);
  }
  
  if (targetId) {
    query += ` AND target_id = ?`;
    params.push(targetId);
  }
  
  if (operator) {
    query += ` AND operator LIKE ?`;
    params.push(`%${operator}%`);
  }
  
  if (startDate) {
    query += ` AND DATE(operation_time) >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND DATE(operation_time) <= ?`;
    params.push(endDate);
  }
  
  query += ` ORDER BY operation_time DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/import-records', (req, res) => {
  db.all(`SELECT * FROM import_records ORDER BY import_time DESC`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/import', upload.single('file'), (req, res) => {
  const { type, operator } = req.body;
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ error: '请上传文件' });
  }
  
  const results = [];
  let successCount = 0;
  let failedCount = 0;
  
  fs.createReadStream(file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      const importNo = 'IMP' + Date.now();
      
      const processItem = (index) => {
        if (index >= results.length) {
          db.run(
            `INSERT INTO import_records (import_no, file_name, total_count, success_count, failed_count, operator, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [importNo, file.originalname, results.length, successCount, failedCount, operator, 'completed'],
            function(err) {
              fs.unlinkSync(file.path);
              res.json({
                success: true,
                importNo,
                total: results.length,
                successCount,
                failedCount
              });
            }
          );
          return;
        }
        
        const item = results[index];
        let success = false;
        
        if (type === 'member') {
          db.run(
            `INSERT OR IGNORE INTO members (member_no, name, phone, level, points) VALUES (?, ?, ?, ?, ?)`,
            [item.member_no, item.name, item.phone, item.level || 'normal', item.points || 0],
            function(err) {
              if (!err && this.changes > 0) success = true;
              if (success) successCount++;
              else failedCount++;
              processItem(index + 1);
            }
          );
        } else if (type === 'verification') {
          db.run(
            `INSERT OR IGNORE INTO verifications (verification_no, coupon_id, member_id, store_id, operator, verification_time, order_amount, discount_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.verification_no, item.coupon_id, item.member_id, item.store_id, item.operator, item.verification_time, item.order_amount, item.discount_amount, 'normal'],
            function(err) {
              if (!err && this.changes > 0) success = true;
              if (success) successCount++;
              else failedCount++;
              processItem(index + 1);
            }
          );
        } else {
          failedCount++;
          processItem(index + 1);
        }
      };
      
      processItem(0);
    });
});

app.get('/api/export/refunds', (req, res) => {
  const { storeId, memberId, returnStatus, handler, startDate, endDate } = req.query;
  let query = `
    SELECT r.refund_no, m.member_no, m.name as member_name, s.name as store_name, c.coupon_no,
           r.refund_time, r.operator as refund_operator, r.refund_amount, r.is_coupon_returned,
           r.return_status, r.exception_type, r.exception_note, r.handler, r.handle_time, r.handle_result
    FROM refunds r
    LEFT JOIN members m ON r.member_id = m.id
    LEFT JOIN stores s ON r.store_id = s.id
    LEFT JOIN coupons c ON r.coupon_id = c.id
    WHERE 1=1
  `;
  const params = [];
  
  if (storeId) {
    query += ` AND r.store_id = ?`;
    params.push(storeId);
  }
  
  if (memberId) {
    query += ` AND r.member_id = ?`;
    params.push(memberId);
  }
  
  if (returnStatus) {
    query += ` AND r.return_status = ?`;
    params.push(returnStatus);
  }
  
  if (handler) {
    query += ` AND r.handler = ?`;
    params.push(handler);
  }
  
  if (startDate) {
    query += ` AND DATE(r.handle_time) >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND DATE(r.handle_time) <= ?`;
    params.push(endDate);
  }
  
  query += ` ORDER BY r.refund_time DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    try {
      const parser = new Parser();
      const csv = parser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=refunds_${Date.now()}.csv`);
      res.send('\uFEFF' + csv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

app.get('/api/export/verifications', (req, res) => {
  const { storeId, memberId, isBlocked, startDate, endDate } = req.query;
  let query = `
    SELECT v.verification_no, m.member_no, m.name as member_name, s.name as store_name, c.coupon_no,
           c.type as coupon_type, v.verification_time, v.operator, v.order_amount, v.discount_amount,
           v.status, v.is_blocked, v.block_reason
    FROM verifications v
    LEFT JOIN members m ON v.member_id = m.id
    LEFT JOIN stores s ON v.store_id = s.id
    LEFT JOIN coupons c ON v.coupon_id = c.id
    WHERE 1=1
  `;
  const params = [];
  
  if (storeId) {
    query += ` AND v.store_id = ?`;
    params.push(storeId);
  }
  
  if (memberId) {
    query += ` AND v.member_id = ?`;
    params.push(memberId);
  }
  
  if (isBlocked !== undefined) {
    query += ` AND v.is_blocked = ?`;
    params.push(isBlocked);
  }
  
  if (startDate) {
    query += ` AND DATE(v.verification_time) >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND DATE(v.verification_time) <= ?`;
    params.push(endDate);
  }
  
  query += ` ORDER BY v.verification_time DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    try {
      const parser = new Parser();
      const csv = parser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=verifications_${Date.now()}.csv`);
      res.send('\uFEFF' + csv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

app.get('/api/reports/verification-summary', (req, res) => {
  const { startDate, endDate, groupBy } = req.query;
  
  let groupField = 'DATE(v.verification_time)';
  if (groupBy === 'store') {
    groupField = 's.name';
  } else if (groupBy === 'member_level') {
    groupField = 'm.level';
  }
  
  const query = `
    SELECT 
      ${groupField} as group_name,
      COUNT(*) as total_verifications,
      SUM(CASE WHEN v.is_blocked = 1 THEN 1 ELSE 0 END) as blocked_count,
      SUM(v.order_amount) as total_order_amount,
      SUM(v.discount_amount) as total_discount_amount
    FROM verifications v
    LEFT JOIN stores s ON v.store_id = s.id
    LEFT JOIN members m ON v.member_id = m.id
    WHERE 1=1
    ${startDate ? ` AND DATE(v.verification_time) >= '${startDate}'` : ''}
    ${endDate ? ` AND DATE(v.verification_time) <= '${endDate}'` : ''}
    GROUP BY ${groupField}
    ORDER BY total_verifications DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/reports/refund-summary', (req, res) => {
  const { startDate, endDate, groupBy } = req.query;
  
  let groupField = 'DATE(r.refund_time)';
  if (groupBy === 'store') {
    groupField = 's.name';
  } else if (groupBy === 'return_status') {
    groupField = 'r.return_status';
  }
  
  const query = `
    SELECT 
      ${groupField} as group_name,
      COUNT(*) as total_refunds,
      SUM(CASE WHEN r.is_coupon_returned = 1 THEN 1 ELSE 0 END) as returned_count,
      SUM(CASE WHEN r.return_status = 'exception' THEN 1 ELSE 0 END) as exception_count,
      SUM(r.refund_amount) as total_refund_amount
    FROM refunds r
    LEFT JOIN stores s ON r.store_id = s.id
    WHERE 1=1
    ${startDate ? ` AND DATE(r.refund_time) >= '${startDate}'` : ''}
    ${endDate ? ` AND DATE(r.refund_time) <= '${endDate}'` : ''}
    GROUP BY ${groupField}
    ORDER BY total_refunds DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
