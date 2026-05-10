const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const db = require('./config/database');
const commissionUtils = require('./utils/commission');

const app = express();
const port = 5001;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// 确保数据库目录存在
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ==================== 团长管理 ====================

// 获取所有团长
app.get('/api/team-leaders', (req, res) => {
  db.all('SELECT * FROM team_leaders ORDER BY id', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 创建团长
app.post('/api/team-leaders', (req, res) => {
  const { name, phone, commission_rate } = req.body;
  const rate = commission_rate || 0.2;
  
  db.run(
    'INSERT INTO team_leaders (name, phone, commission_rate) VALUES (?, ?, ?)',
    [name, phone, rate],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, name, phone, commission_rate: rate });
    }
  );
});

// ==================== 课程管理 ====================

app.get('/api/courses', (req, res) => {
  db.all('SELECT * FROM courses ORDER BY id', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/courses', (req, res) => {
  const { name, original_price } = req.body;
  
  db.run(
    'INSERT INTO courses (name, original_price) VALUES (?, ?)',
    [name, original_price],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, name, original_price });
    }
  );
});

// ==================== 订单管理 ====================

// 获取所有订单（带筛选）
app.get('/api/orders', (req, res) => {
  const { team_leader_id, status, period, search } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (team_leader_id) {
    sql += ' AND team_leader_id = ?';
    params.push(team_leader_id);
  }

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (period) {
    sql += ' AND settlement_period = ?';
    params.push(period);
  }

  if (search) {
    sql += ' AND (student_name LIKE ? OR student_phone LIKE ? OR id LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 获取单个订单
app.get('/api/orders/:id', (req, res) => {
  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '订单不存在' });
    }
    res.json(row);
  });
});

