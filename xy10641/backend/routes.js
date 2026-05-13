const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const ExcelJS = require('exceljs');
const { db } = require('./database');

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const runExecute = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const addTimeline = async (relatedId, relatedType, action, operator, details = '', remarks = '') => {
  const sql = `INSERT INTO operation_timelines (id, related_id, related_type, action, operator, operate_time, details, remarks)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  await runExecute(sql, [uuidv4(), relatedId, relatedType, action, operator, moment().format(), details, remarks]);
};

const addAuditLog = async (table, recordId, fieldName, oldValue, newValue, operator, remarks = '') => {
  const logTable = table === 'credit' ? 'credit_audit_logs' :
                   table === 'order' ? 'order_audit_logs' : 'repayment_audit_logs';
  const idField = table === 'credit' ? 'credit_id' :
                  table === 'order' ? 'order_id' : 'repayment_id';
  const sql = `INSERT INTO ${logTable} (id, ${idField}, field_name, old_value, new_value, operator, operate_time, remarks)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  await runExecute(sql, [uuidv4(), recordId, fieldName, String(oldValue), String(newValue), operator, moment().format(), remarks]);
};

const calculateOverdueLevel = (overdueDays) => {
  if (overdueDays <= 0) return null;
  if (overdueDays <= 30) return 'M1';
  if (overdueDays <= 60) return 'M2';
  if (overdueDays <= 90) return 'M3';
  return 'M4';
};

