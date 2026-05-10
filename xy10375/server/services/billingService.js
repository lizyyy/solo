const dayjs = require('dayjs');
const db = require('../db');

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

async function calculateLeaveDays(studentId, year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const monthEnd = monthStart.endOf('month');

  const leaves = await db.all(`
    SELECT start_date, end_date, days FROM leave_records
    WHERE student_id = ? AND status = 'approved'
    AND DATE(end_date) >= DATE(?) AND DATE(start_date) <= DATE(?)
  `, [studentId, monthStart.format('YYYY-MM-DD'), monthEnd.format('YYYY-MM-DD')]);

  let totalLeaveDays = 0;
  for (const leave of leaves) {
    const leaveStart = dayjs(leave.start_date);
    const leaveEnd = dayjs(leave.end_date);
    const actualStart = leaveStart.isBefore(monthStart) ? monthStart : leaveStart;
    const actualEnd = leaveEnd.isAfter(monthEnd) ? monthEnd : leaveEnd;
    const overlapDays = actualEnd.diff(actualStart, 'day') + 1;
    totalLeaveDays += Math.max(0, overlapDays);
  }

  return Math.min(totalLeaveDays, daysInMonth);
}

function calculateTransferInfo(student, year, month) {
  const enrollmentDate = student.enrollment_date ? dayjs(student.enrollment_date) : null;
  const withdrawalDate = student.withdrawal_date ? dayjs(student.withdrawal_date) : null;
  const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const monthEnd = monthStart.endOf('month');

  let isMidMonthTransfer = 0;
  let transferStartDate = null;
  let transferEndDate = null;
  let transferDays = 0;

  if (enrollmentDate && enrollmentDate.isAfter(monthStart) && enrollmentDate.isBefore(monthEnd.add(1, 'day'))) {
    isMidMonthTransfer = 1;
    transferStartDate = enrollmentDate.format('YYYY-MM-DD');
    transferDays = monthEnd.diff(enrollmentDate, 'day') + 1;
  }

  if (withdrawalDate && withdrawalDate.isAfter(monthStart) && withdrawalDate.isBefore(monthEnd.add(1, 'day'))) {
    isMidMonthTransfer = 1;
    transferEndDate = withdrawalDate.format('YYYY-MM-DD');
    if (!transferStartDate) {
      transferDays = withdrawalDate.diff(monthStart, 'day') + 1;
    } else {
      const start = dayjs(transferStartDate);
      const end = dayjs(transferEndDate);
      transferDays = end.diff(start, 'day') + 1;
    }
  }

  if (enrollmentDate && enrollmentDate.isAfter(monthEnd)) {
    return { isMidMonthTransfer: 0, transferStartDate: null, transferEndDate: null, transferDays: 0, shouldCreate: false };
  }

  if (withdrawalDate && withdrawalDate.isBefore(monthStart)) {
    return { isMidMonthTransfer: 0, transferStartDate: null, transferEndDate: null, transferDays: 0, shouldCreate: false };
  }

  return { isMidMonthTransfer, transferStartDate, transferEndDate, transferDays, shouldCreate: true };
}

