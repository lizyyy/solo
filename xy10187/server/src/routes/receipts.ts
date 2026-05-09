import express from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const RECEIPT_STATUSES = ['pending', 'approved', 'rejected', 'duplicate', 'settled', 'appealed'];

router.get('/', (req, res) => {
  const { employee_id, merchant_id, status, receipt_no, start_date, end_date, is_duplicate, page = 1, page_size = 20 } = req.query;

  let sql = `
    SELECT r.*, 
           e.name as employee_name, e.department as employee_department,
           m.name as merchant_name
    FROM receipts r
    LEFT JOIN employees e ON r.employee_id = e.id
    LEFT JOIN merchants m ON r.merchant_id = m.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (employee_id) {
    sql += ' AND r.employee_id = ?';
    params.push(employee_id);
  }
  if (merchant_id) {
    sql += ' AND r.merchant_id = ?';
    params.push(merchant_id);
  }
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  if (receipt_no) {
    sql += ' AND r.receipt_no LIKE ?';
    params.push(`%${receipt_no}%`);
  }
  if (start_date) {
    sql += ' AND r.consumption_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND r.consumption_date <= ?';
    params.push(end_date);
  }
  if (is_duplicate !== undefined) {
    sql += ' AND r.is_duplicate = ?';
    params.push(is_duplicate === 'true' ? 1 : 0);
  }

  const countSql = sql.replace('SELECT r.*, e.name as employee_name, e.department as employee_department, m.name as merchant_name', 'SELECT COUNT(*) as total');
  const total = db.prepare(countSql).get(...params) as { total: number };

  sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(page_size), (Number(page) - 1) * Number(page_size));

  const receipts = db.prepare(sql).all(...params);

  res.json({
    success: true,
    data: receipts,
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

  const receipt = db.prepare(`
    SELECT r.*, 
           e.name as employee_name, e.department as employee_department, e.monthly_allowance, e.used_amount,
           m.name as merchant_name, m.phone as merchant_phone, m.address as merchant_address
    FROM receipts r
    LEFT JOIN employees e ON r.employee_id = e.id
    LEFT JOIN merchants m ON r.merchant_id = m.id
    WHERE r.id = ?
  `).get(id) as any;

  if (!receipt) {
    return res.status(404).json({ success: false, message: '小票不存在' });
  }

  const logs = db.prepare(`
    SELECT * FROM status_logs 
    WHERE receipt_id = ? 
    ORDER BY created_at DESC
  `).all(id);

  const appeal = db.prepare(`
    SELECT * FROM appeals 
    WHERE receipt_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(id);

  let duplicates = [];
  if (receipt.duplicate_group_id) {
    duplicates = db.prepare(`
      SELECT r.id, r.receipt_no, r.amount, r.status, r.upload_date,
             e.name as employee_name
      FROM receipts r
      LEFT JOIN employees e ON r.employee_id = e.id
      WHERE r.duplicate_group_id = ? AND r.id != ?
    `).all(receipt.duplicate_group_id, id);
  }

  res.json({
    success: true,
    data: {
      ...receipt,
      logs,
      appeal,
      duplicates
    }
  });
});