router.get('/farmers', async (req, res) => {
  try {
    const farmers = await runQuery('SELECT * FROM farmers ORDER BY created_at DESC');
    res.json(farmers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/farmers', async (req, res) => {
  try {
    const { name, id_card, phone, address } = req.body;
    const id = uuidv4();
    const now = moment().format();
    await runExecute(
      'INSERT INTO farmers (id, name, id_card, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, id_card, phone, address, now, now]
    );
    res.json({ id, name, id_card, phone, address });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/credits', async (req, res) => {
  try {
    const credits = await runQuery(`
      SELECT c.*, f.name as farmer_name, f.phone as farmer_phone
      FROM credit_applications c
      LEFT JOIN farmers f ON c.farmer_id = f.id
      ORDER BY c.created_at DESC
    `);
    res.json(credits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/credits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const credits = await runQuery(`
      SELECT c.*, f.name as farmer_name, f.phone as farmer_phone, f.address as farmer_address
      FROM credit_applications c
      LEFT JOIN farmers f ON c.farmer_id = f.id
      WHERE c.id = ?
    `, [id]);
    
    if (credits.length === 0) {
      return res.status(404).json({ error: '授信不存在' });
    }
    
    const auditLogs = await runQuery('SELECT * FROM credit_audit_logs WHERE credit_id = ? ORDER BY operate_time DESC', [id]);
    const timelines = await runQuery('SELECT * FROM operation_timelines WHERE related_id = ? ORDER BY operate_time DESC', [id]);
    
    res.json({ ...credits[0], auditLogs, timelines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/credits', async (req, res) => {
  try {
    const { farmer_id, credit_limit, season, applicant, remarks } = req.body;
    const id = uuidv4();
    const now = moment().format();
    
    await runExecute(
      `INSERT INTO credit_applications (id, farmer_id, credit_limit, used_limit, status, season, applicant, apply_time, remarks, created_at, updated_at)
       VALUES (?, ?, ?, 0, 'PENDING', ?, ?, ?, ?, ?, ?)`,
      [id, farmer_id, credit_limit, season, applicant, now, remarks, now, now]
    );
    
    await addTimeline(id, 'credit', '提交授信申请', applicant, `授信额度: ${credit_limit}元', remarks);
    
    res.json({ id, status: 'PENDING' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/credits/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approver, remarks } = req.body;
    const now = moment().format();
    
    const credits = await runQuery('SELECT * FROM credit_applications WHERE id = ?', [id]);
    if (credits.length === 0) {
      return res.status(404).json({ error: '授信不存在' });
    }
    
    await addAuditLog('credit', id, 'status', credits[0].status, 'APPROVED', approver, remarks);
    
    await runExecute(
      'UPDATE credit_applications SET status = ?, approver = ?, approve_time = ?, updated_at = ? WHERE id = ?',
      ['APPROVED', approver, now, now, id]
    );
    
    await addTimeline(id, 'credit', '审批通过', approver, '', remarks);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/credits/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { approver, remarks } = req.body;
    const now = moment().format();
    
    const credits = await runQuery('SELECT * FROM credit_applications WHERE id = ?', [id]);
    if (credits.length === 0) {
      return res.status(404).json({ error: '授信不存在' });
    }
    
    await addAuditLog('credit', id, 'status', credits[0].status, 'REJECTED', approver, remarks);
    
    await runExecute(
      'UPDATE credit_applications SET status = ?, approver = ?, approve_time = ?, updated_at = ? WHERE id = ?',
      ['REJECTED', approver, now, now, id]
    );
    
    await addTimeline(id, 'credit', '审批拒绝', approver, '', remarks);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await runQuery(`
      SELECT o.*, f.name as farmer_name, c.credit_limit
      FROM sales_orders o
      LEFT JOIN farmers f ON o.farmer_id = f.id
      LEFT JOIN credit_applications c ON o.credit_id = c.id
      ORDER BY o.created_at DESC
    `);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const { credit_id, farmer_id, total_amount, products, operator, remarks } = req.body;
    
    const credits = await runQuery('SELECT * FROM credit_applications WHERE id = ?', [credit_id]);
    if (credits.length === 0) {
      return res.status(404).json({ error: '授信不存在' });
    }
    
    const credit = credits[0];
    if (credit.status !== 'APPROVED') {
      return res.status(400).json({ error: '授信未审批通过，无法下单' });
    }
    
    const availableLimit = credit.credit_limit - credit.used_limit;
    if (total_amount > availableLimit) {
      return res.status(400).json({ error: '授信额度不足' });
    }
    
    const id = uuidv4();
    const orderNo = 'ORD' + moment().format('YYYYMMDDHHmmss');
    const now = moment().format();
    
    await runExecute(
      `INSERT INTO sales_orders (id, credit_id, farmer_id, order_no, total_amount, products, status, operator, order_time, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
      [id, credit_id, farmer_id, orderNo, total_amount, JSON.stringify(products), operator, now, remarks, now, now]
    );
    
    await addTimeline(id, 'order', '创建赊销订单', operator, `订单金额: ${total_amount}元', remarks);
    
    res.json({ id, order_no: orderNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator, remarks } = req.body;
    const now = moment().format();
    
    const orders = await runQuery('SELECT * FROM sales_orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }
    const order = orders[0];
    
    const credits = await runQuery('SELECT * FROM credit_applications WHERE id = ?', [order.credit_id]);
    if (credits.length === 0) {
      return res.status(404).json({ error: '授信不存在' });
    }
    const credit = credits[0];
    
    await addAuditLog('order', id, 'status', order.status, 'CONFIRMED', operator, remarks);
    
    await runExecute('UPDATE sales_orders SET status = ?, delivery_time = ?, updated_at = ? WHERE id = ?',
      ['CONFIRMED', now, now, id]);
    
    const newUsedLimit = credit.used_limit + order.total_amount;
    await addAuditLog('credit', order.credit_id, 'used_limit', credit.used_limit, newUsedLimit, operator, '订单确认占用额度');
    
    await runExecute('UPDATE credit_applications SET used_limit = ?, updated_at = ? WHERE id = ?',
      [newUsedLimit, now, order.credit_id]);
    
    const dueDate = moment().add(3, 'months').format('YYYY-MM-DD');
    const repaymentId = uuidv4();
    await runExecute(
      `INSERT INTO seasonal_repayments (id, credit_id, farmer_id, order_id, season, total_amount, paid_amount, remaining_amount, due_date, status, operator, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'PENDING', ?, ?, ?)`,
      [repaymentId, order.credit_id, order.farmer_id, id, credit.season, order.total_amount, order.total_amount, dueDate, operator, now, now]
    );
    
    await addTimeline(id, 'order', '订单确认', operator, '', remarks);
    await addTimeline(repaymentId, 'repayment', '生成还款计划', operator, `到期日: ${dueDate}`, '');
    
    res.json({ success: true, repayment_id: repaymentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/repayments', async (req, res) => {
  try {
    const repayments = await runQuery(`
      SELECT r.*, f.name as farmer_name, o.order_no
      FROM seasonal_repayments r
      LEFT JOIN farmers f ON r.farmer_id = f.id
      LEFT JOIN sales_orders o ON r.order_id = o.id
      ORDER BY r.created_at DESC
    `);
    res.json(repayments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/repayments/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_method, operator, callback_id, remarks } = req.body;
    
    if (callback_id) {
      const existing = await runQuery('SELECT * FROM repayment_records WHERE callback_id = ?', [callback_id]);
      if (existing.length > 0) {
        return res.status(400).json({ error: '重复回调，已跳过扣减', skipped: true });
      }
    }
    
    const repayments = await runQuery('SELECT * FROM seasonal_repayments WHERE id = ?', [id]);
    if (repayments.length === 0) {
      return res.status(404).json({ error: '还款计划不存在' });
    }
    const repayment = repayments[0];
    
    if (repayment.overdue_level && repayment.overdue_level >= 'M3') {
      return res.status(400).json({ error: '逾期严重，需先完成催收流程' });
    }
    
    const newPaidAmount = repayment.paid_amount + amount;
    const newRemainingAmount = repayment.remaining_amount - amount;
    const newStatus = newRemainingAmount <= 0 ? 'PAID' : 'PARTIAL';
    
    await addAuditLog('repayment', id, 'paid_amount', repayment.paid_amount, newPaidAmount, operator, remarks);
    await addAuditLog('repayment', id, 'remaining_amount', repayment.remaining_amount, newRemainingAmount, operator, remarks);
    await addAuditLog('repayment', id, 'status', repayment.status, newStatus, operator, remarks);
    
    const now = moment().format();
    await runExecute(
      'UPDATE seasonal_repayments SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = ? WHERE id = ?',
      [newPaidAmount, newRemainingAmount, newStatus, now, id]
    );
    
    const recordId = uuidv4();
    await runExecute(
      'INSERT INTO repayment_records (id, repayment_id, amount, payment_method, payment_time, operator, callback_id, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [recordId, id, amount, payment_method, now, operator, callback_id || null, remarks]
    );
    
    await addTimeline(id, 'repayment', '还款', operator, `还款金额: ${amount}元`, remarks);
    
    res.json({ success: true, record_id: recordId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/repayments/check-overdue', async (req, res) => {
  try {
    const { simulate_days } = req.body;
    const repayments = await runQuery("SELECT * FROM seasonal_repayments WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')");
    const now = moment();
    let updatedCount = 0;
    
    for (const repayment of repayments) {
      let overdueDays;
      if (simulate_days !== undefined) {
        overdueDays = parseInt(simulate_days);
      } else {
        const dueDate = moment(repayment.due_date);
        overdueDays = now.diff(dueDate, 'days');
      }
      
      if (overdueDays > 0) {
        const overdueLevel = calculateOverdueLevel(overdueDays);
        const newStatus = 'OVERDUE';
        
        await addAuditLog('repayment', repayment.id, 'overdue_days', repayment.overdue_days || 0, overdueDays, 'system', '系统自动更新');
        await addAuditLog('repayment', repayment.id, 'overdue_level', repayment.overdue_level || '', overdueLevel, 'system', '系统自动更新');
        await addAuditLog('repayment', repayment.id, 'status', repayment.status, newStatus, 'system', '逾期状态更新');
        
        await runExecute(
          'UPDATE seasonal_repayments SET overdue_days = ?, overdue_level = ?, status = ?, updated_at = ? WHERE id = ?',
          [overdueDays, overdueLevel, newStatus, now.format(), repayment.id]
        );
        
        const collections = await runQuery('SELECT * FROM collection_lists WHERE repayment_id = ?', [repayment.id]);
        if (collections.length === 0) {
          const collectionId = uuidv4();
          await runExecute(
            `INSERT INTO collection_lists (id, repayment_id, credit_id, farmer_id, collection_level, collection_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
            [collectionId, repayment.id, repayment.credit_id, repayment.farmer_id, overdueLevel, now.format(), now.format()]
          );
          await addTimeline(collectionId, 'collection', '生成催收清单', 'system', `逾期等级: ${overdueLevel}`, '');
        } else {
          await runExecute('UPDATE collection_lists SET collection_level = ?, updated_at = ? WHERE id = ?',
            [overdueLevel, now.format(), collections[0].id]);
        }
        
        updatedCount++;
      }
    }
    
    res.json({ updated: updatedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/extensions', async (req, res) => {
  try {
    const extensions = await runQuery(`
      SELECT e.*, f.name as farmer_name
      FROM extension_applications e
      LEFT JOIN farmers f ON e.farmer_id = f.id
      ORDER BY e.created_at DESC
    `);
    res.json(extensions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/extensions', async (req, res) => {
  try {
    const { repayment_id, extension_days, reason, applicant } = req.body;
    
    const repayments = await runQuery('SELECT * FROM seasonal_repayments WHERE id = ?', [repayment_id]);
    if (repayments.length === 0) {
      return res.status(404).json({ error: '还款计划不存在' });
    }
    const repayment = repayments[0];
    
    const id = uuidv4();
    const originalDueDate = repayment.due_date;
    const newDueDate = moment(repayment.due_date).add(extension_days, 'days').format('YYYY-MM-DD');
    const now = moment().format();
    
    await runExecute(
      `INSERT INTO extension_applications (id, repayment_id, credit_id, farmer_id, original_due_date, new_due_date, extension_days, reason, status, applicant, apply_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
      [id, repayment_id, repayment.credit_id, repayment.farmer_id, originalDueDate, newDueDate, extension_days, reason, applicant, now, now, now]
    );
    
    await addTimeline(id, 'extension', '提交展期申请', applicant, `展期天数: ${extension_days}天', reason);
    
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/extensions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approver, remarks } = req.body;
    const now = moment().format();
    
    const extensions = await runQuery('SELECT * FROM extension_applications WHERE id = ?', [id]);
    if (extensions.length === 0) {
      return res.status(404).json({ error: '展期申请不存在' });
    }
    const extension = extensions[0];
    
    await runExecute(
      'UPDATE extension_applications SET status = ?, approver = ?, approve_time = ?, updated_at = ? WHERE id = ?',
      ['APPROVED', approver, now, now, id]
    );
    
    const repayments = await runQuery('SELECT * FROM seasonal_repayments WHERE id = ?', [extension.repayment_id]);
    if (repayments.length > 0) {
      const repayment = repayments[0];
      await addAuditLog('repayment', extension.repayment_id, 'due_date', repayment.due_date, extension.new_due_date, approver, '展期审批通过');
      await addAuditLog('repayment', extension.repayment_id, 'status', repayment.status, 'EXTENDED', approver, '展期审批通过');
      
      await runExecute(
        'UPDATE seasonal_repayments SET due_date = ?, status = ?, overdue_days = 0, overdue_level = NULL, updated_at = ? WHERE id = ?',
        [extension.new_due_date, 'EXTENDED', now, extension.repayment_id]
      );
    }
    
    await addTimeline(id, 'extension', '展期审批通过', approver, `新到期日: ${extension.new_due_date}`, remarks);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/extensions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { approver, remarks } = req.body;
    const now = moment().format();
    
    await runExecute(
      'UPDATE extension_applications SET status = ?, approver = ?, approve_time = ?, updated_at = ? WHERE id = ?',
      ['REJECTED', approver, now, now, id]
    );
    
    await addTimeline(id, 'extension', '展期审批拒绝', approver, '', remarks);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/collections', async (req, res) => {
  try {
    const collections = await runQuery(`
      SELECT cl.*, f.name as farmer_name, r.due_date, r.remaining_amount
      FROM collection_lists cl
      LEFT JOIN farmers f ON cl.farmer_id = f.id
      LEFT JOIN seasonal_repayments r ON cl.repayment_id = r.id
      ORDER BY cl.created_at DESC
    `);
    res.json(collections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/collections/:id/collect', async (req, res) => {
  try {
    const { id } = req.params;
    const { collector, remarks } = req.body;
    const now = moment().format();
    
    const collections = await runQuery('SELECT * FROM collection_lists WHERE id = ?', [id]);
    if (collections.length === 0) {
      return res.status(404).json({ error: '催收清单不存在' });
    }
    const collection = collections[0];
    
    const newCount = collection.collection_count + 1;
    
    await runExecute(
      'UPDATE collection_lists SET collector = ?, collection_status = ?, last_collection_time = ?, collection_count = ?, updated_at = ? WHERE id = ?',
      [collector, 'IN_PROGRESS', now, newCount, now, id]
    );
    
    await addTimeline(id, 'collection', '执行催收', collector, `第${newCount}次催收`, remarks);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/collections/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { collector, remarks } = req.body;
    const now = moment().format();
    
    await runExecute(
      'UPDATE collection_lists SET collector = ?, collection_status = ?, last_collection_time = ?, updated_at = ? WHERE id = ?',
      [collector, 'COMPLETED', now, now, id]
    );
    
    await addTimeline(id, 'collection', '催收完成', collector, '', remarks);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/report', async (req, res) => {
  try {
    const { operator, start_date, end_date } = req.query;
    
    let timelineQuery = 'SELECT * FROM operation_timelines WHERE 1=1';
    let params = [];
    
    if (operator) {
      timelineQuery += ' AND operator = ?';
      params.push(operator);
    }
    if (start_date) {
      timelineQuery += ' AND operate_time >= ?';
      params.push(start_date);
    }
    if (end_date) {
      timelineQuery += ' AND operate_time <= ?';
      params.push(end_date + ' 23:59:59');
    }
    timelineQuery += ' ORDER BY operate_time DESC';
    
    const timelines = await runQuery(timelineQuery, params);
    
    const credits = await runQuery('SELECT * FROM credit_audit_logs ORDER BY operate_time DESC');
    const orders = await runQuery('SELECT * FROM order_audit_logs ORDER BY operate_time DESC');
    const repayments = await runQuery('SELECT * FROM repayment_audit_logs ORDER BY operate_time DESC');
    
    res.json({ timelines, credits, orders, repayments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/report/export', async (req, res) => {
  try {
    const { operator, start_date, end_date } = req.query;
    
    let timelineQuery = `
      SELECT t.*, 
             CASE 
               WHEN t.related_type = 'credit' THEN c.status
               WHEN t.related_type = 'order' THEN o.status
               WHEN t.related_type = 'repayment' THEN r.status
               WHEN t.related_type = 'extension' THEN e.status
               WHEN t.related_type = 'collection' THEN cl.collection_status
               ELSE ''
             END as current_status
      FROM operation_timelines t
      LEFT JOIN credit_applications c ON t.related_type = 'credit' AND t.related_id = c.id
      LEFT JOIN sales_orders o ON t.related_type = 'order' AND t.related_id = o.id
      LEFT JOIN seasonal_repayments r ON t.related_type = 'repayment' AND t.related_id = r.id
      LEFT JOIN extension_applications e ON t.related_type = 'extension' AND t.related_id = e.id
      LEFT JOIN collection_lists cl ON t.related_type = 'collection' AND t.related_id = cl.id
      WHERE 1=1
    `;
    let params = [];
    
    if (operator) {
      timelineQuery += ' AND t.operator = ?';
      params.push(operator);
    }
    if (start_date) {
      timelineQuery += ' AND t.operate_time >= ?';
      params.push(start_date);
    }
    if (end_date) {
      timelineQuery += ' AND t.operate_time <= ?';
      params.push(end_date + ' 23:59:59');
    }
    timelineQuery += ' ORDER BY t.operate_time DESC';
    
    const timelines = await runQuery(timelineQuery, params);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('责任节点报告');
    
    worksheet.columns = [
      { header: '操作时间', key: 'operate_time', width: 25 },
      { header: '责任人', key: 'operator', width: 15 },
      { header: '操作类型', key: 'related_type', width: 15 },
      { header: '操作动作', key: 'action', width: 20 },
      { header: '详情', key: 'details', width: 30 },
      { header: '备注', key: 'remarks', width: 30 },
      { header: '当前状态', key: 'current_status', width: 15 }
    ];
    
    worksheet.getRow(1).font = { bold: true };
    
    timelines.forEach(t => {
      worksheet.addRow({
        operate_time: t.operate_time,
        operator: t.operator,
        related_type: t.related_type,
        action: t.action,
        details: t.details,
        remarks: t.remarks,
        current_status: t.current_status
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=responsibility-report.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/timeline/:relatedId', async (req, res) => {
  try {
    const { relatedId } = req.params;
    const timelines = await runQuery(
      'SELECT * FROM operation_timelines WHERE related_id = ? ORDER BY operate_time DESC',
      [relatedId]
    );
    res.json(timelines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