// 创建订单
app.post('/api/orders', (req, res) => {
  const {
    course_name,
    student_name,
    student_phone,
    original_price,
    final_price,
    payment_time,
    team_leader_id,
    team_leader_name,
    commission_rate
  } = req.body;

  const orderId = uuidv4();
  const rate = commission_rate || 0.2;
  const commissionAmount = commissionUtils.calculateCommission(final_price, rate);
  const settlementPeriod = payment_time ? commissionUtils.getSettlementPeriod(payment_time) : null;

  const order = {
    id: orderId,
    course_name,
    student_name,
    student_phone,
    original_price,
    final_price: final_price || original_price,
    payment_time,
    team_leader_id,
    team_leader_name,
    commission_rate: rate,
    commission_amount: commissionAmount,
    status: payment_time ? 'paid' : 'pending',
    refund_amount: 0,
    is_settled: 0,
    settlement_period: settlementPeriod
  };

  db.run(
    `INSERT INTO orders (
      id, course_name, student_name, student_phone, original_price, final_price,
      payment_time, team_leader_id, team_leader_name, commission_rate,
      commission_amount, status, refund_amount, is_settled, settlement_period
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.id, order.course_name, order.student_name, order.student_phone,
      order.original_price, order.final_price, order.payment_time,
      order.team_leader_id, order.team_leader_name, order.commission_rate,
      order.commission_amount, order.status, order.refund_amount,
      order.is_settled, order.settlement_period
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(order);
    }
  );
});

// 导入订单
app.post('/api/orders/import', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const importedOrders = [];
    const errors = [];

    data.forEach((row, index) => {
      try {
        const orderId = row['订单号'] || uuidv4();
        const paymentTime = row['付款时间'] ? 
          moment(String(row['付款时间'])).format('YYYY-MM-DD HH:mm:ss') : null;
        
        const finalPrice = row['实付金额'] || row['原价'];
        const commissionRate = row['返佣比例'] || 0.2;
        const commissionAmount = commissionUtils.calculateCommission(finalPrice, commissionRate);
        const settlementPeriod = paymentTime ? 
          commissionUtils.getSettlementPeriod(paymentTime) : null;

        const order = {
          id: orderId,
          course_name: row['课程名称'],
          student_name: row['学员姓名'],
          student_phone: String(row['学员电话'] || ''),
          original_price: row['原价'],
          final_price: finalPrice,
          payment_time: paymentTime,
          team_leader_id: row['团长ID'],
          team_leader_name: row['团长名称'],
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          status: paymentTime ? 'paid' : 'pending',
          refund_amount: 0,
          is_settled: 0,
          settlement_period: settlementPeriod
        };

        importedOrders.push(order);
      } catch (e) {
        errors.push({ row: index + 1, error: e.message });
      }
    });

    // 检查重复订单
    const existingIds = importedOrders.map(o => o.id);
    db.all(
      'SELECT id FROM orders WHERE id IN (' + existingIds.map(() => '?').join(',') + ')',
      existingIds,
      (err, rows) => {
        const existingOrderIds = rows.map(r => r.id);
        const newOrders = importedOrders.filter(o => !existingOrderIds.includes(o.id));
        const duplicateOrders = importedOrders.filter(o => existingOrderIds.includes(o.id));

        // 批量插入新订单
        if (newOrders.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO orders (
              id, course_name, student_name, student_phone, original_price, final_price,
              payment_time, team_leader_id, team_leader_name, commission_rate,
              commission_amount, status, refund_amount, is_settled, settlement_period
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          newOrders.forEach(order => {
            stmt.run(
              order.id, order.course_name, order.student_name, order.student_phone,
              order.original_price, order.final_price, order.payment_time,
              order.team_leader_id, order.team_leader_name, order.commission_rate,
              order.commission_amount, order.status, order.refund_amount,
              order.is_settled, order.settlement_period
            );
          });

          stmt.finalize();
        }

        res.json({
          total: data.length,
          imported: newOrders.length,
          skipped: duplicateOrders.length,
          errors: errors.length,
          errorDetails: errors,
          skippedOrders: duplicateOrders.map(o => ({ id: o.id, student_name: o.student_name }))
        });
      }
    );

    // 清理上传文件
    fs.unlinkSync(req.file.path);
  } catch (e) {
    res.status(500).json({ error: '文件解析失败: ' + e.message });
  }
});

// ==================== 退款处理 ====================

// 处理退款
app.post('/api/orders/:id/refund', (req, res) => {
  const orderId = req.params.id;
  const { refund_amount, refund_reason } = req.body;

  db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    if (order.status === 'refunded') {
      return res.status(400).json({ error: '订单已全额退款' });
    }

    const totalRefund = (order.refund_amount || 0) + refund_amount;
    if (totalRefund > order.final_price) {
      return res.status(400).json({ error: '退款金额不能超过实付金额' });
    }

    const commissionDeduction = commissionUtils.calculateRefundDeduction(
      refund_amount,
      order.original_price,
      order.commission_amount
    );

    const newStatus = totalRefund >= order.final_price ? 'refunded' : 'partially_refunded';
    const newCommission = order.commission_amount - commissionDeduction;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      try {
        // 更新订单
        db.run(
          `UPDATE orders SET 
            refund_amount = ?, 
            status = ?, 
            commission_amount = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
          [totalRefund, newStatus, newCommission, orderId]
        );

        // 记录退款
        db.run(
          `INSERT INTO refunds (order_id, refund_amount, refund_reason, commission_deduction, is_settled_refund)
           VALUES (?, ?, ?, ?, ?)`,
          [orderId, refund_amount, refund_reason, commissionDeduction, order.is_settled ? 1 : 0]
        );

        // 如果已结算，冲减结算金额
        if (order.is_settled && order.settlement_id) {
          db.run(
            `UPDATE settlements SET 
              refund_commission = refund_commission + ?,
              net_commission = net_commission - ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [commissionDeduction, commissionDeduction, order.settlement_id]
          );
        }

        db.run('COMMIT');

        res.json({
          success: true,
          order_id: orderId,
          refund_amount,
          commission_deduction: commissionDeduction,
          new_status: newStatus,
          new_commission: newCommission,
          was_settled: order.is_settled === 1,
          settlement_id: order.settlement_id
        });
      } catch (e) {
        db.run('ROLLBACK');
        res.status(500).json({ error: e.message });
      }
    });
  });
});

// ==================== 改价审批 ====================

// 获取改价申请
app.get('/api/price-change-requests', (req, res) => {
  const { status } = req.query;
  let sql = `SELECT p.*, o.student_name, o.course_name, o.team_leader_name 
             FROM price_change_requests p 
             JOIN orders o ON p.order_id = o.id`;
  const params = [];

  if (status) {
    sql += ' WHERE p.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY p.created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 创建改价申请
app.post('/api/price-change-requests', (req, res) => {
  const { order_id, requested_price, reason } = req.body;

  db.get('SELECT * FROM orders WHERE id = ?', [order_id], (err, order) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    if (order.is_settled === 1) {
      return res.status(400).json({ error: '已结算订单不能改价' });
    }

    db.run(
      `INSERT INTO price_change_requests (order_id, original_price, requested_price, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [order_id, order.final_price, requested_price, reason],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: this.lastID,
          order_id,
          original_price: order.final_price,
          requested_price,
          reason,
          status: 'pending'
        });
      }
    );
  });
});

