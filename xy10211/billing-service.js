const db = require('./database');
const { v4: uuidv4 } = require('uuid');

function getActiveTariffSync(dbInstance, communityId) {
  return new Promise((resolve, reject) => {
    dbInstance.db.get(`
      SELECT tp.* FROM tariff_profiles tp 
      WHERE tp.community_id = ? AND tp.is_active = 1 
      ORDER BY tp.effective_date DESC LIMIT 1
    `, [communityId], (err, profile) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!profile) {
        resolve(null);
        return;
      }
      
      dbInstance.db.all(`
        SELECT * FROM tariff_periods WHERE tariff_profile_id = ?
      `, [profile.id], (err, periods) => {
        if (err) reject(err);
        else resolve({ ...profile, periods });
      });
    });
  });
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getPeriodForTime(periods, dateTimeStr) {
  const date = new Date(dateTimeStr);
  const totalMinutes = date.getHours() * 60 + date.getMinutes();

  for (const period of periods) {
    const start = parseTime(period.start_time);
    const end = parseTime(period.end_time);

    if (start < end) {
      if (totalMinutes >= start && totalMinutes < end) return period;
    } else {
      if (totalMinutes >= start || totalMinutes < end) return period;
    }
  }
  return null;
}

function sliceRecordByPeriods(record, tariff) {
  const slices = [];
  const startTime = new Date(record.timestamp);
  const endTime = new Date(startTime.getTime() + record.duration_seconds * 1000);
  
  const totalKwh = record.energy_consumed;
  const totalSeconds = record.duration_seconds;
  
  if (totalSeconds === 0 || totalKwh <= 0) return [];

  let currentTime = new Date(startTime);
  
  while (currentTime < endTime) {
    const period = getPeriodForTime(tariff.periods, currentTime.toISOString());
    if (!period) {
      currentTime = new Date(endTime);
      continue;
    }

    const periodStart = parseTime(period.start_time);
    const periodEnd = parseTime(period.end_time);
    
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    let periodEndTime = new Date(currentTime);
    let endMinutes;
    
    if (periodStart < periodEnd) {
      endMinutes = periodEnd;
    } else {
      if (currentMinutes >= periodStart) {
        endMinutes = 24 * 60;
      } else {
        endMinutes = periodEnd;
      }
    }
    
    periodEndTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    
    if (periodEndTime <= currentTime) {
      periodEndTime.setDate(periodEndTime.getDate() + 1);
    }
    
    if (periodEndTime > endTime) {
      periodEndTime = new Date(endTime);
    }
    
    const sliceSeconds = Math.floor((periodEndTime.getTime() - currentTime.getTime()) / 1000);
    if (sliceSeconds <= 0) break;
    
    const sliceRatio = sliceSeconds / totalSeconds;
    const sliceKwh = totalKwh * sliceRatio;
    const sliceAmount = sliceKwh * period.price_per_kwh;
    
    const startKwh = record.start_kwh + (record.energy_consumed * (
      (currentTime.getTime() - startTime.getTime()) / (endTime.getTime() - startTime.getTime())
    ));
    
    slices.push({
      raw_record_id: record.id,
      session_id: record.session_id,
      start_time: currentTime.toISOString(),
      end_time: periodEndTime.toISOString(),
      start_kwh: parseFloat(startKwh.toFixed(3)),
      end_kwh: parseFloat((startKwh + sliceKwh).toFixed(3)),
      energy_consumed: parseFloat(sliceKwh.toFixed(3)),
      duration_seconds: sliceSeconds,
      period_type: period.period_type,
      price_per_kwh: period.price_per_kwh,
      slice_amount: parseFloat(sliceAmount.toFixed(2))
    });
    
    currentTime = new Date(periodEndTime);
  }
  
  return slices;
}

function getSessionStatusSync(dbInstance, sessionId) {
  return new Promise((resolve, reject) => {
    dbInstance.db.get(`
      SELECT * FROM session_status_history 
      WHERE session_id = ? 
      ORDER BY timestamp DESC, id DESC 
      LIMIT 1
    `, [sessionId], (err, history) => {
      if (err) reject(err);
      else resolve(history ? history.status : null);
    });
  });
}