router.post('/', (req, res) => {
  const { employee_id, merchant_id, receipt_no, amount, consumption_date, notes } = req.body;

  if (!employee_id || !merchant_id || !receipt_no || !amount || !consumption_date) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id) as any;
  if (!employee) {
    return res.status(400).json({ success: false, message: '员工不存在' });
  }

  const remaining = employee.monthly_allowance - employee.used_amount;
  if (remaining < amount) {
    return res.status(400).json({ 
      success: false, 
      message: `补贴余额不足，剩余 ${remaining} 元` 
    });
  }

  const existing = db.prepare(`
    SELECT * FROM receipts 
    WHERE receipt_no = ? AND merchant_id = ? AND status != 'rejected'
  `).get(receipt_no, merchant_id) as any;

  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const id = uuidv4();

  let is_duplicate = 0;
  let status = 'pending';
  let duplicate_group_id: string | undefined;

  if (existing) {
    is_duplicate = 1;
    status = 'duplicate';
    
    if (existing.duplicate_group_id) {
      duplicate_group_id = existing.duplicate_group_id;
      db.prepare('UPDATE duplicate_groups SET count = count + 1 WHERE id = ?').run(duplicate_group_id);
    } else {
      duplicate_group_id = uuidv4();
      db.prepare(`
        INSERT INTO duplicate_groups (id, receipt_no, merchant_id, count, created_at)
        VALUES (?, ?, ?, 2, ?)
      `).run(duplicate_group_id, receipt_no, merchant_id, now);

      db.prepare(`
        UPDATE receipts SET is_duplicate = 1, duplicate_group_id = ?, status = 'duplicate', updated_at = ?
        WHERE id = ?
      `).run(duplicate_group_id, now, existing.id);

      db.prepare(`
        INSERT INTO status_logs (id, receipt_id, old_status, new_status, operator, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), existing.id, existing.status, 'duplicate', '系统', '检测到重复小票', now);
    }
  }

  db.prepare(`
    INSERT INTO receipts (
      id, employee_id, merchant_id, receipt_no, amount, consumption_date,
      upload_date, status, is_duplicate, duplicate_group_id, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, employee_id, merchant_id, receipt_no, amount, consumption_date, today, status, is_duplicate, duplicate_group_id, notes, now, now);

  db.prepare(`
    INSERT INTO status_logs (id, receipt_id, old_status, new_status, operator, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, null, status, '系统', is_duplicate ? '检测到重复小票' : '等待审核', now);

  res.json({
    success: true,
    data: { id, status, is_duplicate: Boolean(is_duplicate) },
    message: is_duplicate ? '上传成功，但检测到重复小票' : '上传成功，等待审核'
  });
});

router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, operator = '管理员', reason } = req.body;

  if (!RECEIPT_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: '无效的状态值' });
  }

  const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as any;
  if (!receipt) {
    return res.status(404).json({ success: false, message: '小票不存在' });
  }

  if (receipt.status === 'settled') {
    return res.status(400).json({ success: false, message: '已结算的小票无法修改状态' });
  }

  const now = new Date().toISOString();

  if (status === 'approved') {
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(receipt.employee_id) as any;
    const remaining = employee.monthly_allowance - employee.used_amount;
    if (remaining < receipt.amount) {
      return res.status(400).json({ 
        success: false, 
        message: `补贴余额不足，剩余 ${remaining} 元` 
      });
    }
    db.prepare('UPDATE employees SET used_amount = used_amount + ?, updated_at = ? WHERE id = ?').run(receipt.amount, now, receipt.employee_id);
  }

  if (receipt.status === 'approved' && status !== 'settled') {
    db.prepare('UPDATE employees SET used_amount = used_amount - ?, updated_at = ? WHERE id = ?').run(receipt.amount, now, receipt.employee_id);
  }

  db.prepare('UPDATE receipts SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);

  db.prepare(`
    INSERT INTO status_logs (id, receipt_id, old_status, new_status, operator, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, receipt.status, status, operator, reason, now);

  res.json({ success: true, message: '状态更新成功' });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as any;
  if (!receipt) {
    return res.status(404).json({ success: false, message: '小票不存在' });
  }

  if (['settled', 'approved'].includes(receipt.status)) {
    return res.status(400).json({ success: false, message: '已审核或已结算的小票无法编辑' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE receipts SET notes = ?, updated_at = ? WHERE id = ?').run(notes || null, now, id);

  res.json({ success: true, message: '更新成功' });
});

router.get('/:id/logs', (req, res) => {
  const { id } = req.params;

  const logs = db.prepare(`
    SELECT * FROM status_logs 
    WHERE receipt_id = ? 
    ORDER BY created_at DESC
  `).all(id);

  res.json({ success: true, data: logs });
});

export default router;