// 审批改价
app.post('/api/price-change-requests/:id/approve', (req, res) => {
  const requestId = req.params.id;
  const { approved, approved_by } = req.body;

  db.get('SELECT * FROM price_change_requests WHERE id = ?', [requestId], (err, request) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!request) {
      return res.status(404).json({ error: '改价申请不存在' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '申请已处理' });
    }

    db.get('SELECT * FROM orders WHERE id = ?', [request.order_id], (err, order) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const newStatus = approved ? 'approved' : 'rejected';
      const oldPrice = order.final_price;
      const oldCommission = order.commission_amount;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        try {
          // 更新申请状态
          db.run(
            `UPDATE price_change_requests SET 
              status = ?, 
              approved_by = ?, 
              approved_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [newStatus, approved_by, requestId]
          );

          // 如果批准，更新订单
          if (approved) {
            const newCommission = commissionUtils.calculateCommission(
              request.requested_price,
              order.commission_rate
            );
            const priceChange = request.requested_price - oldPrice;
            const commissionChange = newCommission - oldCommission;

            db.run(
              `UPDATE orders SET 
                final_price = ?, 
                commission_amount = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
              [request.requested_price, newCommission, request.order_id]
            );

            db.run('COMMIT');

            res.json({
              success: true,
              request_id: requestId,
              approved: true,
              order_id: request.order_id,
              old_price: oldPrice,
              new_price: request.requested_price,
              price_change,
              old_commission: oldCommission,
              new_commission: newCommission,
              commission_change: commissionChange
            });
          } else {
            db.run('COMMIT');
            res.json({
              success: true,
              request_id: requestId,
              approved: false,
              order_id: request.order_id,
              message: '改价申请已驳回'
            });
          }
        } catch (e) {
          db.run('ROLLBACK');
          res.status(500).json({ error: e.message });
        }
      });
    });
  });
});

// ==================== 结算管理 ====================

// 获取结算列表
app.get('/api/settlements', (req, res) => {
  const { period, team_leader_id } = req.query;
  let sql = 'SELECT * FROM settlements WHERE 1=1';
  const params = [];

  if (period) {
    sql += ' AND period = ?';
    params.push(period);
  }

  if (team_leader_id) {
    sql += ' AND team_leader_id = ?';
    params.push(team_leader_id);
  }

  sql += ' ORDER BY period DESC, id DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 获取结算详情
app.get('/api/settlements/:id', (req, res) => {
  const settlementId = req.params.id;

  db.get('SELECT * FROM settlements WHERE id = ?', [settlementId], (err, settlement) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!settlement) {
      return res.status(404).json({ error: '结算不存在' });
    }

    db.all(
      'SELECT * FROM orders WHERE settlement_id = ?',
      [settlementId],
      (err, orders) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ ...settlement, orders });
      }
    );
  });
});