async function calculateBill(student, classInfo, year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const leaveDays = await calculateLeaveDays(student.id, year, month);
  const transferInfo = calculateTransferInfo(student, year, month);

  if (!transferInfo.shouldCreate) {
    return null;
  }

  const dailyTuition = classInfo.monthly_tuition / daysInMonth;
  const dailyMealFee = classInfo.daily_meal_fee;

  let baseTuition = classInfo.monthly_tuition;
  let baseMealFee = dailyMealFee * daysInMonth;
  let transferAdjustment = 0;

  if (transferInfo.isMidMonthTransfer) {
    const actualDays = transferInfo.transferDays;
    baseTuition = dailyTuition * actualDays;
    baseMealFee = dailyMealFee * actualDays;

    if (transferInfo.transferStartDate && transferInfo.transferEndDate) {
      const originalTuition = classInfo.monthly_tuition;
      const originalMealFee = dailyMealFee * daysInMonth;
      transferAdjustment = (originalTuition - baseTuition) + (originalMealFee - baseMealFee);
    } else if (transferInfo.transferStartDate) {
      const originalTuition = classInfo.monthly_tuition;
      const originalMealFee = dailyMealFee * daysInMonth;
      transferAdjustment = (originalTuition - baseTuition) + (originalMealFee - baseMealFee);
    } else if (transferInfo.transferEndDate) {
      const originalTuition = classInfo.monthly_tuition;
      const originalMealFee = dailyMealFee * daysInMonth;
      transferAdjustment = (originalTuition - baseTuition) + (originalMealFee - baseMealFee);
    }
  }

  const leaveDeduction = dailyMealFee * leaveDays;
  const actualAttendanceDays = transferInfo.isMidMonthTransfer ? transferInfo.transferDays - leaveDays : daysInMonth - leaveDays;
  const totalAmount = baseTuition + baseMealFee - leaveDeduction;

  const formulaParts = [];
  formulaParts.push(`月学费: ¥${classInfo.monthly_tuition.toFixed(2)} (${daysInMonth}天 × ¥${dailyTuition.toFixed(2)}/天)`);
  formulaParts.push(`月餐费: ¥${(dailyMealFee * daysInMonth).toFixed(2)} (${daysInMonth}天 × ¥${dailyMealFee.toFixed(2)}/天)`);

  if (transferInfo.isMidMonthTransfer) {
    if (transferInfo.transferStartDate) {
      formulaParts.push(`插班调整: 从 ${transferInfo.transferStartDate} 起算 ${transferInfo.transferDays} 天`);
      formulaParts.push(`实际学费: ¥${baseTuition.toFixed(2)}`);
      formulaParts.push(`实际餐费: ¥${baseMealFee.toFixed(2)}`);
    } else if (transferInfo.transferEndDate) {
      formulaParts.push(`退园调整: 至 ${transferInfo.transferEndDate} 共 ${transferInfo.transferDays} 天`);
      formulaParts.push(`实际学费: ¥${baseTuition.toFixed(2)}`);
      formulaParts.push(`实际餐费: ¥${baseMealFee.toFixed(2)}`);
    }
  }

  if (leaveDays > 0) {
    formulaParts.push(`请假减免: ¥${leaveDeduction.toFixed(2)} (${leaveDays}天 × ¥${dailyMealFee.toFixed(2)}/天)`);
  }

  formulaParts.push(`应缴总额: ¥${totalAmount.toFixed(2)}`);

  const formula = formulaParts.join('\n');

  return {
    studentId: student.id,
    classId: student.class_id,
    billingYear: year,
    billingMonth: month,
    daysInMonth,
    attendanceDays: actualAttendanceDays,
    leaveDays,
    isMidMonthTransfer: transferInfo.isMidMonthTransfer,
    transferStartDate: transferInfo.transferStartDate,
    transferEndDate: transferInfo.transferEndDate,
    transferDays: transferInfo.transferDays,
    baseTuition: parseFloat(baseTuition.toFixed(2)),
    baseMealFee: parseFloat(baseMealFee.toFixed(2)),
    leaveDeduction: parseFloat(leaveDeduction.toFixed(2)),
    transferAdjustment: parseFloat(transferAdjustment.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    formula,
    dailyTuition: parseFloat(dailyTuition.toFixed(2)),
    dailyMealFee: parseFloat(dailyMealFee.toFixed(2))
  };
}

async function createBill(studentId, year, month) {
  const existingBill = await db.get(`
    SELECT * FROM bills WHERE student_id = ? AND billing_year = ? AND billing_month = ?
  `, [studentId, year, month]);

  if (existingBill) {
    return { success: false, message: '该月份账单已存在', bill: existingBill };
  }

  const student = await db.get('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!student) {
    return { success: false, message: '学生不存在' };
  }

  const classInfo = await db.get('SELECT * FROM classes WHERE id = ?', [student.class_id]);
  if (!classInfo) {
    return { success: false, message: '班级信息不存在' };
  }

  const billData = await calculateBill(student, classInfo, year, month);
  if (!billData) {
    return { success: false, message: '该学生此月份无需创建账单（已退园或未入学）' };
  }

  const result = await db.run(`
    INSERT INTO bills (
      student_id, class_id, billing_year, billing_month, days_in_month,
      attendance_days, leave_days, is_mid_month_transfer,
      transfer_start_date, transfer_end_date, transfer_days,
      base_tuition, base_meal_fee, leave_deduction, transfer_adjustment,
      total_amount, paid_amount, remaining_amount, status, formula
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?)
  `, [
    studentId, student.class_id, year, month, billData.daysInMonth,
    billData.attendanceDays, billData.leaveDays, billData.isMidMonthTransfer,
    billData.transferStartDate, billData.transferEndDate, billData.transferDays,
    billData.baseTuition, billData.baseMealFee, billData.leaveDeduction, billData.transferAdjustment,
    billData.totalAmount, billData.totalAmount, billData.formula
  ]);

  return { success: true, billId: result.lastInsertRowid, bill: { id: result.lastInsertRowid, ...billData } };
}

async function createBillsForMonth(year, month) {
  const students = await db.all(`
    SELECT s.* FROM students s
    WHERE s.status = 'active'
    OR (s.status = 'withdrawn' AND s.withdrawal_date >= ?)
  `, [dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('YYYY-MM-DD')]);

  const results = [];
  for (const student of students) {
    const result = await createBill(student.id, year, month);
    results.push({ studentId: student.id, studentName: student.name, ...result });
  }

  return results;
}

async function processPayment(billId, amount, paymentMethod, operator, notes) {
  const bill = await db.get('SELECT * FROM bills WHERE id = ?', [billId]);
  if (!bill) {
    return { success: false, message: '账单不存在' };
  }

  if (bill.status === 'paid') {
    return { success: false, message: '账单已结清，无法再次付款' };
  }

  if (amount <= 0) {
    return { success: false, message: '付款金额必须大于0' };
  }

  const actualAmount = Math.min(amount, bill.remaining_amount);

  const result = await db.run(`
    INSERT INTO payments (bill_id, student_id, amount, payment_method, payment_date, operator, notes)
    VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
  `, [billId, bill.student_id, actualAmount, paymentMethod, operator, notes]);

  const newPaidAmount = bill.paid_amount + actualAmount;
  const newRemainingAmount = bill.total_amount - newPaidAmount;
  const newStatus = newRemainingAmount <= 0 ? 'paid' : 'partial';

  await db.run(`
    UPDATE bills SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [newPaidAmount, newRemainingAmount, newStatus, billId]);

  return {
    success: true,
    paymentId: result.lastInsertRowid,
    paidAmount: actualAmount,
    newStatus,
    remainingAmount: newRemainingAmount
  };
}

async function modifyBill(billId, newTotalAmount, reason, operator) {
  const bill = await db.get('SELECT * FROM bills WHERE id = ?', [billId]);
  if (!bill) {
    return { success: false, message: '账单不存在' };
  }

  if (bill.status === 'paid') {
    return { success: false, message: '账单已结清，禁止修改' };
  }

  if (newTotalAmount < 0) {
    return { success: false, message: '金额不能为负数' };
  }

  const beforeData = JSON.stringify({
    total_amount: bill.total_amount,
    paid_amount: bill.paid_amount,
    remaining_amount: bill.remaining_amount,
    status: bill.status
  });

  const oldRemaining = bill.remaining_amount;
  const amountDiff = newTotalAmount - bill.total_amount;
  const newRemainingAmount = bill.remaining_amount + amountDiff;
  const newStatus = newRemainingAmount <= 0 ? 'paid' : bill.status;

  await db.run(`
    UPDATE bills SET 
      total_amount = ?,
      remaining_amount = ?,
      status = ?,
      is_manual_modified = 1,
      updated_at = datetime('now')
    WHERE id = ?
  `, [newTotalAmount, newRemainingAmount, newStatus, billId]);

  const afterData = JSON.stringify({
    total_amount: newTotalAmount,
    paid_amount: bill.paid_amount,
    remaining_amount: newRemainingAmount,
    status: newStatus
  });

  const affectedFields = ['total_amount', 'remaining_amount', 'status'].join(',');

  await db.run(`
    INSERT INTO bill_modifications (bill_id, operator, reason, before_data, after_data, affected_fields)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [billId, operator, reason, beforeData, afterData, affectedFields]);

  return {
    success: true,
    oldAmount: bill.total_amount,
    newAmount: newTotalAmount,
    amountDiff,
    oldRemaining,
    newRemaining: newRemainingAmount,
    newStatus
  };
}

async function getBillHistory(billId) {
  return await db.all(`
    SELECT * FROM bill_modifications 
    WHERE bill_id = ? 
    ORDER BY created_at DESC
  `, [billId]);
}

module.exports = {
  calculateBill,
  createBill,
  createBillsForMonth,
  processPayment,
  modifyBill,
  getBillHistory,
  getDaysInMonth
};
