const { getOne, getAll, runQuery, STATUS } = require('../db');
const dayjs = require('dayjs');

async function createMeter(meterData) {
  const result = await runQuery(
    `INSERT INTO meters (meter_no, meter_name, location, type, is_active) 
     VALUES (?, ?, ?, ?, ?)`,
    [meterData.meter_no, meterData.meter_name, meterData.location, meterData.type || 'electric', 1]
  );
  return getOne('SELECT * FROM meters WHERE id = ?', [result.lastID]);
}

async function getMeterByNo(meter_no) {
  return getOne('SELECT * FROM meters WHERE meter_no = ?', [meter_no]);
}

async function getMeterById(id) {
  return getOne('SELECT * FROM meters WHERE id = ?', [id]);
}

async function getAllMeters() {
  return getAll('SELECT * FROM meters ORDER BY created_at DESC');
}

async function replaceMeter(oldMeterNo, newMeterData) {
  const oldMeter = await getMeterByNo(oldMeterNo);
  if (!oldMeter) throw new Error('旧电表不存在');

  await runQuery(
    'UPDATE meters SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [oldMeter.id]
  );

  const result = await runQuery(
    `INSERT INTO meters (meter_no, meter_name, location, type, is_active, replaced_from, replace_time) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newMeterData.meter_no,
      newMeterData.meter_name || oldMeter.meter_name,
      newMeterData.location || oldMeter.location,
      newMeterData.type || oldMeter.type,
      1,
      oldMeter.id,
      dayjs().format('YYYY-MM-DD HH:mm:ss')
    ]
  );

  return getOne('SELECT * FROM meters WHERE id = ?', [result.lastID]);
}

async function addReading(meterId, readingValue, readingTime, collector = null) {
  const meter = await getMeterById(meterId);
  if (!meter) throw new Error('电表不存在');

  const result = await runQuery(
    `INSERT INTO meter_readings (meter_id, reading_value, reading_time, collector, is_valid) 
     VALUES (?, ?, ?, ?, ?)`,
    [meterId, readingValue, readingTime, collector, 1]
  );

  const reading = await getOne('SELECT * FROM meter_readings WHERE id = ?', [result.lastID]);
  
  const reviewResult = await detectAndCreateReview(meter, reading);
  
  return { reading, review: reviewResult };
}

async function detectAndCreateReview(meter, reading) {
  const previousReading = await getOne(
    `SELECT * FROM meter_readings 
     WHERE meter_id = ? AND id != ? AND is_valid = 1
     ORDER BY reading_time DESC, id DESC LIMIT 1`,
    [meter.id, reading.id]
  );

  const reviewData = {
    meter_id: meter.id,
    reading_id: reading.id,
    current_reading: reading.reading_value,
    current_reading_time: reading.reading_time,
    status: STATUS.NORMAL,
    anomaly_type: null,
    anomaly_detail: null
  };

  if (previousReading) {
    reviewData.previous_reading = previousReading.reading_value;
    reviewData.previous_reading_time = previousReading.reading_time;

    if (reading.reading_value < previousReading.reading_value) {
      if (meter.replaced_from) {
        reviewData.status = STATUS.PENDING_MANUAL;
        reviewData.anomaly_type = 'meter_replace_inversion';
        reviewData.anomaly_detail = `电表换表后读数倒挂：旧表读数(${previousReading.reading_value}) -> 新表读数(${reading.reading_value})，需人工核实换表底度和计费规则`;
      } else {
        reviewData.status = STATUS.ABNORMAL_PENDING;
        reviewData.anomaly_type = 'reading_inversion';
        reviewData.anomaly_detail = `读数倒挂：上一次读数(${previousReading.reading_value}) > 当前读数(${reading.reading_value})，请核实是否存在抄表错误或电表异常`;
      }
    }
  }

  if (reviewData.status !== STATUS.NORMAL) {
    return createReviewRecord(reviewData);
  }
  
  return null;
}

async function createReviewRecord(data) {
  const result = await runQuery(
    `INSERT INTO review_records 
     (meter_id, reading_id, status, review_note, reviewed_by, anomaly_type, anomaly_detail, 
      previous_reading, current_reading, previous_reading_time, current_reading_time) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.meter_id,
      data.reading_id,
      data.status,
      data.review_note || null,
      data.reviewed_by || null,
      data.anomaly_type,
      data.anomaly_detail,
      data.previous_reading || null,
      data.current_reading,
      data.previous_reading_time || null,
      data.current_reading_time
    ]
  );

  if (data.status !== STATUS.NORMAL) {
    await addReviewHistory(result.lastID, null, data.status, '系统自动检测异常', 'system');
  }

  return getOne(`
    SELECT r.*, m.meter_no, m.meter_name 
    FROM review_records r
    LEFT JOIN meters m ON r.meter_id = m.id
    WHERE r.id = ?
  `, [result.lastID]);
}

