import express from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.get('/', (req, res) => {
  const { status, receipt_id, appellant, page = 1, page_size = 20 } = req.query;

  let sql = `
    SELECT a.*, 
           r.receipt_no, r.amount, r.status as receipt_status,
           e.name as employee_name, e.department,
           m.name as merchant_name
    FROM appeals a
    LEFT JOIN receipts r ON a.receipt_id = r.id
    LEFT JOIN employees e ON r.employee_id = e.id
    LEFT JOIN merchants m ON r.merchant_id = m.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }
  if (receipt_id) {
    sql += ' AND a.receipt_id = ?';
    params.push(receipt_id);
  }
  if (appellant) {
    sql += ' AND a.appellant LIKE ?';
    params.push(`%${appellant}%`);
  }

  const countSql = sql.replace(
    'SELECT a.*, r.receipt_no, r.amount, r.status as receipt_status, e.name as employee_name, e.department, m.name as merchant_name',
    'SELECT COUNT(*) as total'
  );
  const total = db.prepare(countSql).get(...params) as { total: number };

  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(page_size), (Number(page) - 1) * Number(page_size));

  const appeals = db.prepare(sql).all(...params);

  res.json({
    success: true,
    data: appeals,
    pagination: {
      page: Number(page),
      page_size: Number(page_size),
      total: total.total,
      total_pages: Math.ceil(total.total / Number(page_size))
    }
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  const appeal = db.prepare(`
    SELECT a.*, 
           r.receipt_no, r.amount, r.status as receipt_status, r.notes as receipt_notes,
           e.name as employee_name, e.department,
           m.name as merchant_name
    FROM appeals a
    LEFT JOIN receipts r ON a.receipt_id = r.id
    LEFT JOIN employees e ON r.employee_id = e.id
    LEFT JOIN merchants m ON r.merchant_id = m.id
    WHERE a.id = ?
  `).get(id) as any;

  if (!appeal) {
    return res.status(404).json({ success: false, message: '申诉不存在' });
  }

  const receiptLogs = db.prepare(`
    SELECT * FROM status_logs 
    WHERE receipt_id = ? 
    ORDER BY created_at DESC
  `).all(appeal.receipt_id);

  res.json({
    success: true,
    data: {
      ...appeal,
      receipt_logs: receiptLogs
    }
  });
});

router.post('/', (req, res) => {
  const { receipt_id, appellant, appeal_type, reason } = req.body;

  if (!receipt_id || !appellant || !appeal_type || !reason) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(receipt_id) as any;
  if (!receipt) {
    return res.status(404).json({ success: false, message: '小票不存在' });
  }

  const existingPending = db.prepare(`
    SELECT * FROM appeals 
    WHERE receipt_id = ? AND status = 'pending'
  `).get(receipt_id);

  if (existingPending) {
    return res.status(400).json({ success: false, message: '该小票已有待处理的申诉' });
  }

  const now = new Date().toISOString();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO appeals (
      id, receipt_id, appellant, appeal_type, reason, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, receipt_id, appellant, appeal_type, reason, now, now);

  db.prepare(`
    UPDATE receipts SET status = 'appealed', updated_at = ? WHERE id = ?
  `).run(now, receipt_id);

  db.prepare(`
    INSERT INTO status_logs (id, receipt_id, old_status, new_status, operator, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), receipt_id, receipt.status, 'appealed', appellant, `提交申诉: ${reason}`, now);

  res.json({
    success: true,
    data: { id },
    message: '申诉提交成功'
  });
});

router.put('/:id/handle', (req, res) => {
  const { id } = req.params;
  const { status, handler = '管理员', handle_result, approve = false } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  if (!['resolved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: '无效的状态值' });
  }

  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(id) as any;
  if (!appeal) {
    return res.status(404).json({ success: false, message: '申诉不存在' });
  }

  if (appeal.status !== 'pending') {
    return res.status(400).json({ success: false, message: '该申诉已处理完成' });
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE appeals 
    SET status = ?, handler = ?, handle_result = ?, updated_at = ?
    WHERE id = ?
  `).run(status, handler, handle_result, now, id);

  const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(appeal.receipt_id) as any;

  if (status === 'resolved' && approve) {
    db.prepare(`
      UPDATE receipts SET status = 'approved', updated_at = ? WHERE id = ?
    `).run(now, appeal.receipt_id);

    db.prepare(`
      INSERT INTO status_logs (id, receipt_id, old_status, new_status, operator, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), appeal.receipt_id, 'appealed', 'approved', handler, `申诉通过: ${handle_result}`, now);

    if (receipt.status === 'rejected') {
      const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(receipt.employee_id) as any;
      const remaining = employee.monthly_allowance - employee.used_amount;
      if (remaining >= receipt.amount) {
        db.prepare('UPDATE employees SET used_amount = used_amount + ?, updated_at = ? WHERE id = ?').run(receipt.amount, now, receipt.employee_id);
      }
    }
  } else if (status === 'rejected' || (status === 'resolved' && !approve)) {
    const originalStatus = receipt.status === 'appealed' ? 'rejected' : receipt.status;
    db.prepare(`
      UPDATE receipts SET status = ?, updated_at = ? WHERE id = ?
    `).run(originalStatus, now, appeal.receipt_id);

    db.prepare(`
      INSERT INTO status_logs (id, receipt_id, old_status, new_status, operator, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), appeal.receipt_id, 'appealed', originalStatus, handler, `申诉驳回: ${handle_result}`, now);
  }

  res.json({
    success: true,
    message: '申诉处理完成'
  });
});

export default router;