// 生成月度结算
app.post('/api/settlements/generate', (req, res) => {
  const { period } = req.body;

  if (!period) {
    return res.status(400).json({ error: '请指定账期（如：2024-01）' });
  }

  // 检查是否已生成结算
  db.all(
    'SELECT * FROM settlements WHERE period = ?',
    [period],
    (err, existingSettlements) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (existingSettlements.length > 0) {
        return res.status(400).json({ 
          error: '该账期已生成结算',
          existing_settlements: existingSettlements.length
        });
      }

      // 查询该账期的订单（已付款且未结算）
      db.all(
        `SELECT * FROM orders 
         WHERE settlement_period = ? 
           AND status IN ('paid', 'partially_refunded') 
           AND is_settled = 0
         ORDER BY team_leader_id, payment_time`,
        [period],
        (err, orders) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          if (orders.length === 0) {
            return res.json({
              period,
              total_orders: 0,
              total_amount: 0,
              total_commission: 0,
              settlements: [],
              message: '该账期无待结算订单'
            });
          }

          // 按团长分组
          const leaderOrders = {};
          orders.forEach(order => {
            const key = order.team_leader_id || 'unknown';
            if (!leaderOrders[key]) {
              leaderOrders[key] = [];
            }
            leaderOrders[key].push(order);
          });

          const settlements = [];
          const settlementOrderIds = [];

          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            try {
              Object.keys(leaderOrders).forEach(leaderId => {
                const leaderOrderList = leaderOrders[leaderId];
                const leader = leaderOrderList[0];

                const totalAmount = leaderOrderList.reduce(
                  (sum, o) => sum + (o.final_price - o.refund_amount),
                  0
                );
                const totalCommission = leaderOrderList.reduce(
                  (sum, o) => sum + o.commission_amount,
                  0
                );

                db.run(
                  `INSERT INTO settlements (
                    period, team_leader_id, team_leader_name, total_orders,
                    total_amount, total_commission, refund_commission, net_commission, status
                  ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'draft')`,
                  [
                    period,
                    leader.team_leader_id,
                    leader.team_leader_name,
                    leaderOrderList.length,
                    parseFloat(totalAmount.toFixed(2)),
                    parseFloat(totalCommission.toFixed(2)),
                    parseFloat(totalCommission.toFixed(2))
                  ],
                  function(err) {
                    if (err) throw err;

                    const settlementId = this.lastID;
                    settlements.push({
                      id: settlementId,
                      period,
                      team_leader_id: leader.team_leader_id,
                      team_leader_name: leader.team_leader_name,
                      total_orders: leaderOrderList.length,
                      total_amount: parseFloat(totalAmount.toFixed(2)),
                      total_commission: parseFloat(totalCommission.toFixed(2)),
                      net_commission: parseFloat(totalCommission.toFixed(2))
                    });

                    // 更新订单状态
                    leaderOrderList.forEach(order => {
                      settlementOrderIds.push(order.id);
                      db.run(
                        `UPDATE orders SET 
                          is_settled = 1, 
                          settlement_id = ?,
                          updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?`,
                        [settlementId, order.id]
                      );
                    });
                  }
                );
              });

              db.run('COMMIT');

              const grandTotal = {
                orders: orders.length,
                amount: orders.reduce((sum, o) => sum + (o.final_price - o.refund_amount), 0),
                commission: orders.reduce((sum, o) => sum + o.commission_amount, 0)
              };

              res.json({
                period,
                total_orders: grandTotal.orders,
                total_amount: parseFloat(grandTotal.amount.toFixed(2)),
                total_commission: parseFloat(grandTotal.commission.toFixed(2)),
                settlements_count: settlements.length,
                settlements,
                processed_orders: settlementOrderIds
              });
            } catch (e) {
              db.run('ROLLBACK');
              res.status(500).json({ error: e.message });
            }
          });
        }
      );
    }
  );
});

// ==================== 统计和导出 ====================