async function updateReviewStatus(reviewId, newStatus, note, reviewedBy) {
  const review = await getOne('SELECT * FROM review_records WHERE id = ?', [reviewId]);
  if (!review) throw new Error('复核记录不存在');

  const oldStatus = review.status;

  await runQuery(
    `UPDATE review_records 
     SET status = ?, review_note = ?, reviewed_by = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [newStatus, note, reviewedBy, reviewId]
  );

  await addReviewHistory(reviewId, oldStatus, newStatus, note, reviewedBy);

  return getOne(`
    SELECT r.*, m.meter_no, m.meter_name 
    FROM review_records r
    LEFT JOIN meters m ON r.meter_id = m.id
    WHERE r.id = ?
  `, [reviewId]);
}

async function addReviewHistory(reviewId, oldStatus, newStatus, changeNote, changedBy) {
  return runQuery(
    `INSERT INTO review_history (review_id, old_status, new_status, change_note, changed_by) 
     VALUES (?, ?, ?, ?, ?)`,
    [reviewId, oldStatus, newStatus, changeNote, changedBy]
  );
}

async function getReviewList(params = {}) {
  let sql = `
    SELECT r.*, m.meter_no, m.meter_name, m.location
    FROM review_records r
    LEFT JOIN meters m ON r.meter_id = m.id
    WHERE 1=1
  `;
  const queryParams = [];

  if (params.status) {
    sql += ' AND r.status = ?';
    queryParams.push(params.status);
  }
  if (params.meter_no) {
    sql += ' AND m.meter_no LIKE ?';
    queryParams.push(`%${params.meter_no}%`);
  }

  sql += ' ORDER BY r.created_at DESC';

  return getAll(sql, queryParams);
}

async function getReviewDetail(id) {
  const review = await getOne(`
    SELECT r.*, m.meter_no, m.meter_name, m.location
    FROM review_records r
    LEFT JOIN meters m ON r.meter_id = m.id
    WHERE r.id = ?
  `, [id]);

  if (review) {
    review.history = await getAll(
      'SELECT * FROM review_history WHERE review_id = ? ORDER BY created_at DESC',
      [id]
    );
  }

  return review;
}

async function getReadingByMeter(meterId) {
  return getAll(
    'SELECT * FROM meter_readings WHERE meter_id = ? ORDER BY reading_time DESC',
    [meterId]
  );
}

async function correctReading(readingId, newValue, reviewNote, reviewedBy) {
  const reading = await getOne('SELECT * FROM meter_readings WHERE id = ?', [readingId]);
  if (!reading) throw new Error('读数记录不存在');

  await runQuery(
    'UPDATE meter_readings SET reading_value = ?, is_valid = 0 WHERE id = ?',
    [reading.reading_value, readingId]
  );

  const result = await runQuery(
    `INSERT INTO meter_readings (meter_id, reading_value, reading_time, collector, is_valid) 
     VALUES (?, ?, ?, ?, ?)`,
    [reading.meter_id, newValue, reading.reading_time, reviewedBy, 1]
  );

  const reviews = await getAll(
    'SELECT id FROM review_records WHERE reading_id = ?',
    [readingId]
  );

  for (const review of reviews) {
    await updateReviewStatus(review.id, STATUS.CORRECTED, reviewNote, reviewedBy);
  }

  return getOne('SELECT * FROM meter_readings WHERE id = ?', [result.lastID]);
}

module.exports = {
  createMeter,
  getMeterByNo,
  getMeterById,
  getAllMeters,
  replaceMeter,
  addReading,
  detectAndCreateReview,
  createReviewRecord,
  updateReviewStatus,
  getReviewList,
  getReviewDetail,
  getReadingByMeter,
  correctReading
};
