const express = require('express');
const XLSX = require('xlsx');
const db = require('./db');
const billingService = require('./services/billingService');

const router = express.Router();

router.get('/classes', async (req, res) => {
  const classes = await db.all(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'active') as student_count
    FROM classes c
    ORDER BY c.name
  `);
  res.json(classes);
});

router.post('/classes', async (req, res) => {
  const { name, level, monthly_tuition, daily_meal_fee } = req.body;
  const result = await db.run(`
    INSERT INTO classes (name, level, monthly_tuition, daily_meal_fee)
    VALUES (?, ?, ?, ?)
  `, [name, level, monthly_tuition, daily_meal_fee]);
  res.json({ id: result.lastInsertRowid });
});

router.get('/students', async (req, res) => {
  const { class_id, status } = req.query;
  let sql = `
    SELECT s.*, c.name as class_name, c.level as class_level
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if (class_id) {
    sql += ' AND s.class_id = ?';
    params.push(class_id);
  }
  if (status) {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY s.name';
  const students = await db.all(sql, params);
  res.json(students);
});

router.get('/students/:id', async (req, res) => {
  const student = await db.get(`
    SELECT s.*, c.name as class_name, c.level as class_level,
      c.monthly_tuition as class_monthly_tuition, c.daily_meal_fee as class_daily_meal_fee
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    WHERE s.id = ?
  `, [req.params.id]);

  if (!student) {
    return res.status(404).json({ message: '学生不存在' });
  }

  const bills = await db.all(`
    SELECT b.*, c.name as class_name
    FROM bills b
    LEFT JOIN classes c ON b.class_id = c.id
    WHERE b.student_id = ?
    ORDER BY b.billing_year DESC, b.billing_month DESC
  `, [req.params.id]);

  const leaves = await db.all(`
    SELECT * FROM leave_records
    WHERE student_id = ?
    ORDER BY start_date DESC
  `, [req.params.id]);

  const payments = await db.all(`
    SELECT p.*,
      b.billing_year, b.billing_month, b.total_amount as bill_amount
    FROM payments p
    LEFT JOIN bills b ON p.bill_id = b.id
    WHERE p.student_id = ?
    ORDER BY p.created_at DESC
  `, [req.params.id]);

  res.json({ student, bills, leaves, payments });
});

router.post('/students', async (req, res) => {
  const { name, gender, birthday, guardian_name, guardian_phone, class_id, enrollment_date, notes } = req.body;
  const result = await db.run(`
    INSERT INTO students (name, gender, birthday, guardian_name, guardian_phone, class_id, enrollment_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [name, gender, birthday, guardian_name, guardian_phone, class_id, enrollment_date, notes]);
  res.json({ id: result.lastInsertRowid });
});

router.post('/students/:id/withdraw', async (req, res) => {
  const { withdrawal_date, reason } = req.body;
  await db.run(`
    UPDATE students SET status = 'withdrawn', withdrawal_date = ?, notes = ?
    WHERE id = ?
  `, [withdrawal_date, reason, req.params.id]);
  res.json({ success: true });
});

router.get('/leaves', async (req, res) => {
  const { student_id } = req.query;
  let sql = `
    SELECT l.*, s.name as student_name, s.class_id
    FROM leave_records l
    LEFT JOIN students s ON l.student_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (student_id) {
    sql += ' AND l.student_id = ?';
    params.push(student_id);
  }
  sql += ' ORDER BY l.created_at DESC';
  const leaves = await db.all(sql, params);
  res.json(leaves);
});

router.post('/leaves', async (req, res) => {
  const { student_id, leave_type, start_date, end_date, days, reason } = req.body;
  const result = await db.run(`
    INSERT INTO leave_records (student_id, leave_type, start_date, end_date, days, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [student_id, leave_type, start_date, end_date, days, reason]);
  res.json({ id: result.lastInsertRowid });
});

router.get('/bills', async (req, res) => {
  const { year, month, status, student_id, class_id } = req.query;
  let sql = `
    SELECT b.*, 
      s.name as student_name, s.guardian_name, s.guardian_phone,
      c.name as class_name, c.level as class_level
    FROM bills b
    LEFT JOIN students s ON b.student_id = s.id
    LEFT JOIN classes c ON b.class_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if (year) {
    sql += ' AND b.billing_year = ?';
    params.push(parseInt(year));
  }
  if (month) {
    sql += ' AND b.billing_month = ?';
    params.push(parseInt(month));
  }
  if (status) {
    sql += ' AND b.status = ?';
    params.push(status);
  }
  if (student_id) {
    sql += ' AND b.student_id = ?';
    params.push(parseInt(student_id));
  }
  if (class_id) {
    sql += ' AND b.class_id = ?';
    params.push(parseInt(class_id));
  }
  sql += ' ORDER BY b.billing_year DESC, b.billing_month DESC, c.name, s.name';
  const bills = await db.all(sql, params);
  res.json(bills);
});

router.get('/bills/:id', async (req, res) => {
  const bill = await db.get(`
    SELECT b.*, 
      s.name as student_name, s.gender, s.birthday, s.guardian_name, s.guardian_phone,
      s.enrollment_date, s.withdrawal_date,
      c.name as class_name, c.level as class_level,
      c.monthly_tuition as class_monthly_tuition, c.daily_meal_fee as class_daily_meal_fee
    FROM bills b
    LEFT JOIN students s ON b.student_id = s.id
    LEFT JOIN classes c ON b.class_id = c.id
    WHERE b.id = ?
  `, [req.params.id]);

  if (!bill) {
    return res.status(404).json({ message: '账单不存在' });
  }

  const payments = await db.all(`
    SELECT * FROM payments WHERE bill_id = ? ORDER BY created_at DESC
  `, [req.params.id]);

  const history = await billingService.getBillHistory(req.params.id);

  res.json({ bill, payments, history });
});

router.post('/bills/generate', async (req, res) => {
  const { year, month, student_id } = req.body;
  if (student_id) {
    const result = await billingService.createBill(student_id, year, month);
    res.json(result);
  } else {
    const results = await billingService.createBillsForMonth(year, month);
    res.json({ results, count: results.filter(r => r.success).length });
  }
});

router.post('/bills/:id/pay', async (req, res) => {
  const { amount, payment_method, operator, notes } = req.body;
  const result = await billingService.processPayment(req.params.id, amount, payment_method, operator, notes);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/bills/:id/modify', async (req, res) => {
  const { new_total_amount, reason, operator } = req.body;
  const result = await billingService.modifyBill(req.params.id, new_total_amount, reason, operator);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.get('/bills/:id/history', async (req, res) => {
  const history = await billingService.getBillHistory(req.params.id);
  res.json(history);
});

router.get('/payments', async (req, res) => {
  const { student_id, bill_id } = req.query;
  let sql = `
    SELECT p.*,
      s.name as student_name,
      b.billing_year, b.billing_month, b.total_amount as bill_total
    FROM payments p
    LEFT JOIN students s ON p.student_id = s.id
    LEFT JOIN bills b ON p.bill_id = b.id
    WHERE 1=1
  `;
  const params = [];
  if (student_id) {
    sql += ' AND p.student_id = ?';
    params.push(parseInt(student_id));
  }
  if (bill_id) {
    sql += ' AND p.bill_id = ?';
    params.push(parseInt(bill_id));
  }
  sql += ' ORDER BY p.created_at DESC';
  const payments = await db.all(sql, params);
  res.json(payments);
});

router.get('/approvals', async (req, res) => {
  const { status, student_id } = req.query;
  let sql = `
    SELECT a.*, s.name as student_name
    FROM reduction_approvals a
    LEFT JOIN students s ON a.student_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }
  if (student_id) {
    sql += ' AND a.student_id = ?';
    params.push(parseInt(student_id));
  }
  sql += ' ORDER BY a.created_at DESC';
  const approvals = await db.all(sql, params);
  res.json(approvals);
});

router.post('/approvals', async (req, res) => {
  const { student_id, bill_id, reduction_type, reduction_amount, reason, applied_by } = req.body;
  const result = await db.run(`
    INSERT INTO reduction_approvals (student_id, bill_id, reduction_type, reduction_amount, reason, applied_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [student_id, bill_id, reduction_type, reduction_amount, reason, applied_by]);
  res.json({ id: result.lastInsertRowid });
});

router.post('/approvals/:id/approve', async (req, res) => {
  const { approved_by } = req.body;
  await db.run(`
    UPDATE reduction_approvals 
    SET status = 'approved', approved_by = ?, approved_at = datetime('now')
    WHERE id = ?
  `, [approved_by, req.params.id]);
  res.json({ success: true });
});

router.post('/approvals/:id/reject', async (req, res) => {
  await db.run(`
    UPDATE reduction_approvals SET status = 'rejected' WHERE id = ?
  `, [req.params.id]);
  res.json({ success: true });
});

router.get('/dashboard/stats', async (req, res) => {
  const { year, month } = req.query;
  const currentYear = year ? parseInt(year) : new Date().getFullYear();
  const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;

  const totalStudentsResult = await db.get(`
    SELECT COUNT(*) as count FROM students WHERE status = 'active'
  `);
  const totalStudents = totalStudentsResult?.count || 0;

  const totalBillsResult = await db.get(`
    SELECT COUNT(*) as count FROM bills 
    WHERE billing_year = ? AND billing_month = ?
  `, [currentYear, currentMonth]);
  const totalBills = totalBillsResult?.count || 0;

  const paidBillsResult = await db.get(`
    SELECT COUNT(*) as count FROM bills 
    WHERE billing_year = ? AND billing_month = ? AND status = 'paid'
  `, [currentYear, currentMonth]);
  const paidBills = paidBillsResult?.count || 0;

  const partialBillsResult = await db.get(`
    SELECT COUNT(*) as count FROM bills 
    WHERE billing_year = ? AND billing_month = ? AND status = 'partial'
  `, [currentYear, currentMonth]);
  const partialBills = partialBillsResult?.count || 0;

  const pendingBillsResult = await db.get(`
    SELECT COUNT(*) as count FROM bills 
    WHERE billing_year = ? AND billing_month = ? AND status = 'pending'
  `, [currentYear, currentMonth]);
  const pendingBills = pendingBillsResult?.count || 0;

  const totalAmountResult = await db.get(`
    SELECT COALESCE(SUM(total_amount), 0) as sum FROM bills 
    WHERE billing_year = ? AND billing_month = ?
  `, [currentYear, currentMonth]);
  const totalAmount = totalAmountResult?.sum || 0;

  const paidAmountResult = await db.get(`
    SELECT COALESCE(SUM(paid_amount), 0) as sum FROM bills 
    WHERE billing_year = ? AND billing_month = ?
  `, [currentYear, currentMonth]);
  const paidAmount = paidAmountResult?.sum || 0;

  const remainingAmountResult = await db.get(`
    SELECT COALESCE(SUM(remaining_amount), 0) as sum FROM bills 
    WHERE billing_year = ? AND billing_month = ? AND status != 'paid'
  `, [currentYear, currentMonth]);
  const remainingAmount = remainingAmountResult?.sum || 0;

  res.json({
    totalStudents,
    totalBills,
    paidBills,
    partialBills,
    pendingBills,
    totalAmount,
    paidAmount,
    remainingAmount,
    currentYear,
    currentMonth
  });
});

router.get('/export/bills', async (req, res) => {
  const { year, month, class_id } = req.query;
  let sql = `
    SELECT 
      s.name as 学生姓名,
      c.name as 班级,
      c.level as 年级,
      b.billing_year as 年份,
      b.billing_month as 月份,
      b.days_in_month as 本月天数,
      b.attendance_days as 出勤天数,
      b.leave_days as 请假天数,
      CASE WHEN b.is_mid_month_transfer = 1 THEN '是' ELSE '否' END as 是否插班退园,
      b.transfer_start_date as 插班日期,
      b.transfer_end_date as 退园日期,
      b.transfer_days as 实际就读天数,
      b.base_tuition as 学费,
      b.base_meal_fee as 餐费,
      b.leave_deduction as 请假减免,
      b.total_amount as 应缴总额,
      b.paid_amount as 已缴金额,
      b.remaining_amount as 未缴金额,
      CASE b.status 
        WHEN 'pending' THEN '待缴费'
        WHEN 'partial' THEN '部分缴费'
        WHEN 'paid' THEN '已结清'
      END as 缴费状态,
      s.guardian_name as 家长姓名,
      s.guardian_phone as 联系电话,
      b.formula as 计费说明,
      b.updated_at as 更新时间
    FROM bills b
    LEFT JOIN students s ON b.student_id = s.id
    LEFT JOIN classes c ON b.class_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if (year) {
    sql += ' AND b.billing_year = ?';
    params.push(parseInt(year));
  }
  if (month) {
    sql += ' AND b.billing_month = ?';
    params.push(parseInt(month));
  }
  if (class_id) {
    sql += ' AND b.class_id = ?';
    params.push(parseInt(class_id));
  }
  sql += ' ORDER BY c.name, s.name';

  const data = await db.all(sql, params);

  if (data.length === 0) {
    return res.status(404).json({ message: '没有可导出的数据' });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, '账单明细');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=bills_${year || 'all'}_${month || 'all'}.xlsx`);
  res.send(buffer);
});

router.get('/export/student/:id', async (req, res) => {
  const studentId = parseInt(req.params.id);
  
  const student = await db.get(`
    SELECT 
      name as 姓名,
      gender as 性别,
      birthday as 出生日期,
      guardian_name as 家长姓名,
      guardian_phone as 联系电话,
      enrollment_date as 入学日期,
      withdrawal_date as 退园日期,
      CASE status WHEN 'active' THEN '在读' WHEN 'withdrawn' THEN '已退园' END as 状态,
      notes as 备注
    FROM students WHERE id = ?
  `, [studentId]);

  if (!student) {
    return res.status(404).json({ message: '学生不存在' });
  }

  const bills = await db.all(`
    SELECT
      billing_year as 年份,
      billing_month as 月份,
      days_in_month as 本月天数,
      attendance_days as 出勤天数,
      leave_days as 请假天数,
      base_tuition as 学费,
      base_meal_fee as 餐费,
      leave_deduction as 请假减免,
      total_amount as 应缴,
      paid_amount as 已缴,
      remaining_amount as 未缴,
      CASE status WHEN 'pending' THEN '待缴' WHEN 'partial' THEN '部分' WHEN 'paid' THEN '结清' END as 状态,
      formula as 计费说明
    FROM bills WHERE student_id = ?
    ORDER BY billing_year DESC, billing_month DESC
  `, [studentId]);

  const payments = await db.all(`
    SELECT
      amount as 付款金额,
      payment_method as 付款方式,
      payment_date as 付款时间,
      operator as 经办人,
      notes as 备注
    FROM payments WHERE student_id = ?
    ORDER BY created_at DESC
  `, [studentId]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([student]), '学生信息');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bills), '账单明细');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payments), '付款记录');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=student_${studentId}_${student['姓名']}.xlsx`);
  res.send(buffer);
});

router.get('/arrears', async (req, res) => {
  const { year, month, class_id } = req.query;
  let sql = `
    SELECT 
      b.id,
      b.student_id,
      s.name as student_name,
      c.name as class_name,
      c.level as class_level,
      b.billing_year,
      b.billing_month,
      b.total_amount,
      b.paid_amount,
      b.remaining_amount,
      b.status,
      s.guardian_name,
      s.guardian_phone,
      b.updated_at
    FROM bills b
    LEFT JOIN students s ON b.student_id = s.id
    LEFT JOIN classes c ON b.class_id = c.id
    WHERE b.status != 'paid'
    AND b.remaining_amount > 0
  `;
  const params = [];
  if (year) {
    sql += ' AND b.billing_year = ?';
    params.push(parseInt(year));
  }
  if (month) {
    sql += ' AND b.billing_month = ?';
    params.push(parseInt(month));
  }
  if (class_id) {
    sql += ' AND b.class_id = ?';
    params.push(parseInt(class_id));
  }
  sql += ' ORDER BY b.billing_year DESC, b.billing_month DESC, c.name, s.name';

  const arrears = await db.all(sql, params);
  res.json(arrears);
});

module.exports = router;