function isStatusTransitionValid(currentStatus, newStatus) {
  const validTransitions = {
    null: ['created', 'charging', 'paused', 'resumed', 'completed', 'failed'],
    'created': ['charging', 'failed'],
    'charging': ['charging', 'paused', 'completed', 'failed'],
    'paused': ['resumed', 'completed', 'failed', 'paused'],
    'resumed': ['paused', 'completed', 'failed', 'resumed'],
    'completed': ['reconciled', 'completed'],
    'failed': ['completed', 'reconciled', 'failed'],
    'reconciled': []
  };
  
  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

function validateRecord(record) {
  const errors = [];
  
  if (!record.request_id) errors.push('request_id is required');
  if (!record.session_id) errors.push('session_id is required');
  if (!record.community_id) errors.push('community_id is required');
  if (!record.resident_id) errors.push('resident_id is required');
  if (!record.charger_id) errors.push('charger_id is required');
  if (!record.timestamp) errors.push('timestamp is required');
  
  if (record.start_kwh === undefined || record.start_kwh === null) {
    errors.push('start_kwh is required');
  } else if (typeof record.start_kwh !== 'number' || record.start_kwh < 0) {
    errors.push('start_kwh must be a non-negative number');
  }
  
  if (record.end_kwh === undefined || record.end_kwh === null) {
    errors.push('end_kwh is required');
  } else if (typeof record.end_kwh !== 'number' || record.end_kwh < 0) {
    errors.push('end_kwh must be a non-negative number');
  }
  
  if (record.duration_seconds === undefined || record.duration_seconds === null) {
    errors.push('duration_seconds is required');
  } else if (typeof record.duration_seconds !== 'number' || record.duration_seconds < 0) {
    errors.push('duration_seconds must be a non-negative number');
  }
  
  if (errors.length === 0 && record.end_kwh < record.start_kwh) {
    errors.push('end_kwh cannot be less than start_kwh');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    energyConsumed: errors.length === 0 ? record.end_kwh - record.start_kwh : 0
  };
}

function checkDuplicateSync(dbInstance, requestId, sessionId) {
  return new Promise((resolve, reject) => {
    dbInstance.db.all(`
      SELECT * FROM request_deduplication 
      WHERE request_id = ? OR (session_id = ? AND result = 'accepted')
    `, [requestId, sessionId], (err, existing) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (existing.some(r => r.request_id === requestId)) {
        const matched = existing.find(r => r.request_id === requestId);
        resolve({ isDuplicate: true, reason: 'same_request_id', existing: matched });
      } else {
        resolve({ isDuplicate: false });
      }
    });
  });
}

function checkConflictSync(dbInstance, record) {
  return new Promise((resolve, reject) => {
    dbInstance.db.all(`
      SELECT * FROM raw_charging_records 
      WHERE session_id = ? AND is_validated = 1
      ORDER BY timestamp
    `, [record.session_id], (err, existingRecords) => {
      if (err) {
        reject(err);
        return;
      }
      
      for (const existing of existingRecords) {
        if (existing.request_id === record.request_id) continue;
        
        const existingEndTime = new Date(existing.timestamp).getTime() + existing.duration_seconds * 1000;
        const newStartTime = new Date(record.timestamp).getTime();
        const newEndTime = newStartTime + record.duration_seconds * 1000;
        
        if (newStartTime < existingEndTime && newEndTime > new Date(existing.timestamp).getTime()) {
          resolve({ 
            isConflict: true, 
            reason: 'time_overlap', 
            existingRecord: existing 
          });
          return;
        }
        
        if (record.start_kwh < existing.end_kwh) {
          resolve({ 
            isConflict: true, 
            reason: 'kwh_backward', 
            existingRecord: existing 
          });
          return;
        }
      }
      
      resolve({ isConflict: false });
    });
  });
}