// 团长排行榜
app.get('/api/stats/leaderboard', (req, res) => {
  const { period } = req.query;
  let sql = `
    SELECT 
      tl.id,
      tl.name,
      COUNT(DISTINCT o.id) as total_orders,
      SUM(o.final_price - o.refund_amount) as total_amount,
      SUM(o.commission_amount) as total_commission,
      tl.commission_rate
    FROM team_leaders tl
    LEFT JOIN orders o ON tl.id = o.team_leader_id AND o.status IN ('paid', 'partially_refunded')
  `;
  const params = [];

  if (period) {
    sql += ' AND o.settlement_period = ?';
    params.push(period);
  }

  sql += `
    GROUP BY tl.id, tl.name
    ORDER BY total_commission DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.map(r => ({
      ...r,
      total_amount: parseFloat((r.total_amount || 0).toFixed(2)),
      total_commission: parseFloat((r.total_commission || 0).toFixed(2))
    })));
  });
});

// 异常订单
app.get('/api/stats/abnormal-orders', (req, res) => {
  db.all(
    `SELECT * FROM orders 
     WHERE status IN ('partially_refunded', 'refunded') 
        OR is_settled = 0 AND payment_time IS NULL
     ORDER BY updated_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// 导出结算表
app.get('/api/export/settlements/:period', (req, res) => {
  const period = req.params.period;

  db.all(
    `SELECT s.*, o.id as order_id, o.course_name, o.student_name, o.student_phone,
            o.original_price, o.final_price, o.refund_amount, o.commission_amount,
            o.payment_time, o.status
     FROM settlements s
     LEFT JOIN orders o ON s.id = o.settlement_id
     WHERE s.period = ?
     ORDER BY s.id, o.payment_time`,
    [period],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // 按结算分组
      const settlements = {};
      rows.forEach(row => {
        if (!settlements[row.id]) {
          settlements[row.id] = {
            settlement: {
              period: row.period,
              team_leader_name: row.team_leader_name,
              total_orders: row.total_orders,
              total_amount: row.total_amount,
              total_commission: row.total_commission,
              refund_commission: row.refund_commission,
              net_commission: row.net_commission,
              status: row.status
            },
            orders: []
          };
        }
        if (row.order_id) {
          settlements[row.id].orders.push({
            order_id: row.order_id,
            course_name: row.course_name,
            student_name: row.student_name,
            student_phone: row.student_phone,
            original_price: row.original_price,
            final_price: row.final_price,
            refund_amount: row.refund_amount,
            commission_amount: row.commission_amount,
            payment_time: row.payment_time,
            status: row.status
          });
        }
      });

      // 生成Excel
      const wb = XLSX.utils.book_new();

      // 汇总表
      const summaryData = Object.values(settlements).map(s => ({
        '团长': s.settlement.team_leader_name,
        '订单数': s.settlement.total_orders,
        '总金额': s.settlement.total_amount,
        '应结佣金': s.settlement.total_commission,
        '退款扣回': s.settlement.refund_commission,
        '实结佣金': s.settlement.net_commission,
        '状态': s.settlement.status
      }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, '结算汇总');

      // 明细表
      const detailData = [];
      Object.values(settlements).forEach(s => {
        s.orders.forEach(o => {
          detailData.push({
            '团长': s.settlement.team_leader_name,
            '订单号': o.order_id,
            '课程': o.course_name,
            '学员': o.student_name,
            '电话': o.student_phone,
            '原价': o.original_price,
            '实付': o.final_price,
            '退款': o.refund_amount,
            '佣金': o.commission_amount,
            '付款时间': o.payment_time,
            '订单状态': o.status
          });
        });
      });
      const detailSheet = XLSX.utils.json_to_sheet(detailData);
      XLSX.utils.book_append_sheet(wb, detailSheet, '订单明细');

      const fileName = `结算表_${period}.xlsx`;
      const filePath = path.join(__dirname, 'exports', fileName);

      // 确保导出目录存在
      if (!fs.existsSync(path.join(__dirname, 'exports'))) {
        fs.mkdirSync(path.join(__dirname, 'exports'), { recursive: true });
      }

      XLSX.writeFile(wb, filePath);

      res.download(filePath, fileName);
    }
  );
});

// 导出订单
app.get('/api/export/orders', (req, res) => {
  const { team_leader_id, status, period } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (team_leader_id) {
    sql += ' AND team_leader_id = ?';
    params.push(team_leader_id);
  }

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (period) {
    sql += ' AND settlement_period = ?';
    params.push(period);
  }

  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const data = rows.map(o => ({
      '订单号': o.id,
      '课程': o.course_name,
      '学员': o.student_name,
      '电话': o.student_phone,
      '原价': o.original_price,
      '实付': o.final_price,
      '退款': o.refund_amount,
      '团长': o.team_leader_name,
      '返佣比例': o.commission_rate,
      '佣金': o.commission_amount,
      '付款时间': o.payment_time,
      '账期': o.settlement_period,
      '状态': o.status,
      '是否结算': o.is_settled ? '是' : '否'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '订单列表');

    const fileName = `订单导出_${moment().format('YYYYMMDDHHmmss')}.xlsx`;
    const filePath = path.join(__dirname, 'exports', fileName);

    if (!fs.existsSync(path.join(__dirname, 'exports'))) {
      fs.mkdirSync(path.join(__dirname, 'exports'), { recursive: true });
    }

    XLSX.writeFile(wb, filePath);
    res.download(filePath, fileName);
  });
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
