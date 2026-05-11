const express = require('express');
const bodyParser = require('body-parser');
const { runAsync, getAsync, allAsync, uuidv4 } = require('./db');

const app = express();
app.use(bodyParser.json());

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function getRemainingHours(packageId) {
  const records = await allAsync(
    `SELECT type, hours FROM hour_records WHERE package_id = ?`,
    [packageId]
  );
  
  let remaining = 0;
  for (const r of records) {
    if (r.type === 'purchase' || r.type === 'gift') {
      remaining += r.hours;
    } else if (r.type === 'consume' || r.type === 'refund') {
      remaining -= r.hours;
    }
  }
  return remaining;
}

async function getConsumedHours(packageId) {
  const records = await allAsync(
    `SELECT type, hours FROM hour_records WHERE package_id = ? AND type = 'consume'`,
    [packageId]
  );
  return records.reduce((sum, r) => sum + r.hours, 0);
}

async function isPackageFrozen(packageId) {
  const frozen = await getAsync(
    `SELECT 1 FROM freeze_requests 
     WHERE package_id = ? AND status = 'approved' 
     AND date('now') >= start_date AND date('now') <= end_date
     LIMIT 1`,
    [packageId]
  );
  return !!frozen;
}

async function logException(packageId, studentId, operation, errorMessage, requestData) {
  await runAsync(
    `INSERT INTO exception_logs (id, package_id, student_id, operation, error_message, request_data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), packageId, studentId, operation, errorMessage, JSON.stringify(requestData)]
  );
}

app.post('/api/students', async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone are required' });
    }
    
    const id = uuidv4();
    await runAsync(
      `INSERT INTO students (id, name, phone) VALUES (?, ?, ?)`,
      [id, name, phone]
    );
    
    res.status(201).json({ id, name, phone });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      const existing = await getAsync(`SELECT * FROM students WHERE phone = ?`, [req.body.phone]);
      return res.status(200).json(existing);
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchases', async (req, res) => {
  try {
    const { studentId, courseType, purchasedHours, giftedHours = 0, unitPrice, validityDays } = req.body;
    if (!studentId || !courseType || !purchasedHours || !unitPrice || !validityDays) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    const student = await getAsync(`SELECT * FROM students WHERE id = ?`, [studentId]);
    if (!student) {
      return res.status(404).json({ error: 'student not found' });
    }

    const packageId = uuidv4();
    const startDate = formatDate(new Date());
    const endDate = formatDate(addDays(new Date(), validityDays));
    const totalHours = purchasedHours + giftedHours;

    await runAsync(
      `INSERT INTO course_packages 
       (id, student_id, course_type, purchased_hours, gifted_hours, total_hours, 
        unit_price, start_date, end_date, original_end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [packageId, studentId, courseType, purchasedHours, giftedHours, totalHours, 
       unitPrice, startDate, endDate, endDate]
    );

    const purchaseRecordId = uuidv4();
    await runAsync(
      `INSERT INTO hour_records (id, package_id, student_id, hours, type, reference_id, reason)
       VALUES (?, ?, ?, ?, 'purchase', ?, 'course purchase')`,
      [purchaseRecordId, packageId, studentId, purchasedHours, packageId]
    );

    let giftRecordId = null;
    if (giftedHours > 0) {
      giftRecordId = uuidv4();
      await runAsync(
        `INSERT INTO hour_records (id, package_id, student_id, hours, type, reference_id, reason)
         VALUES (?, ?, ?, ?, 'gift', ?, 'promotional gift')`,
        [giftRecordId, packageId, studentId, giftedHours, packageId]
      );
    }

    res.status(201).json({
      id: packageId,
      studentId,
      courseType,
      totalHours,
      remainingHours: totalHours,
      startDate,
      endDate,
      purchaseRecordId,
      giftRecordId
    });
  } catch (err) {
    await logException(null, req.body.studentId, 'purchase', err.message, req.body);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/consume', async (req, res) => {
  try {
    const { packageId, hours, scheduleId, reason = 'scheduled class' } = req.body;
    if (!packageId || !hours) {
      return res.status(400).json({ error: 'packageId and hours are required' });
    }

    const pkg = await getAsync(`SELECT * FROM course_packages WHERE id = ?`, [packageId]);
    if (!pkg) {
      return res.status(404).json({ error: 'package not found' });
    }

    if (pkg.status !== 'active') {
      const errorMsg = `package is ${pkg.status}, cannot consume hours`;
      await logException(packageId, pkg.student_id, 'consume', errorMsg, req.body);
      return res.status(400).json({ error: errorMsg });
    }

    const frozen = await isPackageFrozen(packageId);
    if (frozen) {
      const errorMsg = 'package is currently frozen, cannot consume hours during freeze period';
      await logException(packageId, pkg.student_id, 'consume', errorMsg, req.body);
      return res.status(400).json({ error: errorMsg, rule: 'freeze_period_no_consumption' });
    }

    const remaining = await getRemainingHours(packageId);
    if (remaining < hours) {
      const errorMsg = `insufficient hours: remaining ${remaining}, requested ${hours}`;
      await logException(packageId, pkg.student_id, 'consume', errorMsg, req.body);
      return res.status(400).json({ error: errorMsg });
    }

    const recordId = uuidv4();
    await runAsync(
      `INSERT INTO hour_records (id, package_id, student_id, hours, type, reference_id, reason)
       VALUES (?, ?, ?, ?, 'consume', ?, ?)`,
      [recordId, packageId, pkg.student_id, hours, scheduleId || recordId, reason]
    );

    const newRemaining = await getRemainingHours(packageId);

    res.status(200).json({
      recordId,
      packageId,
      consumedHours: hours,
      remainingHours: newRemaining,
      scheduleId: scheduleId || recordId,
      reason
    });
  } catch (err) {
    await logException(req.body.packageId, null, 'consume', err.message, req.body);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/freeze/request', async (req, res) => {
  try {
    const { packageId, idempotencyKey, freezeDays, freezeReason, startDate } = req.body;
    if (!packageId || !idempotencyKey || !freezeDays) {
      return res.status(400).json({ error: 'packageId, idempotencyKey and freezeDays are required' });
    }

    const existing = await getAsync(
      `SELECT * FROM freeze_requests WHERE request_idempotency_key = ?`,
      [idempotencyKey]
    );
    if (existing) {
      return res.status(200).json({
        idempotent: true,
        requestId: existing.id,
        status: existing.status,
        message: 'duplicate request, returning original result'
      });
    }

    const pkg = await getAsync(`SELECT * FROM course_packages WHERE id = ?`, [packageId]);
    if (!pkg) {
      return res.status(404).json({ error: 'package not found' });
    }

    if (pkg.status !== 'active') {
      const errorMsg = `package is ${pkg.status}, cannot request freeze`;
      await logException(packageId, pkg.student_id, 'freeze_request', errorMsg, req.body);
      return res.status(400).json({ error: errorMsg });
    }

    const pendingOrApproved = await getAsync(
      `SELECT 1 FROM freeze_requests 
       WHERE package_id = ? AND status IN ('pending', 'approved')
       AND date('now') <= end_date
       LIMIT 1`,
      [packageId]
    );
    if (pendingOrApproved) {
      const errorMsg = 'package already has an active or pending freeze request';
      await logException(packageId, pkg.student_id, 'freeze_request', errorMsg, req.body);
      return res.status(400).json({ error: errorMsg, rule: 'no_concurrent_freeze' });
    }

    const requestId = uuidv4();
    const actualStartDate = startDate || formatDate(new Date());
    const endDate = formatDate(addDays(new Date(actualStartDate), freezeDays - 1));

    await runAsync(
      `INSERT INTO freeze_requests 
       (id, package_id, student_id, request_idempotency_key, freeze_reason, freeze_days, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [requestId, packageId, pkg.student_id, idempotencyKey, freezeReason, freezeDays, actualStartDate, endDate]
    );

    res.status(201).json({
      requestId,
      packageId,
      studentId: pkg.student_id,
      freezeDays,
      startDate: actualStartDate,
      endDate,
      status: 'pending',
      idempotencyKey
    });
  } catch (err) {
    await logException(req.body.packageId, null, 'freeze_request', err.message, req.body);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/freeze/approve', async (req, res) => {
  try {
    const { requestId, approverId } = req.body;
    if (!requestId || !approverId) {
      return res.status(400).json({ error: 'requestId and approverId are required' });
    }

    const request = await getAsync(`SELECT * FROM freeze_requests WHERE id = ?`, [requestId]);
    if (!request) {
      return res.status(404).json({ error: 'freeze request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `request already ${request.status}` });
    }

    const now = new Date().toISOString();
    await runAsync(
      `UPDATE freeze_requests 
       SET status = 'approved', approver_id = ?, approved_at = ?
       WHERE id = ?`,
      [approverId, now, requestId]
    );

    res.status(200).json({
      requestId,
      status: 'approved',
      approverId,
      approvedAt: now,
      freezeDays: request.freeze_days,
      startDate: request.start_date,
      endDate: request.end_date
    });
  } catch (err) {
    await logException(null, null, 'freeze_approve', err.message, req.body);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/freeze/reject', async (req, res) => {
  try {
    const { requestId, approverId, rejectedReason } = req.body;
    if (!requestId || !approverId) {
      return res.status(400).json({ error: 'requestId and approverId are required' });
    }

    const request = await getAsync(`SELECT * FROM freeze_requests WHERE id = ?`, [requestId]);
    if (!request) {
      return res.status(404).json({ error: 'freeze request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `request already ${request.status}` });
    }

    await runAsync(
      `UPDATE freeze_requests 
       SET status = 'rejected', approver_id = ?, rejected_reason = ?
       WHERE id = ?`,
      [approverId, rejectedReason || 'no reason provided', requestId]
    );

    res.status(200).json({
      requestId,
      status: 'rejected',
      approverId,
      rejectedReason: rejectedReason || 'no reason provided'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/unfreeze', async (req, res) => {
  try {
    const { packageId, unfreezeReason = 'manual unfreeze' } = req.body;
    if (!packageId) {
      return res.status(400).json({ error: 'packageId is required' });
    }

    const activeFreeze = await getAsync(
      `SELECT * FROM freeze_requests 
       WHERE package_id = ? AND status = 'approved'
       AND date('now') >= start_date AND date('now') <= end_date
       ORDER BY created_at DESC LIMIT 1`,
      [packageId]
    );

    if (!activeFreeze) {
      return res.status(400).json({ error: 'no active freeze found for this package' });
    }

    const pkg = await getAsync(`SELECT * FROM course_packages WHERE id = ?`, [packageId]);

    const today = formatDate(new Date());
    const freezeEnd = new Date(activeFreeze.end_date);
    const todayDate = new Date(today);
    const remainingDays = Math.ceil((freezeEnd - todayDate) / (1000 * 60 * 60 * 24));

    const newEndDate = formatDate(addDays(new Date(pkg.end_date), Math.max(0, remainingDays)));

    await runAsync(
      `UPDATE course_packages SET end_date = ? WHERE id = ?`,
      [newEndDate, packageId]
    );

    await runAsync(
      `UPDATE freeze_requests SET status = 'unfrozen' WHERE id = ?`,
      [activeFreeze.id]
    );

    const recordId = uuidv4();
    await runAsync(
      `INSERT INTO hour_records (id, package_id, student_id, hours, type, reference_id, reason)
       VALUES (?, ?, ?, 0, 'validity_extend', ?, ?)`,
      [recordId, packageId, pkg.student_id, activeFreeze.id, `unfrozen, validity extended by ${remainingDays} days`]
    );

    res.status(200).json({
      packageId,
      originalEndDate: pkg.end_date,
      newEndDate,
      extendedDays: remainingDays,
      unfreezeReason,
      validityRecordId: recordId
    });
  } catch (err) {
    await logException(req.body.packageId, null, 'unfreeze', err.message, req.body);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/refund/request', async (req, res) => {
  try {
    const { packageId, idempotencyKey, refundReason } = req.body;
    if (!packageId || !idempotencyKey) {
      return res.status(400).json({ error: 'packageId and idempotencyKey are required' });
    }

    const existing = await getAsync(
      `SELECT * FROM refund_requests WHERE request_idempotency_key = ?`,
      [idempotencyKey]
    );
    if (existing) {
      return res.status(200).json({
        idempotent: true,
        requestId: existing.id,
        status: existing.status,
        message: 'duplicate request, returning original result'
      });
    }

    const pkg = await getAsync(`SELECT * FROM course_packages WHERE id = ?`, [packageId]);
    if (!pkg) {
      return res.status(404).json({ error: 'package not found' });
    }

    if (pkg.status === 'refunded' || pkg.status === 'expired') {
      const errorMsg = `package is ${pkg.status}, cannot request refund`;
      await logException(packageId, pkg.student_id, 'refund_request', errorMsg, req.body);
      return res.status(400).json({ error: errorMsg });
    }

    const consumed = await getConsumedHours(packageId);
    const remaining = await getRemainingHours(packageId);

    const giftedRemaining = Math.min(pkg.gifted_hours, remaining);
    const refundableHours = Math.max(0, remaining - giftedRemaining);

    const refundAmount = refundableHours * pkg.unit_price;

    if (refundableHours <= 0) {
      const errorMsg = 'no refundable hours: all remaining hours are gifted or already consumed';
      await logException(packageId, pkg.student_id, 'refund_request', errorMsg, req.body);
      return res.status(400).json({ 
        error: errorMsg, 
        rule: 'refund_excludes_gifted_and_consumed',
        details: {
          totalHours: pkg.total_hours,
          purchasedHours: pkg.purchased_hours,
          giftedHours: pkg.gifted_hours,
          consumedHours: consumed,
          remainingHours: remaining,
          refundableHours: 0
        }
      });
    }

    const requestId = uuidv4();
    await runAsync(
      `INSERT INTO refund_requests 
       (id, package_id, student_id, request_idempotency_key, refund_reason, refundable_hours, refund_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [requestId, packageId, pkg.student_id, idempotencyKey, refundReason, refundableHours, refundAmount]
    );

    res.status(201).json({
      requestId,
      packageId,
      studentId: pkg.student_id,
      courseType: pkg.course_type,
      purchasedHours: pkg.purchased_hours,
      giftedHours: pkg.gifted_hours,
      consumedHours: consumed,
      remainingHours: remaining,
      refundableHours,
      refundAmount,
      unitPrice: pkg.unit_price,
      status: 'pending',
      idempotencyKey
    });
  } catch (err) {
    await logException(req.body.packageId, null, 'refund_request', err.message, req.body);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/refund/approve', async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    const request = await getAsync(`SELECT * FROM refund_requests WHERE id = ?`, [requestId]);
    if (!request) {
      return res.status(404).json({ error: 'refund request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `request already ${request.status}` });
    }

    const now = new Date().toISOString();
    
    await runAsync(
      `UPDATE refund_requests SET status = 'approved', approved_at = ? WHERE id = ?`,
      [now, requestId]
    );

    await runAsync(
      `UPDATE course_packages SET status = 'refunded' WHERE id = ?`,
      [request.package_id]
    );

    const recordId = uuidv4();
    await runAsync(
      `INSERT INTO hour_records (id, package_id, student_id, hours, type, reference_id, reason)
       VALUES (?, ?, ?, ?, 'refund', ?, 'refund approved')`,
      [recordId, request.package_id, request.student_id, request.refundable_hours, requestId]
    );

    res.status(200).json({
      requestId,
      status: 'approved',
      approvedAt: now,
      refundedHours: request.refundable_hours,
      refundAmount: request.refund_amount,
      refundRecordId: recordId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/packages/:packageId/query', async (req, res) => {
  try {
    const { packageId } = req.params;

    const pkg = await getAsync(`SELECT * FROM course_packages WHERE id = ?`, [packageId]);
    if (!pkg) {
      return res.status(404).json({ error: 'package not found' });
    }

    const remaining = await getRemainingHours(packageId);
    const consumed = await getConsumedHours(packageId);
    const frozen = await isPackageFrozen(packageId);

    const freezeHistory = await allAsync(
      `SELECT * FROM freeze_requests WHERE package_id = ? ORDER BY created_at DESC`,
      [packageId]
    );

    const hourRecords = await allAsync(
      `SELECT * FROM hour_records WHERE package_id = ? ORDER BY created_at DESC`,
      [packageId]
    );

    const exceptions = await allAsync(
      `SELECT * FROM exception_logs WHERE package_id = ? ORDER BY created_at DESC`,
      [packageId]
    );

    const refundRequests = await allAsync(
      `SELECT * FROM refund_requests WHERE package_id = ? ORDER BY created_at DESC`,
      [packageId]
    );

    res.status(200).json({
      packageId,
      courseType: pkg.course_type,
      status: pkg.status,
      isCurrentlyFrozen: frozen,
      hours: {
        totalPurchased: pkg.purchased_hours,
        totalGifted: pkg.gifted_hours,
        total: pkg.total_hours,
        consumed,
        remaining
      },
      validity: {
        startDate: pkg.start_date,
        currentEndDate: pkg.end_date,
        originalEndDate: pkg.original_end_date,
        extendedDays: Math.floor((new Date(pkg.end_date) - new Date(pkg.original_end_date)) / (1000 * 60 * 60 * 24))
      },
      freezeHistory,
      hourRecords,
      refundRequests,
      exceptionLogs: exceptions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:studentId/packages', async (req, res) => {
  try {
    const { studentId } = req.params;
    const packages = await allAsync(
      `SELECT * FROM course_packages WHERE student_id = ? ORDER BY created_at DESC`,
      [studentId]
    );
    
    const result = [];
    for (const pkg of packages) {
      const remaining = await getRemainingHours(pkg.id);
      const frozen = await isPackageFrozen(pkg.id);
      result.push({
        ...pkg,
        remainingHours: remaining,
        isCurrentlyFrozen: frozen
      });
    }
    
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