async function processRecord(record, source = 'charger') {
  const validation = validateRecord(record);
  
  if (!validation.isValid) {
    return {
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Record validation failed',
      errors: validation.errors
    };
  }
  
  const duplicate = await checkDuplicateSync(db, record.request_id, record.session_id);
  if (duplicate.isDuplicate) {
    await db.run(`INSERT OR IGNORE INTO request_deduplication (request_id, session_id, result) VALUES (?, ?, 'duplicate')`, 
      [record.request_id, record.session_id]);
    
    if (duplicate.reason === 'same_request_id') {
      return {
        success: false,
        code: 'DUPLICATE_REQUEST',
        message: 'Duplicate request detected - same request_id already processed',
        existing: duplicate.existing
      };
    }
  }
  
  const currentStatus = await getSessionStatusSync(db, record.session_id);
  
  let inferredStatus;
  if (record.status === 'completed') {
    inferredStatus = 'completed';
  } else if (record.is_retransmit) {
    inferredStatus = currentStatus === 'paused' ? 'resumed' : 'charging';
  } else {
    inferredStatus = 'charging';
  }
  
  if (!isStatusTransitionValid(currentStatus, inferredStatus)) {
    return {
      success: false,
      code: 'INVALID_STATE_TRANSITION',
      message: `Invalid state transition: ${currentStatus} -> ${inferredStatus}`,
      currentStatus,
      requestedStatus: inferredStatus
    };
  }
  
  const conflict = await checkConflictSync(db, record);
  if (conflict.isConflict && !record.is_retransmit) {
    return {
      success: false,
      code: 'CONFLICT_DETECTED',
      message: `Conflict detected: ${conflict.reason}`,
      conflictDetails: conflict
    };
  }
  
  try {
    const insertRecordResult = await db.run(`
      INSERT INTO raw_charging_records (
        request_id, session_id, community_id, resident_id, charger_id,
        timestamp, start_kwh, end_kwh, energy_consumed, duration_seconds,
        is_retransmit, original_request_id, is_validated, validation_errors
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
    `, [
      record.request_id,
      record.session_id,
      record.community_id,
      record.resident_id,
      record.charger_id,
      record.timestamp,
      record.start_kwh,
      record.end_kwh,
      validation.energyConsumed,
      record.duration_seconds,
      record.is_retransmit ? 1 : 0,
      record.original_request_id || null
    ]);
    
    const newRecordId = insertRecordResult.lastInsertRowid;
    const insertedRecord = { ...record, id: newRecordId, energy_consumed: validation.energyConsumed };
    
    if (!currentStatus) {
      await db.run(`
        INSERT OR IGNORE INTO charging_sessions (session_id, community_id, resident_id, charger_id)
        VALUES (?, ?, ?, ?)
      `, [record.session_id, record.community_id, record.resident_id, record.charger_id]);
      
      await db.run(`
        INSERT INTO session_status_history (session_id, status, timestamp, source, request_id)
        VALUES (?, 'created', ?, ?, ?)
      `, [record.session_id, record.timestamp, source, record.request_id]);
    }
    
    const statusTimestamp = new Date(new Date(record.timestamp).getTime() + record.duration_seconds * 1000).toISOString();
    await db.run(`
      INSERT INTO session_status_history (session_id, status, timestamp, source, request_id)
      VALUES (?, ?, ?, ?, ?)
    `, [record.session_id, inferredStatus, statusTimestamp, source, record.request_id]);
    
    await db.run(`UPDATE charging_sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = ?`,
      [record.session_id]);
    
    const tariff = await getActiveTariffSync(db, record.community_id);
    if (tariff) {
      const slices = sliceRecordByPeriods(insertedRecord, tariff);
      for (const slice of slices) {
        await db.run(`
          INSERT INTO energy_slices (
            session_id, raw_record_id, start_time, end_time,
            start_kwh, end_kwh, energy_consumed, duration_seconds,
            period_type, price_per_kwh, slice_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          slice.session_id, slice.raw_record_id, slice.start_time, slice.end_time,
          slice.start_kwh, slice.end_kwh, slice.energy_consumed, slice.duration_seconds,
          slice.period_type, slice.price_per_kwh, slice.slice_amount
        ]);
      }
    }
    
    await db.run(`INSERT INTO request_deduplication (request_id, session_id, result) VALUES (?, ?, 'accepted')`,
      [record.request_id, record.session_id]);
    
    return {
      success: true,
      code: 'RECORD_ACCEPTED',
      message: 'Record processed successfully',
      record: insertedRecord
    };
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      await db.run(`INSERT OR IGNORE INTO request_deduplication (request_id, session_id, result) VALUES (?, ?, 'duplicate')`,
        [record.request_id, record.session_id]);
      
      return {
        success: false,
        code: 'DUPLICATE_REQUEST',
        message: 'Duplicate request detected',
        error: error.message
      };
    }
    throw error;
  }
}

async function generateBill(sessionId) {
  const session = await db.get(`SELECT * FROM charging_sessions WHERE session_id = ?`, [sessionId]);
  if (!session) {
    return { success: false, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
  }
  
  const currentStatus = await getSessionStatusSync(db, sessionId);
  if (currentStatus !== 'completed' && currentStatus !== 'failed') {
    return { 
      success: false, 
      code: 'SESSION_NOT_COMPLETE', 
      message: `Session is not complete. Current status: ${currentStatus}` 
    };
  }
  
  const existingBill = await db.get(`SELECT * FROM bills WHERE session_id = ?`, [sessionId]);
  if (existingBill) {
    return { success: false, code: 'BILL_EXISTS', message: 'Bill already exists for this session' };
  }
  
  const slices = await db.all(`
    SELECT * FROM energy_slices WHERE session_id = ? ORDER BY start_time
  `, [sessionId]);
  
  if (slices.length === 0) {
    return { success: false, code: 'NO_SLICES', message: 'No energy slices found for this session' };
  }
  
  const totals = {
    totalEnergy: 0,
    totalAmount: 0,
    peakEnergy: 0,
    peakAmount: 0,
    flatEnergy: 0,
    flatAmount: 0,
    valleyEnergy: 0,
    valleyAmount: 0
  };
  
  for (const slice of slices) {
    totals.totalEnergy += slice.energy_consumed;
    totals.totalAmount += slice.slice_amount;
    
    if (slice.period_type === 'peak') {
      totals.peakEnergy += slice.energy_consumed;
      totals.peakAmount += slice.slice_amount;
    } else if (slice.period_type === 'flat') {
      totals.flatEnergy += slice.energy_consumed;
      totals.flatAmount += slice.slice_amount;
    } else if (slice.period_type === 'valley') {
      totals.valleyEnergy += slice.energy_consumed;
      totals.valleyAmount += slice.slice_amount;
    }
  }
  
  const billId = `BILL-${sessionId}`;
  
  await db.run(`
    INSERT INTO bills (
      bill_id, session_id, community_id, resident_id,
      total_energy, total_amount,
      peak_energy, peak_amount,
      flat_energy, flat_amount,
      valley_energy, valley_amount,
      reconciliation_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [
    billId, sessionId, session.community_id, session.resident_id,
    parseFloat(totals.totalEnergy.toFixed(3)),
    parseFloat(totals.totalAmount.toFixed(2)),
    parseFloat(totals.peakEnergy.toFixed(3)),
    parseFloat(totals.peakAmount.toFixed(2)),
    parseFloat(totals.flatEnergy.toFixed(3)),
    parseFloat(totals.flatAmount.toFixed(2)),
    parseFloat(totals.valleyEnergy.toFixed(3)),
    parseFloat(totals.valleyAmount.toFixed(2))
  ]);
  
  await db.run(`
    INSERT INTO reconciliation_logs (session_id, bill_id, action, details)
    VALUES (?, ?, 'bill_generated', ?)
  `, [sessionId, billId, JSON.stringify({ sliceCount: slices.length, totals })]);
  
  await db.run(`
    INSERT INTO session_status_history (session_id, status, timestamp, source)
    VALUES (?, 'reconciled', CURRENT_TIMESTAMP, 'server')
  `, [sessionId]);
  
  const bill = await db.get(`SELECT * FROM bills WHERE bill_id = ?`, [billId]);
  
  return {
    success: true,
    code: 'BILL_GENERATED',
    message: 'Bill generated successfully',
    bill: bill,
    slices: slices
  };
}

async function verifyBill(billId, operator = 'system') {
  const bill = await db.get(`SELECT * FROM bills WHERE bill_id = ?`, [billId]);
  if (!bill) {
    return { success: false, code: 'BILL_NOT_FOUND', message: 'Bill not found' };
  }
  
  if (bill.reconciliation_status === 'verified') {
    return { success: false, code: 'ALREADY_VERIFIED', message: 'Bill already verified' };
  }
  
  const records = await db.all(`SELECT * FROM raw_charging_records WHERE session_id = ? AND is_validated = 1 ORDER BY timestamp`, [bill.session_id]);
  const slices = await db.all(`SELECT * FROM energy_slices WHERE session_id = ? ORDER BY start_time`, [bill.session_id]);
  
  let issues = [];
  
  const totalRecordEnergy = records.reduce((sum, r) => sum + r.energy_consumed, 0);
  const totalSliceEnergy = slices.reduce((sum, s) => sum + s.energy_consumed, 0);
  
  if (Math.abs(totalRecordEnergy - totalSliceEnergy) > 0.001) {
    issues.push(`Energy mismatch: records=${totalRecordEnergy.toFixed(3)}, slices=${totalSliceEnergy.toFixed(3)}`);
  }
  
  if (Math.abs(bill.total_energy - totalSliceEnergy) > 0.001) {
    issues.push(`Bill energy mismatch: bill=${bill.total_energy.toFixed(3)}, slices=${totalSliceEnergy.toFixed(3)}`);
  }
  
  const calculatedAmount = slices.reduce((sum, s) => sum + s.slice_amount, 0);
  if (Math.abs(bill.total_amount - calculatedAmount) > 0.01) {
    issues.push(`Amount mismatch: bill=${bill.total_amount.toFixed(2)}, calculated=${calculatedAmount.toFixed(2)}`);
  }
  
  const duplicates = await db.all(`SELECT * FROM duplicate_records WHERE session_id = ? AND resolution IS NULL`, [bill.session_id]);
  if (duplicates.length > 0) {
    issues.push(`Unresolved duplicates detected: ${duplicates.length}`);
  }
  
  const newStatus = issues.length === 0 ? 'verified' : 'needs_review';
  
  await db.run(`UPDATE bills SET reconciliation_status = ?, updated_at = CURRENT_TIMESTAMP WHERE bill_id = ?`,
    [newStatus, billId]);
  
  await db.run(`
    INSERT INTO reconciliation_logs (session_id, bill_id, action, details, operator)
    VALUES (?, ?, 'bill_verified', ?, ?)
  `, [bill.session_id, billId, JSON.stringify({ issues, verificationResult: newStatus }), operator]);
  
  const updatedBill = await db.get(`SELECT * FROM bills WHERE bill_id = ?`, [billId]);
  
  return {
    success: true,
    code: newStatus === 'verified' ? 'BILL_VERIFIED' : 'BILL_NEEDS_REVIEW',
    message: newStatus === 'verified' ? 'Bill verified successfully' : 'Bill needs review',
    bill: updatedBill,
    issues: issues
  };
}

async function manuallyAdjustBill(billId, adjustments, operator) {
  const bill = await db.get(`SELECT * FROM bills WHERE bill_id = ?`, [billId]);
  if (!bill) {
    return { success: false, code: 'BILL_NOT_FOUND', message: 'Bill not found' };
  }
  
  const current = bill;
  const newTotalEnergy = adjustments.total_energy !== undefined ? adjustments.total_energy : current.total_energy;
  const newTotalAmount = adjustments.total_amount !== undefined ? adjustments.total_amount : current.total_amount;
  
  await db.run(`
    UPDATE bills SET 
      total_energy = ?, total_amount = ?,
      peak_energy = ?, peak_amount = ?,
      flat_energy = ?, flat_amount = ?,
      valley_energy = ?, valley_amount = ?,
      reconciliation_status = 'manually_adjusted',
      updated_at = CURRENT_TIMESTAMP
    WHERE bill_id = ?
  `, [
    newTotalEnergy, newTotalAmount,
    adjustments.peak_energy ?? current.peak_energy,
    adjustments.peak_amount ?? current.peak_amount,
    adjustments.flat_energy ?? current.flat_energy,
    adjustments.flat_amount ?? current.flat_amount,
    adjustments.valley_energy ?? current.valley_energy,
    adjustments.valley_amount ?? current.valley_amount,
    billId
  ]);
  
  await db.run(`
    INSERT INTO reconciliation_logs (session_id, bill_id, action, details, operator)
    VALUES (?, ?, 'manual_adjustment', ?, ?)
  `, [bill.session_id, billId, JSON.stringify({ original: bill, adjustments }), operator]);
  
  const updatedBill = await db.get(`SELECT * FROM bills WHERE bill_id = ?`, [billId]);
  
  return {
    success: true,
    code: 'BILL_ADJUSTED',
    message: 'Bill adjusted manually',
    bill: updatedBill
  };
}

async function getSessionDetails(sessionId) {
  const session = await db.get(`SELECT * FROM charging_sessions WHERE session_id = ?`, [sessionId]);
  if (!session) return null;
  
  const statusHistory = await db.all(`
    SELECT * FROM session_status_history WHERE session_id = ? ORDER BY timestamp
  `, [sessionId]);
  
  const records = await db.all(`
    SELECT * FROM raw_charging_records WHERE session_id = ? ORDER BY timestamp
  `, [sessionId]);
  
  const slices = await db.all(`
    SELECT * FROM energy_slices WHERE session_id = ? ORDER BY start_time
  `, [sessionId]);
  
  const bill = await db.get(`SELECT * FROM bills WHERE session_id = ?`, [sessionId]);
  const logs = await db.all(`
    SELECT * FROM reconciliation_logs WHERE session_id = ? ORDER BY created_at
  `, [sessionId]);
  
  const currentStatus = statusHistory.length > 0 ? statusHistory[statusHistory.length - 1].status : null;
  
  return {
    session,
    currentStatus,
    statusHistory,
    records,
    slices,
    bill,
    reconciliationLogs: logs
  };
}

async function getDashboardStats(communityId) {
  const sessions = await db.get(`
    SELECT COUNT(*) as count FROM charging_sessions WHERE community_id = ?
  `, [communityId]);
  
  const bills = await db.get(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN reconciliation_status = 'verified' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN reconciliation_status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN reconciliation_status = 'needs_review' THEN 1 ELSE 0 END) as needs_review,
      SUM(CASE WHEN reconciliation_status = 'manually_adjusted' THEN 1 ELSE 0 END) as manually_adjusted,
      SUM(total_amount) as total_amount
    FROM bills WHERE community_id = ?
  `, [communityId]);
  
  const recentSessions = await db.all(`
    SELECT s.*, 
      (SELECT h.status FROM session_status_history h 
       WHERE h.session_id = s.session_id 
       ORDER BY h.timestamp DESC LIMIT 1) as current_status
    FROM charging_sessions s
    WHERE s.community_id = ?
    ORDER BY s.updated_at DESC
    LIMIT 10
  `, [communityId]);
  
  return {
    communityId,
    sessionCount: sessions ? sessions.count : 0,
    billStats: bills || { total: 0, verified: 0, pending: 0, needs_review: 0, manually_adjusted: 0, total_amount: 0 },
    recentSessions: recentSessions
  };
}

async function getTariffConfig(communityId) {
  return await getActiveTariffSync(db, communityId);
}

module.exports = {
  getActiveTariff: (communityId) => getActiveTariffSync(db, communityId),
  validateRecord,
  checkDuplicate: (requestId, sessionId) => checkDuplicateSync(db, requestId, sessionId),
  checkConflict: (record) => checkConflictSync(db, record),
  processRecord,
  generateBill,
  verifyBill,
  manuallyAdjustBill,
  getSessionDetails,
  getDashboardStats,
  getTariffConfig,
  getSessionStatus: (sessionId) => getSessionStatusSync(db, sessionId),
  isStatusTransitionValid
};
